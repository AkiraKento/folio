import fs from 'node:fs';
import path from 'node:path';
import {
  ANKING_FIXTURE,
  AVICENA_FIXTURE,
  EXEMPLO_AVICENA_PNG_BASE64,
  getCardModelFixtures,
  listCardModelFixtures,
} from '../__fixtures__';

describe('Card Model Fixtures (M10 Passo 1)', () => {
  const rootDir = path.resolve(__dirname, '../../../..');
  const modelosDir = path.join(rootDir, 'docs', 'referencia', 'modelos');

  it('deve carregar as fixtures avicena e AnKing sincronizadas com docs/referencia/modelos/*', () => {
    const fixtures = getCardModelFixtures();
    const list = listCardModelFixtures();

    expect(list).toHaveLength(2);
    expect(fixtures.avicena).toBe(AVICENA_FIXTURE);
    expect(fixtures.anking).toBe(ANKING_FIXTURE);

    const avicenaDiskFront = fs.readFileSync(
      path.join(modelosDir, 'avicena', 'front.html'),
      'utf-8'
    );
    const avicenaDiskBack = fs.readFileSync(
      path.join(modelosDir, 'avicena', 'back.html'),
      'utf-8'
    );
    const avicenaDiskCss = fs.readFileSync(
      path.join(modelosDir, 'avicena', 'style.css'),
      'utf-8'
    );

    expect(AVICENA_FIXTURE.frontHtml).toBe(avicenaDiskFront);
    expect(AVICENA_FIXTURE.backHtml).toBe(avicenaDiskBack);
    expect(AVICENA_FIXTURE.styleCss).toBe(avicenaDiskCss);
    expect(AVICENA_FIXTURE.model.fields).toEqual(['question', 'answer', 'reference']);

    const ankingDiskFront = fs.readFileSync(
      path.join(modelosDir, 'anking', 'front.html'),
      'utf-8'
    );
    const ankingDiskBack = fs.readFileSync(
      path.join(modelosDir, 'anking', 'back.html'),
      'utf-8'
    );
    const ankingDiskCss = fs.readFileSync(
      path.join(modelosDir, 'anking', 'style.css'),
      'utf-8'
    );

    expect(ANKING_FIXTURE.frontHtml).toBe(ankingDiskFront);
    expect(ANKING_FIXTURE.backHtml).toBe(ankingDiskBack);
    expect(ANKING_FIXTURE.styleCss).toBe(ankingDiskCss);
    expect(ANKING_FIXTURE.model.fields).toEqual([
      'Text',
      'Extra',
      'Personal Notes',
      'Missed Questions',
      'One by one',
    ]);
  });

  it('deve disponibilizar exemplos de Avicena (Cloze e Básico) e AnKing (Cloze múltiplo e único)', () => {
    expect(AVICENA_FIXTURE.examples.map((e) => e.id)).toEqual([
      'avicena-cloze',
      'avicena-basico',
    ]);
    expect(ANKING_FIXTURE.examples.map((e) => e.id)).toEqual([
      'anking-cloze-multiplo',
      'anking-cloze-unico',
    ]);

    const avicenaNoteType = AVICENA_FIXTURE.toNoteType();
    expect(avicenaNoteType.name).toBe('avicena');
    expect(avicenaNoteType.templates).toHaveLength(1);

    const ankingNoteType = ANKING_FIXTURE.toNoteType();
    expect(ankingNoteType.name).toBe('AnKing');
    expect(ankingNoteType.kind).toBe('cloze');
  });

  it('deve possuir a imagem exemplo-avicena.png válida na pasta de mídia de teste', () => {
    const pngPath = path.join(
      rootDir,
      'src',
      'webview',
      'card',
      '__fixtures__',
      'media',
      'exemplo-avicena.png'
    );
    expect(fs.existsSync(pngPath)).toBe(true);

    const buffer = fs.readFileSync(pngPath);
    // Assinatura PNG: 89 50 4E 47
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4e);
    expect(buffer[3]).toBe(0x47);
    expect(EXEMPLO_AVICENA_PNG_BASE64.length).toBeGreaterThan(20);
  });
});
