import type { Card, Note, NoteType, Deck, Annotation } from '@/db/schema';
import type { NextReviewOption, Rating } from '@/scheduler';

export interface ReviewCardData {
  card: Card;
  note: Note;
  noteType: NoteType;
  deck: Deck;
  frontHtml: string;
  backHtml: string;
  annotations: Annotation[];
}

export interface BuriedSiblingInfo {
  cardId: string;
  previousBuriedUntil: number | null;
  removedFromQueueIndex?: number;
  removedCard?: Card;
}

export interface ReviewUndoItem {
  previousCard: Card;
  updatedCard: Card;
  reviewLogId: string;
  cardData: ReviewCardData;
  reinsertedInQueue: boolean;
  buriedSiblings?: BuriedSiblingInfo[];
}

export interface ReviewQueueCounts {
  newCards: number;
  learning: number;
  review: number;
  total: number;
}

import type { FolioDatabase } from '@/db/client';

export interface UseReviewSessionOptions {
  deckId?: string;
  now?: number | Date;
  db?: FolioDatabase;
}

export interface UseReviewSessionReturn {
  loading: boolean;
  deckName: string;
  currentCardData: ReviewCardData | null;
  isAnswerRevealed: boolean;
  nextReviewOptions: NextReviewOption[];
  buttonMode: 2 | 4;
  showHighlights: boolean;
  remainingCounts: ReviewQueueCounts;
  reviewedCount: number;
  canUndo: boolean;
  isFinished: boolean;
  flipCard: () => void;
  answerCard: (rating: Rating) => void;
  undo: () => boolean;
  reloadCurrentCard: () => void;
}
