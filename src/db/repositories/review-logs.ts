import { eq, and, isNull, gte, lte, desc } from 'drizzle-orm';
import type { FolioDatabase } from '../client';
import { getDb } from '../client';
import { reviewLogs, cards, type ReviewLog } from '../schema';
import { generateId } from './utils';

export interface CreateReviewLogInput {
  id?: string;
  card_id: string;
  rating: number;
  state: number;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  last_elapsed_days: number;
  scheduled_days: number;
  review_ms: number;
  reviewed_at?: number;
  created_at?: number;
  updated_at?: number;
}

export class ReviewLogsRepository {
  private db: FolioDatabase;

  constructor(db?: FolioDatabase) {
    this.db = db ?? getDb();
  }

  create(input: CreateReviewLogInput): ReviewLog {
    const now = Date.now();
    const id = input.id ?? generateId();
    const record: ReviewLog = {
      id,
      card_id: input.card_id,
      rating: input.rating,
      state: input.state,
      due: input.due,
      stability: input.stability,
      difficulty: input.difficulty,
      elapsed_days: input.elapsed_days,
      last_elapsed_days: input.last_elapsed_days,
      scheduled_days: input.scheduled_days,
      review_ms: input.review_ms,
      reviewed_at: input.reviewed_at ?? now,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
      deleted_at: null,
    };

    this.db.insert(reviewLogs).values(record).run();
    return record;
  }

  getById(id: string): ReviewLog | null {
    const rows = this.db
      .select()
      .from(reviewLogs)
      .where(and(eq(reviewLogs.id, id), isNull(reviewLogs.deleted_at)))
      .all();

    return rows[0] ?? null;
  }

  listByCard(cardId: string): ReviewLog[] {
    return this.db
      .select()
      .from(reviewLogs)
      .where(and(eq(reviewLogs.card_id, cardId), isNull(reviewLogs.deleted_at)))
      .orderBy(desc(reviewLogs.reviewed_at))
      .all();
  }

  listByRange(startMs: number, endMs: number): ReviewLog[] {
    return this.db
      .select()
      .from(reviewLogs)
      .where(
        and(
          isNull(reviewLogs.deleted_at),
          gte(reviewLogs.reviewed_at, startMs),
          lte(reviewLogs.reviewed_at, endMs)
        )
      )
      .orderBy(desc(reviewLogs.reviewed_at))
      .all();
  }

  countReviewedInRange(startMs: number, endMs: number): number {
    const logs = this.listByRange(startMs, endMs);
    return logs.length;
  }

  getReviewTimestamps(): number[] {
    const rows = this.db
      .select({ reviewed_at: reviewLogs.reviewed_at })
      .from(reviewLogs)
      .where(isNull(reviewLogs.deleted_at))
      .orderBy(desc(reviewLogs.reviewed_at))
      .all();

    return rows.map((r) => r.reviewed_at);
  }

  listRecent(limit = 50): ReviewLog[] {
    return this.db
      .select()
      .from(reviewLogs)
      .where(isNull(reviewLogs.deleted_at))
      .orderBy(desc(reviewLogs.reviewed_at))
      .limit(limit)
      .all();
  }

  listByNote(noteId: string): ReviewLog[] {
    return this.db
      .select({
        log: reviewLogs,
      })
      .from(reviewLogs)
      .innerJoin(cards, eq(reviewLogs.card_id, cards.id))
      .where(and(isNull(reviewLogs.deleted_at), eq(cards.note_id, noteId)))
      .orderBy(desc(reviewLogs.reviewed_at))
      .all()
      .map((r) => r.log);
  }

  getAverageReviewDurationMs(sinceMs?: number): number | null {
    const conditions = [isNull(reviewLogs.deleted_at)];
    if (sinceMs !== undefined) {
      conditions.push(gte(reviewLogs.reviewed_at, sinceMs));
    }
    const logs = this.db
      .select({ review_ms: reviewLogs.review_ms })
      .from(reviewLogs)
      .where(and(...conditions))
      .all();

    if (logs.length === 0) return null;
    const total = logs.reduce((acc, curr) => acc + curr.review_ms, 0);
    return Math.round(total / logs.length);
  }

  softDelete(id: string): boolean {
    const now = Date.now();
    const result = this.db
      .update(reviewLogs)
      .set({ deleted_at: now, updated_at: now })
      .where(eq(reviewLogs.id, id))
      .run();

    return result.changes > 0;
  }

  delete(id: string): boolean {
    const result = this.db.delete(reviewLogs).where(eq(reviewLogs.id, id)).run();
    return result.changes > 0;
  }
}

