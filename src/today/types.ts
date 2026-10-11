import type { DailyQueueResult } from '@/scheduler';
import type { HeatmapData } from '@/stats/types';

export interface StreakResult {
  /** Número de dias consecutivos de estudo */
  streak: number;
  /** Se o usuário já concluiu pelo menos uma revisão no dia de estudo de hoje */
  studiedToday: boolean;
}

export interface TodaySummary {
  /** Quantidade total de cards a estudar na fila de hoje */
  pendingCount: number;
  /** Quantidade de cards novos na fila */
  newCount: number;
  /** Quantidade de cards em aprendizado na fila */
  learningCount: number;
  /** Quantidade de cards a revisar na fila */
  reviewCount: number;
  /** Quantidade de cards já revisados hoje */
  reviewedTodayCount: number;
  /** Duração média por card nos últimos 7 dias em ms, ou null se sem histórico */
  averageReviewDurationMs: number | null;
  /** Duração estimada total para os cards pendentes em ms */
  estimatedDurationMs: number;
  /** Texto formatado da duração estimada (ex.: "~3 min", "< 1 min", "0 min") */
  estimatedMinutesText: string;
  /** Sequência de dias consecutivos */
  streak: number;
  /** Se o usuário já revisou hoje */
  studiedToday: boolean;
  /** Resultado detalhado da fila diária */
  queueResult: DailyQueueResult;
  /** Dados do Heatmap recente de revisões (estilo GitHub) */
  heatmap?: HeatmapData;
}
