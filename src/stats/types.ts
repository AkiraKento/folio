export interface HeatmapDayData {
  /** Data no formato ISO YYYY-MM-DD */
  date: string;
  /** Timestamp UTC do início do dia em ms */
  dateMs: number;
  /** Quantidade de revisões concluídas no dia */
  count: number;
  /** Nível de intensidade de 0 (sem revisões) a 4 (intensidade máxima) */
  level: 0 | 1 | 2 | 3 | 4;
  /** Dia da semana (0 = Domingo, 1 = Segunda, ..., 6 = Sábado) */
  dayOfWeek: number;
}

export type HeatmapWeek = HeatmapDayData[];

export interface HeatmapData {
  /** Lista de semanas (cada uma contendo 7 dias, de Domingo a Sábado) */
  weeks: HeatmapWeek[];
  /** Total de revisões contabilizadas no período */
  totalReviews: number;
  /** Total de dias com pelo menos 1 revisão */
  activeDays: number;
  /** Maior quantidade de revisões em um único dia */
  maxCount: number;
  /** Data inicial do período (YYYY-MM-DD) */
  startDate: string;
  /** Data final do período (YYYY-MM-DD) */
  endDate: string;
}

export interface CardsByStateSummary {
  new: number;
  learning: number;
  review: number;
  suspended: number;
  total: number;
}

export interface ReviewStatsSummary {
  /** Quantidade total de revisões no histórico */
  totalReviews: number;
  /** Quantidade total de dias ativos no histórico */
  activeDays: number;
  /** Média diária de revisões considerando dias ativos */
  averageReviewsPerActiveDay: number;
  /** Taxa de retenção real (0 a 1, ex.: 0.88 para 88%) */
  retentionRate: number;
  /** Total de revisões avaliadas para retenção */
  retentionReviewCount: number;
  /** Distribuição de cards por estado no banco */
  cardsByState: CardsByStateSummary;
  /** Sequência de dias consecutivos */
  streak: number;
  /** Se estudou hoje */
  studiedToday: boolean;
  /** Dados do Heatmap */
  heatmap: HeatmapData;
  /** Bloco de validação de hipóteses do teste (PRD §4) */
  testStats: TestStatsSummary;
}

export interface TestStatsHypothesis1 {
  /** Quantidade de dias com pelo menos 1 revisão na janela dos últimos 14 dias */
  daysReviewedIn14Days: number;
  /** Meta de dias com revisão (10) */
  targetDays: number;
  /** Tamanho da janela em dias (14) */
  windowDays: number;
  /** Se a meta individual foi atingida (>= 10 dias) */
  isMet: boolean;
  /** Sequência atual de dias */
  currentStreak: number;
  /** Total de revisões concluídas */
  totalReviews: number;
}

export interface TestStatsHypothesis2 {
  /** Quantidade de vezes que a Consulta foi aberta */
  consultaOpenCount: number;
  /** Meta de aberturas (3) */
  targetOpens: number;
  /** Se a meta de aberturas foi atingida (>= 3) */
  isOpensMet: boolean;
  /** Quantidade total de grifos/anotações criadas */
  annotationsCount: number;
  /** Meta de grifos (5) */
  targetAnnotations: number;
  /** Se a meta de anotações foi atingida (>= 5) */
  isAnnotationsMet: boolean;
  /** Se ambas as condições da hipótese foram atingidas */
  isMet: boolean;
}

export interface TestStatsHypothesis3 {
  /** Se importou pelo menos um arquivo .apkg */
  hasImportedApkg: boolean;
  /** Quantidade de arquivos .apkg importados registrados */
  apkgImportCount: number;
  /** Quantidade de decks importados (source_id presente) */
  importedDecksCount: number;
  /** Quantidade de cards importados (source_id presente) */
  importedCardsCount: number;
  /** Se a meta foi atingida (importou pelo menos 1 .apkg) */
  isMet: boolean;
}

export interface TestStatsSummary {
  /** Hipótese 1: hábito de revisão diária em 10+ de 14 dias */
  hypothesis1: TestStatsHypothesis1;
  /** Hipótese 2: abertura da Consulta 3+ vezes e 5+ grifos */
  hypothesis2: TestStatsHypothesis2;
  /** Hipótese 3: importação de .apkg */
  hypothesis3: TestStatsHypothesis3;
  /** Total de metas atingidas (0 a 3) */
  totalGoalsMet: number;
  /** Taxa de retenção real (0 a 1) */
  retentionRate: number;
  /** Timestamp UTC de geração das estatísticas em ms */
  generatedAt: number;
  /** Texto formatado para exportação direta */
  exportText: string;
}
