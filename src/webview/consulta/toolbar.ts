/**
 * Barra flutuante de seleção do Modo Consulta (MODO_CONSULTA.md §3).
 *
 * Ao selecionar texto dentro do verso de uma unidade:
 *   - Apresenta a barra flutuante acima da seleção (ou abaixo se estiver no topo);
 *   - Suprime o menu de contexto nativo do Android;
 *   - Oferece: 5 cores (●), sublinhar (U), nota (✎) e Copiar;
 *   - Ao tocar numa cor, grifa direto e salva a anotação;
 *   - Ao tocar em U, sublinha com a última cor usada e salva;
 *   - Ao tocar em ✎, permite digitar uma nota associada ao trecho e salva;
 *   - Ao tocar em Copiar, copia o texto para a área de transferência.
 */
import { describe, wrap, type AnnotationColor, type AnnotationKind } from '../shared/anchor';
import { strings } from '../../ui/strings';
import {
  ANNOTATION_COLORS,
  type AnnotationInput,
  type SavedAnnotation,
} from './protocol';
import type { ConsultaUnitWeb } from './types';

export interface SelectionToolbarOptions {
  rootEl: HTMLElement;
  doc: Document;
  win: Window;
  getUnits: () => readonly ConsultaUnitWeb[];
  getLastColor: () => AnnotationColor;
  onSaveAnnotation: (input: AnnotationInput) => Promise<SavedAnnotation>;
  onSetColor: (color: AnnotationColor) => void;
  onBeforeOpen?: () => void;
}

export interface SelectionToolbar {
  readonly element: HTMLElement;
  isVisible: () => boolean;
  hide: () => void;
  checkSelection: () => void;
  dispose: () => void;
}

interface ActiveSelectionState {
  unitIndex: number;
  noteId: string;
  groupKey: string | null;
  unitBackEl: HTMLElement;
  range: Range;
  start: number;
  end: number;
  quote: string;
  prefix: string;
  suffix: string;
}

const COLOR_NAMES: Record<AnnotationColor, string> = {
  amarelo: strings.consulta.colorYellow,
  verde: strings.consulta.colorGreen,
  azul: strings.consulta.colorBlue,
  rosa: strings.consulta.colorPink,
  laranja: strings.consulta.colorOrange,
};

function copyToClipboard(win: Window, doc: Document, text: string): void {
  if (win.navigator?.clipboard?.writeText) {
    win.navigator.clipboard.writeText(text).catch(() => {
      fallbackCopy(doc, text);
    });
  } else {
    fallbackCopy(doc, text);
  }
}

function fallbackCopy(doc: Document, text: string): void {
  const textarea = doc.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  doc.body.appendChild(textarea);
  textarea.select();
  try {
    doc.execCommand('copy');
  } catch {
    // Silently continue
  }
  textarea.remove();
}

/**
 * Valida se um Range está inteiramente contido dentro de um `.unit-back`.
 */
function getUnitBackInfo(
  range: Range,
  getUnits: () => readonly ConsultaUnitWeb[]
): {
  unitIndex: number;
  noteId: string;
  groupKey: string | null;
  unitBackEl: HTMLElement;
} | null {
  const common = range.commonAncestorContainer;
  const element = common.nodeType === 1 ? (common as Element) : common.parentElement;
  if (!element) return null;

  const unitBackEl = element.closest<HTMLElement>('.unit-back');
  if (!unitBackEl) return null;

  // Garante que o início e o fim da seleção estão dentro deste mesmo verso
  if (!unitBackEl.contains(range.startContainer) || !unitBackEl.contains(range.endContainer)) {
    return null;
  }

  const unitEl = unitBackEl.closest<HTMLElement>('.consulta-unit');
  if (!unitEl) return null;

  const unitIndexStr = unitEl.dataset.unitIndex;
  const noteId = unitEl.dataset.noteId;
  if (unitIndexStr === undefined || !noteId) return null;

  const unitIndex = parseInt(unitIndexStr, 10);
  const units = getUnits();
  const unitData = units.find((u) => u.index === unitIndex);
  const groupKey = unitData?.groupKey ?? null;

  return {
    unitIndex,
    noteId,
    groupKey,
    unitBackEl,
  };
}

export function createSelectionToolbar(options: SelectionToolbarOptions): SelectionToolbar {
  const { rootEl, doc, win, getUnits, getLastColor, onSaveAnnotation, onSetColor } = options;

  let activeState: ActiveSelectionState | null = null;
  let isNoteMode = false;
  let isSaving = false;
  let copyTimeout: ReturnType<typeof setTimeout> | null = null;
  let selectionCheckTimeout: ReturnType<typeof setTimeout> | null = null;

  // Criação do elemento DOM da barra
  const toolbarEl = doc.createElement('div');
  toolbarEl.className = 'selection-toolbar';
  toolbarEl.id = 'selection-toolbar';
  toolbarEl.style.display = 'none';
  rootEl.appendChild(toolbarEl);

  // Impede que o toque nos botões desfoque / desfaça a seleção do texto
  const preventBlur = (event: Event) => {
    // Permite foco interativo no input de texto quando em modo de nota
    const target = event.target as HTMLElement | null;
    if (target?.tagName === 'INPUT') return;
    event.preventDefault();
  };
  toolbarEl.addEventListener('pointerdown', preventBlur);
  toolbarEl.addEventListener('mousedown', preventBlur);

  function isVisible(): boolean {
    return toolbarEl.style.display !== 'none';
  }

  function hide(): void {
    if (copyTimeout) {
      clearTimeout(copyTimeout);
      copyTimeout = null;
    }
    isNoteMode = false;
    isSaving = false;
    activeState = null;
    toolbarEl.style.display = 'none';
    toolbarEl.innerHTML = '';
  }

  function clearWindowSelection(): void {
    try {
      const sel = win.getSelection();
      sel?.removeAllRanges();
    } catch {
      // Ignora erro em ambientes restritos
    }
  }

  function updatePosition(range: Range): void {
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    toolbarEl.style.display = 'flex';

    const scrollY = win.scrollY || win.pageYOffset || doc.documentElement.scrollTop || 0;
    const scrollX = win.scrollX || win.pageXOffset || doc.documentElement.scrollLeft || 0;
    const viewportWidth = win.innerWidth || doc.documentElement.clientWidth || 360;

    const toolbarRect = toolbarEl.getBoundingClientRect();
    const toolbarWidth = toolbarRect.width || 320;
    const toolbarHeight = toolbarRect.height || 48;
    const spacing = 10;

    // Tenta posicionar acima da seleção (MODO_CONSULTA.md §3)
    let top = rect.top + scrollY - toolbarHeight - spacing;

    // Se estiver muito próximo ao topo do viewport, posiciona abaixo da seleção
    if (rect.top - toolbarHeight - spacing < 8) {
      top = rect.bottom + scrollY + spacing;
    }

    // Centraliza horizontalmente sobre a seleção e delimita às bordas da tela
    let left = rect.left + scrollX + rect.width / 2 - toolbarWidth / 2;
    const minLeft = scrollX + 10;
    const maxLeft = scrollX + viewportWidth - toolbarWidth - 10;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    toolbarEl.style.top = `${Math.round(top)}px`;
    toolbarEl.style.left = `${Math.round(left)}px`;
  }

  async function handleApplyAnnotation(
    kind: AnnotationKind,
    color: AnnotationColor,
    noteText = ''
  ): Promise<void> {
    if (!activeState || isSaving) return;
    isSaving = true;
    toolbarEl.style.pointerEvents = 'none';

    const { unitIndex, noteId, groupKey, unitBackEl, start, end, quote, prefix, suffix } =
      activeState;

    const input: AnnotationInput = {
      note_id: noteId,
      group_key: groupKey,
      kind,
      color,
      quote,
      prefix,
      suffix,
      start,
      end,
      note: noteText,
    };

    try {
      const saved = await onSaveAnnotation(input);

      // Aplica a decoração diretamente no verso usando wrap (§5)
      wrap(unitBackEl, start, end, saved);

      // Atualiza o estado em memória da unidade correspondente
      const units = getUnits();
      const unit = units.find((u) => u.index === unitIndex);
      if (unit) {
        unit.annotations.push(saved);
      }

      clearWindowSelection();
      hide();
    } catch {
      // Em caso de falha de comunicação, reabilita a barra
      toolbarEl.style.pointerEvents = 'auto';
      isSaving = false;
    }
  }

  function renderStandardToolbar(): void {
    toolbarEl.innerHTML = '';
    const lastColor = getLastColor();

    // 1. As 5 cores de grifo
    for (const color of ANNOTATION_COLORS) {
      const colorBtn = doc.createElement('button');
      colorBtn.type = 'button';
      colorBtn.className = `toolbar-btn toolbar-color-btn ${color === lastColor ? 'active' : ''}`.trim();
      colorBtn.dataset.color = color;
      colorBtn.setAttribute('aria-label', COLOR_NAMES[color]);

      const dot = doc.createElement('span');
      dot.className = `toolbar-color-dot color-${color}`;
      colorBtn.appendChild(dot);

      colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onSetColor(color);
        void handleApplyAnnotation('hl', color, '');
      });

      toolbarEl.appendChild(colorBtn);
    }

    // Divisor visual
    const divider = doc.createElement('div');
    divider.className = 'toolbar-divider';
    toolbarEl.appendChild(divider);

    // 2. Sublinhar (U)
    const underlineBtn = doc.createElement('button');
    underlineBtn.type = 'button';
    underlineBtn.className = 'toolbar-btn toolbar-underline-btn';
    underlineBtn.setAttribute('aria-label', strings.consulta.toolbarUnderline);
    const uSpan = doc.createElement('span');
    uSpan.className = 'toolbar-u-icon';
    uSpan.textContent = 'U';
    underlineBtn.appendChild(uSpan);

    underlineBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      void handleApplyAnnotation('ul', getLastColor(), '');
    });
    toolbarEl.appendChild(underlineBtn);

    // 3. Nota (✎)
    const noteBtn = doc.createElement('button');
    noteBtn.type = 'button';
    noteBtn.className = 'toolbar-btn toolbar-note-btn';
    noteBtn.setAttribute('aria-label', strings.consulta.toolbarNote);
    const noteSpan = doc.createElement('span');
    noteSpan.className = 'toolbar-note-icon';
    noteSpan.textContent = '✎';
    noteBtn.appendChild(noteSpan);

    noteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      renderNoteMode();
    });
    toolbarEl.appendChild(noteBtn);

    // 4. Copiar
    const copyBtn = doc.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'toolbar-btn toolbar-copy-btn';
    copyBtn.setAttribute('aria-label', strings.consulta.toolbarCopy);
    const copySpan = doc.createElement('span');
    copySpan.className = 'toolbar-copy-text';
    copySpan.textContent = strings.consulta.toolbarCopy;
    copyBtn.appendChild(copySpan);

    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!activeState) return;
      copyToClipboard(win, doc, activeState.quote);
      copySpan.textContent = strings.consulta.toolbarCopied;

      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        clearWindowSelection();
        hide();
      }, 400);
    });
    toolbarEl.appendChild(copyBtn);
  }

  function renderNoteMode(): void {
    isNoteMode = true;
    toolbarEl.innerHTML = '';

    const form = doc.createElement('div');
    form.className = 'toolbar-note-form';

    const input = doc.createElement('input');
    input.type = 'text';
    input.className = 'toolbar-note-input';
    input.placeholder = strings.consulta.toolbarNotePlaceholder;
    input.setAttribute('aria-label', strings.consulta.toolbarNotePlaceholder);

    const saveBtn = doc.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'toolbar-btn toolbar-note-save-btn';
    saveBtn.setAttribute('aria-label', strings.consulta.toolbarSave);
    saveBtn.textContent = '✓';

    const cancelBtn = doc.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'toolbar-btn toolbar-note-cancel-btn';
    cancelBtn.setAttribute('aria-label', strings.consulta.toolbarCancel);
    cancelBtn.textContent = '✕';

    const submit = () => {
      const noteText = input.value.trim();
      void handleApplyAnnotation('hl', getLastColor(), noteText);
    };

    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      submit();
    });

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isNoteMode = false;
      renderStandardToolbar();
      if (activeState) updatePosition(activeState.range);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        isNoteMode = false;
        renderStandardToolbar();
        if (activeState) updatePosition(activeState.range);
      }
    });

    form.appendChild(input);
    form.appendChild(saveBtn);
    form.appendChild(cancelBtn);
    toolbarEl.appendChild(form);

    if (activeState) {
      updatePosition(activeState.range);
    }
    input.focus();
  }

  function checkSelection(): void {
    if (isNoteMode || isSaving) return;

    const selection = win.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      if (isVisible()) hide();
      return;
    }

    const range = selection.getRangeAt(0);
    const unitInfo = getUnitBackInfo(range, getUnits);

    if (!unitInfo) {
      if (isVisible()) hide();
      return;
    }

    const described = describe(unitInfo.unitBackEl, range);
    if (!described || !described.quote) {
      if (isVisible()) hide();
      return;
    }

    activeState = {
      unitIndex: unitInfo.unitIndex,
      noteId: unitInfo.noteId,
      groupKey: unitInfo.groupKey,
      unitBackEl: unitInfo.unitBackEl,
      range,
      start: described.start,
      end: described.end,
      quote: described.quote,
      prefix: described.prefix,
      suffix: described.suffix,
    };

    options.onBeforeOpen?.();
    renderStandardToolbar();
    updatePosition(range);
  }

  const debouncedCheckSelection = () => {
    if (selectionCheckTimeout) clearTimeout(selectionCheckTimeout);
    selectionCheckTimeout = setTimeout(() => {
      checkSelection();
    }, 120);
  };

  // Suprime o menu nativo do Android para não sobrepor a barra (MODO_CONSULTA.md §3)
  const onContextMenu = (event: Event) => {
    const selection = win.getSelection();
    if (selection && !selection.isCollapsed) {
      event.preventDefault();
      checkSelection();
    }
  };

  const onScroll = () => {
    if (activeState && isVisible()) {
      updatePosition(activeState.range);
    }
  };

  const onPointerDownOutside = (event: Event) => {
    const target = event.target as Node | null;
    if (target && toolbarEl.contains(target)) return;
    if (isVisible() && !isSaving) {
      // Se clicou fora da barra e não há seleção ativa, fecha
      const selection = win.getSelection();
      if (!selection || selection.isCollapsed) {
        hide();
      }
    }
  };

  doc.addEventListener('selectionchange', debouncedCheckSelection);
  doc.addEventListener('contextmenu', onContextMenu);
  doc.addEventListener('pointerdown', onPointerDownOutside);
  doc.addEventListener('mousedown', onPointerDownOutside);
  win.addEventListener('scroll', onScroll, { passive: true });

  return {
    element: toolbarEl,
    isVisible,
    hide,
    checkSelection,
    dispose() {
      if (selectionCheckTimeout) clearTimeout(selectionCheckTimeout);
      if (copyTimeout) clearTimeout(copyTimeout);
      doc.removeEventListener('selectionchange', debouncedCheckSelection);
      doc.removeEventListener('contextmenu', onContextMenu);
      doc.removeEventListener('pointerdown', onPointerDownOutside);
      doc.removeEventListener('mousedown', onPointerDownOutside);
      win.removeEventListener('scroll', onScroll);
      toolbarEl.remove();
    },
  };
}
