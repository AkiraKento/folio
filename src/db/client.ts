import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import { logWarn } from '@/logging';

export const DATABASE_NAME = 'folio.db';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let currentDbName: string | null = null;

/**
 * Retorna a instância única (singleton) do banco de dados local com os PRAGMAs
 * recomendados (WAL, foreign_keys e busy_timeout).
 */
export function getDb(databaseName: string = DATABASE_NAME) {
  if (dbInstance && currentDbName === databaseName) {
    return dbInstance;
  }

  const expoDb = openDatabaseSync(databaseName);
  try {
    expoDb.execSync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
    `);
  } catch (err) {
    // Em alguns ambientes de teste em memória, os PRAGMAs podem não ser suportados
    logWarn('DatabasePragma', err);
  }

  dbInstance = drizzle(expoDb, { schema });
  currentDbName = databaseName;
  return dbInstance;
}

/**
 * Reseta a instância única do banco de dados (útil em testes unitários).
 */
export function resetDbInstance(): void {
  dbInstance = null;
  currentDbName = null;
}

export type FolioDatabase = ReturnType<typeof getDb>;
