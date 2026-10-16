import DOMPurify from 'dompurify';

let hookAdded = false;

function getPurify(): typeof DOMPurify {
  let purify = DOMPurify;
  if (typeof window !== 'undefined') {
    if (
      typeof DOMPurify === 'function' &&
      typeof (DOMPurify as unknown as { sanitize?: unknown }).sanitize !== 'function'
    ) {
      purify = (DOMPurify as unknown as (win: Window) => typeof DOMPurify)(window);
    }
  }

  if (!hookAdded && purify.addHook) {
    purify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'IMG') {
        node.setAttribute('loading', 'lazy');
        node.setAttribute('decoding', 'async');
      }
    });
    hookAdded = true;
  }

  return purify;
}

/**
 * Sanitiza o HTML de frente e verso da unidade antes de inserir no DOM da Consulta.
 * Remove scripts, iframes, links externos para CSS e handlers on*.
 * Garante loading="lazy" e decoding="async" em todas as imagens (P0-3).
 */
export function sanitizeConsultaHtml(rawHtml: string): string {
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
    ADD_ATTR: ['target', 'loading', 'decoding'],
  });
}
