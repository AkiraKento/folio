/**
 * Controlador da WebView da Consulta: monta o DOM, fala com o React Native
 * pela ponte tipada (§8) e mantém o estado da lista.
 *
 * Separado do `index.ts` (que só faz o boot) para poder ser testado no jsdom
 * com um endpoint "RN" de verdade do outro lado.
 */
import type { AnnotationColor } from '../shared/anchor';
import { createBridgeEndpoint, type BridgeEndpoint } from '../shared/bridge';
import { BASE_CONSULTA_STYLES } from './styles';
import { renderUnitsBatch, renderConsultaUnit, closeAllUnitMenus } from './renderer';
import { createSelectionToolbar, type SelectionToolbar } from './toolbar';
import { createHighlightPopover, type HighlightPopover } from './popover';
import {
  computeReadingPosition,
  debounce,
  scrollToTarget,
  type ScrollTarget,
} from './navigation';
import {
  POSITION_DEBOUNCE_MS,
  type AnnotationInput,
  type ConsultaInitPayload,
  type RnToWebEvents,
  type RnToWebRequests,
  type SavedAnnotation,
  type WebToRnEvents,
  type WebToRnRequests,
} from './protocol';
import type {
  ConsultaInitialData,
  ConsultaTheme,
  ConsultaUnitWeb,
  UnitMenuAction,
} from './types';

export type ConsultaWebBridge = BridgeEndpoint<
  WebToRnEvents,
  WebToRnRequests,
  RnToWebEvents,
  RnToWebRequests
>;

export interface ConsultaAppOptions {
  /** Elemento onde a Consulta é montada (`#root`). */
  mountRoot: HTMLElement;
  /** Janela (para rolagem e eventos). */
  win: Window;
  /** Envia para o React Native. */
  post: (raw: string) => void;
  /** Dados pré-injetados para a primeira pintura. */
  initialData?: ConsultaInitialData;
  /** Timeout dos requests. */
  timeoutMs?: number;
}

export interface ConsultaApp {
  readonly bridge: ConsultaWebBridge;
  readonly toolbar: SelectionToolbar;
  readonly popover: HighlightPopover;
  /** Entrega uma mensagem vinda do React Native. */
  receive(raw: unknown): void;
  /** Configuração de leitura atual. */
  getSettings(): ConsultaInitPayload;
  /** Unidades atualmente no DOM. */
  getUnits(): readonly ConsultaUnitWeb[];
  /** Grava (cria ou atualiza) uma anotação no app. */
  saveAnnotation(input: AnnotationInput): Promise<SavedAnnotation>;
  deleteAnnotation(id: string): Promise<boolean>;
  restoreAnnotation(id: string): Promise<boolean>;
  /** Avisa o app da última cor usada. */
  setColor(color: AnnotationColor): void;
  /** Avisa o app do tamanho de fonte escolhido aqui dentro. */
  setFont(fontSize: number): void;
  /** Envia a posição de leitura imediatamente (ao sair). */
  flushPosition(): void;
  dispose(): void;
}

const DEFAULT_SETTINGS: ConsultaInitPayload = {
  theme: 'light',
  fontSize: 17,
  lastColor: 'amarelo',
  showFront: true,
};

export function createConsultaApp(options: ConsultaAppOptions): ConsultaApp {
  const { mountRoot, win } = options;
  const doc = mountRoot.ownerDocument;

  let settings: ConsultaInitPayload = { ...DEFAULT_SETTINGS };
  let renderedUnits: ConsultaUnitWeb[] = [];
  let lastDeckPath = '';
  let hasMoreUnits = false;
  let isLoadingMore = false;
  let pendingGoto: ScrollTarget | null = null;
  const cleanups: (() => void)[] = [];

  const bridge: ConsultaWebBridge = createBridgeEndpoint({
    side: 'web',
    post: options.post,
    timeoutMs: options.timeoutMs,
  });

  // --- DOM -----------------------------------------------------------------

  mountRoot.innerHTML = `
    <div class="consulta-root theme-light" id="consulta-root">
      <style id="consulta-base-styles">${BASE_CONSULTA_STYLES}</style>
      <main class="consulta-container" id="consulta-container">
        <div id="units-list"></div>
        <div id="scroll-sentinel" class="scroll-sentinel" style="display: none;">Carregando mais unidades...</div>
      </main>
    </div>
  `;

  const rootEl = mountRoot.querySelector<HTMLElement>('#consulta-root')!;
  const listEl = mountRoot.querySelector<HTMLElement>('#units-list')!;
  const sentinelEl = mountRoot.querySelector<HTMLElement>('#scroll-sentinel')!;

  const toolbar = createSelectionToolbar({
    rootEl,
    doc,
    win,
    getUnits: () => renderedUnits,
    getLastColor: () => settings.lastColor,
    onSaveAnnotation: (input) => bridge.request('saveAnnotation', input),
    onSetColor: (color) => {
      settings = { ...settings, lastColor: color };
      bridge.emit('setColor', color);
    },
    onBeforeOpen: () => {
      popover.hide();
    },
  });
  cleanups.push(() => toolbar.dispose());

  const popover = createHighlightPopover({
    rootEl,
    doc,
    win,
    getUnits: () => renderedUnits,
    onSaveAnnotation: (input) => bridge.request('saveAnnotation', input),
    onDeleteAnnotation: async (id) => (await bridge.request('deleteAnnotation', { id })).ok,
    onSetColor: (color) => {
      settings = { ...settings, lastColor: color };
      bridge.emit('setColor', color);
    },
    onAnnotationDeleted: (annotation, unitIndex) => {
      bridge.emit('annotationDeleted', { annotation, unitIndex });
    },
    onBeforeOpen: () => {
      toolbar.hide();
    },
  });
  cleanups.push(() => popover.dispose());

  function reportError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    bridge.emit('error', { message });
  }

  // --- Configuração de leitura ---------------------------------------------

  function applyTheme(theme: ConsultaTheme): void {
    settings = { ...settings, theme };
    rootEl.classList.remove('theme-light', 'theme-dark');
    rootEl.classList.add(`theme-${theme}`);
  }

  function applyFontSize(fontSize: number): void {
    const clamped = Math.max(14, Math.min(26, fontSize));
    settings = { ...settings, fontSize: clamped };
    rootEl.style.setProperty('--consulta-font-size', `${clamped}px`);
  }

  function applySettings(next: Partial<ConsultaInitPayload>): void {
    if (next.theme) applyTheme(next.theme);
    if (typeof next.fontSize === 'number' && next.fontSize > 0) applyFontSize(next.fontSize);
    if (next.lastColor) settings = { ...settings, lastColor: next.lastColor };
    if (typeof next.showFront === 'boolean') {
      settings = { ...settings, showFront: next.showFront };
      rootEl.classList.toggle('hide-front', !next.showFront);
    }
  }

  // --- Lista -----------------------------------------------------------------

  function handleMenuAction(action: UnitMenuAction, noteId: string, unitIndex: number): void {
    if (action === 'edit') {
      bridge.emit('openEditor', { noteId });
    } else {
      bridge.emit('menuAction', { action, noteId, unitIndex });
    }
  }

  function updateSentinel(): void {
    sentinelEl.style.display = hasMoreUnits ? 'flex' : 'none';
  }

  function triggerNeedMore(): void {
    if (!hasMoreUnits || isLoadingMore) return;
    isLoadingMore = true;
    const last = renderedUnits.length > 0 ? renderedUnits[renderedUnits.length - 1].index : -1;
    bridge.emit('needMore', { after: last });
  }

  function tryPendingGoto(): void {
    if (!pendingGoto) return;
    if (scrollToTarget(win, listEl, pendingGoto)) {
      pendingGoto = null;
    } else if (hasMoreUnits) {
      // A unidade ainda não chegou: pede o próximo lote.
      triggerNeedMore();
    } else {
      pendingGoto = null;
    }
  }

  function appendUnits(units: ConsultaUnitWeb[], hasMore: boolean): void {
    isLoadingMore = false;
    hasMoreUnits = hasMore;

    if (units.length > 0) {
      const result = renderUnitsBatch(listEl, units, {
        lastDeckPath,
        onMenuAction: handleMenuAction,
      });
      lastDeckPath = result.lastDeckPath;
      renderedUnits.push(...units);
    }

    updateSentinel();
    bridge.emit('rendered', { count: renderedUnits.length, hasMore: hasMoreUnits });
    tryPendingGoto();
  }

  function clearList(): void {
    toolbar.hide();
    popover.hide();
    listEl.innerHTML = '';
    renderedUnits = [];
    lastDeckPath = '';
    hasMoreUnits = false;
    isLoadingMore = false;
    pendingGoto = null;
    updateSentinel();
  }

  /** Re-renderiza toda a lista mantendo a posição de leitura. */
  function rerenderAll(units: ConsultaUnitWeb[], hasMore: boolean): void {
    const position = computeReadingPosition(listEl);
    listEl.innerHTML = '';
    renderedUnits = [];
    lastDeckPath = '';
    appendUnits(units, hasMore);
    if (position) scrollToTarget(win, listEl, position);
  }

  /**
   * Troca unidades já exibidas, casando por `index`. Se o deck de alguma mudou
   * (cabeçalhos de seção mudam), re-renderiza tudo preservando a posição.
   */
  function replaceUnits(units: ConsultaUnitWeb[]): void {
    const positionByIndex = new Map(renderedUnits.map((u, i) => [u.index, i]));
    const next = renderedUnits.slice();
    let deckChanged = false;
    const changedPositions: number[] = [];

    for (const unit of units) {
      const pos = positionByIndex.get(unit.index);
      if (pos === undefined) continue; // ainda não exibida: chega no append
      if (next[pos].deckPath !== unit.deckPath) deckChanged = true;
      next[pos] = unit;
      changedPositions.push(pos);
    }
    if (changedPositions.length === 0) return;

    if (deckChanged) {
      rerenderAll(next, hasMoreUnits);
      return;
    }

    renderedUnits = next;
    for (const pos of changedPositions) {
      const unit = next[pos];
      const oldEl = listEl.querySelector<HTMLElement>(
        `.consulta-unit[data-unit-index="${unit.index}"]`
      );
      if (!oldEl) continue;
      const { unitElement } = renderConsultaUnit(unit, {
        // Mesmo deck da anterior: nunca gera cabeçalho novo aqui.
        previousDeckPath: unit.deckPath,
        onMenuAction: handleMenuAction,
      });
      oldEl.replaceWith(unitElement);
    }
  }

  // --- Posição de leitura ------------------------------------------------------

  const emitPosition = debounce(() => {
    const position = computeReadingPosition(listEl);
    if (position) bridge.emit('position', position);
  }, POSITION_DEBOUNCE_MS);

  function checkScrollPosition(): void {
    if (!hasMoreUnits || isLoadingMore) return;
    const scrollY = win.scrollY || win.pageYOffset || doc.documentElement.scrollTop || 0;
    const viewportHeight = win.innerHeight || 800;
    const totalHeight = doc.documentElement.scrollHeight || doc.body.scrollHeight || 0;
    // MODO_CONSULTA.md §3: quando a rolagem chega a ~2 telas do fim
    if (totalHeight - (scrollY + viewportHeight) <= viewportHeight * 2) {
      triggerNeedMore();
    }
  }

  function onScroll(): void {
    checkScrollPosition();
    emitPosition();
  }

  // --- Mensagens do React Native ---------------------------------------------

  const offs = [
    bridge.on('init', (payload) => {
      clearList();
      applySettings(payload);
    }),
    bridge.on('append', (payload) => appendUnits(payload.units ?? [], Boolean(payload.hasMore))),
    bridge.on('replace', (payload) => replaceUnits(payload.units ?? [])),
    bridge.on('goto', (payload) => {
      pendingGoto = {
        unitIndex: payload.unitIndex,
        annotationId: payload.annotationId,
        offset: payload.offset,
      };
      tryPendingGoto();
    }),
    bridge.on('setTheme', (payload) => applyTheme(payload.theme)),
    bridge.on('setFontSize', (payload) => applyFontSize(payload.fontSize)),
    bridge.on('restoreAnnotation', (payload) => {
      popover.restore(payload.unitIndex, payload.annotation);
    }),
    bridge.on('flushPosition', () => {
      emitPosition.flush();
    }),
  ];
  cleanups.push(...offs);

  function receive(raw: unknown): void {
    try {
      bridge.receive(raw);
    } catch (error) {
      reportError(error);
    }
  }

  // --- Eventos do DOM ----------------------------------------------------------

  const onDocumentClick = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest?.('.unit-menu-dropdown') && !target?.closest?.('.unit-menu-button')) {
      closeAllUnitMenus(doc.body);
    }
  };
  doc.addEventListener('click', onDocumentClick);
  cleanups.push(() => doc.removeEventListener('click', onDocumentClick));

  win.addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(() => win.removeEventListener('scroll', onScroll));

  const onHide = () => {
    if (doc.visibilityState === 'hidden') emitPosition.flush();
  };
  doc.addEventListener('visibilitychange', onHide);
  win.addEventListener('pagehide', emitPosition.flush);
  cleanups.push(() => {
    doc.removeEventListener('visibilitychange', onHide);
    win.removeEventListener('pagehide', emitPosition.flush);
  });

  const IO = (win as Window & { IntersectionObserver?: typeof IntersectionObserver })
    .IntersectionObserver;
  if (typeof IO === 'function') {
    const observer = new IO(
      (entries) => {
        if (entries[0]?.isIntersecting) triggerNeedMore();
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinelEl);
    cleanups.push(() => observer.disconnect());
  }

  // --- Primeira pintura com os dados injetados ---------------------------------

  if (options.initialData) {
    const { units, hasMore, initialPosition, ...initSettings } = options.initialData;
    applySettings(initSettings);
    if (initialPosition) {
      pendingGoto = {
        unitIndex: initialPosition.unitIndex,
        offset: initialPosition.offset,
      };
    }
    appendUnits(units ?? [], Boolean(hasMore));
  } else {
    applySettings(settings);
  }

  bridge.emit('ready', null);

  return {
    bridge,
    toolbar,
    popover,
    receive,
    getSettings: () => ({ ...settings }),
    getUnits: () => renderedUnits,
    saveAnnotation: (input) => bridge.request('saveAnnotation', input),
    deleteAnnotation: async (id) => (await bridge.request('deleteAnnotation', { id })).ok,
    restoreAnnotation: async (id) => (await bridge.request('restoreAnnotation', { id })).ok,
    setColor(color) {
      settings = { ...settings, lastColor: color };
      bridge.emit('setColor', color);
    },
    setFont(fontSize) {
      const clamped = Math.max(14, Math.min(26, fontSize));
      applyFontSize(clamped);
      bridge.emit('setFont', clamped);
    },
    flushPosition: () => emitPosition.flush(),
    dispose() {
      emitPosition.cancel();
      for (const off of cleanups) off();
      bridge.dispose();
    },
  };
}
