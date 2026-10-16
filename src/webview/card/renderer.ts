import { NIGHT_MODE_CLASSES, shouldIncludeBaseCardStyles } from './ankiDocument';
import { rewriteMediaElements } from './media';
import { sanitizeCardHtml } from './sanitize';
import { BASE_CARD_STYLES, WEISS_OVERLAY_STYLES, WEISS_RESET_STYLES } from './styles';
import type { CardRenderPayload, CardSide, ThemeMode } from './types';
import { apply, unwrapAll } from '../shared/anchor';

export interface RenderResult {
  side: CardSide;
  height: number;
  backgroundColor?: string;
}

/**
 * Remove qualquer tooltip de nota aberto no elemento raiz.
 */
function closeActiveTooltip(rootElement: HTMLElement): void {
  const existing = rootElement.querySelectorAll('.card-note-tooltip');
  existing.forEach((el) => el.remove());
}

function isTransparentCssColor(color: string | null | undefined): boolean {
  if (!color) return true;
  const trimmed = color.trim().toLowerCase();
  if (!trimmed || trimmed === 'transparent') return true;
  if (/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)$/.test(trimmed)) {
    return true;
  }
  if (/^hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*0(?:\.0+)?\s*\)$/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Obtém a cor de fundo efetiva do documento do card:
 * getComputedStyle(document.body).backgroundColor, ou a do html se a do body for transparente (M10 Passo 5).
 */
export function getEffectiveCardBackgroundColor(
  bodyEl?: HTMLElement | null
): string | undefined {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return undefined;
  }

  try {
    const targetBody = bodyEl ?? document.body;
    if (targetBody) {
      const bodyBg = window.getComputedStyle(targetBody).backgroundColor;
      if (!isTransparentCssColor(bodyBg)) {
        return bodyBg;
      }
    }

    if (document.documentElement) {
      const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
      if (!isTransparentCssColor(htmlBg)) {
        return htmlBg;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForQuietDom(targetEl: HTMLElement, quietMs = 100, maxWaitMs = 600): Promise<void> {
  if (typeof MutationObserver === 'undefined') {
    return sleepMs(quietMs);
  }

  return new Promise((resolve) => {
    let quietTimer: ReturnType<typeof setTimeout> | null = null;
    let maxTimer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const finish = (obs: MutationObserver) => {
      if (settled) return;
      settled = true;
      if (quietTimer) clearTimeout(quietTimer);
      if (maxTimer) clearTimeout(maxTimer);
      obs.disconnect();
      resolve();
    };

    const observer = new MutationObserver(() => {
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(() => finish(observer), quietMs);
    });

    observer.observe(targetEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    quietTimer = setTimeout(() => finish(observer), quietMs);
    maxTimer = setTimeout(() => finish(observer), maxWaitMs);
  });
}

/**
 * Espera os scripts do template terminarem na ordem especificada no M10 Passo 5:
 * 1. 2 requestAnimationFrame
 * 2. 150 ms
 * 3. MutationObserver quieto por 100 ms
 */
export async function waitForTemplateScriptsToSettle(targetEl: HTMLElement): Promise<void> {
  await nextAnimationFrame();
  await nextAnimationFrame();
  await sleepMs(150);
  await waitForQuietDom(targetEl, 100, 600);
}

/**
 * Aplica os grifos da Consulta no verso sobre #qa e conecta o balão de nota ao toque.
 */
export function applyConsultaHighlightsToElement(
  qaElement: HTMLElement,
  tooltipContainer: HTMLElement,
  payload: CardRenderPayload
): void {
  const side: CardSide = payload.side ?? 'front';
  if (
    side !== 'back' ||
    payload.showHighlights === false ||
    !payload.annotations ||
    payload.annotations.length === 0
  ) {
    return;
  }

  unwrapAll(qaElement);
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

function openWeissImageZoomOverlay(src: string, alt: string, overlayContainer: HTMLElement): void {
  const existing = overlayContainer.querySelectorAll('.weiss-zoom-overlay');
  existing.forEach((el) => el.remove());

  const doc = overlayContainer.ownerDocument || document;
  const overlay = doc.createElement('div');
  overlay.className = 'weiss-zoom-overlay';

  const zoomedImg = doc.createElement('img');
  zoomedImg.src = src;
  zoomedImg.alt = alt;
  zoomedImg.setAttribute('draggable', 'false');

  let scale = 1;
  let tx = 0;
  let ty = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialPinchDist = 0;
  let initialPinchScale = 1;

  const updateTransform = () => {
    zoomedImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  };

  zoomedImg.addEventListener('wheel', (e) => {
    e.preventDefault();
    scale = Math.min(Math.max(1, scale + e.deltaY * -0.002), 8);
    if (scale === 1) {
      tx = 0;
      ty = 0;
    }
    updateTransform();
  });

  zoomedImg.addEventListener('mousedown', (e) => {
    if (scale > 1) {
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;
      startX = e.clientX - tx;
      startY = e.clientY - ty;
    }
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    tx = e.clientX - startX;
    ty = e.clientY - startY;
    updateTransform();
  });

  overlay.addEventListener('mouseup', () => {
    isDragging = false;
  });

  overlay.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDist = Math.hypot(dx, dy);
      initialPinchScale = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      isDragging = true;
      startX = e.touches[0].clientX - tx;
      startY = e.touches[0].clientY - ty;
    }
  });

  overlay.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && initialPinchDist > 0) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      scale = Math.min(Math.max(1, initialPinchScale * (dist / initialPinchDist)), 8);
      if (scale === 1) {
        tx = 0;
        ty = 0;
      }
      updateTransform();
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      e.preventDefault();
      tx = e.touches[0].clientX - startX;
      ty = e.touches[0].clientY - startY;
      updateTransform();
    }
  });

  overlay.addEventListener('touchend', () => {
    isDragging = false;
    initialPinchDist = 0;
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || scale === 1) {
      overlay.remove();
    }
  });

  zoomedImg.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    overlay.remove();
  });

  overlay.appendChild(zoomedImg);
  overlayContainer.appendChild(overlay);
}

/**
 * Configura zoom de imagem para imagens que NÃO têm .zoom-enabled (M10 Passo 5):
 * Se a imagem já tem .zoom-enabled (ex: modelo Avicena), não mexe.
 * Caso contrário, toque duplo (ou dblclick) abre .weiss-zoom-overlay com pinça e arrasto.
 */
export function setupImageZoomFallback(
  qaElement: HTMLElement,
  overlayContainer: HTMLElement
): void {
  const images = qaElement.querySelectorAll<HTMLImageElement>('img');
  images.forEach((img) => {
    if (
      img.classList.contains('zoom-enabled') ||
      img.classList.contains('zoomed-img') ||
      img.hasAttribute('data-weiss-zoom-bound')
    ) {
      return;
    }

    img.setAttribute('data-weiss-zoom-bound', 'true');
    let lastTapMs = 0;

    img.addEventListener('dblclick', (e) => {
      if (img.classList.contains('zoom-enabled')) return;
      e.preventDefault();
      e.stopPropagation();
      const src = img.getAttribute('src') || img.src;
      if (src) {
        openWeissImageZoomOverlay(src, img.alt || '', overlayContainer);
      }
    });

    img.addEventListener('touchend', (e) => {
      if (img.classList.contains('zoom-enabled')) return;
      const now = Date.now();
      if (now - lastTapMs < 300) {
        e.preventDefault();
        e.stopPropagation();
        lastTapMs = 0;
        const src = img.getAttribute('src') || img.src;
        if (src) {
          openWeissImageZoomOverlay(src, img.alt || '', overlayContainer);
        }
      } else {
        lastTapMs = now;
      }
    });
  });
}

function interceptCardLinks(qaElement: HTMLElement): void {
  const links = qaElement.querySelectorAll<HTMLAnchorElement>('a');
  links.forEach((a) => {
    if (a.hasAttribute('data-weiss-link-bound')) return;
    a.setAttribute('data-weiss-link-bound', 'true');
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
}

function measureCardResult(
  qaElement: HTMLElement,
  tooltipContainer: HTMLElement,
  side: CardSide
): RenderResult {
  const height =
    tooltipContainer.offsetHeight ||
    tooltipContainer.scrollHeight ||
    qaElement.offsetHeight ||
    qaElement.scrollHeight ||
    0;
  const backgroundColor = getEffectiveCardBackgroundColor(tooltipContainer);

  return {
    side,
    height,
    backgroundColor,
  };
}

/**
 * Aplica comportamentos do runtime do Weiss (anotações da Consulta no verso,
 * balão de nota, zoom de imagem fallback, resolução de mídia local e interceptação de links) sobre #qa.
 */
export function enhanceAnkiQaElement(
  qaElement: HTMLElement,
  tooltipContainer: HTMLElement,
  payload: CardRenderPayload,
  options?: { deferHighlightsAndZoom?: boolean }
): RenderResult {
  const side: CardSide = payload.side ?? 'front';

  // 1. Reescrita de imagens se mediaBasePath foi fornecido explicitamente
  rewriteMediaElements(qaElement, payload.mediaBasePath);

  // 2. Interceptação segura de links para evitar navegação arbitrária fora do app
  interceptCardLinks(qaElement);

  if (!options?.deferHighlightsAndZoom) {
    applyConsultaHighlightsToElement(qaElement, tooltipContainer, payload);
    setupImageZoomFallback(qaElement, tooltipContainer);
  }

  return measureCardResult(qaElement, tooltipContainer, side);
}

/**
 * Executa o fluxo assíncrono completo do M10 Passo 5 sobre #qa:
 * espera 2 requestAnimationFrame + 150 ms + MutationObserver quieto por 100 ms
 * antes de aplicar os grifos da Consulta e o fallback de zoom de imagem.
 */
export async function enhanceAnkiQaElementAfterScripts(
  qaElement: HTMLElement,
  tooltipContainer: HTMLElement,
  payload: CardRenderPayload
): Promise<RenderResult> {
  const side: CardSide = payload.side ?? 'front';
  await waitForTemplateScriptsToSettle(qaElement);
  interceptCardLinks(qaElement);
  applyConsultaHighlightsToElement(qaElement, tooltipContainer, payload);
  setupImageZoomFallback(qaElement, tooltipContainer);
  return measureCardResult(qaElement, tooltipContainer, side);
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
