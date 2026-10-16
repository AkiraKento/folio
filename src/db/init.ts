import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { getDb, type FolioDatabase } from './client';
import { loadSampleDeck, isSampleDeckLoaded, type LoadSampleDeckResult, type StudyArea } from './sample-deck';
import { SettingsRepository } from './repositories/settings';
import type { Deck } from './schema';
import { logError } from '@/logging';
import migrations from './migrations/migrations';

export interface InitAppDatabaseResult {
  migrated: boolean;
  sampleDeckResult: LoadSampleDeckResult;
}

/**
 * Inicializa o banco de dados do aplicativo:
 * 1. Aplica migrações pendentes do SQLite (falha caso a migração seja interrompida).
 * 2. Garante o deck de exemplo se o onboarding já foi concluído ou se já foi carregado.
 */
export async function initAppDatabase(db?: FolioDatabase): Promise<InitAppDatabaseResult> {
  const targetDb = db ?? getDb();

  let migrated = false;
  try {
    await migrate(targetDb as unknown as ExpoSQLiteDatabase<Record<string, unknown>>, migrations);
    migrated = true;
  } catch (error) {
    logError('DatabaseMigration', error);
    throw new Error(
      `Falha na migração do banco de dados: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const settingsRepo = new SettingsRepository(targetDb);
  const onboardingCompleted = settingsRepo.get<boolean>('onboardingCompleted') === true;
  const sampleDeckLoaded = isSampleDeckLoaded(targetDb);

  let sampleDeckResult: LoadSampleDeckResult;
  if (onboardingCompleted || sampleDeckLoaded) {
    const userArea = settingsRepo.get<StudyArea>('userArea') ?? 'medicina';
    sampleDeckResult = loadSampleDeck(targetDb, { area: userArea });
  } else {
    sampleDeckResult = {
      loaded: false,
      deck: null as unknown as Deck,
      notes: [],
      cards: [],
    };
  }

  return {
    migrated,
    sampleDeckResult,
  };
}
