import { getColorLightness } from '@/ui/colorUtils';
import { adjustFixedColorsForDarkMode } from '../fixedColors';
import { sanitizeFieldHtml } from '../sanitizeField';
import { renderCard } from '../card';
import { ANKING_FIXTURE } from '../../webview/card/__fixtures__';

describe('M10 Passo 8 — Cores fixas no modo escuro', () => {
  describe('getColorLightness', () => {
    it('calcula luminosidade HSL de preto e cores muito escuras (< 0.25)', () => {
      expect(getColorLightness('rgb(0, 0, 0)')).toBe(0);
      expect(getColorLightness('rgb(0,0,0)')).toBe(0);
      expect(getColorLightness('#000')).toBe(0);
      expect(getColorLightness('#000000')).toBe(0);
      expect(getColorLightness('black')).toBe(0);
      expect(getColorLightness('rgb(30, 30, 30)')).toBeCloseTo(30 / 255, 2);
      expect(getColorLightness('rgb(30, 30, 30)')).toBeLessThan(0.25);
    });

    it('calcula luminosidade de cores médias (como azul rgb(0, 0, 255), mantidas)', () => {
      expect(getColorLightness('rgb(0, 0, 255)')).toBe(0.5);
      expect(getColorLightness('blue')).toBe(0.5);
      expect(getColorLightness('#0000ff')).toBe(0.5);
      expect(getColorLightness('rgb(255, 0, 0)')).toBe(0.5); // vermelho
      expect(getColorLightness('rgb(0, 128, 0)')).toBeCloseTo(0.251, 2); // verde
      expect(getColorLightness('rgb(0, 0, 255)')).toBeGreaterThanOrEqual(0.25);
      expect(getColorLightness('rgb(0, 0, 255)')).toBeLessThanOrEqual(0.85);
    });

    it('calcula luminosidade de branco e fundos muito claros (> 0.85)', () => {
      expect(getColorLightness('rgb(255, 255, 255)')).toBe(1.0);
      expect(getColorLightness('#fff')).toBe(1.0);
      expect(getColorLightness('#ffffff')).toBe(1.0);
      expect(getColorLightness('white')).toBe(1.0);
      expect(getColorLightness('rgb(240, 240, 240)')).toBeCloseTo(240 / 255, 2);
      expect(getColorLightness('rgb(240, 240, 240)')).toBeGreaterThan(0.85);
    });

    it('trata declarações com !important', () => {
      expect(getColorLightness('rgb(0, 0, 0) !important')).toBe(0);
      expect(getColorLightness('#ffffff !important')).toBe(1.0);
    });
  });

  describe('adjustFixedColorsForDarkMode', () => {
    it('remove color inline com luminância < 0.25', () => {
      const input = '<span style="color: rgb(0, 0, 0);">Texto preto</span>';
      const output = adjustFixedColorsForDarkMode(input);
      expect(output).toBe('<span>Texto preto</span>');
    });

    it('preserva outras propriedades CSS quando remove color', () => {
      const input = '<span style="color: rgb(0, 0, 0); font-weight: bold;">Texto negrito</span>';
      const output = adjustFixedColorsForDarkMode(input);
      expect(output).toBe('<span style="font-weight: bold">Texto negrito</span>');
    });

    it('preserva cores médias como o azul rgb(0, 0, 255)', () => {
      const input = '<span style="color: rgb(0, 0, 255);">Texto azul</span>';
      const output = adjustFixedColorsForDarkMode(input);
      expect(output).toContain('color: rgb(0, 0, 255)');
    });

    it('remove background-color inline com luminância > 0.85', () => {
      const input = '<div style="background-color: #ffffff; color: rgb(0, 0, 255);">Box</div>';
      const output = adjustFixedColorsForDarkMode(input);
      expect(output).not.toContain('background-color');
      expect(output).toContain('color: rgb(0, 0, 255)');
    });

    it('preserva gradientes e imagens em background', () => {
      const input = '<div style="background: linear-gradient(white, black);">Box</div>';
      const output = adjustFixedColorsForDarkMode(input);
      expect(output).toContain('linear-gradient');
    });

    it('remove cor preta em tag antiga <font color="#000000">', () => {
      const input = '<font color="#000000">Texto legado</font>';
      const output = adjustFixedColorsForDarkMode(input);
      expect(output).toBe('<font>Texto legado</font>');
    });
  });

  describe('sanitizeFieldHtml com opções de tema', () => {
    it('remove cor preta fixa em modo escuro quando ajuste ativado', () => {
      const raw = '<span style="color: rgb(0, 0, 0);">Texto</span>';
      const sanitized = sanitizeFieldHtml(raw, {
        isDark: true,
        adjustFixedColorsInDarkMode: true,
      });
      expect(sanitized).toBe('<span>Texto</span>');
    });

    it('mantém cor preta fixa em modo claro', () => {
      const raw = '<span style="color: rgb(0, 0, 0);">Texto</span>';
      const sanitized = sanitizeFieldHtml(raw, {
        isDark: false,
        adjustFixedColorsInDarkMode: true,
      });
      expect(sanitized).toBe('<span style="color: rgb(0, 0, 0);">Texto</span>');
    });

    it('mantém cor preta fixa em modo escuro quando ajuste desativado', () => {
      const raw = '<span style="color: rgb(0, 0, 0);">Texto</span>';
      const sanitized = sanitizeFieldHtml(raw, {
        isDark: true,
        adjustFixedColorsInDarkMode: false,
      });
      expect(sanitized).toBe('<span style="color: rgb(0, 0, 0);">Texto</span>');
    });
  });

  describe('renderCard com a fixture ANKING_FIXTURE', () => {
    const ankingNoteType = ANKING_FIXTURE.toNoteType();
    const exampleFields = ANKING_FIXTURE.example.fields;

    it('no escuro, trecho preto vira span sem cor inline e azul continua azul', () => {
      // O campo Text da fixture AnKing contém:
      // <span style="color: rgb(0, 0, 0);">A estimulação de exemplo ou</span><span style="color: rgb(0, 0, 255);"> {{c1::(termo)::Dica de exemplo}}&nbsp;</span> reduz {{c2::a frequência}}.
      const result = renderCard({
        noteType: ankingNoteType,
        fields: exampleFields,
        cardOrd: 0,
        tags: ANKING_FIXTURE.example.tags,
        theme: 'dark',
        adjustFixedColorsInDarkMode: true,
      });

      // 1. O trecho com "A estimulação de exemplo ou" não tem mais color: rgb(0, 0, 0)
      expect(result.front).not.toContain('color: rgb(0, 0, 0)');
      expect(result.front).toContain('A estimulação de exemplo ou');

      // 2. O trecho azul continua azul
      expect(result.front).toContain('color: rgb(0, 0, 255)');

      // 3. O verso também remove a cor preta e preserva o azul
      expect(result.back).not.toContain('color: rgb(0, 0, 0)');
      expect(result.back).toContain('color: rgb(0, 0, 255)');
    });

    it('no claro, preserva a cor preta original', () => {
      const result = renderCard({
        noteType: ankingNoteType,
        fields: exampleFields,
        cardOrd: 0,
        tags: ANKING_FIXTURE.example.tags,
        theme: 'light',
        adjustFixedColorsInDarkMode: true,
      });

      expect(result.front).toContain('color: rgb(0, 0, 0)');
      expect(result.front).toContain('color: rgb(0, 0, 255)');
    });

    it('no escuro com ajuste desativado, preserva a cor preta original', () => {
      const result = renderCard({
        noteType: ankingNoteType,
        fields: exampleFields,
        cardOrd: 0,
        tags: ANKING_FIXTURE.example.tags,
        theme: 'dark',
        adjustFixedColorsInDarkMode: false,
      });

      expect(result.front).toContain('color: rgb(0, 0, 0)');
      expect(result.front).toContain('color: rgb(0, 0, 255)');
    });
  });
});
