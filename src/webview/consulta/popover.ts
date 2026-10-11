/**
 * Popover do grifo do Modo Consulta (MODO_CONSULTA.md §3).
 *
 * Ao tocar num grifo existente no verso de uma unidade:
 *   - Apresenta popover posicionado sobre o trecho com:
 *     1. Troca de cor (as 5 cores de grifo);
 *     2. Alternar grifo / sublinhado;
 *     3. Campo de nota (salva ao fechar);
 *     4. Apagar (remove do DOM, soft delete no banco e notifica para exibir Snackbar Desfazer).
 *   - Permite restaurar o grifo no DOM caso a ação seja desfeita no app.
 */
import {
  decorate,
  locate,
  unwrap,
  wrap,
  type AnnotationColor,
  type AnnotationKind,
} from '../shared/anchor';
import { strings } from '../../ui/strings';
import {
  ANNOTATION_COLORS,
  type AnnotationInput,
  type SavedAnnotation,
} from './protocol';
import type { ConsultaUnitWeb } from './types';

export interface HighlightPopoverOptions {
  rootEl: HTMLElement;
  doc: Document;
  win: Window;
  getUnits: () => readonly ConsultaUnitWeb[];
  onSaveAnnotation: (input: AnnotationInput) => Promise<SavedAnnotation>;
  onDeleteAnnotation: (id: string) => Promise<boolean>;
  onSetColor: (color: AnnotationColor) => void;
  onAnnotationDeleted?: (annotation: SavedAnnotation, unitIndex: number) => void;
  onBeforeOpen?: () => void;
}

export interface HighlightPopover {
  readonly element: HTMLElement;
  isVisible: () => boolean;
  hide: () => void;
  show: (markEl: HTMLElement) => void;
  restore: (unitIndex: number, annotation: SavedAnnotation) => void;
  dispose: () => void;
}

interface ActiveAnnotationState {
  unitIndex: number;
  noteId: string;
  unitBackEl: HTMLElement;
  annotation: SavedAnnotation;
  targetEl: HTMLElement;
  initialNote: string;
}

const COLOR_NAMES: Record<AnnotationColor, string> = {
  amarelo: strings.consulta.colorYellow,
  verde: strings.consulta.colorGreen,
  azul: strings.consulta.colorBlue,
  rosa: strings.consulta.colorPink,
  laranja: strings.consulta.colorOrange,
};

export function createHighlightPopover(options: HighlightPopoverOptions): HighlightPopover {
  const {
    rootEl,
    doc,
    win,
    getUnits,
    onSaveAnnotation,
    onDeleteAnnotation,
    onSetColor,
    onAnnotationDeleted,
    onBeforeOpen,
  } = options;

  let activeState: ActiveAnnotationState | null = null;
  let noteInputEl: HTMLInputElement | null = null;

  // Elemento DOM do Popover
  const popoverEl = doc.createElement('div');
  popoverEl.className = 'highlight-popover';
  popoverEl.id = 'highlight-popover';
  popoverEl.style.display = 'none';
  popoverEl.setAttribute('role', 'dialog');
  popoverEl.setAttribute('aria-label', 'Opções do grifo');
  rootEl.appendChild(popoverEl);

  // Evita desfoque indesejado ao interagir com botões
  const preventBlur = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
    event.preventDefault();
  };
  popoverEl.addEventListener('pointerdown', preventBlur);
  popoverEl.addEventListener('mousedown', preventBlur);

  function isVisible(): boolean {
    return popoverEl.style.display !== 'none';
  }

  function saveNoteIfChanged(): void {
    if (!activeState || !noteInputEl) return;
    const currentText = noteInputEl.value.trim();
    if (currentText !== activeState.initialNote) {
      activeState.annotation.note = currentText;
      activeState.initialNote = currentText;

      // Atualiza o DOM imediatamente (adiciona/remove ✎)
      decorate(activeState.unitBackEl, activeState.annotation);

      // Persiste via bridge
      const input: AnnotationInput = {
        id: activeState.annotation.id,
        note_id: activeState.noteId,
        group_key: activeState.annotation.group_key,
        kind: activeState.annotation.kind,
        color: activeState.annotation.color,
        quote: activeState.annotation.quote,
        prefix: activeState.annotation.prefix,
        suffix: activeState.annotation.suffix,
        start: activeState.annotation.start,
        end: activeState.annotation.end,
        note: currentText,
        label: activeState.annotation.label,
      };
      void onSaveAnnotation(input);
    }
  }

  function hide(): void {
    if (activeState) {
      saveNoteIfChanged();
    }
    activeState = null;
    noteInputEl = null;
    popoverEl.style.display = 'none';
    popoverEl.innerHTML = '';
  }

  function updatePosition(targetEl: HTMLElement): void {
    popoverEl.style.display = 'flex';

    const rect = targetEl.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const scrollY = win.scrollY || win.pageYOffset || doc.documentElement.scrollTop || 0;
    const scrollX = win.scrollX || win.pageXOffset || doc.documentElement.scrollLeft || 0;
    const viewportWidth = win.innerWidth || doc.documentElement.clientWidth || 360;

    const popoverRect = popoverEl.getBoundingClientRect();
    const popoverWidth = popoverRect.width || 320;
    const popoverHeight = popoverRect.height || 96;
    const spacing = 8;

    // Posiciona preferencialmente acima do grifo
    let top = rect.top + scrollY - popoverHeight - spacing;

    // Se estiver muito próximo ao topo do viewport, posiciona abaixo
    if (rect.top - popoverHeight - spacing < 8) {
      top = rect.bottom + scrollY + spacing;
    }

    // Centraliza horizontalmente e delimita às bordas
    let left = rect.left + scrollX + rect.width / 2 - popoverWidth / 2;
    const minLeft = scrollX + 10;
    const maxLeft = scrollX + viewportWidth - popoverWidth - 10;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    popoverEl.style.top = `${Math.round(top)}px`;
    popoverEl.style.left = `${Math.round(left)}px`;
  }

  function renderPopoverContent(state: ActiveAnnotationState): void {
    popoverEl.innerHTML = '';
    const { annotation, unitBackEl } = state;

    // Linha 1: 5 cores + Divisor + Alternar Grifo/Sublinhado + Divisor + Apagar
    const mainRow = doc.createElement('div');
    mainRow.className = 'popover-main-row';

    // 1. As 5 cores
    for (const color of ANNOTATION_COLORS) {
      const colorBtn = doc.createElement('button');
      colorBtn.type = 'button';
      colorBtn.className = `popover-btn popover-color-btn ${
        color === annotation.color ? 'active' : ''
      }`.trim();
      colorBtn.dataset.color = color;
      colorBtn.setAttribute('aria-label', COLOR_NAMES[color]);

      const dot = doc.createElement('span');
      dot.className = `popover-color-dot color-${color}`;
      colorBtn.appendChild(dot);

      colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (annotation.color === color) return;

        annotation.color = color;
        onSetColor(color);

        // Atualiza a seleção visual das cores
        const allColorBtns = mainRow.querySelectorAll('.popover-color-btn');
        allColorBtns.forEach((btn) => btn.classList.remove('active'));
        colorBtn.classList.add('active');

        // Atualiza no DOM e persiste
        decorate(unitBackEl, annotation);

        const input: AnnotationInput = {
          id: annotation.id,
          note_id: state.noteId,
          group_key: annotation.group_key,
          kind: annotation.kind,
          color,
          quote: annotation.quote,
          prefix: annotation.prefix,
          suffix: annotation.suffix,
          start: annotation.start,
          end: annotation.end,
          note: annotation.note,
          label: annotation.label,
        };
        void onSaveAnnotation(input);
      });

      mainRow.appendChild(colorBtn);
    }

    // Divisor visual
    const divider1 = doc.createElement('div');
    divider1.className = 'popover-divider';
    mainRow.appendChild(divider1);

    // 2. Alternar Grifo / Sublinhado
    const toggleBtn = doc.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = `popover-btn popover-toggle-btn ${
      annotation.kind === 'ul' ? 'is-ul' : ''
    }`.trim();
    toggleBtn.setAttribute(
      'aria-label',
      annotation.kind === 'ul' ? strings.consulta.popoverHighlight : strings.consulta.popoverUnderline
    );
    toggleBtn.textContent = 'U';

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newKind: AnnotationKind = annotation.kind === 'hl' ? 'ul' : 'hl';
      annotation.kind = newKind;
      toggleBtn.classList.toggle('is-ul', newKind === 'ul');
      toggleBtn.setAttribute(
        'aria-label',
        newKind === 'ul' ? strings.consulta.popoverHighlight : strings.consulta.popoverUnderline
      );

      decorate(unitBackEl, annotation);

      const input: AnnotationInput = {
        id: annotation.id,
        note_id: state.noteId,
        group_key: annotation.group_key,
        kind: newKind,
        color: annotation.color,
        quote: annotation.quote,
        prefix: annotation.prefix,
        suffix: annotation.suffix,
        start: annotation.start,
        end: annotation.end,
        note: annotation.note,
        label: annotation.label,
      };
      void onSaveAnnotation(input);
    });
    mainRow.appendChild(toggleBtn);

    // Divisor visual
    const divider2 = doc.createElement('div');
    divider2.className = 'popover-divider';
    mainRow.appendChild(divider2);

    // 3. Apagar
    const deleteBtn = doc.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'popover-btn popover-delete-btn';
    deleteBtn.setAttribute('aria-label', strings.consulta.popoverDelete);
    deleteBtn.textContent = '🗑';

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetAnnotation = { ...annotation };
      const unitIndex = state.unitIndex;

      // Remove do DOM
      unwrap(unitBackEl, annotation.id);

      // Remove da memória da unidade
      const units = getUnits();
      const unit = units.find((u) => u.index === unitIndex);
      if (unit) {
        const idx = unit.annotations.findIndex((a) => a.id === annotation.id);
        if (idx >= 0) unit.annotations.splice(idx, 1);
      }

      // Fecha o popover sem salvar nota
      activeState = null;
      hide();

      // Soft delete e notificação para o app RN exibir Snackbar
      void onDeleteAnnotation(targetAnnotation.id);
      onAnnotationDeleted?.(targetAnnotation, unitIndex);
    });
    mainRow.appendChild(deleteBtn);

    popoverEl.appendChild(mainRow);

    // Linha 2: Campo de Nota
    const noteRow = doc.createElement('div');
    noteRow.className = 'popover-note-row';

    const noteInput = doc.createElement('input');
    noteInput.type = 'text';
    noteInput.className = 'popover-note-input';
    noteInput.value = annotation.note || '';
    noteInput.placeholder = strings.consulta.toolbarNotePlaceholder;
    noteInput.setAttribute('aria-label', strings.consulta.toolbarNotePlaceholder);

    noteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveNoteIfChanged();
        hide();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hide();
      }
    });

    noteInput.addEventListener('blur', () => {
      saveNoteIfChanged();
    });

    noteRow.appendChild(noteInput);
    popoverEl.appendChild(noteRow);

    noteInputEl = noteInput;
  }

  function show(markEl: HTMLElement): void {
    const aid = markEl.getAttribute('data-aid');
    if (!aid) return;

    const unitEl = markEl.closest<HTMLElement>('.consulta-unit');
    const unitBackEl = markEl.closest<HTMLElement>('.unit-back');
    if (!unitEl || !unitBackEl) return;

    const unitIndexStr = unitEl.dataset.unitIndex;
    const noteId = unitEl.dataset.noteId;
    if (unitIndexStr === undefined || !noteId) return;

    const unitIndex = parseInt(unitIndexStr, 10);
    const units = getUnits();
    const unit = units.find((u) => u.index === unitIndex);
    if (!unit) return;

    const annotation = unit.annotations.find((a) => a.id === aid);
    if (!annotation) return;

    onBeforeOpen?.();

    // Se já havia um popover aberto, fecha e salva antes
    if (activeState) {
      saveNoteIfChanged();
    }

    const nextState: ActiveAnnotationState = {
      unitIndex,
      noteId,
      unitBackEl,
      annotation: {
        ...annotation,
        note_id: annotation.note_id || noteId,
        group_key: annotation.group_key ?? null,
        created_at: (annotation as SavedAnnotation).created_at || Date.now(),
        updated_at: (annotation as SavedAnnotation).updated_at || Date.now(),
        prefix: annotation.prefix || '',
        suffix: annotation.suffix || '',
        start: annotation.start || 0,
        end: annotation.end || 0,
        note: annotation.note || '',
        label: annotation.label || '',
      },
      targetEl: markEl,
      initialNote: annotation.note || '',
    };
    activeState = nextState;

    renderPopoverContent(nextState);
    updatePosition(markEl);
  }

  function restore(unitIndex: number, annotation: SavedAnnotation): void {
    const units = getUnits();
    const unit = units.find((u) => u.index === unitIndex);
    const unitEl = rootEl.querySelector<HTMLElement>(`.consulta-unit[data-unit-index="${unitIndex}"]`);
    if (!unitEl) return;

    const unitBackEl = unitEl.querySelector<HTMLElement>('.unit-back');
    if (!unitBackEl) return;

    // Encontra a posição do trecho
    const loc = locate(unitBackEl, annotation);
    const start = loc ? loc[0] : annotation.start;
    const end = loc ? loc[1] : annotation.end;

    // Recoloca na memória se não estiver
    if (unit) {
      const existing = unit.annotations.find((a) => a.id === annotation.id);
      if (!existing) {
        unit.annotations.push(annotation);
      }
    }

    // Aplica no DOM
    const marks = wrap(unitBackEl, start, end, annotation);

    // Efeito visual temporário de piscar no grifo restaurado
    for (const m of marks) {
      m.classList.add('ann-flash');
      setTimeout(() => {
        m.classList.remove('ann-flash');
      }, 1600);
    }
  }

  // Detecta toque/clique em grifos no documento
  const onDocumentClick = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Se clicou dentro do popover, ignora
    if (popoverEl.contains(target)) return;

    // Verifica se há seleção ativa no texto (prioridade para a barra de seleção)
    const sel = win.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
      if (isVisible()) hide();
      return;
    }

    // Verifica se clicou num elemento <mark> de anotação
    const markEl = target.closest<HTMLElement>('mark.ann, mark.cq-mark');
    if (markEl && rootEl.contains(markEl)) {
      event.stopPropagation();
      show(markEl);
      return;
    }

    // Clicou fora de qualquer grifo e fora do popover: fecha
    if (isVisible()) {
      hide();
    }
  };

  const onScroll = () => {
    if (activeState && isVisible()) {
      updatePosition(activeState.targetEl);
    }
  };

  doc.addEventListener('click', onDocumentClick);
  win.addEventListener('scroll', onScroll, { passive: true });

  return {
    element: popoverEl,
    isVisible,
    hide,
    show,
    restore,
    dispose() {
      doc.removeEventListener('click', onDocumentClick);
      win.removeEventListener('scroll', onScroll);
      popoverEl.remove();
    },
  };
}
