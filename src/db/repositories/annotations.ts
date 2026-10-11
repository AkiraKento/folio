import { eq, and, isNull, asc, or, isNotNull } from 'drizzle-orm';
import type { FolioDatabase } from '../client';
import { getDb } from '../client';
import { annotations, notes, type Annotation } from '../schema';
import { generateId } from './utils';

export type AnnotationKind = 'hl' | 'ul';
export type AnnotationColor = 'amarelo' | 'verde' | 'azul' | 'rosa' | 'laranja';

export interface CreateAnnotationInput {
  id?: string;
  note_id: string;
  group_key?: string | null;
  kind: AnnotationKind;
  color: AnnotationColor;
  quote: string;
  prefix?: string;
  suffix?: string;
  start: number;
  end: number;
  note?: string;
  label?: string;
  created_at?: number;
  updated_at?: number;
}

export type UpdateAnnotationInput = Partial<
  Pick<
    Annotation,
    'kind' | 'color' | 'quote' | 'prefix' | 'suffix' | 'start' | 'end' | 'note' | 'label'
  >
>;

export class AnnotationsRepository {
  private db: FolioDatabase;

  constructor(db?: FolioDatabase) {
    this.db = db ?? getDb();
  }

  create(input: CreateAnnotationInput): Annotation {
    const now = Date.now();
    const id = input.id ?? generateId();
    const record: Annotation = {
      id,
      note_id: input.note_id,
      group_key: input.group_key ?? null,
      kind: input.kind,
      color: input.color,
      quote: input.quote,
      prefix: input.prefix ?? '',
      suffix: input.suffix ?? '',
      start: input.start,
      end: input.end,
      note: input.note ?? '',
      label: input.label ?? '',
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
      deleted_at: null,
    };

    this.db.insert(annotations).values(record).run();
    return record;
  }

  getById(id: string, options?: { includeDeleted?: boolean }): Annotation | null {
    const conditions = [eq(annotations.id, id)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(annotations.deleted_at));
    }

    const rows = this.db
      .select()
      .from(annotations)
      .where(and(...conditions))
      .all();

    return rows[0] ?? null;
  }

  listByNote(noteId: string, options?: { includeDeleted?: boolean }): Annotation[] {
    const conditions = [eq(annotations.note_id, noteId)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(annotations.deleted_at));
    }

    return this.db
      .select()
      .from(annotations)
      .where(and(...conditions))
      .orderBy(asc(annotations.start))
      .all();
  }

  listByGroupKey(groupKey: string, options?: { includeDeleted?: boolean }): Annotation[] {
    const conditions = [eq(annotations.group_key, groupKey)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(annotations.deleted_at));
    }

    return this.db
      .select()
      .from(annotations)
      .where(and(...conditions))
      .orderBy(asc(annotations.start))
      .all();
  }

  listByDeck(deckId: string, options?: { includeDeleted?: boolean }): Annotation[] {
    const conditions = [eq(notes.deck_id, deckId)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(annotations.deleted_at));
      conditions.push(isNull(notes.deleted_at));
    }

    const rows = this.db
      .select({ ann: annotations })
      .from(annotations)
      .innerJoin(notes, eq(annotations.note_id, notes.id))
      .where(and(...conditions))
      .orderBy(asc(annotations.start))
      .all();

    return rows.map((r) => r.ann);
  }

  listActive(): Annotation[] {
    return this.db
      .select()
      .from(annotations)
      .where(isNull(annotations.deleted_at))
      .orderBy(asc(annotations.start))
      .all();
  }

  listOrphans(deckId?: string | string[]): (Annotation & { isOrphan: boolean })[] {
    // Anotações órfãs: o registro de anotação está ativo (deleted_at IS NULL),
    // mas a nota associada foi excluída (notes.deleted_at IS NOT NULL) ou não existe.
    const query = this.db
      .select({
        ann: annotations,
        noteId: notes.id,
        noteDeletedAt: notes.deleted_at,
        deckId: notes.deck_id,
      })
      .from(annotations)
      .leftJoin(notes, eq(annotations.note_id, notes.id))
      .where(
        and(
          isNull(annotations.deleted_at),
          or(isNull(notes.id), isNotNull(notes.deleted_at))!
        )
      );

    const rows = query.all();
    const filtered = deckId
      ? Array.isArray(deckId)
        ? rows.filter((r) => r.deckId !== null && deckId.includes(r.deckId))
        : rows.filter((r) => r.deckId === deckId)
      : rows;

    return filtered.map((r) => ({
      ...r.ann,
      isOrphan: true,
    }));
  }

  update(id: string, data: UpdateAnnotationInput): Annotation | null {
    const existing = this.getById(id, { includeDeleted: true });
    if (!existing) return null;

    const now = Date.now();
    // Exclui propositalmente note_id e group_key para garantir a invariante do MODO_CONSULTA.md §4:
    // "note_id e group_key só são definidos na criação. Editar uma anotação nunca a move de nota."
    const recordToUpdate: Record<string, unknown> = { updated_at: now };
    if (data.kind !== undefined) recordToUpdate.kind = data.kind;
    if (data.color !== undefined) recordToUpdate.color = data.color;
    if (data.quote !== undefined) recordToUpdate.quote = data.quote;
    if (data.prefix !== undefined) recordToUpdate.prefix = data.prefix;
    if (data.suffix !== undefined) recordToUpdate.suffix = data.suffix;
    if (data.start !== undefined) recordToUpdate.start = data.start;
    if (data.end !== undefined) recordToUpdate.end = data.end;
    if (data.note !== undefined) recordToUpdate.note = data.note;
    if (data.label !== undefined) recordToUpdate.label = data.label;

    this.db
      .update(annotations)
      .set(recordToUpdate)
      .where(eq(annotations.id, id))
      .run();

    return this.getById(id, { includeDeleted: true });
  }

  save(input: CreateAnnotationInput): Annotation {
    if (input.id) {
      const existing = this.getById(input.id, { includeDeleted: true });
      if (existing) {
        const updated = this.update(input.id, {
          kind: input.kind,
          color: input.color,
          quote: input.quote,
          prefix: input.prefix,
          suffix: input.suffix,
          start: input.start,
          end: input.end,
          note: input.note,
          label: input.label,
        });
        if (existing.deleted_at) {
          this.restore(input.id);
        }
        return updated ?? existing;
      }
    }
    return this.create(input);
  }

  softDelete(id: string): boolean {
    const existing = this.getById(id, { includeDeleted: true });
    if (!existing) return false;

    const now = Date.now();
    this.db
      .update(annotations)
      .set({ deleted_at: now, updated_at: now })
      .where(eq(annotations.id, id))
      .run();

    return true;
  }

  restore(id: string): boolean {
    const existing = this.getById(id, { includeDeleted: true });
    if (!existing) return false;

    const now = Date.now();
    this.db
      .update(annotations)
      .set({ deleted_at: null, updated_at: now })
      .where(eq(annotations.id, id))
      .run();

    return true;
  }

  hardDelete(id: string): boolean {
    this.db.delete(annotations).where(eq(annotations.id, id)).run();
    return true;
  }
}
