// Código TypeScript puro rodando dentro da WebView (sem React)

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (data: string) => void;
    };
  }
}

function initHelloView() {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
      color: #203e3a;
      background: #f0f4f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    ">
      <div style="
        background: #ffffff;
        border: 1px solid #e0e6e6;
        border-radius: 16px;
        padding: 32px 24px;
        max-width: 420px;
        width: 100%;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
      ">
        <h1 style="font-size: 24px; margin-bottom: 12px; color: #203e3a;">Weiss WebView</h1>
        <p style="font-size: 15px; color: #5b858b; line-height: 1.5; margin-bottom: 20px;">
          Pipeline esbuild funcionando perfeitamente dentro da WebView do Android.
        </p>
        <div style="
          display: inline-block;
          background: #3a9d7f;
          color: white;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
        ">
          Status: M0 Ativo
        </div>
      </div>
    </div>
  `;

  // Avisa o host React Native via postMessage se disponível
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'ready', message: 'WebView carregada com sucesso!' })
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHelloView);
} else {
  initHelloView();
}
