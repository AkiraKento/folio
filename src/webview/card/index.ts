import { NIGHT_MODE_CLASSES } from './ankiDocument';
import { enhanceAnkiQaElement, renderCardToDom } from './renderer';
import type { CardInboundMessage, CardOutboundMessage, CardRenderPayload, ThemeMode } from './types';

function postMessageToRn(message: CardOutboundMessage): void {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
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
        if (message.payload.html) {
          qaEl.innerHTML = message.payload.html;
        }
        const result = enhanceAnkiQaElement(qaEl, document.body, message.payload);
        postMessageToRn({
          type: 'rendered',
          payload: {
            side: result.side,
            height: result.height,
          },
        });
      } else {
        const result = renderCardToDom(rootEl, message.payload);
        postMessageToRn({
          type: 'rendered',
          payload: {
            side: result.side,
            height: result.height,
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

  if (window.__INITIAL_CARD_DATA__) {
    try {
      const initialPayload: CardRenderPayload = window.__INITIAL_CARD_DATA__;
      const result =
        qaEl && !document.getElementById('root')
          ? enhanceAnkiQaElement(qaEl, document.body, initialPayload)
          : renderCardToDom(rootEl, initialPayload);
      postMessageToRn({
        type: 'rendered',
        payload: {
          side: result.side,
          height: result.height,
        },
      });
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
