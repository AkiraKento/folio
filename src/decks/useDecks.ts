import { useState, useEffect, useCallback } from 'react';
import {
  DecksRepository,
  type DeckTreeNodeWithCounts,
  type DeckCounts,
  type CreateDeckInput,
} from '@/db/repositories/decks';
import { getDb } from '@/db/client';
import type { Deck } from '@/db/schema';

export interface UseDecksResult {
  tree: DeckTreeNodeWithCounts[];
  allDecks: Deck[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
  createDeck: (input: CreateDeckInput) => Deck;
  renameDeck: (id: string, newName: string) => Deck | null;
  moveDeck: (id: string, newParentId: string | null) => Deck | null;
  deleteDeck: (id: string) => boolean;
  restoreDeck: (id: string) => boolean;
}

/**
 * Hook para carregar a árvore de decks com contadores e gerenciar mutações de deck.
 */
export function useDecks(): UseDecksResult {
  const [tree, setTree] = useState<DeckTreeNodeWithCounts[]>([]);
  const [allDecks, setAllDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadDecks = useCallback(() => {
    try {
      setLoading(true);
      const decksRepo = new DecksRepository(getDb());
      const deckTree = decksRepo.getDeckTreeWithCounts();
      const list = decksRepo.listAll();
      setTree(deckTree);
      setAllDecks(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  const createDeck = useCallback(
    (input: CreateDeckInput): Deck => {
      const decksRepo = new DecksRepository(getDb());
      const created = decksRepo.create(input);
      loadDecks();
      return created;
    },
    [loadDecks]
  );

  const renameDeck = useCallback(
    (id: string, newName: string): Deck | null => {
      const decksRepo = new DecksRepository(getDb());
      const updated = decksRepo.rename(id, newName);
      loadDecks();
      return updated;
    },
    [loadDecks]
  );

  const moveDeck = useCallback(
    (id: string, newParentId: string | null): Deck | null => {
      const decksRepo = new DecksRepository(getDb());
      const updated = decksRepo.move(id, newParentId);
      loadDecks();
      return updated;
    },
    [loadDecks]
  );

  const deleteDeck = useCallback(
    (id: string): boolean => {
      const decksRepo = new DecksRepository(getDb());
      const ok = decksRepo.softDelete(id);
      loadDecks();
      return ok;
    },
    [loadDecks]
  );

  const restoreDeck = useCallback(
    (id: string): boolean => {
      const decksRepo = new DecksRepository(getDb());
      const ok = decksRepo.restore(id);
      loadDecks();
      return ok;
    },
    [loadDecks]
  );

  return {
    tree,
    allDecks,
    loading,
    error,
    refresh: loadDecks,
    createDeck,
    renameDeck,
    moveDeck,
    deleteDeck,
    restoreDeck,
  };
}

export interface UseDeckDetailResult {
  deck: Deck | null;
  counts: DeckCounts;
  subdecks: Deck[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
  renameDeck: (newName: string) => Deck | null;
  moveDeck: (newParentId: string | null) => Deck | null;
  deleteDeck: () => boolean;
}

/**
 * Hook para carregar os detalhes, contadores e subdecks de um deck específico.
 */
export function useDeckDetail(deckId: string | undefined): UseDeckDetailResult {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [counts, setCounts] = useState<DeckCounts>({ new: 0, learning: 0, review: 0, total: 0 });
  const [subdecks, setSubdecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadDetail = useCallback(() => {
    if (!deckId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const decksRepo = new DecksRepository(getDb());
      const found = decksRepo.getById(deckId);
      setDeck(found);

      if (found) {
        const countsData = decksRepo.getDeckCounts(deckId, { recursive: true });
        setCounts(countsData);

        const all = decksRepo.listAll();
        const prefix = `${found.name}::`;
        const children = all.filter((d) => d.name.startsWith(prefix) && d.id !== found.id);
        setSubdecks(children);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const renameDeck = useCallback(
    (newName: string): Deck | null => {
      if (!deckId) return null;
      const decksRepo = new DecksRepository(getDb());
      const updated = decksRepo.rename(deckId, newName);
      loadDetail();
      return updated;
    },
    [deckId, loadDetail]
  );

  const moveDeck = useCallback(
    (newParentId: string | null): Deck | null => {
      if (!deckId) return null;
      const decksRepo = new DecksRepository(getDb());
      const updated = decksRepo.move(deckId, newParentId);
      loadDetail();
      return updated;
    },
    [deckId, loadDetail]
  );

  const deleteDeck = useCallback((): boolean => {
    if (!deckId) return false;
    const decksRepo = new DecksRepository(getDb());
    const ok = decksRepo.softDelete(deckId);
    loadDetail();
    return ok;
  }, [deckId, loadDetail]);

  return {
    deck,
    counts,
    subdecks,
    loading,
    error,
    refresh: loadDetail,
    renameDeck,
    moveDeck,
    deleteDeck,
  };
}
