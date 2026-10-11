/**
 * @jest-environment jsdom
 */

import { sanitizeCardHtml } from '../sanitize';

describe('Sanitização de HTML de Card com DOMPurify (src/webview/card/sanitize)', () => {
  test('remove tags script e seu conteúdo executável', () => {
    const input = '<div>Pergunta<script>alert("hack");</script></div>';
    const output = sanitizeCardHtml(input);
    expect(output).not.toContain('<script');
    expect(output).not.toContain('alert');
    expect(output).toContain('Pergunta');
  });

  test('remove atributos inline de eventos (on* e javascript:)', () => {
    const input = '<img src="foto.jpg" onerror="alert(1)" onclick="steal()" alt="Teste" />';
    const output = sanitizeCardHtml(input);
    expect(output).not.toContain('onerror');
    expect(output).not.toContain('onclick');
    expect(output).toContain('src="foto.jpg"');
    expect(output).toContain('alt="Teste"');
  });

  test('remove links com protocolo javascript:', () => {
    const input = '<a href="javascript:alert(1)">Clique aqui</a>';
    const output = sanitizeCardHtml(input);
    expect(output).not.toContain('javascript:');
    expect(output).toContain('Clique aqui');
  });

  test('remove iframes, embed, object e links externos de stylesheet', () => {
    const input = `
      <iframe src="https://evil.com"></iframe>
      <embed src="flash.swf">
      <object data="malware.pdf"></object>
      <link rel="stylesheet" href="https://evil.com/style.css">
      <p>Conteúdo legítimo</p>
    `;
    const output = sanitizeCardHtml(input);
    expect(output).not.toContain('<iframe');
    expect(output).not.toContain('<embed');
    expect(output).not.toContain('<object');
    expect(output).not.toContain('<link');
    expect(output).toContain('Conteúdo legítimo');
  });

  test('preserva tags de formatação ricas comuns em flashcards', () => {
    const input = `
      <p>Texto com <b>negrito</b>, <i>itálico</i>, <u>sublinhado</u> e <span class="cloze">lacuna cloze</span>.</p>
      <ul><li>Item 1</li><li>Item 2</li></ul>
      <table><tr><th>Cabeçalho</th></tr><tr><td>Dado</td></tr></table>
      <details><summary>Dica</summary>Detalhe oculto</details>
    `;
    const output = sanitizeCardHtml(input);
    expect(output).toContain('<b>negrito</b>');
    expect(output).toContain('<i>itálico</i>');
    expect(output).toContain('<u>sublinhado</u>');
    expect(output).toContain('<span class="cloze">lacuna cloze</span>');
    expect(output).toContain('Item 1');
    expect(output).toContain('<table>');
    expect(output).toContain('<details>');
    expect(output).toContain('<summary>Dica</summary>');
  });

  test('preserva atributos de estilo inline seguros', () => {
    const input = '<span style="color: red; font-size: 18px;">Destaque</span>';
    const output = sanitizeCardHtml(input);
    expect(output).toContain('style="color: red; font-size: 18px;"');
    expect(output).toContain('Destaque');
  });
});
