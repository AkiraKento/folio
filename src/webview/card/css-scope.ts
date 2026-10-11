/**
 * Escopa regras CSS de note type para que atuem exclusivamente dentro do container
 * do card (.card-root), evitando que vazem para a página global ou outros elementos.
 */

function cleanComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function scopeSelectorList(selectorsStr: string, rootSelector: string): string {
  const parts = selectorsStr.split(',');
  const scopedParts = parts.map((part) => {
    const trimmed = part.trim();
    if (!trimmed) return '';

    // Substitui body e html para aplicar direto no elemento raiz
    if (trimmed === 'body' || trimmed === 'html' || trimmed === ':root') {
      return rootSelector;
    }

    if (trimmed.startsWith('body ') || trimmed.startsWith('html ')) {
      return `${rootSelector} ${trimmed.slice(5).trim()}`;
    }

    if (trimmed.startsWith('body.') || trimmed.startsWith('html.')) {
      return `${rootSelector}${trimmed.slice(4).trim()}`;
    }

    // Se já começar com o seletor raiz, não duplica
    if (trimmed.startsWith(rootSelector)) {
      return trimmed;
    }

    return `${rootSelector} ${trimmed}`;
  });

  return scopedParts.filter(Boolean).join(', ');
}

export function scopeCss(rawCss: string, rootSelector = '.card-root'): string {
  if (!rawCss || typeof rawCss !== 'string' || !rawCss.trim()) {
    return '';
  }

  const css = cleanComments(rawCss).trim();
  const output: string[] = [];

  let i = 0;
  const len = css.length;

  while (i < len) {
    // Pular espaços em branco
    while (i < len && /\s/.test(css[i])) {
      i++;
    }
    if (i >= len) break;

    // Verificar se é uma regra @...
    if (css[i] === '@') {
      const atRuleHeaderEnd = css.indexOf('{', i);
      const semicolonIndex = css.indexOf(';', i);

      // At-rule sem bloco de chaves (ex: @import, @charset)
      if (semicolonIndex !== -1 && (atRuleHeaderEnd === -1 || semicolonIndex < atRuleHeaderEnd)) {
        output.push(css.slice(i, semicolonIndex + 1).trim());
        i = semicolonIndex + 1;
        continue;
      }

      if (atRuleHeaderEnd !== -1) {
        const header = css.slice(i, atRuleHeaderEnd).trim();
        const headerLower = header.toLowerCase();

        // Encontrar o fechamento balanceado de chaves
        let depth = 1;
        let blockEnd = atRuleHeaderEnd + 1;
        while (blockEnd < len && depth > 0) {
          if (css[blockEnd] === '{') depth++;
          else if (css[blockEnd] === '}') depth--;
          blockEnd++;
        }

        const blockContent = css.slice(atRuleHeaderEnd + 1, blockEnd - 1);

        if (headerLower.startsWith('@media') || headerLower.startsWith('@supports')) {
          const scopedInner = scopeCss(blockContent, rootSelector);
          output.push(`${header} {\n${scopedInner}\n}`);
        } else {
          // @keyframes, @font-face, etc. permanecem inalterados
          output.push(`${header} {\n${blockContent.trim()}\n}`);
        }

        i = blockEnd;
        continue;
      }
    }

    // Regra de estilo comum: selector { ... }
    const openBrace = css.indexOf('{', i);
    if (openBrace === -1) {
      break;
    }

    const selector = css.slice(i, openBrace).trim();
    let depth = 1;
    let closeBrace = openBrace + 1;
    while (closeBrace < len && depth > 0) {
      if (css[closeBrace] === '{') depth++;
      else if (css[closeBrace] === '}') depth--;
      closeBrace++;
    }

    const declarations = css.slice(openBrace + 1, closeBrace - 1).trim();

    if (selector) {
      const scopedSelector = scopeSelectorList(selector, rootSelector);
      output.push(`${scopedSelector} { ${declarations} }`);
    }

    i = closeBrace;
  }

  return output.join('\n');
}
