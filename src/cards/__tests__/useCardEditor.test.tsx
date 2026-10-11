import React, { act, useEffect } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useCardEditor } from '../useCardEditor';
import * as clientModule from '@/db/client';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import { DecksRepository } from '@/db/repositories/decks';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { BUILTIN_NOTE_TYPE_IDS } from '@/db/builtin-note-types';

describe('useCardEditor hook', () => {
  let testDb: ReturnType<typeof createTestDatabase>['db'];
  let decksRepo: DecksRepository;
  let noteTypesRepo: NoteTypesRepository;
  let deckId: string;

  beforeEach(() => {
    const context = createTestDatabase();
    testDb = context.db;
    jest.spyOn(clientModule, 'getDb').mockReturnValue(testDb);

    decksRepo = new DecksRepository(testDb);
    noteTypesRepo = new NoteTypesRepository(testDb);
    noteTypesRepo.seedBuiltins();

    const deck = decksRepo.create({ name: 'Neurologia' });
    deckId = deck.id;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderUseCardEditor(
    options: { initialDeckId?: string; noteId?: string },
    callback: (res: ReturnType<typeof useCardEditor>) => void
  ) {
    function HookConsumer() {
      const res = useCardEditor(options);
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

  test('inicializa com campos vazios para modelo Básico', async () => {
    let latestRes!: ReturnType<typeof useCardEditor>;
    renderUseCardEditor({ initialDeckId: deckId }, (res) => {
      latestRes = res;
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(latestRes.loading).toBe(false);
    expect(latestRes.selectedDeckId).toBe(deckId);
    expect(latestRes.selectedNoteTypeId).toBe(BUILTIN_NOTE_TYPE_IDS.BASIC);
    expect(latestRes.fields['Frente']).toBe('');
    expect(latestRes.fields['Verso']).toBe('');
  });

  test('permite alterar campos e inserir atalho cloze ao mudar para Cloze', async () => {
    let latestRes!: ReturnType<typeof useCardEditor>;
    renderUseCardEditor({ initialDeckId: deckId }, (res) => {
      latestRes = res;
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      latestRes.setSelectedNoteTypeId(BUILTIN_NOTE_TYPE_IDS.CLOZE);
    });

    expect(latestRes.selectedNoteTypeId).toBe(BUILTIN_NOTE_TYPE_IDS.CLOZE);
    expect(latestRes.fields['Texto']).toBe('');

    act(() => {
      latestRes.setFieldValue('Texto', 'O cérebro tem');
    });

    act(() => {
      latestRes.insertClozeShortcut();
    });

    expect(latestRes.fields['Texto']).toBe('O cérebro tem {{c1::...}}');
  });

  test('valida primeiro campo obrigatório ao salvar', async () => {
    let latestRes!: ReturnType<typeof useCardEditor>;
    renderUseCardEditor({ initialDeckId: deckId }, (res) => {
      latestRes = res;
    });

    await act(async () => {
      await Promise.resolve();
    });

    let saved = false;
    await act(async () => {
      saved = await latestRes.save();
    });

    expect(saved).toBe(false);
    expect(latestRes.errorMessage).toBeTruthy();
  });

  test('salva nota com sucesso e limpa os campos para o próximo card', async () => {
    let latestRes!: ReturnType<typeof useCardEditor>;
    renderUseCardEditor({ initialDeckId: deckId }, (res) => {
      latestRes = res;
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      latestRes.setFieldValue('Frente', 'O que é sinapse?');
      latestRes.setFieldValue('Verso', 'Comunicação entre neurônios.');
      latestRes.setTags('neuro sinapse');
    });

    let saved = false;
    await act(async () => {
      saved = await latestRes.save();
    });

    expect(saved).toBe(true);
    expect(latestRes.successMessage).toBeTruthy();
    // Campos limpos para o próximo card
    expect(latestRes.fields['Frente']).toBe('');
    expect(latestRes.fields['Verso']).toBe('');
    expect(latestRes.tags).toBe('');
    // Mas preserva deck e modelo selecionados
    expect(latestRes.selectedDeckId).toBe(deckId);
    expect(latestRes.selectedNoteTypeId).toBe(BUILTIN_NOTE_TYPE_IDS.BASIC);
  });
});
