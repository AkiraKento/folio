import { eq, and, isNull, lte, or, asc, ne } from 'drizzle-orm';
import type { FolioDatabase } from '../client';
import { getDb } from '../client';
import { cards, type Card } from '../schema';
import { generateId } from './utils';

export interface CreateCardInput {
  id?: string;
  note_id: string;
  deck_id: string;
  ord: number;
  due: number;
  stability?: number;
  difficulty?: number;
  elapsed_days?: number;
  scheduled_days?: number;
  learning_steps?: number;
  reps?: number;
  lapses?: number;
  state?: number;
  last_review?: number | null;
  suspended?: number;
  buried_until?: number | null;
  source_id?: string | null;
  created_at?: number;
  updated_at?: number;
}

export type FsrsStateUpdate = Partial<
  Pick<
    Card,
    | 'due'
    | 'stability'
    | 'difficulty'
    | 'elapsed_days'
    | 'scheduled_days'
    | 'learning_steps'
    | 'reps'
    | 'lapses'
    | 'state'
    | 'last_review'
  >
>;

export class CardsRepository {
  private db: FolioDatabase;

  constructor(db?: FolioDatabase) {
    this.db = db ?? getDb();
  }

  create(input: CreateCardInput): Card {
    const now = Date.now();
    const id = input.id ?? generateId();
    const record: Card = {
      id,
      note_id: input.note_id,
      deck_id: input.deck_id,
      ord: input.ord,
      due: input.due,
      stability: input.stability ?? 0,
      difficulty: input.difficulty ?? 0,
      elapsed_days: input.elapsed_days ?? 0,
      scheduled_days: input.scheduled_days ?? 0,
      learning_steps: input.learning_steps ?? 0,
      reps: input.reps ?? 0,
      lapses: input.lapses ?? 0,
      state: input.state ?? 0,
      last_review: input.last_review ?? null,
      suspended: input.suspended ?? 0,
      buried_until: input.buried_until ?? null,
      source_id: input.source_id ?? null,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
      deleted_at: null,
    };

    this.db.insert(cards).values(record).run();
    return record;
  }

  getById(id: string, options?: { includeDeleted?: boolean }): Card | null {
    const conditions = [eq(cards.id, id)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(cards.deleted_at));
    }

    const rows = this.db
      .select()
      .from(cards)
      .where(and(...conditions))
      .all();

    return rows[0] ?? null;
  }

  getBySourceId(sourceId: string, options?: { includeDeleted?: boolean }): Card | null {
    const conditions = [eq(cards.source_id, sourceId)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(cards.deleted_at));
    }

    const rows = this.db
      .select()
      .from(cards)
      .where(and(...conditions))
      .all();

    return rows[0] ?? null;
  }

  listByNote(noteId: string, options?: { includeDeleted?: boolean }): Card[] {
    const conditions = [eq(cards.note_id, noteId)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(cards.deleted_at));
    }

    return this.db
      .select()
      .from(cards)
      .where(and(...conditions))
      .orderBy(asc(cards.ord))
      .all();
  }

  listByDeck(deckId: string, options?: { includeDeleted?: boolean }): Card[] {
    const conditions = [eq(cards.deck_id, deckId)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(cards.deleted_at));
    }

    return this.db
      .select()
      .from(cards)
      .where(and(...conditions))
      .orderBy(asc(cards.due))
      .all();
  }

  update(id: string, data: Partial<Omit<Card, 'id' | 'created_at'>>): Card | null {
    const existing = this.getById(id, { includeDeleted: true });
    if (!existing) return null;

    const now = Date.now();
    this.db
      .update(cards)
      .set({
        ...data,
        updated_at: now,
      })
      .where(eq(cards.id, id))
      .run();

    return this.getById(id, { includeDeleted: true });
  }

  updateFsrs(id: string, fsrsData: FsrsStateUpdate): Card | null {
    return this.update(id, fsrsData);
  }

  suspend(id: string): Card | null {
    return this.update(id, { suspended: 1 });
  }

  unsuspend(id: string): Card | null {
    return this.update(id, { suspended: 0 });
  }

  bury(id: string, untilMs: number): Card | null {
    return this.update(id, { buried_until: untilMs });
  }

  unbury(id: string): Card | null {
    return this.update(id, { buried_until: null });
  }

  listSiblings(cardId: string): Card[] {
    const card = this.getById(cardId);
    if (!card) return [];
    return this.listByNote(card.note_id).filter(
      (s) => s.id !== cardId && s.deleted_at === null
    );
  }

  burySiblingsByNote(
    noteId: string,
    excludeCardId: string,
    untilMs: number
  ): Array<{ card: Card; previousBuriedUntil: number | null }> {
    const siblings = this.listByNote(noteId).filter(
      (s) => s.id !== excludeCardId && s.deleted_at === null
    );

    const affected: Array<{ card: Card; previousBuriedUntil: number | null }> = [];
    const now = Date.now();

    for (const sibling of siblings) {
      const prev = sibling.buried_until;
      if (prev !== null && prev >= untilMs) {
        continue;
      }

      this.db
        .update(cards)
        .set({
          buried_until: untilMs,
          updated_at: now,
        })
        .where(eq(cards.id, sibling.id))
        .run();

      const updated = this.getById(sibling.id);
      if (updated) {
        affected.push({ card: updated, previousBuriedUntil: prev });
      }
    }

    return affected;
  }

  burySiblings(
    cardId: string,
    untilMs: number
  ): Array<{ card: Card; previousBuriedUntil: number | null }> {
    const card = this.getById(cardId);
    if (!card) return [];
    return this.burySiblingsByNote(card.note_id, cardId, untilMs);
  }

  restoreBuriedSiblings(
    records: Array<{ cardId: string; previousBuriedUntil: number | null }>
  ): void {
    const now = Date.now();
    for (const item of records) {
      this.db
        .update(cards)
        .set({
          buried_until: item.previousBuriedUntil,
          updated_at: now,
        })
        .where(eq(cards.id, item.cardId))
        .run();
    }
  }

  softDelete(id: string): boolean {
    const existing = this.getById(id, { includeDeleted: true });
    if (!existing) return false;

    const now = Date.now();
    this.db
      .update(cards)
      .set({ deleted_at: now, updated_at: now })
      .where(eq(cards.id, id))
      .run();

    return true;
  }

  restore(id: string): boolean {
    const existing = this.getById(id, { includeDeleted: true });
    if (!existing) return false;

    const now = Date.now();
    this.db
      .update(cards)
      .set({ deleted_at: null, updated_at: now })
      .where(eq(cards.id, id))
      .run();

    return true;
  }

  hardDelete(id: string): boolean {
    this.db.delete(cards).where(eq(cards.id, id)).run();
    return true;
  }

  listDue(
    cutoffMs: number,
    options?: { deckId?: string; limit?: number }
  ): Card[] {
    const conditions = [
      isNull(cards.deleted_at),
      eq(cards.suspended, 0),
      ne(cards.state, 0), // Não-novos (learning, review, relearning)
      lte(cards.due, cutoffMs),
      or(isNull(cards.buried_until), lte(cards.buried_until, cutoffMs))!,
    ];

    if (options?.deckId) {
      conditions.push(eq(cards.deck_id, options.deckId));
    }

    const query = this.db
      .select()
      .from(cards)
      .where(and(...conditions))
      .orderBy(asc(cards.due));

    if (options?.limit) {
      return query.limit(options.limit).all();
    }

    return query.all();
  }

  listNew(options?: {
    deckId?: string;
    limit?: number;
    cutoffMs?: number;
  }): Card[] {
    const cutoff = options?.cutoffMs ?? Date.now();
    const conditions = [
      isNull(cards.deleted_at),
      eq(cards.suspended, 0),
      eq(cards.state, 0), // Novos
      or(isNull(cards.buried_until), lte(cards.buried_until, cutoff))!,
    ];

    if (options?.deckId) {
      conditions.push(eq(cards.deck_id, options.deckId));
    }

    const query = this.db
      .select()
      .from(cards)
      .where(and(...conditions))
      .orderBy(asc(cards.due), asc(cards.ord), asc(cards.created_at));

    if (options?.limit) {
      return query.limit(options.limit).all();
    }

    return query.all();
  }
}
