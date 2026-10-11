import React, { act, useEffect } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useDecks, useDeckDetail, type UseDecksResult, type UseDeckDetailResult } from '../useDecks';
import * as clientModule from '@/db/client';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import { DecksRepository } from '@/db/repositories/decks';

describe('useDecks e useDeckDetail hooks', () => {
  let testDb: ReturnType<typeof createTestDatabase>['db'];

  beforeEach(() => {
    const context = createTestDatabase();
    testDb = context.db;
    jest.spyOn(clientModule, 'getDb').mockReturnValue(testDb);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderUseDecks(callback: (res: UseDecksResult) => void) {
    function HookConsumer() {
      const res = useDecks();
      useEffect(() => {
        callback(res);
      }, [res]);
      return null;
    }

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<HookConsumer />);
    });
    return renderer;
  }

  function renderUseDeckDetail(deckId: string | undefined, callback: (res: UseDeckDetailResult) => void) {
    function HookConsumer() {
      const res = useDeckDetail(deckId);
      useEffect(() => {
        callback(res);
      }, [res]);
      return null;
    }

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<HookConsumer />);
    });
    return renderer;
  }

  test('useDecks carrega decks e suporta criar, renomear, mover, apagar e restaurar deck', () => {
    let hookState!: UseDecksResult;
    renderUseDecks((res) => {
      hookState = res;
    });

    expect(hookState.loading).toBe(false);
    expect(hookState.tree).toHaveLength(0);

    // 1. Criar deck raiz
    let deck1: ReturnType<typeof hookState.createDeck>;
    act(() => {
      deck1 = hookState.createDeck({ name: 'Medicina', description: 'Geral' });
    });
    expect(deck1!.name).toBe('Medicina');
    expect(hookState.tree).toHaveLength(1);
    expect(hookState.tree[0].name).toBe('Medicina');

    // 2. Criar subdeck
    let childDeck: ReturnType<typeof hookState.createDeck>;
    act(() => {
      childDeck = hookState.createDeck({ name: 'Medicina::Cardiologia' });
    });
    expect(childDeck!.name).toBe('Medicina::Cardiologia');
    expect(hookState.tree[0].children).toHaveLength(1);
    expect(hookState.tree[0].children[0].shortName).toBe('Cardiologia');

    // 3. Renomear deck raiz e verificar atualização em cascata
    act(() => {
      hookState.renameDeck(deck1!.id, 'Saúde');
    });
    expect(hookState.tree[0].name).toBe('Saúde');
    expect(hookState.tree[0].children[0].name).toBe('Saúde::Cardiologia');

    // 4. Mover subdeck para o nível raiz
    act(() => {
      hookState.moveDeck(childDeck!.id, null);
    });
    expect(hookState.tree).toHaveLength(2);
    expect(hookState.tree.map((n) => n.name).sort()).toEqual(['Cardiologia', 'Saúde']);

    // 5. Apagar deck (soft delete)
    act(() => {
      const ok = hookState.deleteDeck(childDeck!.id);
      expect(ok).toBe(true);
    });
    expect(hookState.tree).toHaveLength(1);
    expect(hookState.tree[0].name).toBe('Saúde');

    // 6. Restaurar deck (Desfazer)
    act(() => {
      const ok = hookState.restoreDeck(childDeck!.id);
      expect(ok).toBe(true);
    });
    expect(hookState.tree).toHaveLength(2);
    expect(hookState.tree.map((n) => n.name).sort()).toEqual(['Cardiologia', 'Saúde']);
  });

  test('useDeckDetail carrega detalhes, subdecks e executa renomeação e exclusão', () => {
    const decksRepo = new DecksRepository(testDb);
    const parent = decksRepo.create({ name: 'Direito' });
    const subdeck = decksRepo.create({ name: 'Direito::Constitucional' });

    let hookState!: UseDeckDetailResult;
    renderUseDeckDetail(parent.id, (res) => {
      hookState = res;
    });

    expect(hookState.loading).toBe(false);
    expect(hookState.deck?.id).toBe(parent.id);
    expect(hookState.subdecks).toHaveLength(1);
    expect(hookState.subdecks[0].id).toBe(subdeck.id);

    // Renomear através do detalhe
    act(() => {
      hookState.renameDeck('Jurídico');
    });
    expect(hookState.deck?.name).toBe('Jurídico');
    expect(hookState.subdecks[0].name).toBe('Jurídico::Constitucional');

    // Apagar através do detalhe
    act(() => {
      const ok = hookState.deleteDeck();
      expect(ok).toBe(true);
    });
    expect(hookState.deck).toBeNull();
  });
});
