import { eq, and, isNull, asc } from 'drizzle-orm';
import type { FolioDatabase } from '../client';
import { getDb } from '../client';
import { notes, cards, decks, type Note, type Card, type Deck } from '../schema';
import { generateId } from './utils';

export interface CreateNoteInput {
  id?: string;
  note_type_id: string;
  deck_id: string;
  fields: Record<string, string>;
  tags?: string[];
  source_id?: string | null;
  created_at?: number;
  updated_at?: number;
}

export type NoteWithCards = Note & {
  cards: Card[];
};

export type NoteForConsulta = Note & {
  cards: Card[];
  deck: Deck;
};

export class NotesRepository {
  private db: FolioDatabase;

  constructor(db?: FolioDatabase) {
    this.db = db ?? getDb();
  }

  create(input: CreateNoteInput): Note {
    const now = Date.now();
    const id = input.id ?? generateId();
    const record: Note = {
      id,
      note_type_id: input.note_type_id,
      deck_id: input.deck_id,
      fields: input.fields,
      tags: input.tags ?? [],
      source_id: input.source_id ?? null,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
      deleted_at: null,
    };

    this.db.insert(notes).values(record).run();
    return record;
  }

  getById(id: string, options?: { includeDeleted?: boolean }): Note | null {
    const conditions = [eq(notes.id, id)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(notes.deleted_at));
    }

    const rows = this.db
      .select()
      .from(notes)
      .where(and(...conditions))
      .all();

    return rows[0] ?? null;
  }

  getBySourceId(sourceId: string, options?: { includeDeleted?: boolean }): Note | null {
    const conditions = [eq(notes.source_id, sourceId)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(notes.deleted_at));
    }

    const rows = this.db
      .select()
      .from(notes)
      .where(and(...conditions))
      .all();

    return rows[0] ?? null;
  }

  listByDeck(deckId: string, options?: { includeDeleted?: boolean }): Note[] {
    const conditions = [eq(notes.deck_id, deckId)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(notes.deleted_at));
    }

    return this.db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(asc(notes.created_at))
      .all();
  }

  listAll(options?: { includeDeleted?: boolean }): Note[] {
    const query = this.db.select().from(notes);
    if (!options?.includeDeleted) {
      return query.where(isNull(notes.deleted_at)).orderBy(asc(notes.created_at)).all();
    }
    return query.orderBy(asc(notes.created_at)).all();
  }

  update(
    id: string,
    data: Partial<Pick<Note, 'fields' | 'tags' | 'deck_id' | 'note_type_id' | 'source_id'>>
  ): Note | null {
    const existing = this.getById(id, { includeDeleted: true });
    if (!existing) return null;

    const now = Date.now();
    this.db
      .update(notes)
      .set({
        ...data,
        updated_at: now,
      })
      .where(eq(notes.id, id))
      .run();

    return this.getById(id, { includeDeleted: true });
  }

  softDelete(id: string): boolean {
    const existing = this.getById(id, { includeDeleted: true });
    if (!existing) return false;

    const now = Date.now();

    // Soft delete da nota
    this.db
      .update(notes)
      .set({ deleted_at: now, updated_at: now })
      .where(eq(notes.id, id))
      .run();

    // Cascata lógica para os cards associados (conforme PRD §7)
    this.db
      .update(cards)
      .set({ deleted_at: now, updated_at: now })
      .where(eq(cards.note_id, id))
      .run();

    // Nota: anotações NÃO são apagadas, conforme MODO_CONSULTA.md §4 (viram órfãs)
    return true;
  }

  restore(id: string): boolean {
    const existing = this.getById(id, { includeDeleted: true });
    if (!existing) return false;

    const now = Date.now();

    // Restaura a nota
    this.db
      .update(notes)
      .set({ deleted_at: null, updated_at: now })
      .where(eq(notes.id, id))
      .run();

    // Restaura os cards associados
    this.db
      .update(cards)
      .set({ deleted_at: null, updated_at: now })
      .where(eq(cards.note_id, id))
      .run();

    return true;
  }

  hardDelete(id: string): boolean {
    // Exclui cards associados
    this.db.delete(cards).where(eq(cards.note_id, id)).run();
    this.db.delete(notes).where(eq(notes.id, id)).run();
    return true;
  }

  getWithCards(id: string, options?: { includeDeleted?: boolean }): NoteWithCards | null {
    const note = this.getById(id, options);
    if (!note) return null;

    const cardConditions = [eq(cards.note_id, id)];
    if (!options?.includeDeleted) {
      cardConditions.push(isNull(cards.deleted_at));
    }

    const noteCards = this.db
      .select()
      .from(cards)
      .where(and(...cardConditions))
      .orderBy(asc(cards.ord))
      .all();

    return {
      ...note,
      cards: noteCards,
    };
  }

  listForConsulta(deckId?: string, options?: { includeDeleted?: boolean }): NoteForConsulta[] {
    const noteConditions = [];
    if (deckId) {
      noteConditions.push(eq(notes.deck_id, deckId));
    }
    if (!options?.includeDeleted) {
      noteConditions.push(isNull(notes.deleted_at));
      noteConditions.push(isNull(decks.deleted_at));
    }

    // Join notas com decks para ordenar por deck name e created_at
    const rows = this.db
      .select({
        note: notes,
        deck: decks,
      })
      .from(notes)
      .innerJoin(decks, eq(notes.deck_id, decks.id))
      .where(noteConditions.length > 0 ? and(...noteConditions) : undefined)
      .orderBy(asc(decks.name), asc(notes.created_at))
      .all();

    return rows.map((r) => {
      const cardConditions = [eq(cards.note_id, r.note.id)];
      if (!options?.includeDeleted) {
        cardConditions.push(isNull(cards.deleted_at));
      }

      const noteCards = this.db
        .select()
        .from(cards)
        .where(and(...cardConditions))
        .orderBy(asc(cards.ord))
        .all();

      return {
        ...r.note,
        deck: r.deck,
        cards: noteCards,
      };
    });
  }
}
