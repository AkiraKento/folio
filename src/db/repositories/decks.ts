import { eq, and, isNull, like, or, inArray, asc } from 'drizzle-orm';
import type { FolioDatabase } from '../client';
import { getDb } from '../client';
import { decks, cards, type Deck } from '../schema';
import { generateId } from './utils';

export interface CreateDeckInput {
  id?: string;
  name: string;
  area?: string | null;
  description?: string | null;
  source_id?: string | null;
  created_at?: number;
  updated_at?: number;
}

export interface DeckNode {
  id: string;
  name: string;
  shortName: string;
  deck: Deck;
  children: DeckNode[];
}

export interface DeckTreeNodeWithCounts {
  id: string;
  name: string;
  shortName: string;
  deck: Deck;
  directCounts: DeckCounts;
  totalCounts: DeckCounts;
  children: DeckTreeNodeWithCounts[];
}

export interface DeckCounts {
  new: number;
  learning: number;
  review: number;
  total: number;
}

export class DecksRepository {
  private db: FolioDatabase;

  constructor(db?: FolioDatabase) {
    this.db = db ?? getDb();
  }

  create(input: CreateDeckInput): Deck {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('Nome do deck não pode ser vazio');
    }
    const existing = this.getByName(trimmedName);
    if (existing) {
      throw new Error(`Já existe um deck ativo com o nome "${trimmedName}"`);
    }

    const now = Date.now();
    const id = input.id ?? generateId();
    const record = {
      id,
      name: trimmedName,
      area: input.area ?? null,
      description: input.description ?? null,
      source_id: input.source_id ?? null,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
      deleted_at: null,
    };

    this.db.insert(decks).values(record).run();
    return record;
  }

  getById(id: string, options?: { includeDeleted?: boolean }): Deck | null {
    const conditions = [eq(decks.id, id)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(decks.deleted_at));
    }

    const rows = this.db
      .select()
      .from(decks)
      .where(and(...conditions))
      .all();

    return rows[0] ?? null;
  }

  getByName(name: string, options?: { includeDeleted?: boolean }): Deck | null {
    const conditions = [eq(decks.name, name)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(decks.deleted_at));
    }

    const rows = this.db
      .select()
      .from(decks)
      .where(and(...conditions))
      .all();

    return rows[0] ?? null;
  }

  getBySourceId(sourceId: string, options?: { includeDeleted?: boolean }): Deck | null {
    const conditions = [eq(decks.source_id, sourceId)];
    if (!options?.includeDeleted) {
      conditions.push(isNull(decks.deleted_at));
    }

    const rows = this.db
      .select()
      .from(decks)
      .where(and(...conditions))
      .all();

    return rows[0] ?? null;
  }

  listAll(options?: { includeDeleted?: boolean }): Deck[] {
    const query = this.db.select().from(decks);
    if (!options?.includeDeleted) {
      return query.where(isNull(decks.deleted_at)).orderBy(asc(decks.name)).all();
    }
    return query.orderBy(asc(decks.name)).all();
  }

  update(
    id: string,
    data: Partial<Pick<Deck, 'name' | 'area' | 'description' | 'source_id'>>
  ): Deck | null {
    const existing = this.getById(id, { includeDeleted: true });
    if (!existing) return null;

    const now = Date.now();
    this.db
      .update(decks)
      .set({
        ...data,
        updated_at: now,
      })
      .where(eq(decks.id, id))
      .run();

    return this.getById(id, { includeDeleted: true });
  }

  rename(id: string, newName: string): Deck | null {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      throw new Error('Nome do deck não pode ser vazio');
    }

    const existing = this.getById(id, { includeDeleted: true });
    if (!existing) return null;

    if (existing.name === trimmedName) {
      return existing;
    }

    const duplicate = this.getByName(trimmedName);
    if (duplicate && duplicate.id !== id) {
      throw new Error(`Já existe um deck ativo com o nome "${trimmedName}"`);
    }

    const oldName = existing.name;
    const now = Date.now();

    // Atualiza o deck principal
    this.db
      .update(decks)
      .set({ name: trimmedName, updated_at: now })
      .where(eq(decks.id, id))
      .run();

    // Renomeia subdecks em cascata (ex: Old::Sub vira New::Sub)
    const prefix = `${oldName}::`;
    const subdecks = this.db
      .select()
      .from(decks)
      .where(like(decks.name, `${prefix}%`))
      .all();

    for (const sub of subdecks) {
      const rest = sub.name.slice(prefix.length);
      const subNewName = `${trimmedName}::${rest}`;
      this.db
        .update(decks)
        .set({ name: subNewName, updated_at: now })
        .where(eq(decks.id, sub.id))
        .run();
    }

    return this.getById(id, { includeDeleted: true });
  }

  move(id: string, newParentId: string | null): Deck | null {
    const existing = this.getById(id);
    if (!existing) return null;

    if (newParentId === id) {
      throw new Error('Não é possível mover um deck para dentro de si mesmo');
    }

    const parts = existing.name.split('::');
    const shortName = parts[parts.length - 1];

    let newName: string;
    if (newParentId === null) {
      newName = shortName;
    } else {
      const parent = this.getById(newParentId);
      if (!parent) {
        throw new Error(`Deck de destino não encontrado: ${newParentId}`);
      }

      // Verifica se o destino é um descendente deste deck
      if (parent.name.startsWith(`${existing.name}::`)) {
        throw new Error('Não é possível mover um deck para dentro de seus subdecks');
      }

      newName = `${parent.name}::${shortName}`;
    }

    if (existing.name === newName) {
      return existing;
    }

    const duplicate = this.getByName(newName);
    if (duplicate && duplicate.id !== id) {
      throw new Error(`Já existe um deck ativo com o nome "${newName}"`);
    }

    return this.rename(id, newName);
  }

  softDelete(id: string): boolean {
    const existing = this.getById(id, { includeDeleted: true });
    if (!existing) return false;

    const now = Date.now();
    const prefix = `${existing.name}::`;

    // Marca o deck e eventuais subdecks
    this.db
      .update(decks)
      .set({ deleted_at: now, updated_at: now })
      .where(or(eq(decks.id, id), like(decks.name, `${prefix}%`)))
      .run();

    return true;
  }

  restore(id: string): boolean {
    const existing = this.getById(id, { includeDeleted: true });
    if (!existing) return false;

    const duplicate = this.getByName(existing.name);
    if (duplicate && duplicate.id !== id) {
      throw new Error(`Não é possível restaurar: já existe um deck ativo com o nome "${existing.name}"`);
    }

    const now = Date.now();
    const prefix = `${existing.name}::`;

    // Restaura o deck e subdecks
    this.db
      .update(decks)
      .set({ deleted_at: null, updated_at: now })
      .where(or(eq(decks.id, id), like(decks.name, `${prefix}%`)))
      .run();

    return true;
  }

  hardDelete(id: string): boolean {
    this.db.delete(decks).where(eq(decks.id, id)).run();
    return true;
  }

  getDeckTree(options?: { includeDeleted?: boolean }): DeckNode[] {
    const allDecks = this.listAll(options);
    const nodeMap = new Map<string, DeckNode>();
    const rootNodes: DeckNode[] = [];

    for (const deck of allDecks) {
      const parts = deck.name.split('::');
      const shortName = parts[parts.length - 1];
      nodeMap.set(deck.name, {
        id: deck.id,
        name: deck.name,
        shortName,
        deck,
        children: [],
      });
    }

    for (const deck of allDecks) {
      const node = nodeMap.get(deck.name)!;
      const lastIndex = deck.name.lastIndexOf('::');
      if (lastIndex === -1) {
        rootNodes.push(node);
      } else {
        const parentName = deck.name.slice(0, lastIndex);
        const parentNode = nodeMap.get(parentName);
        if (parentNode) {
          parentNode.children.push(node);
        } else {
          rootNodes.push(node);
        }
      }
    }

    return rootNodes;
  }

  getDeckTreeWithCounts(options?: { includeDeleted?: boolean }): DeckTreeNodeWithCounts[] {
    const allDecks = this.listAll(options);
    const cardConditions = [isNull(cards.deleted_at), eq(cards.suspended, 0)];
    const cardRows = this.db
      .select({
        deckId: cards.deck_id,
        state: cards.state,
      })
      .from(cards)
      .where(and(...cardConditions))
      .all();

    const countsByDeckId = new Map<string, DeckCounts>();
    for (const row of cardRows) {
      let counts = countsByDeckId.get(row.deckId);
      if (!counts) {
        counts = { new: 0, learning: 0, review: 0, total: 0 };
        countsByDeckId.set(row.deckId, counts);
      }
      if (row.state === 0) {
        counts.new++;
      } else if (row.state === 1 || row.state === 3) {
        counts.learning++;
      } else if (row.state === 2) {
        counts.review++;
      }
      counts.total++;
    }

    const nodeMap = new Map<string, DeckTreeNodeWithCounts>();
    const rootNodes: DeckTreeNodeWithCounts[] = [];

    for (const deck of allDecks) {
      const parts = deck.name.split('::');
      const shortName = parts[parts.length - 1];
      const direct = countsByDeckId.get(deck.id) ?? { new: 0, learning: 0, review: 0, total: 0 };
      nodeMap.set(deck.name, {
        id: deck.id,
        name: deck.name,
        shortName,
        deck,
        directCounts: { ...direct },
        totalCounts: { ...direct },
        children: [],
      });
    }

    for (const deck of allDecks) {
      const node = nodeMap.get(deck.name)!;
      const lastIndex = deck.name.lastIndexOf('::');
      if (lastIndex === -1) {
        rootNodes.push(node);
      } else {
        const parentName = deck.name.slice(0, lastIndex);
        const parentNode = nodeMap.get(parentName);
        if (parentNode) {
          parentNode.children.push(node);
        } else {
          rootNodes.push(node);
        }
      }
    }

    function computeTotalCounts(node: DeckTreeNodeWithCounts): DeckCounts {
      const totals: DeckCounts = { ...node.directCounts };
      for (const child of node.children) {
        const childTotals = computeTotalCounts(child);
        totals.new += childTotals.new;
        totals.learning += childTotals.learning;
        totals.review += childTotals.review;
        totals.total += childTotals.total;
      }
      node.totalCounts = totals;
      return totals;
    }

    for (const root of rootNodes) {
      computeTotalCounts(root);
    }

    return rootNodes;
  }

  getDeckCounts(deckId: string, options?: { recursive?: boolean }): DeckCounts {
    const deck = this.getById(deckId);
    if (!deck) {
      return { new: 0, learning: 0, review: 0, total: 0 };
    }

    let targetDeckIds = [deck.id];
    if (options?.recursive) {
      const subdecks = this.db
        .select({ id: decks.id })
        .from(decks)
        .where(
          and(
            like(decks.name, `${deck.name}::%`),
            isNull(decks.deleted_at)
          )
        )
        .all();
      targetDeckIds = [deck.id, ...subdecks.map((s) => s.id)];
    }

    const allCards = this.db
      .select({
        state: cards.state,
        suspended: cards.suspended,
      })
      .from(cards)
      .where(
        and(
          inArray(cards.deck_id, targetDeckIds),
          isNull(cards.deleted_at),
          eq(cards.suspended, 0)
        )
      )
      .all();

    let newCount = 0;
    let learningCount = 0;
    let reviewCount = 0;

    for (const c of allCards) {
      if (c.state === 0) {
        newCount++;
      } else if (c.state === 1 || c.state === 3) {
        learningCount++;
      } else if (c.state === 2) {
        reviewCount++;
      }
    }

    return {
      new: newCount,
      learning: learningCount,
      review: reviewCount,
      total: allCards.length,
    };
  }
}
