import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

export const DATABASE_NAME = 'folio.db';

export function getDb(databaseName: string = DATABASE_NAME) {
  const expoDb = openDatabaseSync(databaseName);
  return drizzle(expoDb, { schema });
}

export type FolioDatabase = ReturnType<typeof getDb>;
