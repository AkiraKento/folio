import { scopeCss } from './css-scope';
import { rewriteMediaElements } from './media';
import { sanitizeCardHtml } from './sanitize';
import { BASE_CARD_STYLES } from './styles';
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
 * Renderiza o conteúdo completo do card dentro de um elemento raiz (#root).
 * Aplica sanitização por DOMPurify, injeção de CSS customizado com escopo .card-root,
 * resolução segura de mídias, interceptação de links e aplicação de anotações no verso (MODO_CONSULTA.md §6).
 */
export function renderCardToDom(
  rootElement: HTMLElement,
  payload: CardRenderPayload
): RenderResult {
  const theme: ThemeMode = payload.theme ?? 'light';
  const side: CardSide = payload.side ?? 'front';

  // 1. Sanitização rigorosa via DOMPurify
  const sanitizedHtml = sanitizeCardHtml(payload.html);

  // 2. Escopo do CSS personalizado do note type
  const scopedCustomCss = payload.css ? scopeCss(payload.css, '.card-root') : '';

  // 3. Montagem do DOM
  rootElement.innerHTML = `
    <style id="folio-base-card-style">${BASE_CARD_STYLES}</style>
    <style id="card-custom-style">${scopedCustomCss}</style>
    <div class="card-root theme-${theme} side-${side}" id="card-root">
      <div class="card">
        ${sanitizedHtml}
      </div>
    </div>
  `;

  const cardRoot = rootElement.querySelector('#card-root') as HTMLElement | null;
  const cardElement = rootElement.querySelector('.card') as HTMLElement | null;

  // 4. Aplicação de anotações (apenas no verso, MODO_CONSULTA.md §6)
  if (
    side === 'back' &&
    payload.showHighlights !== false &&
    payload.annotations &&
    payload.annotations.length > 0 &&
    cardElement
  ) {
    apply(cardElement, payload.annotations);

    // Mapeia notas para exibição do balão de nota ao tocar no trecho
    const noteMap = new Map<string, string>();
    for (const ann of payload.annotations) {
      if (ann.note && ann.note.trim().length > 0) {
        noteMap.set(ann.id, ann.note.trim());
      }
    }

    if (noteMap.size > 0 && cardRoot) {
      const marks = cardElement.querySelectorAll<HTMLElement>('mark[data-aid]');
      marks.forEach((mark) => {
        const aid = mark.getAttribute('data-aid');
        const noteText = aid ? noteMap.get(aid) : undefined;
        if (!noteText) return;

        mark.addEventListener('click', (e) => {
          e.stopPropagation();
          closeActiveTooltip(rootElement);

          const tooltip = document.createElement('div');
          tooltip.className = 'card-note-tooltip';
          tooltip.textContent = noteText;

          // Posicionamento relativo ao cardRoot
          const markRect = mark.getBoundingClientRect();
          const rootRect = cardRoot.getBoundingClientRect();
          const top = Math.max(8, markRect.bottom - rootRect.top + 6);
          const left = Math.max(12, Math.min(markRect.left - rootRect.left, rootRect.width - 290));

          tooltip.style.top = `${top}px`;
          tooltip.style.left = `${left}px`;

          tooltip.addEventListener('click', (tEv) => {
            tEv.stopPropagation();
            tooltip.remove();
          });

          cardRoot.appendChild(tooltip);
        });
      });

      // Fecha tooltip ao tocar fora
      cardRoot.addEventListener('click', () => {
        closeActiveTooltip(rootElement);
      });
    }
  }

  // 5. Reescrita das imagens da pasta de mídia local
  rewriteMediaElements(rootElement, payload.mediaBasePath);

  // 6. Interceptação segura de links para evitar navegação arbitrária fora do app
  const links = rootElement.querySelectorAll('a');
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

  const height = rootElement.offsetHeight || rootElement.scrollHeight || 0;

  return {
    side,
    height,
  };
}
