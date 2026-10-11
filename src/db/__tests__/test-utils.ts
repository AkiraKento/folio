import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from '../schema';
import type { FolioDatabase } from '../client';

export function createTestDatabase(): {
  rawDb: DatabaseSync;
  db: FolioDatabase;
} {
  const nodeDb = new DatabaseSync(':memory:');
  nodeDb.exec('PRAGMA foreign_keys = ON;');

  // Aplica a primeira migration gerada pelo drizzle-kit
  const migrationPath = path.join(__dirname, '../migrations/0000_chubby_meteorite.sql');
  const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
  const statements = sqlContent
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    nodeDb.exec(statement);
  }

  const mockClient = {
    prepareSync(sqlQuery: string) {
      const stmt = nodeDb.prepare(sqlQuery);
      const rawStmt = nodeDb.prepare(sqlQuery);
      rawStmt.setReturnArrays(true);

      return {
        executeSync(params: unknown) {
          const arr = Array.isArray(params)
            ? params
            : Object.values((params as Record<string, unknown>) || {});
          const res = stmt.run(...(arr as Array<string | number | bigint | Buffer | null>));
          return {
            changes: res.changes,
            lastInsertRowId: Number(res.lastInsertRowid),
            getAllSync: () => stmt.all(...(arr as Array<string | number | bigint | Buffer | null>)),
            getFirstSync: () => stmt.get(...(arr as Array<string | number | bigint | Buffer | null>)),
          };
        },
        executeForRawResultSync(params: unknown) {
          const arr = Array.isArray(params)
            ? params
            : Object.values((params as Record<string, unknown>) || {});
          return {
            getAllSync: () =>
              rawStmt.all(...(arr as Array<string | number | bigint | Buffer | null>)) as unknown as unknown[][],
          };
        },
      };
    },
    execSync(sqlQuery: string) {
      nodeDb.exec(sqlQuery);
    },
    runSync(sqlQuery: string, ...params: Array<string | number | bigint | Buffer | null>) {
      const stmt = nodeDb.prepare(sqlQuery);
      return stmt.run(...params);
    },
    withTransactionSync<T>(callback: () => T): T {
      nodeDb.exec('BEGIN TRANSACTION;');
      try {
        const result = callback();
        nodeDb.exec('COMMIT;');
        return result;
      } catch (error) {
        nodeDb.exec('ROLLBACK;');
        throw error;
      }
    },
  };

  const db = drizzle(mockClient as unknown as Parameters<typeof drizzle>[0], {
    schema,
  }) as unknown as FolioDatabase;

  return { rawDb: nodeDb, db };
}

export function seedBasicNoteType(db: FolioDatabase, id = 'nt-basic') {
  const now = Date.now();
  db.insert(schema.noteTypes)
    .values({
      id,
      name: 'Básico',
      kind: 'basic',
      fields: [
        { name: 'Frente', ord: 0 },
        { name: 'Verso', ord: 1 },
      ],
      templates: [
        {
          name: 'Card 1',
          ord: 0,
          front: '{{Frente}}',
          back: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Verso}}',
        },
      ],
      css: '.card { font-family: sans-serif; }',
      created_at: now,
      updated_at: now,
    })
    .run();
  return id;
}
