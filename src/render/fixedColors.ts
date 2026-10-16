import { getColorLightness } from '@/ui/colorUtils';

/**
 * Remove declarações inline de `color` (luminância < 0.25) e `background-color` (luminância > 0.85)
 * em modo escuro para garantir legibilidade de cards com cores fixas (M10 Passo 8).
 * Cores médias (como azul rgb(0, 0, 255), vermelho, verde) são preservadas.
 */
export function adjustFixedColorsForDarkMode(html: string): string {
  if (!html || typeof html !== 'string') {
    return html ?? '';
  }

  let result = html;

  // 1. Trata atributos style="..." ou style='...'
  if (result.includes('style=')) {
    result = result.replace(
      /\s*\bstyle=(["'])(.*?)\1/gi,
      (_fullMatch, quote, styleContent) => {
        const declarations = styleContent.split(';');
        const remaining: string[] = [];

        for (const decl of declarations) {
          const trimmed = decl.trim();
          if (!trimmed) continue;

          const colonIdx = trimmed.indexOf(':');
          if (colonIdx === -1) {
            remaining.push(trimmed);
            continue;
          }

          const prop = trimmed.slice(0, colonIdx).trim().toLowerCase();
          const val = trimmed.slice(colonIdx + 1).trim();

          // Regra 1: Remover color inline se luminância < 0.25
          if (prop === 'color') {
            const lightness = getColorLightness(val);
            if (lightness < 0.25) {
              // Remove a declaração de cor preta/muito escura
              continue;
            }
          }

          // Regra 2: Remover background-color / background inline se luminância > 0.85
          if (prop === 'background-color' || prop === 'background') {
            // Se for imagem ou gradiente (url( ou gradient), mantém
            if (/url\(|gradient\(/i.test(val)) {
              remaining.push(trimmed);
              continue;
            }
            const lightness = getColorLightness(val);
            if (lightness > 0.85) {
              // Remove a declaração de fundo branco/muito claro
              continue;
            }
          }

          remaining.push(trimmed);
        }

        if (remaining.length === 0) {
          return '';
        }

        return ` style=${quote}${remaining.join('; ')}${quote}`;
      }
    );
  }

  // 2. Trata tags antigas <font color="..."> com cor escura (< 0.25)
  if (result.includes('color=')) {
    result = result.replace(
      /\s*\bcolor=(["'])(.*?)\1/gi,
      (match, _quote, val) => {
        const lightness = getColorLightness(val);
        return lightness < 0.25 ? '' : match;
      }
    );
  }

  // Limpa tags que possam ter ficado com espaços residuais antes de '>'
  return result
    .replace(/<([a-z0-9]+)\s+>/gi, '<$1>')
    .replace(/<([a-z0-9]+)\s+style=["']\s*["']/gi, '<$1');
}
