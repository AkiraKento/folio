/**
 * @jest-environment jsdom
 */

import { resolveMediaSrc, rewriteMediaElements } from '../media';

describe('Resolução de Mídia para Cards (src/webview/card/media)', () => {
  const baseMedia = 'file:///data/user/0/folio/files/media/';

  test('retorna src inalterado se for URL web ou data URI', () => {
    expect(resolveMediaSrc('https://exemplo.com/imagem.png', baseMedia)).toBe('https://exemplo.com/imagem.png');
    expect(resolveMediaSrc('http://exemplo.com/imagem.png', baseMedia)).toBe('http://exemplo.com/imagem.png');
    expect(resolveMediaSrc('data:image/png;base64,iVBORw0KGgo...', baseMedia)).toBe('data:image/png;base64,iVBORw0KGgo...');
  });

  test('retorna src inalterado se mediaBasePath não for fornecido', () => {
    expect(resolveMediaSrc('coracao.jpg')).toBe('coracao.jpg');
    expect(resolveMediaSrc('coracao.jpg', undefined)).toBe('coracao.jpg');
  });

  test('concatena caminho relativo com mediaBasePath de forma limpa', () => {
    expect(resolveMediaSrc('coracao.jpg', baseMedia)).toBe('file:///data/user/0/folio/files/media/coracao.jpg');
    expect(resolveMediaSrc('./coracao.jpg', baseMedia)).toBe('file:///data/user/0/folio/files/media/coracao.jpg');
    expect(resolveMediaSrc('sub/esquema.png', 'file:///storage/media')).toBe('file:///storage/media/sub/esquema.png');
  });

  test('bloqueia ou neutraliza tentativas de path traversal (..)', () => {
    const malicious = '../../etc/passwd';
    const resolved = resolveMediaSrc(malicious, baseMedia);
    expect(resolved).not.toContain('..');
    expect(resolved.startsWith(baseMedia)).toBe(true);
  });

  test('rewriteMediaElements atualiza tags img dentro de um container DOM', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <p>Card com imagem</p>
      <img id="img1" src="cardio_ecg.png" alt="ECG" />
      <img id="img2" src="https://exemplo.com/web.png" alt="Web" />
    `;

    rewriteMediaElements(container, baseMedia);

    const img1 = container.querySelector('#img1') as HTMLImageElement;
    const img2 = container.querySelector('#img2') as HTMLImageElement;

    expect(img1.getAttribute('src')).toBe('file:///data/user/0/folio/files/media/cardio_ecg.png');
    expect(img2.getAttribute('src')).toBe('https://exemplo.com/web.png');
  });
});
