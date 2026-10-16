import { NIGHT_MODE_CLASSES } from './ankiDocument';
import {
  enhanceAnkiQaElement,
  enhanceAnkiQaElementAfterScripts,
  renderCardToDom,
} from './renderer';
import type { CardInboundMessage, CardOutboundMessage, CardRenderPayload, ThemeMode } from './types';

function postMessageToRn(message: CardOutboundMessage): void {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
}

function runAnkiLifecycleHooks(): void {
  const hooks = [
    ...(Array.isArray(window.onUpdateHook) ? window.onUpdateHook : []),
    ...(Array.isArray(window.onShownHook) ? window.onShownHook : []),
  ];

  for (const hook of hooks) {
    if (typeof hook === 'function') {
      try {
        hook();
      } catch (err) {
        if (typeof window.__weissLogScriptError === 'function') {
          window.__weissLogScriptError(err);
        } else {
          const errMessage = err instanceof Error ? err.message : String(err);
          postMessageToRn({
            type: 'scriptError',
            payload: { message: errMessage },
          });
        }
      }
    }
  }
}

function applyThemeClasses(theme: ThemeMode): void {
  const nmList = NIGHT_MODE_CLASSES.split(' ');
  const htmlEl = document.documentElement;
  const bodyEl = document.body;

  if (theme === 'dark') {
    nmList.forEach((cls) => {
      htmlEl.classList.add(cls);
      bodyEl?.classList.add(cls);
    });
  } else {
    nmList.forEach((cls) => {
      htmlEl.classList.remove(cls);
      bodyEl?.classList.remove(cls);
    });
  }

  const cardRoot = document.getElementById('card-root');
  if (cardRoot) {
    cardRoot.classList.remove('theme-light', 'theme-dark');
    cardRoot.classList.add(`theme-${theme}`);
  }
}

let activeRenderToken = 0;

function runAnkiQaRuntime(qaEl: HTMLElement, payload: CardRenderPayload): void {
  const renderToken = ++activeRenderToken;
  const immediateResult = enhanceAnkiQaElement(qaEl, document.body, payload, {
    deferHighlightsAndZoom: true,
  });
  postMessageToRn({
    type: 'rendered',
    payload: {
      side: immediateResult.side,
      height: immediateResult.height,
      backgroundColor: immediateResult.backgroundColor,
    },
  });

  enhanceAnkiQaElementAfterScripts(qaEl, document.body, payload)
    .then((settledResult) => {
      if (renderToken !== activeRenderToken) return;
      postMessageToRn({
        type: 'rendered',
        payload: {
          side: settledResult.side,
          height: settledResult.height,
          backgroundColor: settledResult.backgroundColor,
        },
      });
    })
    .catch((error) => {
      const errMessage = error instanceof Error ? error.message : String(error);
      postMessageToRn({
        type: 'error',
        payload: { message: errMessage },
      });
    });
}

function handleInboundMessage(rawMessage: unknown, rootEl: HTMLElement): void {
  let message: CardInboundMessage;

  if (typeof rawMessage === 'string') {
    try {
      message = JSON.parse(rawMessage);
    } catch {
      return;
    }
  } else if (rawMessage && typeof rawMessage === 'object') {
    message = rawMessage as CardInboundMessage;
  } else {
    return;
  }

  try {
    if (message.type === 'renderCard') {
      const qaEl = document.getElementById('qa');
      if (qaEl && !document.getElementById('root')) {
        if (message.payload.theme) {
          applyThemeClasses(message.payload.theme);
        }
        // Só substitui qaEl.innerHTML se for uma atualização diferente do documento inicial
        // (para não sobrescrever mutações já iniciadas pelos scripts do template do documento atual)
        if (
          message.payload.html &&
          (!window.__INITIAL_CARD_DATA__ ||
            window.__INITIAL_CARD_DATA__.side !== message.payload.side ||
            window.__INITIAL_CARD_DATA__.cardId !== message.payload.cardId)
        ) {
          qaEl.innerHTML = message.payload.html;
          window.__INITIAL_CARD_DATA__ = { ...message.payload, html: '' };
          runAnkiLifecycleHooks();
        }
        runAnkiQaRuntime(qaEl, message.payload);
      } else {
        const result = renderCardToDom(rootEl, message.payload);
        postMessageToRn({
          type: 'rendered',
          payload: {
            side: result.side,
            height: result.height,
            backgroundColor: result.backgroundColor,
          },
        });
      }
    } else if (message.type === 'setTheme') {
      applyThemeClasses(message.payload.theme);
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    postMessageToRn({
      type: 'error',
      payload: { message: errMessage },
    });
  }
}

function initCardWebView(): void {
  const qaEl = document.getElementById('qa');
  const rootEl = document.getElementById('root') ?? document.body;
  if (!rootEl) return;

  runAnkiLifecycleHooks();

  if (window.__INITIAL_CARD_DATA__) {
    try {
      const initialPayload: CardRenderPayload = window.__INITIAL_CARD_DATA__;
      if (qaEl && !document.getElementById('root')) {
        runAnkiQaRuntime(qaEl, initialPayload);
      } else {
        const result = renderCardToDom(rootEl, initialPayload);
        postMessageToRn({
          type: 'rendered',
          payload: {
            side: result.side,
            height: result.height,
            backgroundColor: result.backgroundColor,
          },
        });
      }
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      postMessageToRn({
        type: 'error',
        payload: { message: errMessage },
      });
    }
  }

  const listener = (event: Event | MessageEvent) => {
    const msgEvent = event as MessageEvent;
    if (msgEvent.data !== undefined) {
      handleInboundMessage(msgEvent.data, rootEl);
    }
  };

  window.addEventListener('message', listener);
  document.addEventListener('message', listener);

  postMessageToRn({ type: 'ready' });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCardWebView);
} else {
  initCardWebView();
}
