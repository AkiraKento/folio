import { DatabaseSync } from 'node:sqlite';
import {
  parseAnkiCollection,
  detectModelKind,
  parseAnkiTags,
  parseAnkiCardFsrsData,
  createNodeSqliteReader,
} from '../ankiParser';

describe('ankiParser', () => {
  describe('parseAnkiTags', () => {
    it('deve extrair tags separadas por espaços e ignorar espaços extras', () => {
      expect(parseAnkiTags(' cardio anatomia fisiologia ')).toEqual([
        'cardio',
        'anatomia',
        'fisiologia',
      ]);
      expect(parseAnkiTags('tag1   tag2')).toEqual(['tag1', 'tag2']);
      expect(parseAnkiTags('')).toEqual([]);
      expect(parseAnkiTags('   ')).toEqual([]);
    });
  });

  describe('detectModelKind', () => {
    it('deve detectar modelo Cloze por type=1 ou tags cloze', () => {
      expect(
        detectModelKind({
          id: 1,
          name: 'Omissão de Palavras',
          type: 1,
          flds: [{ name: 'Texto', ord: 0 }],
          tmpls: [{ name: 'Cloze', ord: 0, qfmt: '{{cloze:Texto}}', afmt: '{{cloze:Texto}}' }],
          css: '',
        })
      ).toBe('cloze');

      expect(
        detectModelKind({
          id: 2,
          name: 'Modelo Custom com cloze',
          type: 0,
          flds: [{ name: 'Texto', ord: 0 }],
          tmpls: [{ name: 'Cloze', ord: 0, qfmt: '{{cloze:Texto}}', afmt: '{{cloze:Texto}}' }],
          css: '',
        })
      ).toBe('cloze');
    });

    it('deve detectar modelo Básico simples', () => {
      expect(
        detectModelKind({
          id: 1,
          name: 'Básico',
          type: 0,
          flds: [
            { name: 'Frente', ord: 0 },
            { name: 'Verso', ord: 1 },
          ],
          tmpls: [{ name: 'Card 1', ord: 0, qfmt: '{{Frente}}', afmt: '{{Verso}}' }],
          css: '',
        })
      ).toBe('basic');
    });

    it('deve detectar modelo Básico e Invertido com 2 templates opostos', () => {
      expect(
        detectModelKind({
          id: 1,
          name: 'Básico (e cartão invertido)',
          type: 0,
          flds: [
            { name: 'Frente', ord: 0 },
            { name: 'Verso', ord: 1 },
          ],
          tmpls: [
            { name: 'Card 1', ord: 0, qfmt: '{{Frente}}', afmt: '{{FrontSide}}\n{{Verso}}' },
            { name: 'Card 2', ord: 1, qfmt: '{{Verso}}', afmt: '{{FrontSide}}\n{{Frente}}' },
          ],
          css: '',
        })
      ).toBe('basic_reversed');
    });

    it('deve categorizar outros modelos como custom', () => {
      expect(
        detectModelKind({
          id: 1,
          name: 'Triplo',
          type: 0,
          flds: [
            { name: 'A', ord: 0 },
            { name: 'B', ord: 1 },
            { name: 'C', ord: 2 },
          ],
          tmpls: [
            { name: '1', ord: 0, qfmt: '{{A}}', afmt: '{{B}}' },
            { name: '2', ord: 1, qfmt: '{{B}}', afmt: '{{C}}' },
            { name: '3', ord: 2, qfmt: '{{C}}', afmt: '{{A}}' },
          ],
          css: '',
        })
      ).toBe('custom');
    });
  });

  describe('parseAnkiCollection - Esquema Legado (col.models / col.decks)', () => {
    let db: DatabaseSync;

    beforeEach(() => {
      db = new DatabaseSync(':memory:');
      db.exec(`
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
      `);

      const modelsJson = JSON.stringify({
        '1001': {
          id: 1001,
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
          css: '.card { font-size: 20px; }',
        },
      });

      const decksJson = JSON.stringify({
        '1': { id: 1, name: 'Default' },
        '2001': { id: 2001, name: 'Medicina::Cardiologia', desc: 'Deck de cardio' },
      });

      const stmtCol = db.prepare(
        "INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) VALUES (1, 0, 0, 0, 11, 0, 0, 0, '{}', ?, ?, '{}', '{}')"
      );
      stmtCol.run(modelsJson, decksJson);

      const stmtNote = db.prepare(
        'INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      // Nota 1: Frente \x1f Verso
      stmtNote.run(3001, 'guid-1', 1001, 1700000000, -1, ' cardio conceito ', 'O que é ICC?\x1fInsuficiência Cardíaca Congestiva', 'O que é ICC?', 0, 0, '');

      const stmtCard = db.prepare(
        'INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      // Card 1: normal
      stmtCard.run(4001, 3001, 2001, 0, 1700000000, -1, 0, 0, 10, 0, 2500, 0, 0, 0, 0, 0, 0, '');
      // Card 2: suspenso (queue = -1)
      stmtCard.run(4002, 3001, 2001, 1, 1700000000, -1, 0, -1, 10, 0, 2500, 0, 0, 0, 0, 0, 0, '');
    });

    afterEach(() => {
      db.close();
    });

    it('deve extrair modelos, decks, notas e cards do banco legado', () => {
      const reader = createNodeSqliteReader(db);
      const collection = parseAnkiCollection(reader);

      expect(collection.models.size).toBe(1);
      const model = collection.models.get('1001');
      expect(model).toBeDefined();
      expect(model?.name).toBe('Básico');
      expect(model?.flds).toHaveLength(2);
      expect(model?.flds[0].name).toBe('Frente');
      expect(model?.flds[1].name).toBe('Verso');

      expect(collection.decks.size).toBe(2);
      const deck = collection.decks.get('2001');
      expect(deck?.name).toBe('Medicina::Cardiologia');

      expect(collection.notes).toHaveLength(1);
      const note = collection.notes[0];
      expect(note.id).toBe('3001');
      expect(note.modelId).toBe('1001');
      expect(note.tags).toEqual(['cardio', 'conceito']);
      expect(note.fields).toEqual({
        Frente: 'O que é ICC?',
        Verso: 'Insuficiência Cardíaca Congestiva',
      });

      expect(collection.cards).toHaveLength(2);
      expect(collection.cards[0].id).toBe('4001');
      expect(collection.cards[0].noteId).toBe('3001');
      expect(collection.cards[0].deckId).toBe('2001');
      expect(collection.cards[0].suspended).toBe(false);

      expect(collection.cards[1].id).toBe('4002');
      expect(collection.cards[1].suspended).toBe(true);
    });
  });

  describe('parseAnkiCollection - Esquema Novo (tabelas notetypes / decks / fields / templates)', () => {
    let db: DatabaseSync;

    beforeEach(() => {
      db = new DatabaseSync(':memory:');
      db.exec(`
        CREATE TABLE notetypes (
          id integer primary key,
          name text,
          mtime_secs integer,
          usn integer,
          config blob
        );
        CREATE TABLE fields (
          ntid integer,
          ord integer,
          name text,
          config blob,
          primary key (ntid, ord)
        );
        CREATE TABLE templates (
          ntid integer,
          ord integer,
          name text,
          mtime_secs integer,
          usn integer,
          config blob,
          primary key (ntid, ord)
        );
        CREATE TABLE decks (
          id integer primary key,
          name text,
          mtime_secs integer,
          usn integer,
          common blob
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
      `);

      db.prepare("INSERT INTO notetypes (id, name, mtime_secs, usn, config) VALUES (5001, 'Anatomia Cloze', 0, 0, NULL)").run();
      db.prepare("INSERT INTO fields (ntid, ord, name, config) VALUES (5001, 0, 'Texto', NULL)").run();
      db.prepare("INSERT INTO fields (ntid, ord, name, config) VALUES (5001, 1, 'Extra', NULL)").run();
      db.prepare("INSERT INTO templates (ntid, ord, name, mtime_secs, usn, config) VALUES (5001, 0, 'Cloze 1', 0, 0, NULL)").run();

      db.prepare("INSERT INTO decks (id, name, mtime_secs, usn, common) VALUES (6001, 'Biologia::Celular', 0, 0, NULL)").run();

      db.prepare("INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (7001, 'guid-2', 5001, 0, 0, 'bio', 'A mitocôndria produz {{c1::ATP}}.\x1fNota extra', '', 0, 0, '')").run();
      db.prepare("INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) VALUES (8001, 7001, 6001, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, '')").run();
    });

    afterEach(() => {
      db.close();
    });

    it('deve extrair modelos, decks, notas e cards do banco normalizado', () => {
      const reader = createNodeSqliteReader(db);
      const collection = parseAnkiCollection(reader);

      expect(collection.models.size).toBe(1);
      const model = collection.models.get('5001');
      expect(model?.name).toBe('Anatomia Cloze');
      expect(model?.flds).toHaveLength(2);

      expect(collection.decks.size).toBe(1);
      expect(collection.decks.get('6001')?.name).toBe('Biologia::Celular');

      expect(collection.notes).toHaveLength(1);
      expect(collection.notes[0].fields).toEqual({
        Texto: 'A mitocôndria produz {{c1::ATP}}.',
        Extra: 'Nota extra',
      });
      expect(collection.notes[0].tags).toEqual(['bio']);

      expect(collection.cards).toHaveLength(1);
      expect(collection.cards[0].id).toBe('8001');
    });
  });

  describe('parseAnkiCardFsrsData', () => {
    it('deve extrair stability e difficulty de JSON válido de cards.data do Anki FSRS', () => {
      const fsrsData = parseAnkiCardFsrsData('{"s": 14.52, "d": 4.18}');
      expect(fsrsData).toEqual({
        stability: 14.52,
        difficulty: 4.18,
      });

      const fsrsWithExtra = parseAnkiCardFsrsData('{"s": 5.2, "d": 3.1, "b": 0, "dr": 0.9}');
      expect(fsrsWithExtra).toEqual({
        stability: 5.2,
        difficulty: 3.1,
      });
    });

    it('deve suportar formato aninhado cd se presente', () => {
      const fsrsNested = parseAnkiCardFsrsData('{"cd": {"s": 22.0, "d": 5.5}}');
      expect(fsrsNested).toEqual({
        stability: 22.0,
        difficulty: 5.5,
      });
    });

    it('deve retornar null para strings vazias, JSON sem s e d, ou dados inválidos', () => {
      expect(parseAnkiCardFsrsData('')).toBeNull();
      expect(parseAnkiCardFsrsData(undefined)).toBeNull();
      expect(parseAnkiCardFsrsData(null)).toBeNull();
      expect(parseAnkiCardFsrsData('{}')).toBeNull();
      expect(parseAnkiCardFsrsData('{"outra_coisa": 123}')).toBeNull();
      expect(parseAnkiCardFsrsData('{invalido: 123}')).toBeNull();
    });
  });

  describe('revlog e col.crt em parseAnkiCollection', () => {
    let db: DatabaseSync;

    beforeEach(() => {
      db = new DatabaseSync(':memory:');
      db.exec(`
        CREATE TABLE col (
          id integer primary key,
          crt integer,
          models text,
          decks text
        );
        CREATE TABLE notes (
          id integer primary key,
          mid integer,
          tags text,
          flds text,
          data text
        );
        CREATE TABLE cards (
          id integer primary key,
          nid integer,
          did integer,
          ord integer,
          type integer,
          queue integer,
          due integer,
          ivl integer,
          factor integer,
          reps integer,
          lapses integer,
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

      db.prepare("INSERT INTO col VALUES (1, 1680000000, '{}', '{}')").run();
      db.prepare("INSERT INTO revlog VALUES (1680001000500, 4001, -1, 3, 10, 5, 2500, 6200, 1)").run();
      db.prepare("INSERT INTO revlog VALUES (1680002000500, 4001, -1, 1, 0, 10, 2300, 12000, 2)").run();
    });

    afterEach(() => {
      db.close();
    });

    it('deve extrair crt e entradas da tabela revlog quando presentes', () => {
      const reader = createNodeSqliteReader(db);
      const collection = parseAnkiCollection(reader);

      expect(collection.crt).toBe(1680000000);
      expect(collection.revlogs).toHaveLength(2);
      expect(collection.revlogs[0]).toEqual({
        id: 1680001000500,
        cardId: '4001',
        ease: 3,
        ivl: 10,
        lastIvl: 5,
        factor: 2500,
        time: 6200,
        type: 1,
      });
      expect(collection.revlogs[1].cardId).toBe('4001');
      expect(collection.revlogs[1].ease).toBe(1);
    });
  });
});
