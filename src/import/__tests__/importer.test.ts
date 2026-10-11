import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import JSZip from 'jszip';
import { eq, sql } from 'drizzle-orm';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import * as schema from '@/db/schema';
import { AnnotationsRepository } from '@/db/repositories/annotations';
import { getApkgPreview, importApkg } from '../importer';
import type { ImportProgress } from '../types';
import { createNodeSqliteReader } from '../ankiParser';

describe('importer', () => {
  let tempDbPath: string;
  let testApkgBuffer: Uint8Array;

  beforeAll(async () => {
    // Cria um banco SQLite real em arquivo temporário com dados do Anki
    tempDbPath = path.join(os.tmpdir(), `test-anki-${Date.now()}.db`);
    const ankiDb = new DatabaseSync(tempDbPath);

    ankiDb.exec(`
      CREATE TABLE col (
        id integer primary key,
        crt integer,
        mod integer,
        scm integer,
        ver integer,
        dty integer,
        usn integer,
        ls integer,
        conf text,
        models text,
        decks text,
        dconf text,
        tags text
      );
      CREATE TABLE notes (
        id integer primary key,
        guid text,
        mid integer,
        mod integer,
        usn integer,
        tags text,
        flds text,
        sfld text,
        csum integer,
        flags integer,
        data text
      );
      CREATE TABLE cards (
        id integer primary key,
        nid integer,
        did integer,
        ord integer,
        mod integer,
        usn integer,
        type integer,
        queue integer,
        due integer,
        ivl integer,
        factor integer,
        reps integer,
        lapses integer,
        left integer,
        odue integer,
        odid integer,
        flags integer,
        data text
      );
      CREATE TABLE revlog (
        id integer primary key,
        cid integer,
        usn integer,
        ease integer,
        ivl integer,
        lastIvl integer,
        factor integer,
        time integer,
        type integer
      );
    `);

    const modelsJson = JSON.stringify({
      '101': {
        id: 101,
        name: 'Básico',
        type: 0,
        flds: [
          { name: 'Frente', ord: 0 },
          { name: 'Verso', ord: 1 },
        ],
        tmpls: [
          {
            name: 'Card 1',
            ord: 0,
            qfmt: '{{Frente}}',
            afmt: '{{FrontSide}}\n<hr id=answer>\n{{Verso}}',
          },
        ],
        css: '.card { font-family: serif; }',
      },
    });

    const decksJson = JSON.stringify({
      '1': { id: 1, name: 'Default' },
      '201': { id: 201, name: 'Medicina::Cardiologia' },
    });

    ankiDb.prepare("INSERT INTO col VALUES (1, 1680000000, 0, 0, 11, 0, 0, 0, '{}', ?, ?, '{}', '{}')").run(modelsJson, decksJson);

    ankiDb.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      301,
      'guid-301',
      101,
      1700000000,
      -1,
      ' cardio valvas ',
      'Onde auscultar foco mitral?\x1fNo 5º espaço intercostal E na LHC',
      'Onde auscultar foco mitral?',
      0,
      0,
      ''
    );

    ankiDb.prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      401,
      301,
      201,
      0,
      1700000000,
      -1,
      2,
      2,
      15,
      15,
      2500,
      3,
      0,
      0,
      0,
      0,
      0,
      ''
    );

    ankiDb.prepare('INSERT INTO revlog VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      1700000500123,
      401,
      -1,
      3,
      15,
      5,
      2500,
      5400,
      1
    );

    ankiDb.close();

    const dbBytes = fs.readFileSync(tempDbPath);

    // Monta o ZIP do .apkg
    const zip = new JSZip();
    zip.file('collection.anki2', dbBytes);
    zip.file('media', JSON.stringify({ '0': 'ausculta.png' }));
    zip.file('0', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])); // PNG header

    testApkgBuffer = await zip.generateAsync({ type: 'uint8array' });
  });

  afterAll(() => {
    try {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    } catch {
      // Ignora erro de lock no Windows
    }
  });

  it('deve gerar prévia do .apkg com contagem de decks, notas, cards e mídia', async () => {
    let previewDb: DatabaseSync | null = null;
    let previewTempPath = '';
    const preview = await getApkgPreview(testApkgBuffer, {
      openSqliteReader: (bytes: Uint8Array) => {
        previewTempPath = path.join(os.tmpdir(), `preview-${Date.now()}-${Math.random()}.db`);
        fs.writeFileSync(previewTempPath, Buffer.from(bytes));
        previewDb = new DatabaseSync(previewTempPath);
        return createNodeSqliteReader(previewDb);
      },
    });

    expect(preview.totalNotes).toBe(1);
    expect(preview.totalCards).toBe(1);
    expect(preview.totalMedia).toBe(1);
    expect(preview.modelsCount).toBe(1);
    expect(preview.totalRevlogs).toBe(1);
    expect(preview.hasExistingIntervals).toBe(true);
    expect(preview.hasFsrsData).toBe(false);
    expect(preview.decks.length).toBeGreaterThanOrEqual(1);

    const cardioDeck = preview.decks.find((d: { name: string }) => d.name === 'Medicina::Cardiologia');
    expect(cardioDeck).toBeDefined();
    expect(cardioDeck?.notesCount).toBe(1);
    expect(cardioDeck?.cardsCount).toBe(1);

    try {
      (previewDb as unknown as { close?: () => void })?.close?.();
      if (previewTempPath && fs.existsSync(previewTempPath)) {
        fs.unlinkSync(previewTempPath);
      }
    } catch {
      // ignora
    }
  });

  it('deve importar dados do .apkg para o banco de dados do Folio e disparar progresso', async () => {
    const { db } = createTestDatabase();
    const progressEvents: ImportProgress[] = [];
    let importDb: DatabaseSync | null = null;
    let importTempPath = '';

    const result = await importApkg(testApkgBuffer, db, {
      onProgress: (p: ImportProgress) => progressEvents.push({ ...p }),
      openSqliteReader: (bytes: Uint8Array) => {
        importTempPath = path.join(os.tmpdir(), `import-${Date.now()}-${Math.random()}.db`);
        fs.writeFileSync(importTempPath, Buffer.from(bytes));
        importDb = new DatabaseSync(importTempPath);
        return createNodeSqliteReader(importDb);
      },
    });

    expect(result.importedDecks).toBeGreaterThanOrEqual(1);
    expect(result.importedNotes).toBe(1);
    expect(result.importedCards).toBe(1);
    expect(result.importedMedia).toBe(1);
    expect(result.importedRevlogs).toBe(1);

    // Verifica se os eventos de progresso foram emitidos nas fases esperadas
    const stages = progressEvents.map((e) => e.stage);
    expect(stages).toContain('unzipping');
    expect(stages).toContain('reading_db');
    expect(stages).toContain('importing_decks');
    expect(stages).toContain('importing_notes');
    expect(stages).toContain('importing_cards');
    expect(stages).toContain('importing_revlogs');
    expect(stages).toContain('importing_media');
    expect(stages).toContain('completed');

    // Verifica persistência no banco Folio
    const decksInDb = db.select().from(schema.decks).where(eq(schema.decks.source_id, '201')).all();
    expect(decksInDb).toHaveLength(1);
    expect(decksInDb[0].name).toBe('Medicina::Cardiologia');

    const noteTypesInDb = db
      .select()
      .from(schema.noteTypes)
      .where(eq(schema.noteTypes.source_id, '101'))
      .all();
    expect(noteTypesInDb).toHaveLength(1);
    expect(noteTypesInDb[0].name).toBe('Básico');
    expect(noteTypesInDb[0].kind).toBe('basic');

    const notesInDb = db.select().from(schema.notes).where(eq(schema.notes.source_id, '301')).all();
    expect(notesInDb).toHaveLength(1);
    expect(notesInDb[0].fields).toEqual({
      Frente: 'Onde auscultar foco mitral?',
      Verso: 'No 5º espaço intercostal E na LHC',
    });
    expect(notesInDb[0].tags).toEqual(['cardio', 'valvas']);

    const cardsInDb = db.select().from(schema.cards).where(eq(schema.cards.source_id, '401')).all();
    expect(cardsInDb).toHaveLength(1);
    expect(cardsInDb[0].note_id).toBe(notesInDb[0].id);
    expect(cardsInDb[0].deck_id).toBe(decksInDb[0].id);
    expect(cardsInDb[0].suspended).toBe(0);
    expect(cardsInDb[0].stability).toBe(15); // stability ≈ ivl
    expect(cardsInDb[0].difficulty).toBe(5.0);
    expect(cardsInDb[0].scheduled_days).toBe(15);
    expect(cardsInDb[0].state).toBe(2);
    expect(cardsInDb[0].due).toBeGreaterThan(0);
    expect(cardsInDb[0].last_review).toBe(1700000500123);

    const revlogsInDb = db.select().from(schema.reviewLogs).where(eq(schema.reviewLogs.card_id, cardsInDb[0].id)).all();
    expect(revlogsInDb).toHaveLength(1);
    expect(revlogsInDb[0].rating).toBe(3);
    expect(revlogsInDb[0].review_ms).toBe(5400);
    expect(revlogsInDb[0].reviewed_at).toBe(1700000500123);

    const mediaInDb = db.select().from(schema.media).where(eq(schema.media.filename, 'ausculta.png')).all();
    expect(mediaInDb).toHaveLength(1);
    expect(mediaInDb[0].bytes).toBe(8);

    try {
      (importDb as unknown as { close?: () => void })?.close?.();
      if (importTempPath && fs.existsSync(importTempPath)) {
        fs.unlinkSync(importTempPath);
      }
    } catch {
      // ignora
    }
  });

  it('deve importar estado FSRS nativo a partir de cards.data com stability e difficulty', async () => {
    const { db } = createTestDatabase();
    const tempFsrsDbPath = path.join(os.tmpdir(), `test-anki-fsrs-${Date.now()}.db`);
    const ankiDb = new DatabaseSync(tempFsrsDbPath);

    ankiDb.exec(`
      CREATE TABLE col (id integer primary key, crt integer, models text, decks text);
      CREATE TABLE notes (id integer primary key, mid integer, tags text, flds text, data text);
      CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, data text);
      CREATE TABLE revlog (id integer primary key, cid integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer);
    `);

    ankiDb.prepare("INSERT INTO col VALUES (1, 1680000000, ?, ?)").run(
      JSON.stringify({ '10': { id: 10, name: 'Básico', type: 0, flds: [{ name: 'Frente' }, { name: 'Verso' }], tmpls: [{ name: 'C1', qfmt: '{{Frente}}', afmt: '{{Verso}}' }] } }),
      JSON.stringify({ '20': { id: 20, name: 'FSRS Deck' } })
    );

    ankiDb.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?)').run(30, 10, '', 'Pergunta\x1fResposta', '');
    ankiDb.prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      40,
      30,
      20,
      0,
      2,
      2,
      25,
      14,
      0,
      4,
      1,
      '{"s": 14.52, "d": 4.18}'
    );

    ankiDb.close();

    const zip = new JSZip();
    zip.file('collection.anki2', fs.readFileSync(tempFsrsDbPath));
    zip.file('media', '{}');
    const fsrsPkg = await zip.generateAsync({ type: 'uint8array' });

    let tempReaderPath = '';
    let readerDb: DatabaseSync | null = null;
    const result = await importApkg(fsrsPkg, db, {
      openSqliteReader: (bytes: Uint8Array) => {
        tempReaderPath = path.join(os.tmpdir(), `fsrs-read-${Date.now()}.db`);
        fs.writeFileSync(tempReaderPath, Buffer.from(bytes));
        readerDb = new DatabaseSync(tempReaderPath);
        return createNodeSqliteReader(readerDb);
      },
    });

    expect(result.importedCards).toBe(1);
    const card = db.select().from(schema.cards).where(eq(schema.cards.source_id, '40')).all()[0];
    expect(card).toBeDefined();
    expect(card.stability).toBe(14.52);
    expect(card.difficulty).toBe(4.18);
    expect(card.reps).toBe(4);
    expect(card.lapses).toBe(1);
    expect(card.state).toBe(2);

    try {
      (readerDb as unknown as { close?: () => void })?.close?.();
      if (fs.existsSync(tempReaderPath)) fs.unlinkSync(tempReaderPath);
      if (fs.existsSync(tempFsrsDbPath)) fs.unlinkSync(tempFsrsDbPath);
    } catch {
      // ignora
    }
  });

  it('deve respeitar a opção scheduleMode="reset_new" zerando todos os cards para novos', async () => {
    const { db } = createTestDatabase();
    let tempReaderPath = '';
    let readerDb: DatabaseSync | null = null;

    const result = await importApkg(testApkgBuffer, db, {
      scheduleMode: 'reset_new',
      openSqliteReader: (bytes: Uint8Array) => {
        tempReaderPath = path.join(os.tmpdir(), `reset-read-${Date.now()}.db`);
        fs.writeFileSync(tempReaderPath, Buffer.from(bytes));
        readerDb = new DatabaseSync(tempReaderPath);
        return createNodeSqliteReader(readerDb);
      },
    });

    expect(result.importedCards).toBe(1);
    const card = db.select().from(schema.cards).where(eq(schema.cards.source_id, '401')).all()[0];
    expect(card).toBeDefined();
    expect(card.state).toBe(0); // State.New
    expect(card.stability).toBe(0);
    expect(card.difficulty).toBe(0);
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
    expect(card.scheduled_days).toBe(0);
    expect(card.last_review).toBeNull();

    try {
      (readerDb as unknown as { close?: () => void })?.close?.();
      if (fs.existsSync(tempReaderPath)) fs.unlinkSync(tempReaderPath);
    } catch {
      // ignora
    }
  });

  it('deve reimportar de forma idempotente por source_id sem duplicar decks, notas, cards e revlogs', async () => {
    const { db } = createTestDatabase();

    const helperOpenReader = (bytes: Uint8Array) => {
      const p = path.join(os.tmpdir(), `idempotent-read-${Date.now()}-${Math.random()}.db`);
      fs.writeFileSync(p, Buffer.from(bytes));
      const rDb = new DatabaseSync(p);
      return createNodeSqliteReader(rDb);
    };

    // 1ª importação
    const result1 = await importApkg(testApkgBuffer, db, {
      openSqliteReader: helperOpenReader,
    });

    expect(result1.importedNotes).toBe(1);
    expect(result1.importedCards).toBe(1);
    expect(result1.importedRevlogs).toBe(1);

    const initialDecks = db.select().from(schema.decks).all();
    const initialNotes = db.select().from(schema.notes).all();
    const initialCards = db.select().from(schema.cards).all();
    const initialRevlogs = db.select().from(schema.reviewLogs).all();

    expect(initialDecks).toHaveLength(2);
    expect(initialNotes).toHaveLength(1);
    expect(initialCards).toHaveLength(1);
    expect(initialRevlogs).toHaveLength(1);

    const initialDeckIds = initialDecks.map((d) => d.id).sort();
    const initialNoteId = initialNotes[0].id;
    const initialCardId = initialCards[0].id;

    // 2ª importação do mesmo arquivo
    const result2 = await importApkg(testApkgBuffer, db, {
      openSqliteReader: helperOpenReader,
    });

    // Total de registros no banco NÃO deve ter duplicado!
    const afterDecks = db.select().from(schema.decks).all();
    const afterNotes = db.select().from(schema.notes).all();
    const afterCards = db.select().from(schema.cards).all();
    const afterRevlogs = db.select().from(schema.reviewLogs).all();

    expect(afterDecks).toHaveLength(2);
    expect(afterNotes).toHaveLength(1);
    expect(afterCards).toHaveLength(1);
    expect(afterRevlogs).toHaveLength(1);

    // Os IDs locais (UUIDs) originais do Folio devem ser preservados
    expect(afterDecks.map((d) => d.id).sort()).toEqual(initialDeckIds);
    expect(afterNotes[0].id).toBe(initialNoteId);
    expect(afterCards[0].id).toBe(initialCardId);

    // Contadores de criação vs atualização
    expect(result2.createdNotes).toBe(0);
    expect(result2.updatedNotes).toBe(1);
    expect(result2.createdCards).toBe(0);
    expect(result2.updatedCards).toBe(1);
  });

  it('deve atualizar campos da nota na reimportação preservando as anotações existentes', async () => {
    const { db } = createTestDatabase();
    const annRepo = new AnnotationsRepository(db);

    const helperOpenReader = (bytes: Uint8Array) => {
      const p = path.join(os.tmpdir(), `ann-preservation-${Date.now()}-${Math.random()}.db`);
      fs.writeFileSync(p, Buffer.from(bytes));
      const rDb = new DatabaseSync(p);
      return createNodeSqliteReader(rDb);
    };

    // 1ª importação
    await importApkg(testApkgBuffer, db, { openSqliteReader: helperOpenReader });
    const noteBefore = db.select().from(schema.notes).where(eq(schema.notes.source_id, '301')).all()[0];
    expect(noteBefore).toBeDefined();

    // Cria anotação de usuário no Modo Consulta vinculada a esta nota
    const annotation = annRepo.create({
      note_id: noteBefore.id,
      kind: 'hl',
      color: 'amarelo',
      quote: '5º espaço intercostal E',
      start: 6,
      end: 29,
      note: 'Importante em semiologia',
    });

    // Gera um novo .apkg onde a mesma nota (source_id 301) teve o texto e tags atualizados
    const tempUpdatedDbPath = path.join(os.tmpdir(), `updated-anki-${Date.now()}.db`);
    const ankiDb = new DatabaseSync(tempUpdatedDbPath);
    ankiDb.exec(`
      CREATE TABLE col (id integer primary key, crt integer, models text, decks text);
      CREATE TABLE notes (id integer primary key, mid integer, tags text, flds text, data text);
      CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, data text);
      CREATE TABLE revlog (id integer primary key, cid integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer);
    `);
    ankiDb.prepare("INSERT INTO col VALUES (1, 1680000000, ?, ?)").run(
      JSON.stringify({ '101': { id: 101, name: 'Básico', type: 0, flds: [{ name: 'Frente' }, { name: 'Verso' }], tmpls: [{ name: 'Card 1', qfmt: '{{Frente}}', afmt: '{{Verso}}' }] } }),
      JSON.stringify({ '201': { id: 201, name: 'Medicina::Cardiologia' } })
    );
    ankiDb.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?)').run(
      301,
      101,
      ' cardio valvas semiologia ',
      'Onde auscultar foco mitral?\x1fNo 5º espaço intercostal E na LHC (apical)',
      ''
    );
    ankiDb.prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      401,
      301,
      201,
      0,
      2,
      2,
      16,
      16,
      2500,
      4,
      0,
      ''
    );
    ankiDb.close();

    const zip = new JSZip();
    zip.file('collection.anki2', fs.readFileSync(tempUpdatedDbPath));
    zip.file('media', '{}');
    const updatedPkg = await zip.generateAsync({ type: 'uint8array' });

    // 2ª importação com o pacote atualizado
    await importApkg(updatedPkg, db, {
      openSqliteReader: (bytes: Uint8Array) => {
        const p = path.join(os.tmpdir(), `updated-read-${Date.now()}-${Math.random()}.db`);
        fs.writeFileSync(p, Buffer.from(bytes));
        const rDb = new DatabaseSync(p);
        return createNodeSqliteReader(rDb);
      },
    });

    // Verifica que a nota foi atualizada
    const noteAfter = db.select().from(schema.notes).where(eq(schema.notes.source_id, '301')).all()[0];
    expect(noteAfter.id).toBe(noteBefore.id); // ID preservado!
    expect(noteAfter.fields.Verso).toBe('No 5º espaço intercostal E na LHC (apical)');
    expect(noteAfter.tags).toEqual(['cardio', 'valvas', 'semiologia']);

    // A anotação continua ligada à mesma nota e continua existindo!
    const annAfter = annRepo.getById(annotation.id);
    expect(annAfter).toBeDefined();
    expect(annAfter?.note_id).toBe(noteBefore.id);

    try {
      if (fs.existsSync(tempUpdatedDbPath)) fs.unlinkSync(tempUpdatedDbPath);
    } catch {
      // ignora
    }
  });

  it('deve reimportar deck com novos cards e notas mantendo os existentes e inserindo os novos', async () => {
    const { db } = createTestDatabase();

    const helperOpenReader = (bytes: Uint8Array) => {
      const p = path.join(os.tmpdir(), `new-items-read-${Date.now()}-${Math.random()}.db`);
      fs.writeFileSync(p, Buffer.from(bytes));
      const rDb = new DatabaseSync(p);
      return createNodeSqliteReader(rDb);
    };

    // 1ª importação: 1 nota e 1 card
    await importApkg(testApkgBuffer, db, { openSqliteReader: helperOpenReader });
    expect(db.select().from(schema.notes).all()).toHaveLength(1);
    expect(db.select().from(schema.cards).all()).toHaveLength(1);

    // Cria um .apkg contendo a nota existente (301) + uma nova nota (302)
    const tempMultiDbPath = path.join(os.tmpdir(), `multi-anki-${Date.now()}.db`);
    const ankiDb = new DatabaseSync(tempMultiDbPath);
    ankiDb.exec(`
      CREATE TABLE col (id integer primary key, crt integer, models text, decks text);
      CREATE TABLE notes (id integer primary key, mid integer, tags text, flds text, data text);
      CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, data text);
      CREATE TABLE revlog (id integer primary key, cid integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer);
    `);
    ankiDb.prepare("INSERT INTO col VALUES (1, 1680000000, ?, ?)").run(
      JSON.stringify({ '101': { id: 101, name: 'Básico', type: 0, flds: [{ name: 'Frente' }, { name: 'Verso' }], tmpls: [{ name: 'Card 1', qfmt: '{{Frente}}', afmt: '{{Verso}}' }] } }),
      JSON.stringify({ '201': { id: 201, name: 'Medicina::Cardiologia' } })
    );
    ankiDb.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?)').run(
      301, 101, 'cardio', 'Pergunta 1\x1fResposta 1', ''
    );
    ankiDb.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?)').run(
      302, 101, 'cardio', 'Pergunta 2\x1fResposta 2', ''
    );
    ankiDb.prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      401, 301, 201, 0, 2, 2, 10, 10, 2500, 2, 0, ''
    );
    ankiDb.prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      402, 302, 201, 0, 0, 0, 0, 0, 0, 0, 0, ''
    );
    ankiDb.close();

    const zip = new JSZip();
    zip.file('collection.anki2', fs.readFileSync(tempMultiDbPath));
    zip.file('media', '{}');
    const multiPkg = await zip.generateAsync({ type: 'uint8array' });

    const result = await importApkg(multiPkg, db, {
      openSqliteReader: (bytes: Uint8Array) => {
        const p = path.join(os.tmpdir(), `multi-read-${Date.now()}-${Math.random()}.db`);
        fs.writeFileSync(p, Buffer.from(bytes));
        const rDb = new DatabaseSync(p);
        return createNodeSqliteReader(rDb);
      },
    });

    expect(result.createdNotes).toBe(1);
    expect(result.updatedNotes).toBe(1);
    expect(result.createdCards).toBe(1);
    expect(result.updatedCards).toBe(1);

    expect(db.select().from(schema.notes).all()).toHaveLength(2);
    expect(db.select().from(schema.cards).all()).toHaveLength(2);

    try {
      if (fs.existsSync(tempMultiDbPath)) fs.unlinkSync(tempMultiDbPath);
    } catch {
      // ignora
    }
  });

  it('deve reativar notas e cards deletados logicamente quando forem reimportados', async () => {
    const { db } = createTestDatabase();

    const helperOpenReader = (bytes: Uint8Array) => {
      const p = path.join(os.tmpdir(), `restore-read-${Date.now()}-${Math.random()}.db`);
      fs.writeFileSync(p, Buffer.from(bytes));
      const rDb = new DatabaseSync(p);
      return createNodeSqliteReader(rDb);
    };

    // 1ª importação
    await importApkg(testApkgBuffer, db, { openSqliteReader: helperOpenReader });

    // Simula exclusão lógica de nota e card no Folio
    const now = Date.now();
    db.update(schema.notes).set({ deleted_at: now }).run();
    db.update(schema.cards).set({ deleted_at: now }).run();

    expect(db.select().from(schema.notes).where(eq(schema.notes.deleted_at, now)).all()).toHaveLength(1);
    expect(db.select().from(schema.cards).where(eq(schema.cards.deleted_at, now)).all()).toHaveLength(1);

    // 2ª importação
    await importApkg(testApkgBuffer, db, { openSqliteReader: helperOpenReader });

    // Devem ter sido reativados (deleted_at = null)
    const activeNotes = db.select().from(schema.notes).where(eq(schema.notes.source_id, '301')).all();
    const activeCards = db.select().from(schema.cards).where(eq(schema.cards.source_id, '401')).all();

    expect(activeNotes[0].deleted_at).toBeNull();
    expect(activeCards[0].deleted_at).toBeNull();
  });

  it('deve preservar o progresso de estudo no Folio quando reimportar com keep_intervals', async () => {
    const { db } = createTestDatabase();

    const helperOpenReader = (bytes: Uint8Array) => {
      const p = path.join(os.tmpdir(), `preserve-progress-${Date.now()}-${Math.random()}.db`);
      fs.writeFileSync(p, Buffer.from(bytes));
      const rDb = new DatabaseSync(p);
      return createNodeSqliteReader(rDb);
    };

    // 1ª importação
    await importApkg(testApkgBuffer, db, { openSqliteReader: helperOpenReader });
    const cardBefore = db.select().from(schema.cards).where(eq(schema.cards.source_id, '401')).all()[0];
    expect(cardBefore).toBeDefined();

    // Simula que o usuário estudou o card no Folio (progresso posterior)
    const folioReviewTime = Date.now() + 500_000;
    const folioDue = folioReviewTime + 7 * 86400 * 1000;
    db.update(schema.cards)
      .set({
        state: 2,
        reps: 5,
        lapses: 0,
        stability: 14.5,
        difficulty: 4.2,
        due: folioDue,
        last_review: folioReviewTime,
        scheduled_days: 7,
        elapsed_days: 7,
      })
      .where(eq(schema.cards.id, cardBefore.id))
      .run();

    // 2ª importação do mesmo .apkg (que possui dados de estudo antigos) com 'keep_intervals'
    const result = await importApkg(testApkgBuffer, db, {
      openSqliteReader: helperOpenReader,
      scheduleMode: 'keep_intervals',
    });

    expect(result.updatedCards).toBe(1);

    const cardAfter = db.select().from(schema.cards).where(eq(schema.cards.source_id, '401')).all()[0];
    expect(cardAfter.id).toBe(cardBefore.id);
    // Progresso do Folio NÃO deve ter sido sobrescrito ou regredido!
    expect(cardAfter.reps).toBe(5);
    expect(cardAfter.stability).toBe(14.5);
    expect(cardAfter.difficulty).toBe(4.2);
    expect(cardAfter.due).toBe(folioDue);
    expect(cardAfter.last_review).toBe(folioReviewTime);
  });

  it('deve redefinir o progresso se scheduleMode="reset_new" for explicitamente selecionado na reimportação', async () => {
    const { db } = createTestDatabase();

    const helperOpenReader = (bytes: Uint8Array) => {
      const p = path.join(os.tmpdir(), `reset-progress-${Date.now()}-${Math.random()}.db`);
      fs.writeFileSync(p, Buffer.from(bytes));
      const rDb = new DatabaseSync(p);
      return createNodeSqliteReader(rDb);
    };

    // 1ª importação
    await importApkg(testApkgBuffer, db, { openSqliteReader: helperOpenReader });
    const cardBefore = db.select().from(schema.cards).where(eq(schema.cards.source_id, '401')).all()[0];

    // Simula estudo no Folio
    db.update(schema.cards)
      .set({
        state: 2,
        reps: 10,
        stability: 25.0,
        last_review: Date.now(),
      })
      .where(eq(schema.cards.id, cardBefore.id))
      .run();

    // 2ª importação forçando 'reset_new'
    await importApkg(testApkgBuffer, db, {
      openSqliteReader: helperOpenReader,
      scheduleMode: 'reset_new',
    });

    const cardAfter = db.select().from(schema.cards).where(eq(schema.cards.source_id, '401')).all()[0];
    expect(cardAfter.id).toBe(cardBefore.id);
    expect(cardAfter.state).toBe(0);
    expect(cardAfter.reps).toBe(0);
    expect(cardAfter.stability).toBe(0);
    expect(cardAfter.last_review).toBeNull();
  });

  it('deve atualizar o deck_id da nota e dos cards se a nota for movida de deck no Anki', async () => {
    const { db } = createTestDatabase();

    const helperOpenReader = (bytes: Uint8Array) => {
      const p = path.join(os.tmpdir(), `moved-deck-read-${Date.now()}-${Math.random()}.db`);
      fs.writeFileSync(p, Buffer.from(bytes));
      const rDb = new DatabaseSync(p);
      return createNodeSqliteReader(rDb);
    };

    // 1ª importação no deck Medicina::Cardiologia (source_id 201)
    await importApkg(testApkgBuffer, db, { openSqliteReader: helperOpenReader });
    const noteBefore = db.select().from(schema.notes).where(eq(schema.notes.source_id, '301')).all()[0];
    const cardBefore = db.select().from(schema.cards).where(eq(schema.cards.source_id, '401')).all()[0];
    const originalDeck = db.select().from(schema.decks).where(eq(schema.decks.source_id, '201')).all()[0];
    expect(noteBefore.deck_id).toBe(originalDeck.id);
    expect(cardBefore.deck_id).toBe(originalDeck.id);

    // Cria um .apkg onde a nota 301 e o card 401 foram movidos para um novo deck 202 Medicina::Pneumologia
    const tempMovedDbPath = path.join(os.tmpdir(), `moved-anki-${Date.now()}.db`);
    const ankiDb = new DatabaseSync(tempMovedDbPath);
    ankiDb.exec(`
      CREATE TABLE col (id integer primary key, crt integer, models text, decks text);
      CREATE TABLE notes (id integer primary key, mid integer, tags text, flds text, data text);
      CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, data text);
      CREATE TABLE revlog (id integer primary key, cid integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer);
    `);
    ankiDb.prepare("INSERT INTO col VALUES (1, 1680000000, ?, ?)").run(
      JSON.stringify({ '101': { id: 101, name: 'Básico', type: 0, flds: [{ name: 'Frente' }, { name: 'Verso' }], tmpls: [{ name: 'Card 1', qfmt: '{{Frente}}', afmt: '{{Verso}}' }] } }),
      JSON.stringify({
        '201': { id: 201, name: 'Medicina::Cardiologia' },
        '202': { id: 202, name: 'Medicina::Pneumologia' },
      })
    );
    ankiDb.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?)').run(
      301, 101, 'cardio pneumo', 'Pergunta\x1fResposta', ''
    );
    ankiDb.prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      401, 301, 202, 0, 0, 0, 0, 0, 0, 0, 0, ''
    );
    ankiDb.close();

    const zip = new JSZip();
    zip.file('collection.anki2', fs.readFileSync(tempMovedDbPath));
    zip.file('media', '{}');
    const movedPkg = await zip.generateAsync({ type: 'uint8array' });

    // 2ª importação
    await importApkg(movedPkg, db, {
      openSqliteReader: (bytes: Uint8Array) => {
        const p = path.join(os.tmpdir(), `moved-read-${Date.now()}-${Math.random()}.db`);
        fs.writeFileSync(p, Buffer.from(bytes));
        const rDb = new DatabaseSync(p);
        return createNodeSqliteReader(rDb);
      },
    });

    const newDeck = db.select().from(schema.decks).where(eq(schema.decks.source_id, '202')).all()[0];
    expect(newDeck).toBeDefined();
    expect(newDeck.name).toBe('Medicina::Pneumologia');

    const noteAfter = db.select().from(schema.notes).where(eq(schema.notes.source_id, '301')).all()[0];
    const cardAfter = db.select().from(schema.cards).where(eq(schema.cards.source_id, '401')).all()[0];
    expect(noteAfter.id).toBe(noteBefore.id);
    expect(cardAfter.id).toBe(cardBefore.id);
    expect(noteAfter.deck_id).toBe(newDeck.id);
    expect(cardAfter.deck_id).toBe(newDeck.id);

    try {
      if (fs.existsSync(tempMovedDbPath)) fs.unlinkSync(tempMovedDbPath);
    } catch {
      // ignora
    }
  });

  it('deve atualizar templates e css de modelo existente na reimportação preservando o ID do Folio', async () => {
    const { db } = createTestDatabase();

    const helperOpenReader = (bytes: Uint8Array) => {
      const p = path.join(os.tmpdir(), `model-update-${Date.now()}-${Math.random()}.db`);
      fs.writeFileSync(p, Buffer.from(bytes));
      const rDb = new DatabaseSync(p);
      return createNodeSqliteReader(rDb);
    };

    // 1ª importação
    await importApkg(testApkgBuffer, db, { openSqliteReader: helperOpenReader });
    const modelBefore = db.select().from(schema.noteTypes).where(eq(schema.noteTypes.source_id, '101')).all()[0];
    expect(modelBefore).toBeDefined();

    // Cria um .apkg onde o modelo 101 teve o CSS e templates atualizados
    const tempModelDbPath = path.join(os.tmpdir(), `model-anki-${Date.now()}.db`);
    const ankiDb = new DatabaseSync(tempModelDbPath);
    ankiDb.exec(`
      CREATE TABLE col (id integer primary key, crt integer, models text, decks text);
      CREATE TABLE notes (id integer primary key, mid integer, tags text, flds text, data text);
      CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, data text);
      CREATE TABLE revlog (id integer primary key, cid integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer);
    `);
    ankiDb.prepare("INSERT INTO col VALUES (1, 1680000000, ?, ?)").run(
      JSON.stringify({
        '101': {
          id: 101,
          name: 'Básico Atualizado',
          type: 0,
          flds: [{ name: 'Frente' }, { name: 'Verso' }],
          tmpls: [{ name: 'Card 1', qfmt: '<h3>{{Frente}}</h3>', afmt: '{{Verso}}' }],
          css: '.card { font-size: 22px; color: teal; }',
        },
      }),
      JSON.stringify({ '201': { id: 201, name: 'Medicina::Cardiologia' } })
    );
    ankiDb.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?)').run(
      301, 101, 'cardio', 'Pergunta\x1fResposta', ''
    );
    ankiDb.prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      401, 301, 201, 0, 0, 0, 0, 0, 0, 0, 0, ''
    );
    ankiDb.close();

    const zip = new JSZip();
    zip.file('collection.anki2', fs.readFileSync(tempModelDbPath));
    zip.file('media', '{}');
    const updatedModelPkg = await zip.generateAsync({ type: 'uint8array' });

    // 2ª importação
    await importApkg(updatedModelPkg, db, {
      openSqliteReader: (bytes: Uint8Array) => {
        const p = path.join(os.tmpdir(), `model-read-${Date.now()}-${Math.random()}.db`);
        fs.writeFileSync(p, Buffer.from(bytes));
        const rDb = new DatabaseSync(p);
        return createNodeSqliteReader(rDb);
      },
    });

    const modelAfter = db.select().from(schema.noteTypes).where(eq(schema.noteTypes.source_id, '101')).all()[0];
    expect(modelAfter.id).toBe(modelBefore.id); // ID preservado!
    expect(modelAfter.name).toBe('Básico Atualizado');
    expect(modelAfter.css).toBe('.card { font-size: 22px; color: teal; }');
    expect(modelAfter.templates[0].front).toBe('<h3>{{Frente}}</h3>');

    try {
      if (fs.existsSync(tempModelDbPath)) fs.unlinkSync(tempModelDbPath);
    } catch {
      // ignora
    }
  });

  it('deve realizar toda a importação dentro de uma transação e reverter em caso de erro', async () => {
    const { db } = createTestDatabase();

    const helperOpenReader = (bytes: Uint8Array) => {
      const p = path.join(os.tmpdir(), `tx-read-${Date.now()}-${Math.random()}.db`);
      fs.writeFileSync(p, Buffer.from(bytes));
      const rDb = new DatabaseSync(p);
      return createNodeSqliteReader(rDb);
    };

    // Cria um pacote inválido que causará falha durante a transação
    // Por exemplo, um card que referencia uma nota inexistente ou erro forçado
    const tempErrDbPath = path.join(os.tmpdir(), `err-anki-${Date.now()}.db`);
    const ankiDb = new DatabaseSync(tempErrDbPath);
    ankiDb.exec(`
      CREATE TABLE col (id integer primary key, crt integer, models text, decks text);
      CREATE TABLE notes (id integer primary key, mid integer, tags text, flds text, data text);
      CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, data text);
      CREATE TABLE revlog (id integer primary key, cid integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer);
    `);
    ankiDb.prepare("INSERT INTO col VALUES (1, 1680000000, ?, ?)").run(
      JSON.stringify({ '101': { id: 101, name: 'Básico', type: 0, flds: [{ name: 'Frente' }, { name: 'Verso' }], tmpls: [{ name: 'Card 1', qfmt: '{{Frente}}', afmt: '{{Verso}}' }] } }),
      JSON.stringify({ '201': { id: 201, name: 'Deck Falha' } })
    );
    ankiDb.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?)').run(
      301, 101, 'tag', 'Frente\x1fVerso', ''
    );
    // Insere dois cards com a mesma chave primária ou que causa erro
    ankiDb.prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      401, 301, 201, 0, 0, 0, 0, 0, 0, 0, 0, ''
    );
    ankiDb.close();

    const zip = new JSZip();
    zip.file('collection.anki2', fs.readFileSync(tempErrDbPath));
    zip.file('media', '{}');
    const errPkg = await zip.generateAsync({ type: 'uint8array' });

    // Modifica o banco temporariamente com um trigger que força erro em cards
    db.run(
      sql.raw(
        'CREATE TRIGGER fail_on_card_insert BEFORE INSERT ON cards BEGIN SELECT RAISE(ABORT, "Erro forçado em transação"); END;'
      )
    );

    await expect(
      importApkg(errPkg, db, {
        openSqliteReader: helperOpenReader,
      })
    ).rejects.toThrow();

    // Como estava dentro de uma transação, NADA deve ter sido persistido (nem os decks nem as notas inseridos antes do card!)
    const decksInDb = db.select().from(schema.decks).where(eq(schema.decks.source_id, '201')).all();
    const notesInDb = db.select().from(schema.notes).where(eq(schema.notes.source_id, '301')).all();
    const cardsInDb = db.select().from(schema.cards).where(eq(schema.cards.source_id, '401')).all();

    expect(decksInDb).toHaveLength(0);
    expect(notesInDb).toHaveLength(0);
    expect(cardsInDb).toHaveLength(0);

    try {
      if (fs.existsSync(tempErrDbPath)) fs.unlinkSync(tempErrDbPath);
    } catch {
      // ignora
    }
  });
});

