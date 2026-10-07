import {
  lightTheme,
  darkTheme,
  lightAnnotationColors,
  darkAnnotationColors,
  AnnotationColorName,
} from '../theme';

describe('Design Tokens e Tema (src/ui/theme)', () => {
  const requiredThemeKeys = [
    'canvas',
    'elevated',
    'elevated2',
    'border',
    'fg',
    'fgMuted',
    'accent',
    'learn',
  ] as const;

  test('lightTheme contém todos os tokens com as cores exatas do AGENTS.md (Calmcoder)', () => {
    for (const key of requiredThemeKeys) {
      expect(lightTheme[key]).toBeDefined();
      expect(typeof lightTheme[key]).toBe('string');
    }
    expect(lightTheme.canvas).toBe('#f0f4f0');
    expect(lightTheme.elevated).toBe('#ffffff');
    expect(lightTheme.elevated2).toBe('#e0e8e8');
    expect(lightTheme.border).toBe('#e0e6e6');
    expect(lightTheme.fg).toBe('#203e3a');
    expect(lightTheme.fgMuted).toBe('#5b858b');
    expect(lightTheme.accent).toBe('#3a9d7f');
    expect(lightTheme.learn).toBe('#b8941f');
  });

  test('darkTheme contém todos os tokens com as cores exatas do AGENTS.md (Noctis Obscuro)', () => {
    for (const key of requiredThemeKeys) {
      expect(darkTheme[key]).toBeDefined();
      expect(typeof darkTheme[key]).toBe('string');
    }
    expect(darkTheme.canvas).toBe('#031417');
    expect(darkTheme.elevated).toBe('#062e32');
    expect(darkTheme.elevated2).toBe('#083f44');
    expect(darkTheme.border).toBe('#083f44');
    expect(darkTheme.fg).toBe('#b2cacd');
    expect(darkTheme.fgMuted).toBe('#87a7ab');
    expect(darkTheme.accent).toBe('#169fb1');
    expect(darkTheme.learn).toBe('#d5971a');
  });

  test('cores de anotação contêm as 5 cores definidas no MODO_CONSULTA.md', () => {
    const cores: AnnotationColorName[] = ['amarelo', 'verde', 'azul', 'rosa', 'laranja'];

    for (const cor of cores) {
      expect(lightAnnotationColors[cor]).toBeDefined();
      expect(lightAnnotationColors[cor].highlight).toContain('rgba(');
      expect(lightAnnotationColors[cor].underline).toBeDefined();

      expect(darkAnnotationColors[cor]).toBeDefined();
      expect(darkAnnotationColors[cor].highlight).toContain('rgba(');
      expect(darkAnnotationColors[cor].underline).toBeDefined();
    }

    expect(lightAnnotationColors.amarelo.underline).toBe('#d6a400');
    expect(darkAnnotationColors.amarelo.underline).toBe('#f2c94c');
  });
});
