/**
 * Posição de leitura e navegação dentro da lista da Consulta.
 * Roda dentro da WebView (DOM puro, sem React Native).
 */
import { marksOf } from '../shared/anchor';

export interface ReadingPosition {
  unitIndex: number;
  /** Quantos px do topo da unidade já passaram do topo da tela. */
  offset: number;
}

const UNIT_SELECTOR = '.consulta-unit';

function unitIndexOf(el: HTMLElement): number {
  return Number(el.dataset.unitIndex);
}

/**
 * Primeira unidade visível no topo da tela e o deslocamento dentro dela.
 * As unidades estão no DOM em ordem, então a borda de baixo cresce de forma
 * monótona: busca binária, para não varrer 5.000 elementos a cada rolagem.
 */
export function computeReadingPosition(list: ParentNode): ReadingPosition | null {
  const units = list.querySelectorAll<HTMLElement>(UNIT_SELECTOR);
  if (units.length === 0) return null;

  let lo = 0;
  let hi = units.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (units[mid].getBoundingClientRect().bottom > 0) {
      found = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  // Rolou além da última unidade: fica na última.
  const el = units[found === -1 ? units.length - 1 : found];
  const top = el.getBoundingClientRect().top;
  const index = unitIndexOf(el);
  if (!Number.isFinite(index)) return null;

  return { unitIndex: index, offset: Math.max(0, Math.round(-top)) };
}

export function findUnitElement(list: ParentNode, unitIndex: number): HTMLElement | null {
  if (!Number.isInteger(unitIndex)) return null;
  return list.querySelector<HTMLElement>(`${UNIT_SELECTOR}[data-unit-index="${unitIndex}"]`);
}

export interface ScrollTarget {
  unitIndex: number;
  annotationId?: string;
  /** Deslocamento dentro da unidade (para "Continuar lendo"). */
  offset?: number;
}

const FLASH_CLASS = 'ann-flash';
const FLASH_MS = 1600;

/**
 * Rola até a unidade (ou até o grifo, se houver) e pisca o grifo.
 * Retorna `false` se a unidade ainda não está no DOM.
 */
export function scrollToTarget(win: Window, list: ParentNode, target: ScrollTarget): boolean {
  const unitEl = findUnitElement(list, target.unitIndex);
  if (!unitEl) return false;

  const marks = target.annotationId ? Array.from(marksOf(unitEl, target.annotationId)) : [];
  const anchorEl = marks[0] ?? unitEl;
  const currentY = win.scrollY || win.pageYOffset || 0;
  const rectTop = anchorEl.getBoundingClientRect().top;

  let y: number;
  if (marks.length > 0) {
    // Grifo a ~1/3 da altura da tela, para dar contexto acima.
    y = currentY + rectTop - (win.innerHeight || 0) / 3;
  } else {
    y = currentY + rectTop + (target.offset ?? 0);
  }
  win.scrollTo(0, Math.max(0, Math.round(y)));

  if (marks.length > 0) {
    for (const m of marks) m.classList.add(FLASH_CLASS);
    win.setTimeout(() => {
      for (const m of marks) m.classList.remove(FLASH_CLASS);
    }, FLASH_MS);
  }
  return true;
}

/** Debounce simples, com `flush` para gravar a posição ao sair. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number
): ((...args: A) => void) & { flush: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;

  const run = () => {
    timer = null;
    const args = lastArgs ?? ([] as unknown as A);
    lastArgs = null;
    fn(...args);
  };

  const debounced = (...args: A) => {
    lastArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(run, waitMs);
  };
  debounced.flush = () => {
    if (timer !== null) clearTimeout(timer);
    run();
  };
  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };
  return debounced;
}
