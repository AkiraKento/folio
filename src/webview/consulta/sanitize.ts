import DOMPurify from 'dompurify';

function getPurify(): typeof DOMPurify {
  if (typeof window !== 'undefined') {
    if (
      typeof DOMPurify === 'function' &&
      typeof (DOMPurify as unknown as { sanitize?: unknown }).sanitize !== 'function'
    ) {
      return (DOMPurify as unknown as (win: Window) => typeof DOMPurify)(window);
    }
    return DOMPurify;
  }
  return DOMPurify;
}

/**
 * Sanitiza o HTML de frente e verso da unidade antes de inserir no DOM da Consulta.
 * Remove scripts, iframes, links externos para CSS e handlers on*.
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
    ADD_ATTR: ['target'],
  });
}
