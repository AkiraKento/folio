import type { FolioDatabase } from '@/db/client';
import { getDb } from '@/db/client';
import { ReviewLogsRepository } from '@/db/repositories/review-logs';
import { SettingsRepository } from '@/db/repositories/settings';
import {
  buildDailyQueue,
  getStudyDayStart,
  getStudyDayRange,
  toDate,
  DEFAULT_SCHEDULER_CONFIG,
  type DailyQueueResult,
  type SchedulerConfig,
} from '@/scheduler';
import { buildHeatmapData } from '@/stats/heatmap';
import type { StreakResult, TodaySummary } from './types';

/** Duração padrão por card na ausência de histórico nos últimos 7 dias (8 segundos) */
export const DEFAULT_CARD_REVIEW_DURATION_MS = 8000;

/** Janela de 7 dias em milissegundos */
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Calcula a sequência de dias consecutivos de estudo (streak).
 * Respeita a virada do dia (ex.: às 4h no fuso local).
 */
export function calculateStreak(
  reviewTimestamps: number[],
  options?: {
    now?: Date | number;
    rolloverHour?: number;
  }
): StreakResult {
  const nowDate = toDate(options?.now);
  const rolloverHour = options?.rolloverHour ?? DEFAULT_SCHEDULER_CONFIG.dayRolloverHour;

  if (!reviewTimestamps || reviewTimestamps.length === 0) {
    return { streak: 0, studiedToday: false };
  }

  // Agrupa os timestamps pelos inícios de dia de estudo
  const studyDaysSet = new Set<number>();
  for (const ts of reviewTimestamps) {
    const dayStart = getStudyDayStart(ts, rolloverHour);
    studyDaysSet.add(dayStart);
  }

  const todayStart = getStudyDayStart(nowDate, rolloverHour);
  const studiedToday = studyDaysSet.has(todayStart);

  let streak = 0;
  let currentDayStart = todayStart;

  if (studiedToday) {
    streak = 1;
    // Percorre dias anteriores consecutivos
    while (true) {
      const prevDayStart = getStudyDayStart(currentDayStart - 1, rolloverHour);
      if (studyDaysSet.has(prevDayStart)) {
        streak++;
        currentDayStart = prevDayStart;
      } else {
        break;
      }
    }
  } else {
    // Se ainda não estudou hoje, a sequência permanece viva se estudou ontem
    const yesterdayStart = getStudyDayStart(todayStart - 1, rolloverHour);
    if (studyDaysSet.has(yesterdayStart)) {
      streak = 1;
      currentDayStart = yesterdayStart;
      while (true) {
        const prevDayStart = getStudyDayStart(currentDayStart - 1, rolloverHour);
        if (studyDaysSet.has(prevDayStart)) {
          streak++;
          currentDayStart = prevDayStart;
        } else {
          break;
        }
      }
    } else {
      streak = 0;
    }
  }

  return { streak, studiedToday };
}

/**
 * Calcula a duração estimada total em ms para os cards pendentes.
 * Usa a média dos últimos 7 dias ou fallback para 8s/card.
 */
export function calculateEstimatedDurationMs(
  pendingCount: number,
  averageDurationMs: number | null
): number {
  if (pendingCount <= 0) return 0;
  const durationPerCard =
    averageDurationMs !== null && averageDurationMs > 0
      ? averageDurationMs
      : DEFAULT_CARD_REVIEW_DURATION_MS;

  return pendingCount * durationPerCard;
}

/**
 * Formata os milissegundos estimados em texto amigável de minutos:
 * - 0 ms => '0 min'
 * - < 60s => '< 1 min'
 * - >= 60s => '~X min'
 */
export function formatEstimatedMinutes(durationMs: number): string {
  if (durationMs <= 0) return '0 min';
  if (durationMs < 60000) return '< 1 min';
  const minutes = Math.round(durationMs / 60000);
  return `~${minutes} min`;
}

export interface GetTodaySummaryOptions {
  db?: FolioDatabase;
  now?: Date | number;
  settings?: Partial<SchedulerConfig>;
  rolloverHour?: number;
}

/**
 * Constrói o resumo consolidado de hoje com fila de revisão, estimativas e sequência de dias.
 */
export function getTodaySummary(options: GetTodaySummaryOptions = {}): TodaySummary {
  const database: FolioDatabase = options.db ?? getDb();
  const nowDate = toDate(options.now);
  const nowMs = nowDate.getTime();

  // Carrega configurações se não fornecidas explicitamente
  let effectiveSettings: SchedulerConfig;
  if (options.settings) {
    effectiveSettings = {
      ...DEFAULT_SCHEDULER_CONFIG,
      ...options.settings,
    };
  } else {
    try {
      const settingsRepo = new SettingsRepository(database);
      effectiveSettings = {
        newCardsPerDay: settingsRepo.getWithDefault('newCardsPerDay', DEFAULT_SCHEDULER_CONFIG.newCardsPerDay),
        maxReviewsPerDay: settingsRepo.getWithDefault('maxReviewsPerDay', DEFAULT_SCHEDULER_CONFIG.maxReviewsPerDay),
        desiredRetention: settingsRepo.getWithDefault('desiredRetention', DEFAULT_SCHEDULER_CONFIG.desiredRetention),
        dayRolloverHour: settingsRepo.getWithDefault('dayRolloverHour', DEFAULT_SCHEDULER_CONFIG.dayRolloverHour),
        enableShortTerm: DEFAULT_SCHEDULER_CONFIG.enableShortTerm,
        buttonMode: DEFAULT_SCHEDULER_CONFIG.buttonMode,
      };
    } catch {
      effectiveSettings = DEFAULT_SCHEDULER_CONFIG;
    }
  }

  const rolloverHour =
    options.rolloverHour ??
    effectiveSettings.dayRolloverHour ??
    DEFAULT_SCHEDULER_CONFIG.dayRolloverHour;

  // 1. Fila de hoje
  const queueResult: DailyQueueResult = buildDailyQueue({
    db: database,
    now: nowDate,
    settings: effectiveSettings,
  });

  const pendingCount = queueResult.queue.length;
  const newCount = queueResult.newCards.length;
  const learningCount = queueResult.learning.length;
  const reviewCount = queueResult.review.length;

  // 2. Logs e histórico de revisões
  const reviewLogsRepo = new ReviewLogsRepository(database);
  const reviewTimestamps = reviewLogsRepo.getReviewTimestamps();

  // 3. Sequência de dias
  const { streak, studiedToday } = calculateStreak(reviewTimestamps, {
    now: nowDate,
    rolloverHour,
  });

  // 4. Quantidade já revisada hoje
  const { startMs } = getStudyDayRange(nowDate, rolloverHour);
  const reviewedTodayCount = reviewLogsRepo.countReviewedInRange(startMs, nowMs);

  // 5. Média dos últimos 7 dias e tempo estimado
  const sinceMs = nowMs - SEVEN_DAYS_MS;
  const averageReviewDurationMs = reviewLogsRepo.getAverageReviewDurationMs(sinceMs);

  const estimatedDurationMs = calculateEstimatedDurationMs(
    pendingCount,
    averageReviewDurationMs
  );
  const estimatedMinutesText = formatEstimatedMinutes(estimatedDurationMs);

  // 6. Heatmap de revisões recentes (últimas 14 semanas)
  const heatmap = buildHeatmapData(reviewTimestamps, {
    now: nowDate,
    rolloverHour,
    weeksCount: 14,
  });

  return {
    pendingCount,
    newCount,
    learningCount,
    reviewCount,
    reviewedTodayCount,
    averageReviewDurationMs,
    estimatedDurationMs,
    estimatedMinutesText,
    streak,
    studiedToday,
    queueResult,
    heatmap,
  };
}
