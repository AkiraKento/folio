import { applyFilter, isFieldEmpty, resetUnknownFilterWarnings, stripHtml } from './filters';
import { parseTemplate, type TemplateNode } from './parser';
import { sanitizeFieldHtml } from './sanitizeField';
import type { RenderContext } from './types';

export { isFieldEmpty, resetUnknownFilterWarnings, sanitizeFieldHtml, stripHtml };

/**
 * Resolve o valor de um campo da nota (sanitizado via DOMPurify antes da substituição)
 * ou campo especial do Anki (FrontSide, Tags, Deck, Subdeck, Card, CardFlag).
 */
function resolveFieldValue(fieldName: string, context: RenderContext): string {
  const normalized = fieldName.trim();
  if (!normalized) {
    return '';
  }

  const lower = normalized.toLowerCase();

  // Tratamento de FrontSide (já renderizado a partir do template da frente)
  if (lower === 'frontside') {
    if (context.side === 'back') {
      return context.frontHtml ?? '';
    }
    return '';
  }

  // Campos especiais do Anki
  if (lower === 'tags') {
    return (context.tags ?? []).join(' ');
  }

  if (lower === 'deck') {
    return context.deckName ?? '';
  }

  if (lower === 'subdeck') {
    if (!context.deckName) {
      return '';
    }
    const parts = context.deckName.split('::');
    return parts[parts.length - 1] ?? '';
  }

  if (lower === 'card') {
    return context.cardName ?? '';
  }

  if (lower === 'cardflag') {
    return context.cardFlag !== undefined ? String(context.cardFlag) : '';
  }

  // Busca nos campos da nota (primeiro exato, depois case-insensitive) e sanitiza o campo
  const sanitizeOptions = {
    isDark: context.theme === 'dark',
    adjustFixedColorsInDarkMode: context.adjustFixedColorsInDarkMode,
  };

  if (context.fields[normalized] !== undefined) {
    return sanitizeFieldHtml(context.fields[normalized], sanitizeOptions);
  }

  for (const [key, value] of Object.entries(context.fields)) {
    if (key.toLowerCase() === lower) {
      return sanitizeFieldHtml(value, sanitizeOptions);
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
 * Renderiza uma string de template aplicando os campos sanitizados, filtros, condicionais e campos especiais.
 * Preserva os <script> e comentários <!-- --> do template, removendo [sound:...].
 */
export function renderTemplate(template: string, options: RenderContext): string {
  if (!template) {
    return '';
  }

  const ast = parseTemplate(template);
  const rendered = evaluateNodes(ast, options);
  return rendered.replace(/\[sound:[^\]]*\]/gi, '');
}
