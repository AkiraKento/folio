import { eq, and, isNull, asc } from 'drizzle-orm';
import type { FolioDatabase } from '../client';
import { getDb } from '../client';
import { media, type Media } from '../schema';
import { generateId } from './utils';

export interface CreateMediaInput {
  id?: string;
  filename: string;
  sha1: string;
  bytes: number;
  mime: string;
  created_at?: number;
  updated_at?: number;
}

export class MediaRepository {
  private db: FolioDatabase;

  constructor(db?: FolioDatabase) {
    this.db = db ?? getDb();
  }

  create(input: CreateMediaInput): Media {
    const now = Date.now();
    const id = input.id ?? generateId();
    const record: Media = {
      id,
      filename: input.filename,
      sha1: input.sha1,
      bytes: input.bytes,
      mime: input.mime,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
      deleted_at: null,
    };

    this.db.insert(media).values(record).run();
    return record;
  }

  getById(id: string, options?: { includeDeleted?: boolean }): Media | null {
    const conditions = [eq(media.id, id)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(media.deleted_at));
    }

    const rows = this.db
      .select()
      .from(media)
      .where(and(...conditions))
      .all();

    return rows[0] ?? null;
  }

  getByFilename(filename: string, options?: { includeDeleted?: boolean }): Media | null {
    const conditions = [eq(media.filename, filename)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(media.deleted_at));
    }

    const rows = this.db
      .select()
      .from(media)
      .where(and(...conditions))
      .all();

    return rows[0] ?? null;
  }

  getBySha1(sha1: string, options?: { includeDeleted?: boolean }): Media | null {
    const conditions = [eq(media.sha1, sha1)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(media.deleted_at));
    }

    const rows = this.db
      .select()
      .from(media)
      .where(and(...conditions))
      .all();

    return rows[0] ?? null;
  }

  listAll(options?: { includeDeleted?: boolean }): Media[] {
    const query = this.db.select().from(media);
    if (!options?.includeDeleted) {
      return query.where(isNull(media.deleted_at)).orderBy(asc(media.created_at)).all();
    }
    return query.orderBy(asc(media.created_at)).all();
  }

  softDelete(id: string): boolean {
    const existing = this.getById(id, { includeDeleted: true });
    if (!existing) return false;

    const now = Date.now();
    this.db
      .update(media)
      .set({ deleted_at: now, updated_at: now })
      .where(eq(media.id, id))
      .run();

    return true;
  }

  hardDelete(id: string): boolean {
    this.db.delete(media).where(eq(media.id, id)).run();
    return true;
  }
}
