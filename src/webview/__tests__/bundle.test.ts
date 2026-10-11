import { cardHtml } from '../generated/card.html';
import { helloHtml } from '../generated/hello.html';
import { consultaHtml } from '../generated/consulta.html';

describe('Pipeline WebView Bundles (src/webview)', () => {
  test('bundle helloHtml é gerado e contém tags HTML essenciais', () => {
    expect(helloHtml).toBeDefined();
    expect(typeof helloHtml).toBe('string');
    expect(helloHtml.length).toBeGreaterThan(100);
    expect(helloHtml).toContain('<!DOCTYPE html>');
    expect(helloHtml).toContain('<div id="root"></div>');
    expect(helloHtml).toContain('<script>');
    expect(helloHtml).toContain('Weiss WebView');
  });

  test('bundle cardHtml é gerado com DOMPurify e renderizador de card empacotados', () => {
    expect(cardHtml).toBeDefined();
    expect(typeof cardHtml).toBe('string');
    expect(cardHtml.length).toBeGreaterThan(500);
    expect(cardHtml).toContain('<!DOCTYPE html>');
    expect(cardHtml).toContain('<div id="root"></div>');
    expect(cardHtml).toContain('Weiss - Card');
    // Verifica empacotamento do DOMPurify e renderizador
    expect(cardHtml).toContain('DOMPurify');
    expect(cardHtml).toContain('renderCardToDom');
  });

  test('bundle consultaHtml é gerado com DOMPurify, âncoras e renderizador empacotados', () => {
    expect(consultaHtml).toBeDefined();
    expect(typeof consultaHtml).toBe('string');
    expect(consultaHtml.length).toBeGreaterThan(500);
    expect(consultaHtml).toContain('<!DOCTYPE html>');
    expect(consultaHtml).toContain('<div id="root"></div>');
    expect(consultaHtml).toContain('Weiss - Consulta');
    // Verifica empacotamento do DOMPurify, âncoras e estilos da Consulta
    expect(consultaHtml).toContain('DOMPurify');
    expect(consultaHtml).toContain('renderUnitsBatch');
    expect(consultaHtml).toContain('deck-section-header');
  });
});

