import { scopeCss } from '../css-scope';

describe('Escopo de CSS do Note Type (src/webview/card/css-scope)', () => {
  test('retorna string vazia para entrada vazia ou em branco', () => {
    expect(scopeCss('')).toBe('');
    expect(scopeCss('   ')).toBe('');
  });

  test('prefixa seletores simples com .card-root', () => {
    const input = '.card { font-size: 18px; color: black; }';
    const output = scopeCss(input, '.card-root');
    expect(output).toContain('.card-root .card { font-size: 18px; color: black; }');
  });

  test('substitui seletores body e html pelo seletor raiz para não afetar o documento global', () => {
    const input = `
      html { height: 100%; }
      body { margin: 0; background-color: #fff; }
    `;
    const output = scopeCss(input, '.card-root');
    expect(output).not.toMatch(/(^|\s)body\s*\{/);
    expect(output).not.toMatch(/(^|\s)html\s*\{/);
    expect(output).toContain('.card-root { margin: 0; background-color: #fff; }');
  });

  test('prefixa múltiplos seletores separados por vírgula', () => {
    const input = 'h1, h2, .destaque { color: #3a9d7f; margin-bottom: 8px; }';
    const output = scopeCss(input, '.card-root');
    expect(output).toContain('.card-root h1, .card-root h2, .card-root .destaque { color: #3a9d7f; margin-bottom: 8px; }');
  });

  test('prefixa regras dentro de blocos @media e @supports mantendo a condição', () => {
    const input = `
      @media screen and (max-width: 480px) {
        .card { font-size: 14px; }
        .cloze { font-weight: bold; }
      }
    `;
    const output = scopeCss(input, '.card-root');
    expect(output).toContain('@media screen and (max-width: 480px)');
    expect(output).toContain('.card-root .card { font-size: 14px; }');
    expect(output).toContain('.card-root .cloze { font-weight: bold; }');
  });

  test('preserva blocos @keyframes e @font-face sem prefixar com .card-root', () => {
    const input = `
      @keyframes fade {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @font-face {
        font-family: 'MinhaFonte';
        src: local('Arial');
      }
    `;
    const output = scopeCss(input, '.card-root');
    expect(output).not.toContain('.card-root from');
    expect(output).not.toContain('.card-root to');
    expect(output).not.toContain('.card-root @font-face');
    expect(output).toContain('@keyframes fade');
    expect(output).toContain('@font-face');
  });

  test('remove ou tolera comentários CSS sem quebrar a sintaxe', () => {
    const input = `
      /* Estilo geral */
      .card { text-align: center; }
      /* Destaque cloze */
      .cloze { color: blue; }
    `;
    const output = scopeCss(input, '.card-root');
    expect(output).toContain('.card-root .card { text-align: center; }');
    expect(output).toContain('.card-root .cloze { color: blue; }');
  });
});
