/**
 * @jest-environment jsdom
 */

import { buildAnkiDocument } from '../ankiDocument';
import { ANKING_FIXTURE, AVICENA_FIXTURE } from '../__fixtures__';

describe('Documento HTML no formato do Anki (M10 Passo 2)', () => {
  test('gera classes corretas em html e body no tema claro e exatamente um #qa', () => {
    const docString = buildAnkiDocument({
      html: '<div class="main question-field">Pergunta avicena</div>',
      side: 'front',
      theme: 'light',
      css: AVICENA_FIXTURE.styleCss,
      isBuiltinModel: false,
      cardOrd: 0,
    });

    const parser = new DOMParser();
    const doc = parser.parseFromString(docString, 'text/html');

    const htmlEl = doc.documentElement;
    const bodyEl = doc.body;

    expect(htmlEl.classList.contains('mobile')).toBe(true);
    expect(htmlEl.classList.contains('android')).toBe(true);
    expect(htmlEl.classList.contains('js')).toBe(true);
    expect(htmlEl.classList.contains('nightMode')).toBe(false);
    expect(htmlEl.classList.contains('night_mode')).toBe(false);
    expect(htmlEl.classList.contains('night-mode')).toBe(false);

    expect(bodyEl.classList.contains('card')).toBe(true);
    expect(bodyEl.classList.contains('card1')).toBe(true);
    expect(bodyEl.classList.contains('nightMode')).toBe(false);

    const qaElements = doc.querySelectorAll('#qa');
    expect(qaElements).toHaveLength(1);
    expect(qaElements[0].innerHTML).toContain('Pergunta avicena');
  });

  test('gera classes nightMode night_mode night-mode em html e body no tema escuro e card{ORD+1}', () => {
    const docString = buildAnkiDocument({
      html: '<div id="text">Cloze 2</div>',
      side: 'back',
      theme: 'dark',
      css: ANKING_FIXTURE.styleCss,
      isBuiltinModel: false,
      cardOrd: 1,
    });

    const parser = new DOMParser();
    const doc = parser.parseFromString(docString, 'text/html');

    const htmlEl = doc.documentElement;
    const bodyEl = doc.body;

    expect(htmlEl.classList.contains('mobile')).toBe(true);
    expect(htmlEl.classList.contains('android')).toBe(true);
    expect(htmlEl.classList.contains('js')).toBe(true);
    expect(htmlEl.classList.contains('nightMode')).toBe(true);
    expect(htmlEl.classList.contains('night_mode')).toBe(true);
    expect(htmlEl.classList.contains('night-mode')).toBe(true);

    expect(bodyEl.classList.contains('card')).toBe(true);
    expect(bodyEl.classList.contains('card2')).toBe(true);
    expect(bodyEl.classList.contains('nightMode')).toBe(true);
    expect(bodyEl.classList.contains('night_mode')).toBe(true);
    expect(bodyEl.classList.contains('night-mode')).toBe(true);
  });

  test('injeta o CSS do modelo importado em #note-css SEM escopo (.card-root) e SEM BASE_CARD_STYLES', () => {
    const docString = buildAnkiDocument({
      html: '<div class="main question-field">Pergunta</div>',
      side: 'front',
      theme: 'light',
      css: AVICENA_FIXTURE.styleCss,
      isBuiltinModel: false,
      cardOrd: 0,
    });

    const parser = new DOMParser();
    const doc = parser.parseFromString(docString, 'text/html');

    const noteCssEl = doc.getElementById('note-css');
    const resetCssEl = doc.getElementById('weiss-reset');
    const overlayCssEl = doc.getElementById('weiss-overlay');

    expect(noteCssEl).not.toBeNull();
    expect(resetCssEl).not.toBeNull();
    expect(overlayCssEl).not.toBeNull();

    const cssText = noteCssEl?.textContent ?? '';
    expect(cssText).toContain('background-color: #e4ebe4;');
    expect(cssText).toContain('.nightMode.card');
    expect(cssText).not.toContain('.card-root');
    expect(cssText).not.toContain('--folio-canvas-light');
  });

  test('inclui BASE_CARD_STYLES apenas para modelos embutidos do Weiss ou modelos com CSS vazio', () => {
    const emptyCssDoc = buildAnkiDocument({
      html: '<p>Sem CSS</p>',
      side: 'front',
      theme: 'light',
      css: '',
    });

    const builtinDoc = buildAnkiDocument({
      html: '<p>Modelo embutido</p>',
      side: 'front',
      theme: 'light',
      css: '.card { font-size: 18px; }',
      isBuiltinModel: true,
    });

    expect(emptyCssDoc).toContain('--folio-canvas-light');
    expect(builtinDoc).toContain('--folio-canvas-light');
  });
});
