import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { useToday } from '../useToday';
import type { UseTodayOptions, UseTodayReturn } from '../useToday';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import { DecksRepository } from '@/db/repositories/decks';
import { NotesRepository } from '@/db/repositories/notes';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { CardsRepository } from '@/db/repositories/cards';
import { ConsultaPosRepository } from '@/db/repositories/consulta-pos';
import type { FolioDatabase } from '@/db/client';

function TestHookComponent({
  options,
  onHook,
}: {
  options: UseTodayOptions;
  onHook: (data: UseTodayReturn) => void;
}) {
  const result = useToday(options);
  onHook(result);
  return <Text testID="rendered">Loaded</Text>;
}

describe('src/today/useToday.ts — Hook useToday', () => {
  let db: FolioDatabase;
  let decksRepo: DecksRepository;
  let notesRepo: NotesRepository;
  let noteTypesRepo: NoteTypesRepository;
  let cardsRepo: CardsRepository;
  let posRepo: ConsultaPosRepository;

  beforeEach(() => {
    const testDb = createTestDatabase();
    db = testDb.db;
    decksRepo = new DecksRepository(db);
    notesRepo = new NotesRepository(db);
    noteTypesRepo = new NoteTypesRepository(db);
    cardsRepo = new CardsRepository(db);
    posRepo = new ConsultaPosRepository(db);
    noteTypesRepo.seedBuiltins();
  });

  test('carrega resumo diário e posição de continuar lendo', () => {
    const now = new Date(2026, 9, 9, 12, 0, 0);
    const deck = decksRepo.create({ name: 'Medicina::Pneumo' });
    const basicType = noteTypesRepo.list()[0];

    const note = notesRepo.create({
      deck_id: deck.id,
      note_type_id: basicType.id,
      fields: { Frente: 'Tosse crônica', Verso: 'Investigar asma/refluxo' },
    });
    cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: now.getTime(),
    });

    posRepo.save(deck.id, 3, 150);

    let hookData!: UseTodayReturn;

    act(() => {
      ReactTestRenderer.create(
        <TestHookComponent
          options={{ db, now }}
          onHook={(data) => {
            hookData = data;
          }}
        />
      );
    });

    expect(hookData.loading).toBe(false);
    expect(hookData.summary).not.toBeNull();
    expect(hookData.summary?.pendingCount).toBe(1);
    expect(hookData.summary?.newCount).toBe(1);

    expect(hookData.continueReading).toEqual({
      deckId: deck.id,
      deckName: 'Pneumo',
      unitIndex: 3,
      offset: 150,
    });
  });

  test('permite atualizar dados chamando refresh()', () => {
    const now = new Date(2026, 9, 9, 12, 0, 0);
    const deck = decksRepo.create({ name: 'Direito' });
    const basicType = noteTypesRepo.list()[0];

    let hookData!: UseTodayReturn;

    act(() => {
      ReactTestRenderer.create(
        <TestHookComponent
          options={{ db, now }}
          onHook={(data) => {
            hookData = data;
          }}
        />
      );
    });

    expect(hookData.summary?.pendingCount).toBe(0);

    // Adiciona um card novo posteriormente
    const note = notesRepo.create({
      deck_id: deck.id,
      note_type_id: basicType.id,
      fields: { Frente: 'Pergunta', Verso: 'Resposta' },
    });
    cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: now.getTime(),
    });

    act(() => {
      hookData.refresh();
    });

    expect(hookData.summary?.pendingCount).toBe(1);
  });
});
