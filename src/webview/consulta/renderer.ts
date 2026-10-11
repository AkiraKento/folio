import { apply } from '../shared/anchor';
import { sanitizeConsultaHtml } from './sanitize';
import type { ConsultaUnitWeb, UnitMenuAction } from './types';

/**
 * Formata o caminho do deck para exibição no cabeçalho de seção (ex: "CARDIOLOGIA › INSUFICIÊNCIA CARDÍACA").
 */
export function formatDeckPath(deckPath: string): string {
  if (!deckPath) return '';
  return deckPath
    .split('::')
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .join(' › ');
}

export interface RenderUnitOptions {
  previousDeckPath?: string;
  onMenuAction?: (action: UnitMenuAction, noteId: string, unitIndex: number) => void;
}

export interface RenderUnitResult {
  unitElement: HTMLElement;
  headerElement: HTMLElement | null;
  newDeckPath: string;
}

/**
 * Fecha qualquer menu de contexto aberto no container raiz.
 */
export function closeAllUnitMenus(root: Element): void {
  const existingDropdowns = root.querySelectorAll('.unit-menu-dropdown');
  existingDropdowns.forEach((dropdown) => dropdown.remove());
}

/**
 * Cria o menu contextual flutuante para a unidade.
 */
function createUnitMenuDropdown(
  unit: ConsultaUnitWeb,
  anchorButton: HTMLElement,
  onMenuAction?: (action: UnitMenuAction, noteId: string, unitIndex: number) => void
): HTMLElement {
  const dropdown = document.createElement('div');
  dropdown.className = 'unit-menu-dropdown';
  dropdown.setAttribute('role', 'menu');

  // Ação: Editar
  const editItem = document.createElement('button');
  editItem.type = 'button';
  editItem.className = 'unit-menu-item';
  editItem.textContent = 'Editar';
  editItem.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.remove();
    onMenuAction?.('edit', unit.noteId, unit.index);
  });
  dropdown.appendChild(editItem);

  // Ação: Revisar agora
  const reviewItem = document.createElement('button');
  reviewItem.type = 'button';
  reviewItem.className = 'unit-menu-item';
  reviewItem.textContent = 'Revisar agora';
  reviewItem.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.remove();
    onMenuAction?.('review', unit.noteId, unit.index);
  });
  dropdown.appendChild(reviewItem);

  // Ação: Suspender / Reativar
  const suspendItem = document.createElement('button');
  suspendItem.type = 'button';
  suspendItem.className = 'unit-menu-item';
  suspendItem.textContent = unit.suspended ? 'Reativar' : 'Suspender';
  suspendItem.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.remove();
    onMenuAction?.('toggleSuspend', unit.noteId, unit.index);
  });
  dropdown.appendChild(suspendItem);

  return dropdown;
}

/**
 * Renderiza uma unidade da Consulta com cabeçalho de seção (se o deck mudou),
 * frente esmaecida, verso em serifa, tags, anotações e menu ⋯.
 */
export function renderConsultaUnit(
  unit: ConsultaUnitWeb,
  options?: RenderUnitOptions
): RenderUnitResult {
  const previousDeckPath = options?.previousDeckPath;
  let headerElement: HTMLElement | null = null;

  // Cabeçalho de deck: só quando muda em relação à unidade anterior
  if (!previousDeckPath || previousDeckPath !== unit.deckPath) {
    headerElement = document.createElement('div');
    headerElement.className = 'deck-section-header';
    headerElement.dataset.deckPath = unit.deckPath;
    headerElement.textContent = formatDeckPath(unit.deckPath);
  }

  // Bloco da unidade
  const unitEl = document.createElement('article');
  unitEl.className = `consulta-unit ${unit.suspended ? 'suspended' : ''}`.trim();
  unitEl.dataset.unitIndex = String(unit.index);
  unitEl.dataset.noteId = unit.noteId;

  // Selo de suspenso (se aplicável)
  if (unit.suspended) {
    const badge = document.createElement('div');
    badge.className = 'suspended-badge';
    badge.textContent = 'suspenso';
    unitEl.appendChild(badge);
  }

  // Frente em fonte menor e esmaecida
  if (unit.frontHtml && unit.frontHtml.trim().length > 0) {
    const frontEl = document.createElement('div');
    frontEl.className = 'unit-front';
    frontEl.innerHTML = sanitizeConsultaHtml(unit.frontHtml);
    unitEl.appendChild(frontEl);
  }

  // Verso em serifa de leitura
  const backEl = document.createElement('div');
  backEl.className = 'unit-back';
  backEl.innerHTML = sanitizeConsultaHtml(unit.backHtml);

  // Aplica anotações no verso usando o algoritmo de âncora
  if (unit.annotations && unit.annotations.length > 0) {
    apply(backEl, unit.annotations);
  }
  unitEl.appendChild(backEl);

  // Metadados (tags e menu ⋯)
  const metaEl = document.createElement('div');
  metaEl.className = 'unit-meta';

  const tagsEl = document.createElement('div');
  tagsEl.className = 'unit-tags';

  if (unit.tags && unit.tags.length > 0) {
    for (const tag of unit.tags) {
      const cleanTag = tag.trim();
      if (!cleanTag) continue;
      const tagSpan = document.createElement('span');
      tagSpan.className = 'unit-tag';
      tagSpan.textContent = cleanTag.startsWith('#') ? cleanTag : `#${cleanTag}`;
      tagsEl.appendChild(tagSpan);
    }
  }
  metaEl.appendChild(tagsEl);

  // Botão ⋯ (alvo de toque mínimo de 44px)
  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'unit-menu-button';
  menuButton.setAttribute('aria-label', 'Opções da unidade');
  menuButton.textContent = '⋯';

  menuButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const isAlreadyOpen = Boolean(unitEl.querySelector('.unit-menu-dropdown'));
    closeAllUnitMenus(document.body);
    if (!isAlreadyOpen) {
      const dropdown = createUnitMenuDropdown(unit, menuButton, options?.onMenuAction);
      unitEl.appendChild(dropdown);
    }
  });

  metaEl.appendChild(menuButton);
  unitEl.appendChild(metaEl);

  return {
    unitElement: unitEl,
    headerElement,
    newDeckPath: unit.deckPath,
  };
}

/**
 * Renderiza um lote de unidades dentro de um container, gerenciando a transição
 * dos cabeçalhos de seção e retornando o último deckPath processado.
 */
export function renderUnitsBatch(
  container: HTMLElement,
  units: ConsultaUnitWeb[],
  options?: {
    lastDeckPath?: string;
    onMenuAction?: (action: UnitMenuAction, noteId: string, unitIndex: number) => void;
  }
): { lastDeckPath: string; renderedCount: number } {
  let currentDeckPath = options?.lastDeckPath ?? '';
  let count = 0;

  const fragment = document.createDocumentFragment();

  for (const unit of units) {
    const result = renderConsultaUnit(unit, {
      previousDeckPath: currentDeckPath,
      onMenuAction: options?.onMenuAction,
    });

    if (result.headerElement) {
      fragment.appendChild(result.headerElement);
    }
    fragment.appendChild(result.unitElement);

    currentDeckPath = result.newDeckPath;
    count++;
  }

  container.appendChild(fragment);

  return {
    lastDeckPath: currentDeckPath,
    renderedCount: count,
  };
}
