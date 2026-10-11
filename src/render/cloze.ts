import type { ClozeProcessOptions } from './types';

/**
 * Regex para capturar lacunas Anki Cloze: {{c1::resposta}} ou {{c1::resposta::dica}}.
 * O interior após cN:: é capturado de forma preguiçosa até o fechamento }}, incluindo quebras de linha ([\s\S]).
 */
const CLOZE_REGEX = /\{\{c(\d+)::([\s\S]*?)\}\}/g;

/**
 * Extrai todos os números únicos de lacunas cloze (1-indexed: 1 para c1, 2 para c2...)
 * presentes em um texto ou conteúdo de campo, ordenados em ordem crescente.
 */
export function extractClozeNumbers(text: string): number[] {
  if (!text || !text.includes('{{c')) {
    return [];
  }

  const numbers = new Set<number>();
  const regex = new RegExp(CLOZE_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0) {
      numbers.add(num);
    }
  }

  return Array.from(numbers).sort((a, b) => a - b);
}

/**
 * Renderiza um texto com todas as lacunas reveladas e destacadas com <span class="cloze">.
 * Usado pelo Modo Consulta (onde uma nota aparece inteira como texto contínuo).
 */
export function renderAllClozesRevealed(text: string): string {
  return processCloze(text, {
    side: 'back',
    targetClozeNumber: 1,
    allClozesRevealed: true,
  });
}

/**
 * Processa lacunas Anki Cloze em um texto HTML.
 *
 * Regras:
 * - Na frente (front):
 *   - Lacuna ativa (c == targetClozeNumber):
 *     - Sem dica (ou dica vazia): <span class="cloze">[...]</span>
 *     - Com dica: <span class="cloze">[dica]</span>
 *   - Lacuna inativa: o texto da resposta é revelado normalmente (sem tags de cloze ou dica).
 * - No verso (back):
 *   - Lacuna ativa: <span class="cloze">resposta</span>
 *   - Lacuna inativa: o texto da resposta é revelado normalmente.
 * - Modo Consulta (allClozesRevealed = true):
 *   - Todas as lacunas c1, c2, ... aparecem reveladas como <span class="cloze">resposta</span>.
 */
export function processCloze(text: string, options: ClozeProcessOptions): string {
  if (!text || !text.includes('{{c')) {
    return text;
  }

  return text.replace(CLOZE_REGEX, (_fullMatch, clozeNumStr: string, inner: string) => {
    const clozeNumber = parseInt(clozeNumStr, 10);
    const parts = inner.split('::');

    let answer: string;
    let hint: string | undefined;

    if (parts.length === 1) {
      answer = parts[0];
      hint = undefined;
    } else {
      answer = parts.slice(0, -1).join('::');
      hint = parts[parts.length - 1];
    }

    if (options.allClozesRevealed) {
      return `<span class="cloze">${answer}</span>`;
    }

    const isActive = clozeNumber === options.targetClozeNumber;

    if (options.side === 'front') {
      if (isActive) {
        const trimmedHint = hint?.trim();
        if (trimmedHint && trimmedHint.length > 0) {
          return `<span class="cloze">[${trimmedHint}]</span>`;
        }
        return '<span class="cloze">[...]</span>';
      }
      return answer;
    }

    // side === 'back'
    if (isActive) {
      return `<span class="cloze">${answer}</span>`;
    }
    return answer;
  });
}
