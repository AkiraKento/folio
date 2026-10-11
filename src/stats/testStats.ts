import { isNotNull, isNull } from 'drizzle-orm';
import type { FolioDatabase } from '@/db/client';
import { getDb } from '@/db/client';
import { decks, cards } from '@/db/schema';
import { SettingsRepository } from '@/db/repositories/settings';
import { AnnotationsRepository } from '@/db/repositories/annotations';
import { getStudyDayStart, toDate, DEFAULT_SCHEDULER_CONFIG } from '@/scheduler';
import type {
  TestStatsHypothesis1,
  TestStatsHypothesis2,
  TestStatsHypothesis3,
  TestStatsSummary,
} from './types';

export interface GetTestStatsOptions {
  db?: FolioDatabase;
  now?: Date | number;
  rolloverHour?: number;
  reviewTimestamps?: number[];
  currentStreak?: number;
  retentionRate?: number;
}

/**
 * Calcula a quantidade de dias com pelo menos uma revisão na janela dos últimos 14 dias de estudo.
 */
export function calculate14DayReviewCount(
  reviewTimestamps: number[],
  options: { now?: Date | number; rolloverHour?: number } = {}
): number {
  if (!reviewTimestamps || reviewTimestamps.length === 0) {
    return 0;
  }

  const rolloverHour = options.rolloverHour ?? DEFAULT_SCHEDULER_CONFIG.dayRolloverHour;
  const currentStudyDayStart = getStudyDayStart(options.now, rolloverHour);

  // Conjunto de inícios de dias de estudo onde houve pelo menos uma revisão
  const reviewedDays = new Set<number>();
  for (const ts of reviewTimestamps) {
    reviewedDays.add(getStudyDayStart(ts, rolloverHour));
  }

  const DAY_MS = 86_400_000;
  let count = 0;

  // Percorre do dia atual retroagindo até 13 dias antes (totalizando 14 dias)
  for (let i = 0; i < 14; i++) {
    const dayStart = currentStudyDayStart - i * DAY_MS;
    if (reviewedDays.has(dayStart)) {
      count++;
    }
  }

  return count;
}

/**
 * Formata as estatísticas do teste (PRD §4) em texto legível para exportação ou compartilhamento.
 */
export function generateTestStatsExportText(
  summary: Omit<TestStatsSummary, 'exportText'>,
  metadata?: {
    appVersion?: string;
    totalCards?: number;
  }
): string {
  const version = metadata?.appVersion ?? '0.1.0';
  const dateStr = new Date(summary.generatedAt).toLocaleString('pt-BR');
  const retentionPercent = `${Math.round(summary.retentionRate * 100)}%`;

  const h1Status = summary.hypothesis1.isMet ? 'ATINGIDA' : 'EM ANDAMENTO';
  const h2Status = summary.hypothesis2.isMet ? 'ATINGIDA' : 'EM ANDAMENTO';
  const h3Status = summary.hypothesis3.isMet ? 'ATINGIDA' : 'PENDENTE';

  const lines = [
    '=== FOLIO · ESTATÍSTICAS DO TESTE (PRD §4) ===',
    `Data: ${dateStr}`,
    `Versão do app: ${version}`,
    `Metas atingidas: ${summary.totalGoalsMet}/3`,
    '',
    '--- HIPÓTESE 1: Hábito de Revisão (14 dias) ---',
    `Status: [${h1Status}]`,
    `• Dias com revisão (últimos 14 dias): ${summary.hypothesis1.daysReviewedIn14Days}/${summary.hypothesis1.windowDays} dias (Meta: ≥ ${summary.hypothesis1.targetDays})`,
    `• Sequência atual: ${summary.hypothesis1.currentStreak} ${summary.hypothesis1.currentStreak === 1 ? 'dia' : 'dias'}`,
    `• Total de revisões: ${summary.hypothesis1.totalReviews}`,
    `• Taxa de retenção: ${retentionPercent}`,
    '',
    '--- HIPÓTESE 2: Modo Consulta ---',
    `Status: [${h2Status}]`,
    `• Aberturas da Consulta: ${summary.hypothesis2.consultaOpenCount}/${summary.hypothesis2.targetOpens} vezes (Meta: ≥ ${summary.hypothesis2.targetOpens}) [${summary.hypothesis2.isOpensMet ? 'OK' : 'PENDENTE'}]`,
    `• Grifos e anotações criados: ${summary.hypothesis2.annotationsCount}/${summary.hypothesis2.targetAnnotations} (Meta: ≥ ${summary.hypothesis2.targetAnnotations}) [${summary.hypothesis2.isAnnotationsMet ? 'OK' : 'PENDENTE'}]`,
    '',
    '--- HIPÓTESE 3: Importação do Anki (.apkg) ---',
    `Status: [${h3Status}]`,
    `• Importou arquivo .apkg: ${summary.hypothesis3.hasImportedApkg ? 'Sim' : 'Não'} (Meta: ≥ 1)`,
    `• Arquivos .apkg registrados: ${summary.hypothesis3.apkgImportCount}`,
    `• Decks importados: ${summary.hypothesis3.importedDecksCount}`,
    `• Cards importados: ${summary.hypothesis3.importedCardsCount}`,
  ];

  if (metadata?.totalCards !== undefined) {
    lines.push(`• Total de cards no banco: ${metadata.totalCards}`);
  }

  lines.push('==============================================');

  return lines.join('\n');
}

/**
 * Coleta e consolida as métricas das 3 hipóteses do teste fechado (PRD §4).
 */
export function getTestStats(options: GetTestStatsOptions = {}): TestStatsSummary {
  const database: FolioDatabase = options.db ?? getDb();
  const nowDate = toDate(options.now);
  const rolloverHour =
    options.rolloverHour ?? DEFAULT_SCHEDULER_CONFIG.dayRolloverHour;

  const settingsRepo = new SettingsRepository(database);
  const annotationsRepo = new AnnotationsRepository(database);

  const reviewTimestamps = options.reviewTimestamps ?? [];
  const currentStreak = options.currentStreak ?? 0;
  const retentionRate = options.retentionRate ?? 0;

  // 1. Hipótese 1: Hábito de revisão diária (meta: >= 10 de 14 dias)
  const daysReviewedIn14Days = calculate14DayReviewCount(reviewTimestamps, {
    now: nowDate,
    rolloverHour,
  });
  const h1TargetDays = 10;
  const h1WindowDays = 14;
  const hypothesis1: TestStatsHypothesis1 = {
    daysReviewedIn14Days,
    targetDays: h1TargetDays,
    windowDays: h1WindowDays,
    isMet: daysReviewedIn14Days >= h1TargetDays,
    currentStreak,
    totalReviews: reviewTimestamps.length,
  };

  // 2. Hipótese 2: Modo Consulta (meta: >= 3 aberturas e >= 5 grifos)
  const consultaOpenCount = settingsRepo.getWithDefault('consultaOpenCount', 0);
  const activeAnnotations = annotationsRepo.listActive();
  const annotationsCount = activeAnnotations.length;
  const targetOpens = 3;
  const targetAnnotations = 5;
  const isOpensMet = consultaOpenCount >= targetOpens;
  const isAnnotationsMet = annotationsCount >= targetAnnotations;

  const hypothesis2: TestStatsHypothesis2 = {
    consultaOpenCount,
    targetOpens,
    isOpensMet,
    annotationsCount,
    targetAnnotations,
    isAnnotationsMet,
    isMet: isOpensMet && isAnnotationsMet,
  };

  // 3. Hipótese 3: Importação do Anki (meta: >= 1 .apkg)
  const apkgImportCount = settingsRepo.getWithDefault('apkgImportCount', 0);

  // Decks com source_id
  const importedDecks = database
    .select({ id: decks.id })
    .from(decks)
    .where(isNotNull(decks.source_id))
    .all();

  // Cards com source_id
  const importedCards = database
    .select({ id: cards.id })
    .from(cards)
    .where(isNotNull(cards.source_id))
    .all();

  const importedDecksCount = importedDecks.length;
  const importedCardsCount = importedCards.length;
  const hasImportedApkg = apkgImportCount > 0 || importedDecksCount > 0;

  const hypothesis3: TestStatsHypothesis3 = {
    hasImportedApkg,
    apkgImportCount,
    importedDecksCount,
    importedCardsCount,
    isMet: hasImportedApkg,
  };

  const totalGoalsMet =
    (hypothesis1.isMet ? 1 : 0) +
    (hypothesis2.isMet ? 1 : 0) +
    (hypothesis3.isMet ? 1 : 0);

  const generatedAt = nowDate.getTime();

  // Contagem de cards totais para metadados de exportação
  const totalCardsInDb = database
    .select({ id: cards.id })
    .from(cards)
    .where(isNull(cards.deleted_at))
    .all().length;

  const summaryWithoutExport: Omit<TestStatsSummary, 'exportText'> = {
    hypothesis1,
    hypothesis2,
    hypothesis3,
    totalGoalsMet,
    retentionRate,
    generatedAt,
  };

  const exportText = generateTestStatsExportText(summaryWithoutExport, {
    totalCards: totalCardsInDb,
  });

  return {
    ...summaryWithoutExport,
    exportText,
  };
}
