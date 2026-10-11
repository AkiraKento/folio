import { applyFilter, isFieldEmpty, stripHtml } from './filters';
import { parseTemplate, type TemplateNode } from './parser';
import type { RenderContext } from './types';

export { isFieldEmpty, stripHtml };

/**
 * Resolve o valor bruto de um campo ou campo especial Anki (FrontSide, Tags, Deck, Subdeck, Card).
 */
function resolveFieldValue(fieldName: string, context: RenderContext): string {
  const normalized = fieldName.trim();

  // Tratamento de FrontSide
  if (normalized.toLowerCase() === 'frontside') {
    if (context.side === 'back') {
      return context.frontHtml ?? '';
    }
    return '';
  }

  // Campos especiais do Anki
  if (normalized.toLowerCase() === 'tags') {
    return (context.tags ?? []).join(' ');
  }

  if (normalized.toLowerCase() === 'deck') {
    return context.deckName ?? '';
  }

  if (normalized.toLowerCase() === 'subdeck') {
    if (!context.deckName) {
      return '';
    }
    const parts = context.deckName.split('::');
    return parts[parts.length - 1] ?? '';
  }

  if (normalized.toLowerCase() === 'card') {
    return context.cardName ?? '';
  }

  // Busca nos campos da nota (primeiro exato, depois case-insensitive)
  if (context.fields[normalized] !== undefined) {
    return context.fields[normalized];
  }

  const lower = normalized.toLowerCase();
  for (const [key, value] of Object.entries(context.fields)) {
    if (key.toLowerCase() === lower) {
      return value;
    }
  }

  return '';
}

/**
 * Avalia uma lista de nós AST contra o contexto de renderização.
 */
function evaluateNodes(nodes: TemplateNode[], options: RenderContext): string {
  let output = '';

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        output += node.value;
        break;

      case 'conditional': {
        const rawValue = resolveFieldValue(node.fieldName, options);
        const empty = isFieldEmpty(rawValue);
        const shouldRender = node.inverted ? empty : !empty;

        if (shouldRender) {
          output += evaluateNodes(node.children, options);
        }
        break;
      }

      case 'tag': {
        let val = resolveFieldValue(node.fieldName, options);

        // Aplica a cadeia de filtros do mais interno para o mais externo (direita para esquerda)
        for (let i = node.filters.length - 1; i >= 0; i--) {
          val = applyFilter(node.filters[i], val, node.fieldName, options);
        }

        output += val;
        break;
      }
    }
  }

  return output;
}

/**
 * Renderiza uma string de template aplicando os campos, filtros, condicionais e campos especiais.
 */
export function renderTemplate(template: string, options: RenderContext): string {
  if (!template) {
    return '';
  }

  const ast = parseTemplate(template);
  return evaluateNodes(ast, options);
}
