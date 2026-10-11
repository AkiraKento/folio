import { eq, and, isNull, desc } from 'drizzle-orm';
import type { FolioDatabase } from '../client';
import { getDb } from '../client';
import { consultaPos, type ConsultaPos } from '../schema';

export interface SaveConsultaPosInput {
  deck_query: string;
  unit_index: number;
  scroll_offset: number;
}

export class ConsultaPosRepository {
  private db: FolioDatabase;

  constructor(db?: FolioDatabase) {
    this.db = db ?? getDb();
  }

  get(deckQuery: string, options?: { includeDeleted?: boolean }): ConsultaPos | null {
    const conditions = [eq(consultaPos.deck_query, deckQuery)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(consultaPos.deleted_at));
    }

    const rows = this.db
      .select()
      .from(consultaPos)
      .where(and(...conditions))
      .all();

    return rows[0] ?? null;
  }

  /**
   * Retorna a posição mais recentemente acessada para o atalho "Continuar lendo" (MODO_CONSULTA.md §1).
   */
  getLatest(): ConsultaPos | null {
    const rows = this.db
      .select()
      .from(consultaPos)
      .where(isNull(consultaPos.deleted_at))
      .orderBy(desc(consultaPos.updated_at))
      .limit(1)
      .all();

    return rows[0] ?? null;
  }

  /**
   * Lista todas as posições salvas ordenadas da mais recente para a mais antiga.
   */
  list(): ConsultaPos[] {
    return this.db
      .select()
      .from(consultaPos)
      .where(isNull(consultaPos.deleted_at))
      .orderBy(desc(consultaPos.updated_at))
      .all();
  }

  save(deckQuery: string, unitIndex: number, scrollOffset: number): ConsultaPos {
    const now = Date.now();
    const existing = this.get(deckQuery, { includeDeleted: true });

    if (existing) {
      this.db
        .update(consultaPos)
        .set({
          unit_index: unitIndex,
          scroll_offset: scrollOffset,
          updated_at: now,
          deleted_at: null,
        })
        .where(eq(consultaPos.deck_query, deckQuery))
        .run();

      return {
        deck_query: deckQuery,
        unit_index: unitIndex,
        scroll_offset: scrollOffset,
        created_at: existing.created_at,
        updated_at: now,
        deleted_at: null,
      };
    }

    const record: ConsultaPos = {
      deck_query: deckQuery,
      unit_index: unitIndex,
      scroll_offset: scrollOffset,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    this.db.insert(consultaPos).values(record).run();
    return record;
  }

  delete(deckQuery: string): boolean {
    const existing = this.get(deckQuery, { includeDeleted: true });
    if (!existing) return false;

    this.db
      .delete(consultaPos)
      .where(eq(consultaPos.deck_query, deckQuery))
      .run();

    return true;
  }
}
