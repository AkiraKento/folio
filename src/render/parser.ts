export type TemplateNode =
  | { type: 'text'; value: string }
  | {
      type: 'tag';
      raw: string;
      filters: string[];
      fieldName: string;
    }
  | {
      type: 'conditional';
      fieldName: string;
      inverted: boolean;
      children: TemplateNode[];
    };

/**
 * Regex para capturar tags Anki/Mustache:
 * {{FieldName}}, {{{FieldName}}}, {{#FieldName}}, {{^FieldName}}, {{/FieldName}}, {{filter:FieldName}}
 * Suporta espaços e caracteres acentuados.
 */
const TAG_REGEX = /\{\{\{?\s*([#^/]?)\s*([^{}]*?)\s*\}\}\}?/g;

interface StackFrame {
  node: {
    type: 'conditional';
    fieldName: string;
    inverted: boolean;
    children: TemplateNode[];
  };
  parentChildren: TemplateNode[];
}

/**
 * Converte a string de template em uma Árvore Sintática Abstrata (AST).
 * Suporta blocos condicionais aninhados ({{#Campo}} e {{^Campo}}) e encadeamento de filtros.
 */
export function parseTemplate(template: string): TemplateNode[] {
  if (!template) {
    return [];
  }

  const root: TemplateNode[] = [];
  const stack: StackFrame[] = [];

  const getCurrentContainer = (): TemplateNode[] => {
    if (stack.length > 0) {
      return stack[stack.length - 1].node.children;
    }
    return root;
  };

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG_REGEX.exec(template)) !== null) {
    const matchIndex = match.index;
    const fullMatch = match[0];
    const prefix = match[1] || '';
    const inner = match[2]?.trim() || '';

    // Adiciona texto literal anterior à tag, se houver
    if (matchIndex > lastIndex) {
      const text = template.slice(lastIndex, matchIndex);
      getCurrentContainer().push({ type: 'text', value: text });
    }

    lastIndex = matchIndex + fullMatch.length;

    if (!inner) {
      continue;
    }

    if (prefix === '#') {
      // Início de condicional positiva
      const frame: StackFrame = {
        node: {
          type: 'conditional',
          fieldName: inner,
          inverted: false,
          children: [],
        },
        parentChildren: getCurrentContainer(),
      };
      stack.push(frame);
    } else if (prefix === '^') {
      // Início de condicional invertida
      const frame: StackFrame = {
        node: {
          type: 'conditional',
          fieldName: inner,
          inverted: true,
          children: [],
        },
        parentChildren: getCurrentContainer(),
      };
      stack.push(frame);
    } else if (prefix === '/') {
      // Fechamento de condicional
      const closingField = inner.toLowerCase();
      // Procura do topo para a base pelo frame correspondente
      let foundIndex = -1;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].node.fieldName.toLowerCase() === closingField) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex !== -1) {
        // Desempilha até o frame encontrado
        while (stack.length > foundIndex) {
          const popped = stack.pop()!;
          popped.parentChildren.push(popped.node);
        }
      }
    } else {
      // Tag de campo com ou sem filtros (ou FrontSide)
      const parts = inner.split(':');
      let filters: string[];
      let fieldName: string;

      if (parts.length === 1) {
        filters = [];
        fieldName = parts[0].trim();
      } else {
        filters = parts.slice(0, -1).map((f) => f.trim());
        fieldName = parts[parts.length - 1].trim();
      }

      getCurrentContainer().push({
        type: 'tag',
        raw: fullMatch,
        filters,
        fieldName,
      });
    }
  }

  // Texto restante após a última tag
  if (lastIndex < template.length) {
    const remainingText = template.slice(lastIndex);
    getCurrentContainer().push({ type: 'text', value: remainingText });
  }

  // Desempilha quaisquer frames que ficaram abertos
  while (stack.length > 0) {
    const popped = stack.pop()!;
    popped.parentChildren.push(popped.node);
  }

  return root;
}
