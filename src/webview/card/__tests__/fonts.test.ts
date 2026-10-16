import { JSDOM } from 'jsdom';
import { buildAnkiDocument } from '../ankiDocument';
import { processModelCss } from '../modelCss';
import { WEISS_FONTS_CSS } from '../../generated/fonts';
import { AVICENA_FIXTURE, ANKING_FIXTURE } from '../__fixtures__';

describe('M10 Passo 6 — Fonte Lato offline', () => {
  describe('processModelCss', () => {
    it('remove @import do Google Fonts para a fonte Lato (sintaxe Avicena)', () => {
      const avicenaCss = `@import url('https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;1,400;1,700&display=swap');
.card { font-family: Lato, sans-serif; font-size: 20px; }`;

      const processed = processModelCss(avicenaCss);
      expect(processed).not.toContain('@import');
      expect(processed).toContain('.card { font-family: Lato, sans-serif; font-size: 20px; }');
    });

    it('remove @import do Google Fonts para a fonte Lato (sintaxe AnKing)', () => {
      const ankingCss = `@import url("https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;1,400;1,700&display=swap");
.card { font-family: Lato; }`;

      const processed = processModelCss(ankingCss);
      expect(processed).not.toContain('@import');
      expect(processed).toContain('.card { font-family: Lato; }');
    });

    it('remove outros @import remotos e dispara aviso em log', () => {
      const blockedUrls: string[] = [];
      const cssWithRemote = `@import url('https://fonts.googleapis.com/css2?family=Roboto');
@import "https://cdn.example.com/styles.css";
.content { color: blue; }`;

      const processed = processModelCss(cssWithRemote, (url) => {
        blockedUrls.push(url);
      });

      expect(processed).not.toContain('@import');
      expect(processed).toContain('.content { color: blue; }');
      expect(blockedUrls).toEqual([
        'https://fonts.googleapis.com/css2?family=Roboto',
        'https://cdn.example.com/styles.css',
      ]);
    });

    it('preserva CSS sem @import inalterado', () => {
      const plainCss = '.card { color: red; background: white; }';
      expect(processModelCss(plainCss)).toBe(plainCss);
    });
  });

  describe('WEISS_FONTS_CSS e buildAnkiDocument', () => {
    it('WEISS_FONTS_CSS contém regras @font-face para Lato 400, 700, 400 italic e 700 italic com data:font/woff2', () => {
      expect(WEISS_FONTS_CSS).toContain("font-family: 'Lato'");
      expect(WEISS_FONTS_CSS).toContain('font-weight: 400');
      expect(WEISS_FONTS_CSS).toContain('font-weight: 700');
      expect(WEISS_FONTS_CSS).toContain('font-style: italic');
      expect(WEISS_FONTS_CSS).toContain('font-style: normal');
      expect(WEISS_FONTS_CSS).toContain("url('data:font/woff2;base64,");
    });

    it('buildAnkiDocument injeta WEISS_FONTS_CSS em #weiss-fonts por padrão', () => {
      const docHtml = buildAnkiDocument({
        html: '<p>Texto em Lato</p>',
        side: 'front',
        theme: 'light',
        css: AVICENA_FIXTURE.styleCss,
        isBuiltinModel: false,
      });

      const dom = new JSDOM(docHtml);
      const fontsStyle = dom.window.document.getElementById('weiss-fonts');
      expect(fontsStyle).not.toBeNull();
      expect(fontsStyle?.textContent).toContain("font-family: 'Lato'");
      expect(fontsStyle?.textContent).toContain("data:font/woff2;base64,");

      const noteStyle = dom.window.document.getElementById('note-css');
      expect(noteStyle).not.toBeNull();
      // O @import remoto deve ter sido removido do #note-css
      expect(noteStyle?.textContent).not.toContain('@import');
      expect(noteStyle?.textContent).toContain("font-family: 'Lato'");

      dom.window.close();
    });

    it('na fixture AnKing, o @import do Google Fonts é removido e #weiss-fonts fornece a fonte offline', () => {
      const docHtml = buildAnkiDocument({
        html: '<div id="qa">AnKing Card</div>',
        side: 'front',
        theme: 'dark',
        css: ANKING_FIXTURE.styleCss,
        isBuiltinModel: false,
      });

      const dom = new JSDOM(docHtml);
      const fontsStyle = dom.window.document.getElementById('weiss-fonts');
      expect(fontsStyle?.textContent).toContain("font-family: 'Lato'");

      const noteStyle = dom.window.document.getElementById('note-css');
      expect(noteStyle?.textContent).not.toContain('fonts.googleapis.com');

      dom.window.close();
    });
  });
});
