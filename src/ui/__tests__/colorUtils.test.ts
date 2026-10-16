import { getLuminance, isColorDark, parseCssColor, toRgbaString } from '../colorUtils';

describe('colorUtils (M10 Passo 7 e 8)', () => {
  describe('parseCssColor', () => {
    it('faz parse de hex de 3, 4, 6 e 8 dígitos', () => {
      expect(parseCssColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseCssColor('#000000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
      expect(parseCssColor('#3a9d7f')).toEqual({ r: 58, g: 157, b: 127, a: 1 });
      expect(parseCssColor('#ffffff80')?.a).toBeCloseTo(0.5, 1);
    });

    it('faz parse de rgb e rgba', () => {
      expect(parseCssColor('rgb(255, 255, 255)')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseCssColor('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    });

    it('trata transparent', () => {
      expect(parseCssColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    });

    it('retorna null para formatos inválidos', () => {
      expect(parseCssColor('')).toBeNull();
      expect(parseCssColor('invalid')).toBeNull();
    });
  });

  describe('toRgbaString', () => {
    it('converte hex para rgba com alpha customizado (ex.: 0.92 da barra flutuante)', () => {
      expect(toRgbaString('#ffffff', 0.92)).toBe('rgba(255, 255, 255, 0.92)');
      expect(toRgbaString('rgb(3, 20, 23)', 0.92)).toBe('rgba(3, 20, 23, 0.92)');
    });
  });

  describe('getLuminance e isColorDark', () => {
    it('branco tem luminância 1 e não é escuro', () => {
      expect(getLuminance('#ffffff')).toBeCloseTo(1.0, 2);
      expect(isColorDark('#ffffff')).toBe(false);
    });

    it('preto tem luminância 0 e é escuro', () => {
      expect(getLuminance('#000000')).toBeCloseTo(0.0, 2);
      expect(isColorDark('#000000')).toBe(true);
    });

    it('tema escuro do Weiss (#031417) é detectado como escuro', () => {
      expect(isColorDark('#031417')).toBe(true);
    });

    it('tema claro do Weiss (#f0f4f0) é detectado como claro', () => {
      expect(isColorDark('#f0f4f0')).toBe(false);
    });
  });
});
