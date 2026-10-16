import { eq, isNull } from 'drizzle-orm';
import type { FolioDatabase } from '../client';
import { getDb } from '../client';
import { settings, type Setting } from '../schema';

export interface FolioSettingsMap {
  theme: 'system' | 'light' | 'dark';
  newCardsPerDay: number;
  maxReviewsPerDay: number;
  desiredRetention: number;
  buttonMode: 2 | 4;
  dayRolloverHour: number;
  showHighlightsInReview: boolean;
  executeModelScripts: boolean;
  adjustFixedColorsInDarkMode: boolean;
  lastHighlightColor: 'amarelo' | 'verde' | 'azul' | 'rosa' | 'laranja';
  fontSize: number;
  sampleDeckLoaded: boolean;
  onboardingCompleted: boolean;
  userArea: 'medicina' | 'concursos' | 'direito' | 'psicologia' | 'geral';
  dailyStudyMinutes: number;
  examDate: string | null;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  consultaOpenCount: number;
  apkgImportCount: number;
}

export const DEFAULT_SETTINGS: FolioSettingsMap = {
  theme: 'system',
  newCardsPerDay: 20,
  maxReviewsPerDay: 200,
  desiredRetention: 0.9,
  buttonMode: 2,
  dayRolloverHour: 4,
  showHighlightsInReview: true,
  executeModelScripts: true,
  adjustFixedColorsInDarkMode: true,
  lastHighlightColor: 'amarelo',
  fontSize: 17,
  sampleDeckLoaded: false,
  onboardingCompleted: false,
  userArea: 'medicina',
  dailyStudyMinutes: 30,
  examDate: null,
  dailyReminderEnabled: false,
  dailyReminderTime: '20:00',
  consultaOpenCount: 0,
  apkgImportCount: 0,
};

export class SettingsRepository {
  private db: FolioDatabase;

  constructor(db?: FolioDatabase) {
    this.db = db ?? getDb();
  }

  get<T = unknown>(key: string): T | null {
    const rows = this.db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .all();

    const row = rows[0];
    if (!row || row.deleted_at !== null) {
      return null;
    }

    return row.value as T;
  }

  getWithDefault<T>(key: string, defaultValue: T): T {
    const val = this.get<T>(key);
    return val !== null ? val : defaultValue;
  }

  set<T = unknown>(key: string, value: T): Setting {
    const now = Date.now();
    const existing = this.db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .all()[0];

    if (existing) {
      this.db
        .update(settings)
        .set({
          value,
          updated_at: now,
          deleted_at: null,
        })
        .where(eq(settings.key, key))
        .run();
    } else {
      this.db
        .insert(settings)
        .values({
          key,
          value,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        })
        .run();
    }

    return {
      key,
      value,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
      deleted_at: null,
    };
  }

  increment(key: string, amount: number = 1): number {
    const current = this.get<number>(key);
    const next = (typeof current === 'number' ? current : 0) + amount;
    this.set(key, next);
    return next;
  }

  delete(key: string): boolean {
    const existing = this.db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .all()[0];

    if (!existing) return false;

    this.db.delete(settings).where(eq(settings.key, key)).run();
    return true;
  }

  getAll(): Record<string, unknown> {
    const rows = this.db
      .select()
      .from(settings)
      .where(isNull(settings.deleted_at))
      .all();

    const result: Record<string, unknown> = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return result;
  }
}
