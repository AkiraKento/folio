import { eq, and, isNull, lte, or, inArray, asc } from 'drizzle-orm';
import type { FolioDatabase } from '../db/client';
import { getDb } from '../db/client';
import { cards, decks, type Card } from '../db/schema';
import { ReviewLogsRepository } from '../db/repositories/review-logs';
import { State } from 'ts-fsrs';
import type { BuildDailyQueueOptions, DailyQueueResult } from './types';
import { DEFAULT_SCHEDULER_CONFIG } from './types';
import { getStudyDayRange, toDate } from './time';

export function buildDailyQueue(options: BuildDailyQueueOptions): DailyQueueResult {
  const database: FolioDatabase = options.db ?? getDb();
  const nowDate = toDate(options.now);
  const nowMs = nowDate.getTime();

  const rolloverHour =
    options.settings?.dayRolloverHour ?? DEFAULT_SCHEDULER_CONFIG.dayRolloverHour;
  const newCardsPerDay =
    options.settings?.newCardsPerDay ?? DEFAULT_SCHEDULER_CONFIG.newCardsPerDay;
  const maxReviewsPerDay =
    options.settings?.maxReviewsPerDay ?? DEFAULT_SCHEDULER_CONFIG.maxReviewsPerDay;

  const { startMs, endMs } = getStudyDayRange(nowDate, rolloverHour);

  // 1. Resolve os IDs dos decks elegíveis (incluindo subdecks se deckId for fornecido)
  let allowedDeckIds: string[] | null = null;
  if (options.deckId) {
    const rootDeck = database
      .select()
      .from(decks)
      .where(and(eq(decks.id, options.deckId), isNull(decks.deleted_at)))
      .all()[0];

    if (rootDeck) {
      const allDecks = database
        .select()
        .from(decks)
        .where(isNull(decks.deleted_at))
        .all();

      const prefix = `${rootDeck.name}::`;
      allowedDeckIds = allDecks
        .filter((d) => d.id === rootDeck.id || d.name.startsWith(prefix))
        .map((d) => d.id);
    } else {
      allowedDeckIds = [options.deckId];
    }
  }

  // 2. Consulta histórico de hoje para descontar do limite diário
  const reviewLogsRepo = new ReviewLogsRepository(database);
  const logsToday = reviewLogsRepo.listByRange(startMs, nowMs);

  let alreadyNewCount = 0;
  let alreadyReviewCount = 0;
  const reviewedCardIds = new Set<string>();

  for (const log of logsToday) {
    if (log.state === State.New) {
      alreadyNewCount++;
    } else {
      alreadyReviewCount++;
    }
    reviewedCardIds.add(log.card_id);
  }

  const reviewedNoteIds = new Set<string>();
  if (reviewedCardIds.size > 0) {
    const reviewedCards = database
      .select({ note_id: cards.note_id })
      .from(cards)
      .where(inArray(cards.id, Array.from(reviewedCardIds)))
      .all();
    for (const c of reviewedCards) {
      reviewedNoteIds.add(c.note_id);
    }
  }

  const remainingNewQuota = Math.max(0, newCardsPerDay - alreadyNewCount);
  const remainingReviewQuota = Math.max(0, maxReviewsPerDay - alreadyReviewCount);

  // 3. Condições base para seleção de cards ativos e disponíveis
  const baseConditions = [
    isNull(cards.deleted_at),
    eq(cards.suspended, 0),
    or(isNull(cards.buried_until), lte(cards.buried_until, nowMs))!,
  ];

  if (allowedDeckIds && allowedDeckIds.length > 0) {
    baseConditions.push(inArray(cards.deck_id, allowedDeckIds));
  }

  // A) Aprendizado vencido (State.Learning = 1 ou State.Relearning = 3)
  const learningCandidates: Card[] = database
    .select()
    .from(cards)
    .where(
      and(
        ...baseConditions,
        or(eq(cards.state, State.Learning), eq(cards.state, State.Relearning)),
        lte(cards.due, endMs)
      )
    )
    .orderBy(asc(cards.due))
    .all();

  // B) Revisões vencidas (State.Review = 2) — mais atrasadas primeiro (due asc)
  const reviewCandidates: Card[] = database
    .select()
    .from(cards)
    .where(
      and(
        ...baseConditions,
        eq(cards.state, State.Review),
        lte(cards.due, endMs)
      )
    )
    .orderBy(asc(cards.due))
    .all();

  // C) Novos cards (State.New = 0)
  const newCandidates: Card[] = database
    .select()
    .from(cards)
    .where(
      and(
        ...baseConditions,
        eq(cards.state, State.New)
      )
    )
    .orderBy(asc(cards.due), asc(cards.ord), asc(cards.created_at))
    .all();

  // 4. Seleção com Bury Simples de Irmãs (mesma note_id)
  // Irmãs da mesma nota não aparecem no mesmo dia (inclusive as já revisadas hoje).
  const seenNoteIds = new Set<string>(reviewedNoteIds);
  let sisterBuriedCount = 0;

  const selectedLearning: Card[] = [];
  for (const card of learningCandidates) {
    if (seenNoteIds.has(card.note_id)) {
      sisterBuriedCount++;
      continue;
    }
    seenNoteIds.add(card.note_id);
    selectedLearning.push(card);
  }

  const selectedReview: Card[] = [];
  for (const card of reviewCandidates) {
    if (seenNoteIds.has(card.note_id)) {
      sisterBuriedCount++;
      continue;
    }
    if (selectedReview.length >= remainingReviewQuota) {
      break;
    }
    seenNoteIds.add(card.note_id);
    selectedReview.push(card);
  }

  const selectedNew: Card[] = [];
  for (const card of newCandidates) {
    if (seenNoteIds.has(card.note_id)) {
      sisterBuriedCount++;
      continue;
    }
    if (selectedNew.length >= remainingNewQuota) {
      break;
    }
    seenNoteIds.add(card.note_id);
    selectedNew.push(card);
  }

  // Fila combinada: Aprendizado -> Revisões -> Novos
  const combinedQueue: Card[] = [
    ...selectedLearning,
    ...selectedReview,
    ...selectedNew,
  ];

  return {
    learning: selectedLearning,
    review: selectedReview,
    newCards: selectedNew,
    queue: combinedQueue,
    sisterBuriedCount,
  };
}
