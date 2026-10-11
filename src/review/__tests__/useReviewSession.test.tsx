import React, { act, useEffect } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { createTestDatabase, seedBasicNoteType } from '@/db/__tests__/test-utils';
import { DecksRepository } from '@/db/repositories/decks';
import { NotesRepository } from '@/db/repositories/notes';
import { CardsRepository } from '@/db/repositories/cards';
import { AnnotationsRepository } from '@/db/repositories/annotations';
import { ReviewLogsRepository } from '@/db/repositories/review-logs';
import { SettingsRepository } from '@/db/repositories/settings';
import { Rating, State } from '@/scheduler';
import { useReviewSession } from '../useReviewSession';
import type { UseReviewSessionOptions, UseReviewSessionReturn } from '../types';

describe('src/review/useReviewSession.ts — Sessão de Revisão FSRS', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let decksRepo: DecksRepository;
  let notesRepo: NotesRepository;
  let cardsRepo: CardsRepository;
  let annotationsRepo: AnnotationsRepository;
  let reviewLogsRepo: ReviewLogsRepository;
  let settingsRepo: SettingsRepository;

  beforeEach(() => {
    const testDb = createTestDatabase();
    db = testDb.db;
    decksRepo = new DecksRepository(db);
    notesRepo = new NotesRepository(db);
    cardsRepo = new CardsRepository(db);
    annotationsRepo = new AnnotationsRepository(db);
    reviewLogsRepo = new ReviewLogsRepository(db);
    settingsRepo = new SettingsRepository(db);

    seedBasicNoteType(db, 'nt-basic');
  });

  function renderSessionHook(
    options: UseReviewSessionOptions,
    callback: (res: UseReviewSessionReturn) => void
  ) {
    function HookConsumer() {
      const res = useReviewSession(options);
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

  test('inicializa fila com card e anotações, com frente oculta até virar', () => {
    const deck = decksRepo.create({ name: 'Cardiologia' });
    const note = notesRepo.create({
      note_type_id: 'nt-basic',
      deck_id: deck.id,
      fields: { Frente: 'Qual a causa da estenose?', Verso: 'Calcificação senil degenerativa' },
      tags: ['valvopatia'],
    });

    const now = new Date(2026, 9, 9, 10, 0, 0).getTime();
    const card = cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: now,
      state: State.New,
    });

    annotationsRepo.create({
      note_id: note.id,
      kind: 'hl',
      color: 'amarelo',
      quote: 'Calcificação senil',
      start: 0,
      end: 18,
      note: 'Mais comum em idosos',
    });

    let hookState!: UseReviewSessionReturn;
    renderSessionHook({ deckId: deck.id, now, db }, (res) => {
      hookState = res;
    });

    expect(hookState.loading).toBe(false);
    expect(hookState.deckName).toBe('Cardiologia');
    expect(hookState.isFinished).toBe(false);
    expect(hookState.canUndo).toBe(false);
    expect(hookState.reviewedCount).toBe(0);
    expect(hookState.remainingCounts.total).toBe(1);
    expect(hookState.isAnswerRevealed).toBe(false);

    expect(hookState.currentCardData).not.toBeNull();
    expect(hookState.currentCardData?.card.id).toBe(card.id);
    expect(hookState.currentCardData?.frontHtml).toContain('Qual a causa da estenose?');
    expect(hookState.currentCardData?.backHtml).toContain('Calcificação senil degenerativa');
    expect(hookState.currentCardData?.annotations.length).toBe(1);
    expect(hookState.currentCardData?.annotations[0].quote).toBe('Calcificação senil');

    // Vira o card
    act(() => {
      hookState.flipCard();
    });

    expect(hookState.isAnswerRevealed).toBe(true);

    // No modo padrão (2 botões), há Errei e Acertei
    expect(hookState.nextReviewOptions.length).toBe(2);
    expect(hookState.nextReviewOptions[0].label).toBe('Errei');
    expect(hookState.nextReviewOptions[1].label).toBe('Acertei');
    expect(hookState.nextReviewOptions[0].intervalText).toBeTruthy();
    expect(hookState.nextReviewOptions[1].intervalText).toBeTruthy();
  });

  test('responde card com Acertei: atualiza FSRS, cria log e avança fila', () => {
    const deck = decksRepo.create({ name: 'Medicina' });
    const note = notesRepo.create({
      note_type_id: 'nt-basic',
      deck_id: deck.id,
      fields: { Frente: 'Pergunta 1', Verso: 'Resposta 1' },
      tags: [],
    });

    const now = new Date(2026, 9, 9, 10, 0, 0).getTime();
    const card = cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: now,
      state: State.Review,
      stability: 10,
      difficulty: 5,
      reps: 2,
    });

    let hookState!: UseReviewSessionReturn;
    renderSessionHook({ deckId: deck.id, now, db }, (res) => {
      hookState = res;
    });

    act(() => {
      hookState.flipCard();
    });

    act(() => {
      hookState.answerCard(Rating.Good);
    });

    // Como o card em revisão graduado vai para o próximo intervalo de dias (> hoje), a fila finaliza
    expect(hookState.isFinished).toBe(true);
    expect(hookState.reviewedCount).toBe(1);
    expect(hookState.canUndo).toBe(true);

    const updatedCard = cardsRepo.getById(card.id);
    expect(updatedCard).not.toBeNull();
    expect(updatedCard?.reps).toBe(3);
    expect(updatedCard?.last_review).not.toBeNull();

    const logs = reviewLogsRepo.listByCard(card.id);
    expect(logs.length).toBe(1);
    expect(logs[0].rating).toBe(Rating.Good);
  });

  test('desfazer: reverte o card e remove o log de revisão', () => {
    const deck = decksRepo.create({ name: 'Medicina' });
    const note = notesRepo.create({
      note_type_id: 'nt-basic',
      deck_id: deck.id,
      fields: { Frente: 'Pergunta 1', Verso: 'Resposta 1' },
      tags: [],
    });

    const now = new Date(2026, 9, 9, 10, 0, 0).getTime();
    const card = cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: now,
      state: State.Review,
      stability: 5,
      difficulty: 5,
      reps: 1,
    });

    let hookState!: UseReviewSessionReturn;
    renderSessionHook({ deckId: deck.id, now, db }, (res) => {
      hookState = res;
    });

    act(() => {
      hookState.flipCard();
    });

    act(() => {
      hookState.answerCard(Rating.Good);
    });

    expect(hookState.reviewedCount).toBe(1);
    expect(hookState.isFinished).toBe(true);

    let undoOk = false;
    act(() => {
      undoOk = hookState.undo();
    });

    expect(undoOk).toBe(true);
    expect(hookState.reviewedCount).toBe(0);
    expect(hookState.isFinished).toBe(false);
    expect(hookState.isAnswerRevealed).toBe(false);
    expect(hookState.currentCardData?.card.id).toBe(card.id);

    const revertedCard = cardsRepo.getById(card.id);
    expect(revertedCard?.reps).toBe(1);

    const logs = reviewLogsRepo.listByCard(card.id);
    expect(logs.length).toBe(0);
  });

  test('suporta modo de 4 botões quando configurado nas opções', () => {
    settingsRepo.set('buttonMode', 4);

    const deck = decksRepo.create({ name: 'Direito' });
    const note = notesRepo.create({
      note_type_id: 'nt-basic',
      deck_id: deck.id,
      fields: { Frente: 'Artigo 5º', Verso: 'Todos são iguais perante a lei' },
      tags: [],
    });

    const now = new Date(2026, 9, 9, 10, 0, 0).getTime();
    cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: now,
      state: State.New,
    });

    let hookState!: UseReviewSessionReturn;
    renderSessionHook({ deckId: deck.id, now, db }, (res) => {
      hookState = res;
    });

    act(() => {
      hookState.flipCard();
    });

    expect(hookState.buttonMode).toBe(4);
    expect(hookState.nextReviewOptions.length).toBe(4);
    expect(hookState.nextReviewOptions.map((o) => o.label)).toEqual([
      'Errei',
      'Difícil',
      'Bom',
      'Fácil',
    ]);
  });

  test('grava review_logs em toda resposta com tempo de revisão e estado anterior', () => {
    const deck = decksRepo.create({ name: 'Neurologia' });
    const note = notesRepo.create({
      note_type_id: 'nt-basic',
      deck_id: deck.id,
      fields: { Frente: 'Sinal de Babinski', Verso: 'Extensão do hálux' },
      tags: [],
    });

    const now = new Date(2026, 9, 9, 10, 0, 0).getTime();
    const card = cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: now,
      state: State.New,
    });

    let hookState!: UseReviewSessionReturn;
    renderSessionHook({ deckId: deck.id, now, db }, (res) => {
      hookState = res;
    });

    act(() => {
      hookState.flipCard();
    });

    act(() => {
      hookState.answerCard(Rating.Good);
    });

    const logs = reviewLogsRepo.listByCard(card.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].rating).toBe(Rating.Good);
    expect(logs[0].state).toBe(State.New); // Estado anterior
    expect(logs[0].due).toBeGreaterThanOrEqual(now);
    expect(logs[0].stability).toBeGreaterThanOrEqual(0);
    expect(logs[0].difficulty).toBeGreaterThanOrEqual(0);
    expect(logs[0].review_ms).toBeGreaterThanOrEqual(0);

    const updatedCard = cardsRepo.getById(card.id);
    expect(updatedCard?.due).toBeGreaterThan(now);
    expect(updatedCard?.difficulty).toBeGreaterThan(0);
  });

  test('enterra irmãs no mesmo dia ao responder e remove da fila da sessão', () => {
    const deck = decksRepo.create({ name: 'Cardiologia' });
    const note = notesRepo.create({
      note_type_id: 'nt-basic',
      deck_id: deck.id,
      fields: { Frente: 'Card A', Verso: 'Card B' },
      tags: [],
    });

    const now = new Date(2026, 9, 9, 10, 0, 0).getTime();
    const card1 = cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: now,
      state: State.Review,
    });
    const card2 = cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 1,
      due: now + 1000,
      state: State.Review,
    });

    let hookState!: UseReviewSessionReturn;
    renderSessionHook({ deckId: deck.id, now, db }, (res) => {
      hookState = res;
    });

    // Inicialmente, card1 está na fila e é o atual
    expect(hookState.currentCardData?.card.id).toBe(card1.id);

    // Responde card1
    act(() => {
      hookState.flipCard();
    });
    act(() => {
      hookState.answerCard(Rating.Good);
    });

    // Card 2 deve ter sido enterrado no banco até o fim do dia de estudo (4h da manhã do dia seguinte)
    const updatedCard2 = cardsRepo.getById(card2.id);
    expect(updatedCard2?.buried_until).not.toBeNull();
    expect(updatedCard2?.buried_until).toBeGreaterThan(now);

    // A fila deve estar vazia (card2 foi enterrado e card1 foi adiado para outro dia)
    expect(hookState.isFinished).toBe(true);

    // Desfaz a resposta
    act(() => {
      hookState.undo();
    });

    // Card 2 deve ter sido desenterrado no banco
    const unburiedCard2 = cardsRepo.getById(card2.id);
    expect(unburiedCard2?.buried_until).toBeNull();

    // Card 1 volta a ser o atual
    expect(hookState.currentCardData?.card.id).toBe(card1.id);
  });
});
