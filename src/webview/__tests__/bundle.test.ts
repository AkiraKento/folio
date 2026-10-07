import { helloHtml } from '../generated/hello.html';

describe('Pipeline WebView Bundles (src/webview)', () => {
  test('bundle helloHtml é gerado e contém tags HTML essenciais', () => {
    expect(helloHtml).toBeDefined();
    expect(typeof helloHtml).toBe('string');
    expect(helloHtml.length).toBeGreaterThan(100);
    expect(helloHtml).toContain('<!DOCTYPE html>');
    expect(helloHtml).toContain('<div id="root"></div>');
    expect(helloHtml).toContain('<script>');
    expect(helloHtml).toContain('Folio WebView');
  });
});
