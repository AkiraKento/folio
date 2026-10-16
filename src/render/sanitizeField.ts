import DOMPurify from 'dompurify';
import { adjustFixedColorsForDarkMode } from './fixedColors';

export interface SanitizeFieldOptions {
  isDark?: boolean;
  adjustFixedColorsInDarkMode?: boolean;
}

const FORBID_TAGS = ['script', 'iframe', 'object', 'embed', 'link'];
const FORBID_ATTR = [
  'onerror',
  'onload',
  'onclick',
  'ondblclick',
  'onmousedown',
  'onmouseup',
  'onmouseover',
  'onmousemove',
  'onmouseout',
  'onmouseenter',
  'onmouseleave',
  'onfocus',
  'onblur',
  'onchange',
  'oninput',
  'onsubmit',
  'onreset',
  'onkeydown',
  'onkeypress',
  'onkeyup',
  'ontouchstart',
  'ontouchmove',
  'ontouchend',
  'ontouchcancel',
  'onwheel',
];

let cachedWindow: Window | null = null;
let cachedPurify: { sanitize: (dirty: string, cfg?: Record<string, unknown>) => string } | null = null;

function getDomPurifyInstance(): { sanitize: (dirty: string, cfg?: Record<string, unknown>) => string } | null {
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    if (cachedWindow === window && cachedPurify) {
      return cachedPurify;
    }
    if (
      typeof DOMPurify === 'function' &&
      typeof (DOMPurify as unknown as { sanitize?: unknown }).sanitize !== 'function'
    ) {
      cachedWindow = window;
      cachedPurify = (DOMPurify as unknown as (win: Window) => typeof DOMPurify)(
        window
      ) as unknown as { sanitize: (dirty: string, cfg?: Record<string, unknown>) => string };
      return cachedPurify;
    }
    if (typeof (DOMPurify as unknown as { sanitize?: unknown }).sanitize === 'function') {
      cachedWindow = window;
      cachedPurify = DOMPurify as unknown as {
        sanitize: (dirty: string, cfg?: Record<string, unknown>) => string;
      };
      return cachedPurify;
    }
  }
  return null;
}

const POTENTIALLY_UNSAFE_HTML_RE =
  /<(?:script|iframe|object|embed|link|svg|math|form|meta|base|style)\b|\bon[a-z]+\s*=|(?:javascript|vbscript)\s*:|data\s*:\s*text\/html|&#/i;

/**
 * Sanitiza o valor HTML de um campo individual da nota ANTES de substituir no template (M10 Passo 3).
 * Remove <script>, <iframe>, <object>, <embed>, <link>, atributos on*=, URLs javascript: e tags [sound:...].
 * Preserva o HTML e os <script> pertencentes ao template do modelo.
 */
export function sanitizeFieldHtml(
  rawFieldValue: string,
  options?: SanitizeFieldOptions
): string {
  if (!rawFieldValue || typeof rawFieldValue !== 'string') {
    return '';
  }

  // 1. Remove tags de áudio do Anki [sound:arquivo.mp3] (sem áudio no MVP)
  let cleaned = rawFieldValue.includes('[sound:') || /\[sound:/i.test(rawFieldValue)
    ? rawFieldValue.replace(/\[sound:[^\]]*\]/gi, '')
    : rawFieldValue;

  // Fast-path para texto puro sem tags HTML nem esquemas javascript:
  if (!cleaned.includes('<') && !/(?:javascript|vbscript)\s*:/i.test(cleaned)) {
    return cleaned;
  }

  // 2. Quando o campo contém padrões potencialmente perigosos e estamos em ambiente com DOM, aplica DOMPurify
  if (POTENTIALLY_UNSAFE_HTML_RE.test(cleaned)) {
    const purify = getDomPurifyInstance();
    if (purify) {
      cleaned = purify.sanitize(cleaned, {
        FORBID_TAGS,
        FORBID_ATTR,
        ALLOW_DATA_ATTR: true,
        ADD_ATTR: ['target'],
      });
    }

    // 3. Limpeza defensiva adicional (garante segurança também no Hermes / Node sem DOM)
    cleaned = cleaned
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<\/?script\b[^>]*>/gi, '')
      .replace(/<(iframe|object|embed|link)\b[^>]*>([\s\S]*?<\/\1>)?/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(
        /(\b(?:href|src|action|formaction)\s*=\s*(?:["']\s*)?)javascript:[^"'\s>]*/gi,
        '$1#'
      );
  }

  // 4. Ajuste de cores fixas no modo escuro (M10 Passo 8)
  if (options?.isDark && options.adjustFixedColorsInDarkMode !== false) {
    cleaned = adjustFixedColorsForDarkMode(cleaned);
  }

  return cleaned;
}
