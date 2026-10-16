import { logWarn } from '../logging';
import { strings } from '../ui/strings';
import { processCloze } from './cloze';
import type { RenderContext } from './types';

const warnedFiltersByModel = new Set<string>();

/**
 * Limpa o cache de avisos de filtros desconhecidos por modelo (útil para testes).
 */
export function resetUnknownFilterWarnings(): void {
  warnedFiltersByModel.clear();
}

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
 * Aplica um filtro nomeado ao valor de um campo (M10 Passo 3):
 * - cloze: processa lacunas Anki
 * - edit: ignora edit: e aplica o resto (add-on Edit Field During Review), sem warning
 * - clickable: devolve o valor como está (ex.: {{clickable::Tags}} devolve tags separadas por espaço)
 * - cloze-only / tts: removidos da saída (sem áudio no MVP)
 * - hint: gera componente expansível <details class="hint">
 * - text: remove tags HTML e decodifica entidades
 * - type: mostra o campo (sem campo de digitação no MVP)
 * - filtros desconhecidos: exibem o valor cru e registram UM aviso por modelo no log.
 */
export function applyFilter(
  filterName: string,
  value: string,
  fieldName: string,
  context: RenderContext
): string {
  const normalizedFilter = filterName.trim().toLowerCase();

  if (normalizedFilter === 'tts' || normalizedFilter.startsWith('tts ')) {
    return '';
  }

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

    case 'edit': {
      return value;
    }

    case 'clickable': {
      return value;
    }

    case 'cloze-only': {
      return '';
    }

    case 'weiss-tags': {
      const text = stripHtml(value || (context.tags ? context.tags.join(' ') : '')).trim();
      if (!text) {
        return '';
      }
      const tagList = text.split(/\s+/).filter(Boolean);
      return tagList
        .map((tag) => `<span class="tag-pill">${tag}</span>`)
        .join(' ');
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
      const modelKey = context.modelName ?? context.cardName ?? 'default';
      const warnKey = `${modelKey}::${normalizedFilter}`;
      if (!warnedFiltersByModel.has(warnKey)) {
        warnedFiltersByModel.add(warnKey);
        const msg = `[Folio Render] Filtro desconhecido: "${filterName}" no campo "${fieldName}" (modelo "${modelKey}"). Mostrando campo cru.`;
        console.warn(msg);
        logWarn('Render', msg);
      }
      return value;
    }
  }
}
