import { useCallback, useEffect, useState } from 'react';
import { getReviewStats, type GetReviewStatsOptions } from './metrics';
import type { ReviewStatsSummary } from './types';

export interface UseStatsOptions extends GetReviewStatsOptions {
  autoLoad?: boolean;
}

export interface UseStatsResult {
  stats: ReviewStatsSummary | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useStats(options: UseStatsOptions = {}): UseStatsResult {
  const { autoLoad = true, heatmapWeeks = 16, db, now, rolloverHour } = options;

  const [stats, setStats] = useState<ReviewStatsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(autoLoad);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      setError(null);
      const data = getReviewStats({
        db,
        now,
        rolloverHour,
        heatmapWeeks,
      });
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [db, now, rolloverHour, heatmapWeeks]);

  useEffect(() => {
    if (autoLoad) {
      refresh();
    }
  }, [autoLoad, refresh]);

  return {
    stats,
    loading,
    error,
    refresh,
  };
}
