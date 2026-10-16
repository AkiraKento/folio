/**
 * Utilitários de cor e luminância para sincronização de fundo e modo escuro (M10 Passo 7 e 8).
 */

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Faz o parse de cores hex (#fff, #ffffff, #ffff, #ffffffff), rgb(r, g, b), rgba(r, g, b, a) ou 'transparent'.
 */
export function parseCssColor(color: string | null | undefined): RgbaColor | null {
  if (!color) return null;
  const s = color.trim().toLowerCase();
  if (!s || s === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // Hex: #fff, #ffffff, #ffff, #ffffffff
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }

  // rgb(r, g, b) ou rgba(r, g, b, a)
  const rgbMatch = s.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/
  );
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10)));
    const a = rgbMatch[4] !== undefined ? Math.min(1, Math.max(0, parseFloat(rgbMatch[4]))) : 1;
    return { r, g, b, a };
  }

  return null;
}

/**
 * Converte qualquer cor CSS suportada para string rgba(r, g, b, a).
 * Se overrideAlpha for especificado, utiliza este valor no canal alpha.
 */
export function toRgbaString(color: string | null | undefined, overrideAlpha?: number): string {
  const parsed = parseCssColor(color);
  if (!parsed) {
    return color ?? 'rgba(0, 0, 0, 1)';
  }
  const a = overrideAlpha !== undefined ? overrideAlpha : parsed.a;
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${a})`;
}

/**
 * Calcula a luminância percebida normalizada no intervalo [0, 1].
 * Utiliza o modelo sRGB ITU-R BT.709 / WCAG.
 */
export function getLuminance(color: string | null | undefined): number {
  const parsed = parseCssColor(color);
  if (!parsed) return 0.5;

  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  return (
    0.2126 * toLinear(parsed.r) +
    0.7152 * toLinear(parsed.g) +
    0.0722 * toLinear(parsed.b)
  );
}

/**
 * Verifica se uma cor de fundo é considerada escura (luminância < 0.5).
 */
export function isColorDark(color: string | null | undefined): boolean {
  return getLuminance(color) < 0.5;
}
