import {
  fsrs,
  Rating,
  State,
  type Grade,
  type Card as FsrsCard,
  type FSRS,
} from 'ts-fsrs';
import type { Card, InsertReviewLog } from '../db/schema';
import type {
  SchedulerConfig,
  NextReviewOption,
  ReviewExecutionResult,
} from './types';
import { DEFAULT_SCHEDULER_CONFIG } from './types';
import { formatInterval, toDate } from './time';
import { generateId } from '../db/repositories/utils';

export function createFsrsInstance(
  config?: Partial<Pick<SchedulerConfig, 'desiredRetention' | 'enableShortTerm'>>
): FSRS {
  return fsrs({
    request_retention: config?.desiredRetention ?? DEFAULT_SCHEDULER_CONFIG.desiredRetention,
    enable_short_term: config?.enableShortTerm ?? DEFAULT_SCHEDULER_CONFIG.enableShortTerm,
  });
}

export function cardToFsrs(card: Card): FsrsCard {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  };
}

export function fsrsToCardFields(fsrsCard: FsrsCard): {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: number | null;
} {
  return {
    due: fsrsCard.due.getTime(),
    stability: fsrsCard.stability,
    difficulty: fsrsCard.difficulty,
    elapsed_days: fsrsCard.elapsed_days,
    scheduled_days: fsrsCard.scheduled_days,
    learning_steps: fsrsCard.learning_steps,
    reps: fsrsCard.reps,
    lapses: fsrsCard.lapses,
    state: fsrsCard.state,
    last_review: fsrsCard.last_review ? fsrsCard.last_review.getTime() : null,
  };
}

export function calculateNextReviews(
  card: Card,
  now?: Date | number,
  config?: Partial<SchedulerConfig>
): NextReviewOption[] {
  const nowDate = toDate(now);
  const nowMs = nowDate.getTime();
  const f = createFsrsInstance(config);
  const fsrsCard = cardToFsrs(card);
  const preview = f.repeat(fsrsCard, nowDate);

  const buttonMode = config?.buttonMode ?? DEFAULT_SCHEDULER_CONFIG.buttonMode;

  const ratingsToInclude: Array<{ rating: Rating; grade: Grade; label: string }> =
    buttonMode === 2
      ? [
          { rating: Rating.Again, grade: Rating.Again as Grade, label: 'Errei' },
          { rating: Rating.Good, grade: Rating.Good as Grade, label: 'Acertei' },
        ]
      : [
          { rating: Rating.Again, grade: Rating.Again as Grade, label: 'Errei' },
          { rating: Rating.Hard, grade: Rating.Hard as Grade, label: 'Difícil' },
          { rating: Rating.Good, grade: Rating.Good as Grade, label: 'Bom' },
          { rating: Rating.Easy, grade: Rating.Easy as Grade, label: 'Fácil' },
        ];

  return ratingsToInclude.map(({ rating, grade, label }) => {
    const item = preview[grade];
    const nextCardFields = fsrsToCardFields(item.card);
    const updatedCard: Card = {
      ...card,
      ...nextCardFields,
      updated_at: nowMs,
    };

    return {
      rating,
      grade,
      label,
      intervalText: formatInterval(nextCardFields.due, nowMs),
      due: nextCardFields.due,
      card: updatedCard,
    };
  });
}

export function applyReview(
  card: Card,
  rating: Rating,
  now?: Date | number,
  config?: Partial<SchedulerConfig> & { reviewDurationMs?: number },
  reviewDurationMs?: number
): ReviewExecutionResult {
  const nowDate = toDate(now);
  const nowMs = nowDate.getTime();
  const f = createFsrsInstance(config);
  const fsrsCard = cardToFsrs(card);

  const grade = rating as Grade;
  const resultItem = f.next(fsrsCard, nowDate, grade);
  const nextCardFields = fsrsToCardFields(resultItem.card);

  const updatedCard: Card = {
    ...card,
    ...nextCardFields,
    updated_at: nowMs,
  };

  const durationMs = reviewDurationMs ?? config?.reviewDurationMs ?? 0;

  const reviewLog: InsertReviewLog = {
    id: generateId(),
    card_id: card.id,
    rating,
    state: card.state, // Estado em que o card estava antes da resposta
    due: resultItem.log.due.getTime(),
    stability: resultItem.log.stability,
    difficulty: resultItem.log.difficulty,
    elapsed_days: resultItem.log.elapsed_days,
    last_elapsed_days: resultItem.log.last_elapsed_days,
    scheduled_days: resultItem.log.scheduled_days,
    review_ms: durationMs,
    reviewed_at: nowMs,
    created_at: nowMs,
    updated_at: nowMs,
    deleted_at: null,
  };

  return { updatedCard, reviewLog };
}
