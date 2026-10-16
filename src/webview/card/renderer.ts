import { NIGHT_MODE_CLASSES, shouldIncludeBaseCardStyles } from './ankiDocument';
import { rewriteMediaElements } from './media';
import { sanitizeCardHtml } from './sanitize';
import { BASE_CARD_STYLES, WEISS_OVERLAY_STYLES, WEISS_RESET_STYLES } from './styles';
import type { CardRenderPayload, CardSide, ThemeMode } from './types';
import { apply } from '../shared/anchor';

export interface RenderResult {
  side: CardSide;
  height: number;
}

/**
 * Remove qualquer tooltip de nota aberto no elemento raiz.
 */
function closeActiveTooltip(rootElement: HTMLElement): void {
  const existing = rootElement.querySelectorAll('.card-note-tooltip');
  existing.forEach((el) => el.remove());
}

/**
 * Aplica comportamentos do runtime do Weiss (anotações da Consulta no verso,
 * balão de nota, resolução de mídia local e interceptação de links) sobre #qa.
 */
export function enhanceAnkiQaElement(
  qaElement: HTMLElement,
  tooltipContainer: HTMLElement,
  payload: CardRenderPayload
): RenderResult {
  const side: CardSide = payload.side ?? 'front';

  // 1. Aplicação de anotações (apenas no verso, MODO_CONSULTA.md §6)
  if (
    side === 'back' &&
    payload.showHighlights !== false &&
    payload.annotations &&
    payload.annotations.length > 0
  ) {
    apply(qaElement, payload.annotations);

    const noteMap = new Map<string, string>();
    for (const ann of payload.annotations) {
      if (ann.note && ann.note.trim().length > 0) {
        noteMap.set(ann.id, ann.note.trim());
      }
    }

    if (noteMap.size > 0) {
      const marks = qaElement.querySelectorAll<HTMLElement>('mark[data-aid]');
      marks.forEach((mark) => {
        const aid = mark.getAttribute('data-aid');
        const noteText = aid ? noteMap.get(aid) : undefined;
        if (!noteText) return;

        mark.addEventListener('click', (e) => {
          e.stopPropagation();
          closeActiveTooltip(tooltipContainer);

          const tooltip = document.createElement('div');
          tooltip.className = 'card-note-tooltip';
          tooltip.textContent = noteText;

          const markRect = mark.getBoundingClientRect();
          const rootRect = tooltipContainer.getBoundingClientRect();
          const top = Math.max(8, markRect.bottom - rootRect.top + 6);
          const left = Math.max(
            12,
            Math.min(markRect.left - rootRect.left, Math.max(12, rootRect.width - 290))
          );

          tooltip.style.top = `${top}px`;
          tooltip.style.left = `${left}px`;

          tooltip.addEventListener('click', (tEv) => {
            tEv.stopPropagation();
            tooltip.remove();
          });

          tooltipContainer.appendChild(tooltip);
        });
      });

      tooltipContainer.addEventListener('click', () => {
        closeActiveTooltip(tooltipContainer);
      });
    }
  }

  // 2. Reescrita de imagens se mediaBasePath foi fornecido explicitamente
  rewriteMediaElements(qaElement, payload.mediaBasePath);

  // 3. Interceptação segura de links para evitar navegação arbitrária fora do app
  const links = qaElement.querySelectorAll('a');
  links.forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const href = a.getAttribute('href');
      if (href && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'linkClick', payload: { url: href } })
        );
      }
    });
  });

  const height =
    tooltipContainer.offsetHeight ||
    tooltipContainer.scrollHeight ||
    qaElement.offsetHeight ||
    qaElement.scrollHeight ||
    0;

  return {
    side,
    height,
  };
}

/**
 * Renderiza o conteúdo do card dentro de um elemento raiz (#root) no formato Anki (#qa e #note-css sem escopo).
 */
export function renderCardToDom(
  rootElement: HTMLElement,
  payload: CardRenderPayload
): RenderResult {
  const theme: ThemeMode = payload.theme ?? 'light';
  const side: CardSide = payload.side ?? 'front';
  const isDark = theme === 'dark';
  const nmClasses = isDark ? ` ${NIGHT_MODE_CLASSES}` : '';
  const ordNumber = (payload.cardOrd ?? 0) + 1;

  // 1. Sanitização do HTML quando injetado via renderCardToDom
  const sanitizedHtml = sanitizeCardHtml(payload.html);

  // 2. CSS do modelo SEM escopo (.card-root removido no M10 Passo 2);
  // BASE_CARD_STYLES entra apenas em modelos embutidos ou sem CSS.
  const includeBase = shouldIncludeBaseCardStyles(payload);
  const rawModelCss = payload.css ?? '';
  const noteCss = includeBase ? `${BASE_CARD_STYLES}\n${rawModelCss}` : rawModelCss;

  // 3. Montagem do DOM com #note-css, #weiss-overlay e #qa
  rootElement.innerHTML = `
    <style id="weiss-reset">${WEISS_RESET_STYLES}</style>
    <style id="note-css">${noteCss}</style>
    <style id="weiss-overlay">${WEISS_OVERLAY_STYLES}</style>
    <div class="card-root theme-${theme} side-${side}${nmClasses}" id="card-root">
      <div class="card card${ordNumber}${nmClasses}">
        <div id="qa">${sanitizedHtml}</div>
      </div>
    </div>
  `;

  const cardRoot = (rootElement.querySelector('#card-root') as HTMLElement | null) ?? rootElement;
  const qaElement = (rootElement.querySelector('#qa') as HTMLElement | null) ?? rootElement;

  return enhanceAnkiQaElement(qaElement, cardRoot, payload);
}
