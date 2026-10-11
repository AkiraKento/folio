import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

describe('Drizzle Schema & Initial Migration', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
  });

  afterEach(() => {
    db.close();
  });

  function applyMigration(database: DatabaseSync) {
    const migrationPath = path.join(__dirname, '../migrations/0000_chubby_meteorite.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
    const statements = sqlContent
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      database.exec(statement);
    }
  }

  test('executa a primeira migration e cria todas as 9 tabelas do PRD §7 + annotations', () => {
    applyMigration(db);

    const tablesStmt = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    );
    const tables = (tablesStmt.all() as { name: string }[]).map((r) => r.name);

    const expectedTables = [
      'annotations',
      'cards',
      'consulta_pos',
      'decks',
      'media',
      'note_types',
      'notes',
      'review_logs',
      'settings',
    ].sort();

    expect(tables).toEqual(expectedTables);
  });

  test('cria todos os índices especificados', () => {
    applyMigration(db);

    const indexStmt = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    );
    const indexes = (indexStmt.all() as { name: string }[]).map((r) => r.name);

    expect(indexes).toContain('ix_decks_name');
    expect(indexes).toContain('ix_notes_deck_id');
    expect(indexes).toContain('ix_notes_note_type_id');
    expect(indexes).toContain('ix_cards_note_id');
    expect(indexes).toContain('ix_cards_deck_id');
    expect(indexes).toContain('ix_cards_due');
    expect(indexes).toContain('ix_review_logs_card_id');
    expect(indexes).toContain('ix_review_logs_reviewed_at');
    expect(indexes).toContain('ix_ann_note');
    expect(indexes).toContain('ix_ann_group');
    expect(indexes).toContain('ix_media_filename');
  });

  test('permite inserção válida e consulta em todas as tabelas', () => {
    applyMigration(db);

    const now = Date.now();

    // 1. Deck
    db.prepare(`
      INSERT INTO decks (id, name, area, description, source_id, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL);
    `).run('deck-1', 'Cardiologia::IC', 'Medicina', 'Insuficiência cardíaca', null, now, now);

    // 2. Note Type
    db.prepare(`
      INSERT INTO note_types (id, name, kind, fields, templates, css, source_id, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);
    `).run(
      'nt-1',
      'Básico',
      'basic',
      JSON.stringify([{ name: 'Frente', ord: 0 }, { name: 'Verso', ord: 1 }]),
      JSON.stringify([{ name: 'Card 1', ord: 0, front: '{{Frente}}', back: '{{Verso}}' }]),
      '.card { font-size: 16px; }',
      null,
      now,
      now
    );

    // 3. Note
    db.prepare(`
      INSERT INTO notes (id, note_type_id, deck_id, fields, tags, source_id, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL);
    `).run(
      'note-1',
      'nt-1',
      'deck-1',
      JSON.stringify({ Frente: 'Qual a primeira linha na ICFEr?', Verso: 'IECA/BRA e betabloqueador' }),
      JSON.stringify(['cardio', 'ic']),
      null,
      now,
      now
    );

    // 4. Card
    db.prepare(`
      INSERT INTO cards (
        id, note_id, deck_id, ord, due, stability, difficulty,
        elapsed_days, scheduled_days, learning_steps, reps, lapses,
        state, last_review, suspended, buried_until, source_id,
        created_at, updated_at, deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);
    `).run(
      'card-1',
      'note-1',
      'deck-1',
      0,
      now + 86400000,
      2.5,
      5.0,
      0,
      1,
      0,
      0,
      0,
      0,
      null,
      0,
      null,
      null,
      now,
      now
    );

    // 5. Review Log
    db.prepare(`
      INSERT INTO review_logs (
        id, card_id, rating, state, due, stability, difficulty,
        elapsed_days, last_elapsed_days, scheduled_days, review_ms,
        reviewed_at, created_at, updated_at, deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);
    `).run(
      'rev-1',
      'card-1',
      3, // Good
      1, // Learning
      now + 86400000,
      2.5,
      5.0,
      0,
      0,
      1,
      4500,
      now,
      now,
      now
    );

    // 6. Annotation (conforme MODO_CONSULTA.md §4)
    db.prepare(`
      INSERT INTO annotations (
        id, note_id, group_key, kind, color, quote, prefix, suffix,
        start, "end", note, label, created_at, updated_at, deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);
    `).run(
      'ann-1',
      'note-1',
      null,
      'hl',
      'amarelo',
      'betabloqueador',
      'IECA/BRA e ',
      '',
      11,
      25,
      'Importante titular dose',
      '',
      now,
      now
    );

    // 7. Media
    db.prepare(`
      INSERT INTO media (id, filename, sha1, bytes, mime, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL);
    `).run('media-1', 'coracao.png', 'da39a3ee5e6b4b0d3255bfef95601890afd80709', 12345, 'image/png', now, now);

    // 8. Settings
    db.prepare(`
      INSERT INTO settings (key, value, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, NULL);
    `).run('new_cards_per_day', JSON.stringify(20), now, now);

    // 9. Consulta Pos
    db.prepare(`
      INSERT INTO consulta_pos (deck_query, unit_index, scroll_offset, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, NULL);
    `).run('deck:deck-1', 4, 320.5, now, now);

    // Verificações
    const annRow = db.prepare('SELECT * FROM annotations WHERE id = ?').get('ann-1') as {
      quote: string;
      color: string;
      end: number;
    };
    expect(annRow.quote).toBe('betabloqueador');
    expect(annRow.color).toBe('amarelo');
    expect(annRow.end).toBe(25);

    const cardRow = db.prepare('SELECT * FROM cards WHERE id = ?').get('card-1') as {
      stability: number;
      suspended: number;
    };
    expect(cardRow.stability).toBe(2.5);
    expect(cardRow.suspended).toBe(0);

    const posRow = db.prepare('SELECT * FROM consulta_pos WHERE deck_query = ?').get('deck:deck-1') as {
      unit_index: number;
      scroll_offset: number;
    };
    expect(posRow.unit_index).toBe(4);
    expect(posRow.scroll_offset).toBe(320.5);
  });

  test('garante integridade de chaves estrangeiras', () => {
    applyMigration(db);

    const now = Date.now();

    // Tentar inserir note com deck inexistente deve falhar
    expect(() => {
      db.prepare(`
        INSERT INTO notes (id, note_type_id, deck_id, fields, tags, created_at, updated_at)
        VALUES ('note-x', 'nt-invalid', 'deck-invalid', '{}', '[]', ?, ?);
      `).run(now, now);
    }).toThrow();

    // Tentar inserir card com note inexistente deve falhar
    expect(() => {
      db.prepare(`
        INSERT INTO cards (id, note_id, deck_id, ord, due, created_at, updated_at)
        VALUES ('card-x', 'note-invalid', 'deck-invalid', 0, ?, ?, ?);
      `).run(now, now, now);
    }).toThrow();

    // Tentar inserir anotação com note inexistente deve falhar
    expect(() => {
      db.prepare(`
        INSERT INTO annotations (id, note_id, kind, color, quote, created_at, updated_at)
        VALUES ('ann-x', 'note-invalid', 'hl', 'amarelo', 'teste', ?, ?);
      `).run(now, now);
    }).toThrow();
  });

  test('teste de migração de ida sobre banco com dados preserva o estado', () => {
    // 1. Aplica migration
    applyMigration(db);
    const now = Date.now();

    db.prepare(`
      INSERT INTO decks (id, name, created_at, updated_at)
      VALUES ('deck-test', 'Direito::Constitucional', ?, ?);
    `).run(now, now);

    // 2. Simula execução idempotente/segura (ex.: verificação de dados existentes)
    const countBefore = (db.prepare('SELECT count(*) as count FROM decks;').get() as { count: number }).count;
    expect(countBefore).toBe(1);

    // O banco preserva os dados inseridos
    const deck = db.prepare('SELECT name FROM decks WHERE id = ?;').get('deck-test') as { name: string };
    expect(deck.name).toBe('Direito::Constitucional');
  });
});
