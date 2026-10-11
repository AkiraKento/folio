import { isNull } from 'drizzle-orm';
import type { FolioDatabase } from '@/db/client';
import { getDb } from '@/db/client';
import { cards, reviewLogs } from '@/db/schema';
import { ReviewLogsRepository } from '@/db/repositories/review-logs';
import { SettingsRepository } from '@/db/repositories/settings';
import {
  getStudyDayStart,
  toDate,
  DEFAULT_SCHEDULER_CONFIG,
} from '@/scheduler';
import { calculateStreak } from '@/today/metrics';
import { buildHeatmapData } from './heatmap';
import { getTestStats } from './testStats';
import type {
  CardsByStateSummary,
  ReviewStatsSummary,
} from './types';

export interface CalculateRetentionResult {
  rate: number;
  total: number;
  successful: number;
}

/**
 * Calcula a taxa de retenção real (% de acertos nos logs de revisão).
 * Acertos são ratings > 1 (Hard, Good, Easy; Again = 1 é erro).
 */
export function calculateRetentionRate(
  logs: Array<{ rating: number }>
): CalculateRetentionResult {
  if (!logs || logs.length === 0) {
    return { rate: 0, total: 0, successful: 0 };
  }

  const total = logs.length;
  const successful = logs.filter((l) => l.rating > 1).length;
  const rate = total > 0 ? successful / total : 0;

  return { rate, total, successful };
}

export interface GetReviewStatsOptions {
  db?: FolioDatabase;
  now?: Date | number;
  rolloverHour?: number;
  heatmapWeeks?: number;
}

/**
 * Coleta todas as estatísticas consolidadas de revisão, cards por estado,
 * retenção real e matriz de heatmap.
 */
export function getReviewStats(
  options: GetReviewStatsOptions = {}
): ReviewStatsSummary {
  const database: FolioDatabase = options.db ?? getDb();
  const nowDate = toDate(options.now);

  let rolloverHour = options.rolloverHour;
  if (rolloverHour === undefined) {
    try {
      const settingsRepo = new SettingsRepository(database);
      rolloverHour = settingsRepo.getWithDefault(
        'dayRolloverHour',
        DEFAULT_SCHEDULER_CONFIG.dayRolloverHour
      );
    } catch {
      rolloverHour = DEFAULT_SCHEDULER_CONFIG.dayRolloverHour;
    }
  }

  const reviewLogsRepo = new ReviewLogsRepository(database);
  const reviewTimestamps = reviewLogsRepo.getReviewTimestamps();

  // 1. Logs para cálculo de retenção
  const rawLogs = database
    .select({
      rating: reviewLogs.rating,
      state: reviewLogs.state,
    })
    .from(reviewLogs)
    .where(isNull(reviewLogs.deleted_at))
    .all();

  const { rate: retentionRate, total: retentionReviewCount } =
    calculateRetentionRate(rawLogs);

  // 2. Contagem de cards por estado
  const rawCards = database
    .select({
      state: cards.state,
      suspended: cards.suspended,
    })
    .from(cards)
    .where(isNull(cards.deleted_at))
    .all();

  const cardsByState: CardsByStateSummary = {
    new: 0,
    learning: 0,
    review: 0,
    suspended: 0,
    total: rawCards.length,
  };

  for (const c of rawCards) {
    if (c.suspended === 1) {
      cardsByState.suspended++;
    } else if (c.state === 0) {
      cardsByState.new++;
    } else if (c.state === 1 || c.state === 3) {
      cardsByState.learning++;
    } else if (c.state === 2) {
      cardsByState.review++;
    }
  }

  // 3. Sequência (streak)
  const { streak, studiedToday } = calculateStreak(reviewTimestamps, {
    now: nowDate,
    rolloverHour,
  });

  // 4. Heatmap
  const heatmap = buildHeatmapData(reviewTimestamps, {
    now: nowDate,
    rolloverHour,
    weeksCount: options.heatmapWeeks ?? 16,
  });

  // 5. Total de revisões e dias ativos em todo o histórico
  const totalReviews = reviewTimestamps.length;
  const activeDaysSet = new Set<number>();
  for (const ts of reviewTimestamps) {
    activeDaysSet.add(getStudyDayStart(ts, rolloverHour));
  }
  const activeDays = activeDaysSet.size;
  const averageReviewsPerActiveDay =
    activeDays > 0 ? Math.round((totalReviews / activeDays) * 10) / 10 : 0;

  // 6. Estatísticas do teste (PRD §4)
  const testStats = getTestStats({
    db: database,
    now: nowDate,
    rolloverHour,
    reviewTimestamps,
    currentStreak: streak,
    retentionRate,
  });

  return {
    totalReviews,
    activeDays,
    averageReviewsPerActiveDay,
    retentionRate,
    retentionReviewCount,
    cardsByState,
    streak,
    studiedToday,
    heatmap,
    testStats,
  };
}
