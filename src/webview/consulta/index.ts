/**
 * Boot da WebView da Consulta. A lógica fica em ./app.ts.
 */
import { createConsultaApp, type ConsultaApp } from './app';

declare global {
  interface Window {
    /** Exposto para a barra de grifo e para depuração no Chrome DevTools. */
    __CONSULTA_APP__?: ConsultaApp;
  }
}

function boot(): void {
  const mountRoot = document.getElementById('root');
  if (!mountRoot) return;

  const app = createConsultaApp({
    mountRoot,
    win: window,
    post: (raw) => window.ReactNativeWebView?.postMessage(raw),
    initialData: window.__INITIAL_CONSULTA_DATA__,
  });
  window.__CONSULTA_APP__ = app;

  // O react-native-webview entrega o postMessage em `document` no Android e em
  // `window` no iOS; em alguns casos o mesmo evento passa pelos dois. O WeakSet
  // garante que cada evento seja tratado uma vez só.
  const seen = new WeakSet<Event>();
  const onMessage = (event: Event) => {
    if (seen.has(event)) return;
    seen.add(event);
    const data = (event as MessageEvent).data;
    if (data !== undefined) app.receive(data);
  };
  window.addEventListener('message', onMessage);
  document.addEventListener('message', onMessage);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
