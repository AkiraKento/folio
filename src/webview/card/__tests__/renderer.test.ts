/**
 * @jest-environment jsdom
 */

import { renderCardToDom } from '../renderer';

describe('Renderizador de Card Único para WebView (src/webview/card/renderer)', () => {
  let rootElement: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    rootElement = document.getElementById('root') as HTMLElement;
  });

  test('renderiza conteúdo sanitizado com classes de tema e lado', () => {
    const result = renderCardToDom(rootElement, {
      html: '<p>Qual o tratamento da <b>IC</b>?</p><script>alert(1)</script>',
      side: 'front',
      theme: 'light',
    });

    expect(result.side).toBe('front');
    expect(rootElement.innerHTML).toContain('Qual o tratamento da <b>IC</b>?');
    expect(rootElement.innerHTML).not.toContain('<script');

    const cardRoot = rootElement.querySelector('.card-root');
    expect(cardRoot).not.toBeNull();
    expect(cardRoot?.classList.contains('theme-light')).toBe(true);
    expect(cardRoot?.classList.contains('side-front')).toBe(true);
  });

  test('injeta CSS do note type em #note-css sem escopo .card-root e monta #qa', () => {
    renderCardToDom(rootElement, {
      html: '<p class="minha-pergunta">Texto</p>',
      side: 'front',
      theme: 'dark',
      css: '.card { font-size: 22px; } .minha-pergunta { color: red; }',
      isBuiltinModel: false,
    });

    const styleEl = rootElement.querySelector('#note-css') as HTMLStyleElement;
    expect(styleEl).not.toBeNull();
    expect(styleEl.textContent).toContain('.card { font-size: 22px; }');
    expect(styleEl.textContent).toContain('.minha-pergunta { color: red; }');
    expect(styleEl.textContent).not.toContain('.card-root');

    const qaEl = rootElement.querySelector('#qa');
    expect(qaEl).not.toBeNull();

    const cardRoot = rootElement.querySelector('.card-root');
    expect(cardRoot?.classList.contains('theme-dark')).toBe(true);
    expect(cardRoot?.classList.contains('nightMode')).toBe(true);
  });


  test('resolve caminhos de imagens relativas para o mediaBasePath', () => {
    renderCardToDom(rootElement, {
      html: '<div>Radiografia:<br><img src="raio_x.jpg" alt="RX" /></div>',
      side: 'back',
      mediaBasePath: 'file:///data/user/0/folio/files/media/',
    });

    const img = rootElement.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('file:///data/user/0/folio/files/media/raio_x.jpg');
    expect(img.getAttribute('alt')).toBe('RX');
  });

  test('renderiza verso e atualiza lado de front para back', () => {
    renderCardToDom(rootElement, {
      html: '<p>Frente</p>',
      side: 'front',
    });

    expect(rootElement.querySelector('.side-front')).not.toBeNull();
    expect(rootElement.querySelector('.side-back')).toBeNull();

    renderCardToDom(rootElement, {
      html: '<p>Verso com resposta</p>',
      side: 'back',
    });

    expect(rootElement.querySelector('.side-front')).toBeNull();
    expect(rootElement.querySelector('.side-back')).not.toBeNull();
    expect(rootElement.innerHTML).toContain('Verso com resposta');
  });

  test('aplica anotações no verso quando side === "back"', () => {
    renderCardToDom(rootElement, {
      html: '<p>O tratamento da insuficiência cardíaca é complexo.</p>',
      side: 'back',
      annotations: [
        {
          id: 'ann-1',
          kind: 'hl',
          color: 'amarelo',
          quote: 'insuficiência cardíaca',
          start: 16,
          end: 38,
        },
      ],
    });

    const mark = rootElement.querySelector('mark[data-aid="ann-1"]');
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe('insuficiência cardíaca');
    expect(mark?.classList.contains('c-amarelo')).toBe(true);
    expect(mark?.classList.contains('hl')).toBe(true);
  });

  test('NÃO aplica anotações na frente do card para não entregar resposta (MODO_CONSULTA.md §6)', () => {
    renderCardToDom(rootElement, {
      html: '<p>Qual a primeira linha na insuficiência cardíaca?</p>',
      side: 'front',
      annotations: [
        {
          id: 'ann-1',
          kind: 'hl',
          color: 'amarelo',
          quote: 'insuficiência cardíaca',
        },
      ],
    });

    const mark = rootElement.querySelector('mark[data-aid="ann-1"]');
    expect(mark).toBeNull();
    expect(rootElement.querySelectorAll('mark').length).toBe(0);
  });

  test('respeita showHighlights === false mesmo no verso', () => {
    renderCardToDom(rootElement, {
      html: '<p>Verso com insuficiência cardíaca</p>',
      side: 'back',
      showHighlights: false,
      annotations: [
        {
          id: 'ann-1',
          kind: 'hl',
          color: 'verde',
          quote: 'insuficiência cardíaca',
        },
      ],
    });

    const mark = rootElement.querySelector('mark[data-aid="ann-1"]');
    expect(mark).toBeNull();
  });

  test('abre balão tooltip ao clicar em trecho com nota', () => {
    renderCardToDom(rootElement, {
      html: '<p>Os quatro pilares da ICFEr.</p>',
      side: 'back',
      annotations: [
        {
          id: 'ann-note-1',
          kind: 'hl',
          color: 'azul',
          quote: 'quatro pilares',
          note: 'IECA/BRA + BB + ARM + iSGLT2',
        },
      ],
    });

    const mark = rootElement.querySelector('mark[data-aid="ann-note-1"]') as HTMLElement;
    expect(mark).not.toBeNull();
    expect(mark.classList.contains('has-note')).toBe(true);

    // Antes do clique, tooltip não existe
    expect(rootElement.querySelector('.card-note-tooltip')).toBeNull();

    // Simula clique no mark
    mark.click();

    // Tooltip deve ser criado com a nota
    const tooltip = rootElement.querySelector('.card-note-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toBe('IECA/BRA + BB + ARM + iSGLT2');

    // Clicar no tooltip fecha o tooltip
    (tooltip as HTMLElement).click();
    expect(rootElement.querySelector('.card-note-tooltip')).toBeNull();
  });
});

