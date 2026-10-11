import { getStudyDayStart, toDate, DEFAULT_SCHEDULER_CONFIG } from '@/scheduler';
import type { HeatmapData, HeatmapDayData, HeatmapWeek } from './types';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Formata uma data local no padrão ISO YYYY-MM-DD.
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calcula o nível de intensidade de 0 a 4 com base na quantidade de revisões.
 */
export function calculateHeatmapLevel(
  count: number,
  maxCount?: number
): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;

  // Se o histórico tiver no máximo 4 revisões por dia, ajusta para dar destaque
  if (maxCount !== undefined && maxCount > 0 && maxCount <= 4) {
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count === 3) return 3;
    return 4;
  }

  if (count <= 4) return 1;
  if (count <= 14) return 2;
  if (count <= 29) return 3;
  return 4;
}

export interface BuildHeatmapOptions {
  now?: Date | number;
  weeksCount?: number;
  rolloverHour?: number;
}

/**
 * Constrói a matriz de semanas e dias para o Heatmap de revisões (estilo GitHub).
 * Organiza em colunas de semanas de Domingo (0) a Sábado (6).
 */
export function buildHeatmapData(
  reviewTimestamps: number[],
  options: BuildHeatmapOptions = {}
): HeatmapData {
  const nowDate = toDate(options.now);
  const weeksCount = options.weeksCount ?? 16;
  const rolloverHour =
    options.rolloverHour ?? DEFAULT_SCHEDULER_CONFIG.dayRolloverHour;

  // 1. Agrupa os timestamps por dia de estudo (YYYY-MM-DD)
  const countsByDate = new Map<string, number>();
  for (const ts of reviewTimestamps) {
    const studyDayStart = getStudyDayStart(ts, rolloverHour);
    const dateKey = formatDateKey(new Date(studyDayStart));
    countsByDate.set(dateKey, (countsByDate.get(dateKey) ?? 0) + 1);
  }

  // 2. Determina o sábado da semana atual e o domingo da primeira semana
  const currentStudyDayStart = getStudyDayStart(nowDate, rolloverHour);
  const currentStudyDate = new Date(currentStudyDayStart);
  const currentDayOfWeek = currentStudyDate.getDay(); // 0 = Domingo, ..., 6 = Sábado

  // Sábado final da grade
  const endSaturdayMs = currentStudyDayStart + (6 - currentDayOfWeek) * ONE_DAY_MS;
  // Domingo inicial da primeira semana
  const totalDays = weeksCount * 7;
  const startSundayMs = endSaturdayMs - (totalDays - 1) * ONE_DAY_MS;

  // 3. Primeira passada para calcular totais e maxCount dentro da janela
  let totalReviews = 0;
  let activeDays = 0;
  let maxCount = 0;

  for (let i = 0; i < totalDays; i++) {
    const dayMs = startSundayMs + i * ONE_DAY_MS;
    const dateKey = formatDateKey(new Date(dayMs));
    const count = countsByDate.get(dateKey) ?? 0;
    if (count > 0) {
      totalReviews += count;
      activeDays++;
      if (count > maxCount) {
        maxCount = count;
      }
    }
  }

  // 4. Constrói as semanas
  const weeks: HeatmapWeek[] = [];
  let startDateStr = '';
  let endDateStr = '';

  for (let w = 0; w < weeksCount; w++) {
    const week: HeatmapDayData[] = [];
    for (let d = 0; d < 7; d++) {
      const dayIndex = w * 7 + d;
      const dayMs = startSundayMs + dayIndex * ONE_DAY_MS;
      const dayDate = new Date(dayMs);
      const dateKey = formatDateKey(dayDate);

      if (dayIndex === 0) {
        startDateStr = dateKey;
      }
      if (dayIndex === totalDays - 1) {
        endDateStr = dateKey;
      }

      const count = countsByDate.get(dateKey) ?? 0;
      const level = calculateHeatmapLevel(count, maxCount);

      week.push({
        date: dateKey,
        dateMs: dayMs,
        count,
        level,
        dayOfWeek: d,
      });
    }
    weeks.push(week);
  }

  return {
    weeks,
    totalReviews,
    activeDays,
    maxCount,
    startDate: startDateStr,
    endDate: endDateStr,
  };
}
