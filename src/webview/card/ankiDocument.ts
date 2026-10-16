import { buildAnkiShimsScript, processTemplateScripts } from './ankiShims';
import { BASE_CARD_STYLES, WEISS_OVERLAY_STYLES, WEISS_RESET_STYLES } from './styles';
import type { CardRenderPayload } from './types';

export const NIGHT_MODE_CLASSES = 'nightMode night_mode night-mode';

const LEGACY_BUILTIN_CSS_SNIPPETS = [
  'hr#answer {\n  border: 0;\n  border-top: 1px solid #e0e6e6;\n  margin: 1.5em 0;\n}',
];

/**
 * Determina se o card deve receber o BASE_CARD_STYLES do Weiss.
 * Pela regra do M10 Passo 2:
 * - Modelos importados (como avicena e AnKing) NÃO recebem BASE_CARD_STYLES nem scopeCss.
 * - Apenas modelos embutidos do Weiss (isBuiltinModel === true) ou modelos com CSS vazio recebem BASE_CARD_STYLES.
 */
export function shouldIncludeBaseCardStyles(payload: Pick<CardRenderPayload, 'css' | 'isBuiltinModel'>): boolean {
  if (payload.isBuiltinModel === true) {
    return true;
  }
  if (payload.isBuiltinModel === false) {
    return !(payload.css && payload.css.trim().length > 0);
  }
  const trimmedCss = payload.css?.trim() ?? '';
  if (!trimmedCss) {
    return true;
  }
  return LEGACY_BUILTIN_CSS_SNIPPETS.some((snippet) => trimmedCss.includes(snippet));
}

export interface BuildAnkiDocumentOptions {
  /**
   * CSS de @font-face locais (Passo 6).
   */
  fontsCss?: string;
  /**
   * Script de shims do Anki executado ANTES do conteúdo (Passo 4).
   */
  shimsScript?: string;
  /**
   * Script de runtime do Weiss executado DEPOIS do conteúdo (Passo 5).
   */
  runtimeScript?: string;
}

/**
 * Monta um documento HTML completo por lado do card no formato exato do AnkiDroid (M10 Passo 2 e Passo 4):
 * - html.mobile.android.js (+ nightMode night_mode night-mode no escuro)
 * - body.card.card{ORD+1} (+ nightMode night_mode night-mode no escuro)
 * - #weiss-reset, #weiss-fonts, #note-css (CSS do modelo cru, sem escopo .card-root), #weiss-overlay
 * - #weiss-anki-shims (shims do Anki ANTES do conteúdo)
 * - <div id="qa">{HTML do lado com scripts protegidos por try/catch ou removidos se executeModelScripts=false}</div>
 */
export function buildAnkiDocument(
  payload: CardRenderPayload,
  options: BuildAnkiDocumentOptions = {}
): string {
  const isDark = payload.theme === 'dark';
  const nmHtml = isDark ? ` ${NIGHT_MODE_CLASSES}` : '';
  const nmBody = isDark ? ` ${NIGHT_MODE_CLASSES}` : '';
  const ordNumber = (payload.cardOrd ?? 0) + 1;

  const includeBase = shouldIncludeBaseCardStyles(payload);
  const rawModelCss = payload.css ?? '';
  const noteCss = includeBase
    ? `${BASE_CARD_STYLES}\n${rawModelCss}`
    : rawModelCss;

  const fontsCss = options.fontsCss ?? '';
  const shimsScript = options.shimsScript ?? buildAnkiShimsScript(payload);
  const executeScripts = payload.executeModelScripts !== false;
  const qaHtml = processTemplateScripts(payload.html ?? '', executeScripts);

  // Serializa metadados do card para o runtime do Weiss (sem re-injetar o HTML inteiro)
  const runtimePayload: CardRenderPayload = {
    ...payload,
    html: '',
  };
  const serializedPayload = JSON.stringify(runtimePayload).replace(/</g, '\\u003c');
  const runtimeJs = options.runtimeScript
    ? `window.__INITIAL_CARD_DATA__ = ${serializedPayload};\n${options.runtimeScript}`
    : `window.__INITIAL_CARD_DATA__ = ${serializedPayload};`;

  return `<!doctype html>
<html class="mobile android js${nmHtml}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style id="weiss-reset">${WEISS_RESET_STYLES}</style>
  <style id="weiss-fonts">${fontsCss}</style>
  <style id="note-css">${noteCss}</style>
  <style id="weiss-overlay">${WEISS_OVERLAY_STYLES}</style>
  <script id="weiss-anki-shims">${shimsScript}</script>
</head>
<body class="card card${ordNumber}${nmBody}">
  <div id="qa">${qaHtml}</div>
  <script id="weiss-runtime">${runtimeJs}</script>
</body>
</html>`;
}
