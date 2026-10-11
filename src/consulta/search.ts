import type { ConsultaUnit } from './units';

export interface ConsultaFilter {
  /** Termo de busca textual (frente + verso + tags sem acento e sem caixa) */
  query?: string;
  /** Se verdadeiro, filtra apenas unidades que possuem anotações ativas */
  onlyWithAnnotations?: boolean;
}

/**
 * Normaliza um texto para busca:
 * - Decompõe acentos e caracteres diacríticos (NFD) e remove-os ([\u0300-\u036f])
 * - Converte para minúsculas (case-insensitive)
 * - Remove espaços excedentes das bordas
 */
export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Remove tags HTML, estilos, scripts e decodifica entidades para extrair o texto puro.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica se todos os termos (tokens separados por espaço) da busca estão contidos no conteúdo,
 * ignorando acentos e maiúsculas/minúsculas.
 */
export function matchesSearchText(content: string, query: string): boolean {
  if (!query || query.trim().length === 0) return true;
  if (!content) return false;

  const normalizedContent = normalizeSearchText(content);
  const queryTokens = normalizeSearchText(query)
    .split(/\s+/)
    .filter(Boolean);

  if (queryTokens.length === 0) return true;

  return queryTokens.every((token) => normalizedContent.includes(token));
}

/**
 * Verifica se uma unidade da Consulta corresponde aos filtros aplicados:
 * - Busca textual (frente + verso + tags) ignorando acento e caixa (MODO_CONSULTA.md §3)
 * - Interruptor "só unidades com anotação"
 */
export function matchesConsultaUnit(
  unit: Pick<ConsultaUnit, 'frontHtml' | 'backHtml' | 'tags' | 'annotations'>,
  filter: ConsultaFilter
): boolean {
  // 1. Filtro "só unidades com anotação"
  if (filter.onlyWithAnnotations) {
    if (!unit.annotations || unit.annotations.length === 0) {
      return false;
    }
  }

  // 2. Filtro textual
  if (!filter.query || filter.query.trim().length === 0) {
    return true;
  }

  const frontText = stripHtml(unit.frontHtml);
  const backText = stripHtml(unit.backHtml);
  const tagsText = (unit.tags ?? [])
    .map((t) => (t.startsWith('#') ? `${t} ${t.slice(1)}` : `${t} #${t}`))
    .join(' ');
  const fullText = `${frontText} ${backText} ${tagsText}`;

  return matchesSearchText(fullText, filter.query);
}

/**
 * Filtra uma coleção de ConsultaUnit segundo o filtro fornecido e reordena os índices sequencialmente.
 */
export function filterConsultaUnits(
  units: ConsultaUnit[],
  filter: ConsultaFilter
): ConsultaUnit[] {
  const filtered = units.filter((u) => matchesConsultaUnit(u, filter));
  return filtered.map((unit, idx) => ({
    ...unit,
    index: idx,
  }));
}
