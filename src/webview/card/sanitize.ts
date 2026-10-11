import DOMPurify from 'dompurify';

/**
 * Obtém uma instância configurada do DOMPurify compatível tanto com navegadores
 * (WebView empacotada por esbuild) quanto com ambientes de teste (JSDOM/Jest).
 */
function getPurify(): typeof DOMPurify {
  if (typeof window !== 'undefined') {
    // Se for uma factory function (como no CommonJS sob jsdom)
    if (typeof DOMPurify === 'function' && typeof (DOMPurify as unknown as { sanitize?: unknown }).sanitize !== 'function') {
      return (DOMPurify as unknown as (win: Window) => typeof DOMPurify)(window);
    }
    return DOMPurify;
  }
  return DOMPurify;
}

/**
 * Sanitiza o HTML de um card antes de inseri-lo no DOM da WebView.
 * Garante que <script>, <link rel="stylesheet">, iframes, objetos executáveis,
 * handlers inline (on* e javascript:) sejam removidos com segurança.
 */
export function sanitizeCardHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') {
    return '';
  }

  const purify = getPurify();

  return purify.sanitize(rawHtml, {
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link'],
    FORBID_ATTR: [
      'onerror',
      'onload',
      'onclick',
      'onmouseover',
      'onfocus',
      'onblur',
      'onchange',
      'onsubmit',
      'onkeydown',
      'onkeypress',
      'onkeyup',
      'ontouchstart',
      'ontouchend',
    ],
    ALLOW_DATA_ATTR: true,
    ADD_ATTR: ['target'],
  });
}
