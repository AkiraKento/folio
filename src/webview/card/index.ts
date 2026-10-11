import { renderCardToDom } from './renderer';
import type { CardInboundMessage, CardOutboundMessage, CardRenderPayload } from './types';

function postMessageToRn(message: CardOutboundMessage): void {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
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
      const result = renderCardToDom(rootEl, message.payload);
      postMessageToRn({
        type: 'rendered',
        payload: {
          side: result.side,
          height: result.height,
        },
      });
    } else if (message.type === 'setTheme') {
      const cardRoot = rootEl.querySelector('#card-root');
      if (cardRoot) {
        cardRoot.classList.remove('theme-light', 'theme-dark');
        cardRoot.classList.add(`theme-${message.payload.theme}`);
      }
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
  const rootEl = document.getElementById('root');
  if (!rootEl) return;

  // Renderiza dados iniciais se pré-injetados
  if (window.__INITIAL_CARD_DATA__) {
    try {
      const initialPayload: CardRenderPayload = window.__INITIAL_CARD_DATA__;
      const result = renderCardToDom(rootEl, initialPayload);
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

  // react-native-webview pode disparar eventos em window ou document
  window.addEventListener('message', listener);
  document.addEventListener('message', listener);

  // Sinaliza para o React Native que a WebView está carregada e pronta
  postMessageToRn({ type: 'ready' });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCardWebView);
} else {
  initCardWebView();
}
