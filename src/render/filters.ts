import { strings } from '../ui/strings';
import { processCloze } from './cloze';
import type { RenderContext } from './types';

/**
 * Remove tags HTML e decodifica entidades básicas para extrair texto puro.
 */
export function stripHtml(html: string): string {
  if (!html) {
    return '';
  }

  let text = html.replace(/<br\s*\/?>/gi, ' ');
  text = text.replace(/<\/(p|div|li|h[1-6])>/gi, ' ');
  text = text.replace(/<[^>]+>/g, '');
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return text.replace(/[ \t\r\n]+/g, ' ').trim();
}

/**
 * Verifica se um valor de campo é considerado vazio no contexto Anki/Folio.
 * Um campo é vazio se for nulo, apenas espaços ou apenas tags HTML sem texto,
 * a menos que contenha tags de mídia (como <img src="...">).
 */
export function isFieldEmpty(value: string | undefined | null): boolean {
  if (!value) {
    return true;
  }

  // Se contiver elementos de mídia visíveis, tem conteúdo
  if (/<(img|audio|video|svg|iframe|object|embed)\b[^>]*>/i.test(value)) {
    return false;
  }

  const plainText = stripHtml(value);
  return plainText.length === 0;
}

/**
 * Aplica um filtro nomeado ao valor de um campo.
 * Filtros conhecidos:
 * - cloze: processa lacunas Anki
 * - hint: gera componente expansível <details class="hint">
 * - text: remove tags HTML e decodifica entidades
 * - type: mostra o campo (sem campo de digitação no MVP)
 * - filtros desconhecidos: exibem o valor cru e registram um warning no console.
 */
export function applyFilter(
  filterName: string,
  value: string,
  fieldName: string,
  context: RenderContext
): string {
  const normalizedFilter = filterName.trim().toLowerCase();

  switch (normalizedFilter) {
    case 'cloze': {
      const targetClozeNumber =
        context.clozeNumber ?? (context.cardOrd !== undefined ? context.cardOrd + 1 : 1);
      return processCloze(value, {
        side: context.side ?? 'front',
        targetClozeNumber,
        allClozesRevealed: context.allClozesRevealed,
      });
    }

    case 'hint': {
      if (isFieldEmpty(value)) {
        return '';
      }
      const label = strings.render.hintFor(fieldName);
      return `<details class="hint"><summary class="hint-label">${label}</summary><div class="hint-content">${value}</div></details>`;
    }

    case 'text': {
      return stripHtml(value);
    }

    case 'type': {
      return value;
    }

    default: {
      console.warn(
        `[Folio Render] Filtro desconhecido: "${filterName}" no campo "${fieldName}". Mostrando campo cru.`
      );
      return value;
    }
  }
}
