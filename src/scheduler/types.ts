import { Rating, State, type Grade, type Card as FsrsCard } from 'ts-fsrs';
import type { Card, InsertReviewLog } from '../db/schema';
import type { FolioDatabase } from '../db/client';

export { Rating, State, type Grade, type FsrsCard };

export interface SchedulerConfig {
  desiredRetention: number;
  enableShortTerm: boolean;
  buttonMode: 2 | 4;
  dayRolloverHour: number;
  newCardsPerDay: number;
  maxReviewsPerDay: number;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  desiredRetention: 0.9,
  enableShortTerm: true,
  buttonMode: 2,
  dayRolloverHour: 4,
  newCardsPerDay: 20,
  maxReviewsPerDay: 200,
};

export interface NextReviewOption {
  rating: Rating;
  grade: Grade;
  label: string;
  intervalText: string;
  due: number;
  card: Card;
}

export interface ReviewExecutionResult {
  updatedCard: Card;
  reviewLog: InsertReviewLog;
}

export interface DailyQueueResult {
  learning: Card[];
  review: Card[];
  newCards: Card[];
  queue: Card[];
  sisterBuriedCount: number;
}

export interface BuildDailyQueueOptions {
  db?: FolioDatabase;
  deckId?: string;
  now?: number | Date;
  settings?: Partial<SchedulerConfig>;
}
