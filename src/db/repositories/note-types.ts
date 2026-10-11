import { eq, and, isNull } from 'drizzle-orm';
import type { FolioDatabase } from '../client';
import { getDb } from '../client';
import {
  noteTypes,
  type NoteType,
  type NoteTypeField,
  type NoteTypeTemplate,
} from '../schema';
import { generateId } from './utils';
import { getBuiltinNoteTypes } from '../builtin-note-types';

export interface CreateNoteTypeInput {
  id?: string;
  name: string;
  kind: 'basic' | 'basic_reversed' | 'cloze' | 'custom';
  fields: NoteTypeField[];
  templates: NoteTypeTemplate[];
  css?: string;
  source_id?: string | null;
  created_at?: number;
  updated_at?: number;
}

export interface UpdateNoteTypeInput {
  name?: string;
  fields?: NoteTypeField[];
  templates?: NoteTypeTemplate[];
  css?: string;
  source_id?: string | null;
  updated_at?: number;
}

export class NoteTypesRepository {
  private db: FolioDatabase;

  constructor(db?: FolioDatabase) {
    this.db = db ?? getDb();
  }

  create(input: CreateNoteTypeInput): NoteType {
    const now = Date.now();
    const id = input.id ?? generateId();
    const record: NoteType = {
      id,
      name: input.name,
      kind: input.kind,
      fields: input.fields,
      templates: input.templates,
      css: input.css ?? '',
      source_id: input.source_id ?? null,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
      deleted_at: null,
    };

    this.db.insert(noteTypes).values(record).run();
    return record;
  }

  getById(id: string, options?: { includeDeleted?: boolean }): NoteType | null {
    const conditions = [eq(noteTypes.id, id)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(noteTypes.deleted_at));
    }

    const rows = this.db
      .select()
      .from(noteTypes)
      .where(and(...conditions))
      .all();

    return rows[0] ?? null;
  }

  getByKind(
    kind: 'basic' | 'basic_reversed' | 'cloze' | 'custom',
    options?: { includeDeleted?: boolean }
  ): NoteType[] {
    const conditions = [eq(noteTypes.kind, kind)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(noteTypes.deleted_at));
    }

    return this.db
      .select()
      .from(noteTypes)
      .where(and(...conditions))
      .all();
  }

  list(options?: { includeDeleted?: boolean }): NoteType[] {
    const conditions = [];
    if (!options?.includeDeleted) {
      conditions.push(isNull(noteTypes.deleted_at));
    }

    if (conditions.length > 0) {
      return this.db
        .select()
        .from(noteTypes)
        .where(and(...conditions))
        .all();
    }

    return this.db.select().from(noteTypes).all();
  }

  update(id: string, input: UpdateNoteTypeInput): NoteType | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    const now = Date.now();
    const patch: Partial<NoteType> = {
      updated_at: input.updated_at ?? now,
    };

    if (input.name !== undefined) patch.name = input.name;
    if (input.fields !== undefined) patch.fields = input.fields;
    if (input.templates !== undefined) patch.templates = input.templates;
    if (input.css !== undefined) patch.css = input.css;
    if (input.source_id !== undefined) patch.source_id = input.source_id;

    this.db.update(noteTypes).set(patch).where(eq(noteTypes.id, id)).run();

    return this.getById(id);
  }

  softDelete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) {
      return false;
    }

    const now = Date.now();
    this.db
      .update(noteTypes)
      .set({ deleted_at: now, updated_at: now })
      .where(eq(noteTypes.id, id))
      .run();

    return true;
  }

  /**
   * Garante a presença dos note types embutidos (Básico, Básico + invertido, Cloze) no banco de dados.
   * Se já existirem, não duplica nem altera customizações prévias do usuário.
   */
  seedBuiltins(): NoteType[] {
    const builtins = getBuiltinNoteTypes();
    for (const item of builtins) {
      const existing = this.getById(item.id, { includeDeleted: true });
      if (!existing) {
        this.db.insert(noteTypes).values(item).run();
      }
    }

    return builtins
      .map((item) => this.getById(item.id, { includeDeleted: true }))
      .filter((nt): nt is NoteType => nt !== null);
  }
}
