import { createTestDatabase, seedBasicNoteType } from '@/db/__tests__/test-utils';
import { DecksRepository } from '@/db/repositories/decks';
import { NotesRepository } from '@/db/repositories/notes';
import { CardsRepository } from '@/db/repositories/cards';
import { ReviewLogsRepository } from '@/db/repositories/review-logs';
import { State, Rating } from 'ts-fsrs';
import { buildDailyQueue } from '../queue';
import { applyReview } from '../fsrs';

describe('src/scheduler — Simulação de 14 dias de uso (PRD §9 e §12)', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let decksRepo: DecksRepository;
  let notesRepo: NotesRepository;
  let cardsRepo: CardsRepository;
  let reviewLogsRepo: ReviewLogsRepository;

  beforeEach(() => {
    const testDb = createTestDatabase();
    db = testDb.db;
    decksRepo = new DecksRepository(db);
    notesRepo = new NotesRepository(db);
    cardsRepo = new CardsRepository(db);
    reviewLogsRepo = new ReviewLogsRepository(db);
    seedBasicNoteType(db, 'nt-basic');
  });

  test('14 dias de uso simulado avançando o relógio não geram card perdido, duplicado ou com due inválido', () => {
    const deck = decksRepo.create({ name: 'Medicina::Cardiologia' });

    // Criamos 30 notas. Para testar o sister burying de forma realística,
    // 10 notas terão 2 cards irmãos cada (ex: ord 0 e ord 1), e 20 notas terão 1 card.
    // Total de cards: 10 * 2 + 20 * 1 = 40 cards.
    const initialCardsCount = 40;
    let createdCount = 0;

    for (let i = 1; i <= 30; i++) {
      const note = notesRepo.create({
        note_type_id: 'nt-basic',
        deck_id: deck.id,
        fields: {
          Frente: `Pergunta ${i}`,
          Verso: `Resposta ${i}`,
        },
        tags: ['exemplo'],
      });

      // Primeiras 10 notas com 2 cards irmãos
      const cardCountForNote = i <= 10 ? 2 : 1;
      for (let ord = 0; ord < cardCountForNote; ord++) {
        cardsRepo.create({
          note_id: note.id,
          deck_id: deck.id,
          ord,
          due: 0,
          state: State.New,
        });
        createdCount++;
      }
    }

    expect(createdCount).toBe(initialCardsCount);

    const baseStartTime = new Date(2026, 9, 1, 9, 0, 0).getTime(); // 1 de Outubro de 2026, 09:00
    const oneDayMs = 24 * 60 * 60 * 1000;
    const settings = {
      newCardsPerDay: 5,
      maxReviewsPerDay: 30,
      desiredRetention: 0.9,
    };

    let totalReviewsAnswered = 0;

    // Loop de 14 dias
    for (let day = 1; day <= 14; day++) {
      const currentDayTime = baseStartTime + (day - 1) * oneDayMs;

      // 1. Monta a fila do dia
      const dailyQueue = buildDailyQueue({
        db,
        now: currentDayTime,
        deckId: deck.id,
        settings,
      });

      // Validação: sem duplicatas na fila
      const queueIds = dailyQueue.queue.map((c) => c.id);
      expect(new Set(queueIds).size).toBe(queueIds.length);

      // Validação: sem irmãs da mesma nota no mesmo dia (sister burying)
      const noteIds = dailyQueue.queue.map((c) => c.note_id);
      expect(new Set(noteIds).size).toBe(noteIds.length);

      // Validação: limites diários respeitados
      expect(dailyQueue.newCards.length).toBeLessThanOrEqual(settings.newCardsPerDay);
      expect(dailyQueue.review.length).toBeLessThanOrEqual(settings.maxReviewsPerDay);

      // Validação: todos os cards têm due válido
      for (const card of dailyQueue.queue) {
        expect(Number.isFinite(card.due)).toBe(true);
        expect(card.due).toBeGreaterThanOrEqual(0);
      }

      // 2. Simula o usuário estudando cada card da fila
      // Alternamos as respostas: ~80% Good, ~20% Again
      for (let idx = 0; idx < dailyQueue.queue.length; idx++) {
        const cardToReview = cardsRepo.getById(dailyQueue.queue[idx].id)!;
        const rating = idx % 5 === 0 ? Rating.Again : Rating.Good;
        const reviewDurationMs = 6000 + (idx % 4) * 1000;

        const { updatedCard, reviewLog } = applyReview(
          cardToReview,
          rating,
          currentDayTime + idx * 60000, // Cada card revisado 1 minuto depois
          { desiredRetention: settings.desiredRetention },
          reviewDurationMs
        );

        // Persiste a atualização do card e o review log
        cardsRepo.update(updatedCard.id, {
          due: updatedCard.due,
          stability: updatedCard.stability,
          difficulty: updatedCard.difficulty,
          elapsed_days: updatedCard.elapsed_days,
          scheduled_days: updatedCard.scheduled_days,
          learning_steps: updatedCard.learning_steps,
          reps: updatedCard.reps,
          lapses: updatedCard.lapses,
          state: updatedCard.state,
          last_review: updatedCard.last_review,
        });

        reviewLogsRepo.create(reviewLog);
        totalReviewsAnswered++;
      }
    }

    // Validações finais de integridade após 14 dias:
    // 1. Nenhum card foi perdido:
    const allDbCards = cardsRepo.listByDeck(deck.id);
    expect(allDbCards.length).toBe(initialCardsCount);

    // 2. Nenhum card possui due inválido, NaN ou null:
    for (const card of allDbCards) {
      expect(Number.isFinite(card.due)).toBe(true);
      expect(card.due).toBeGreaterThanOrEqual(0);
      expect([State.New, State.Learning, State.Review, State.Relearning]).toContain(card.state);
    }

    // 3. Total de review logs é igual ao total de respostas dadas:
    const allLogs = reviewLogsRepo.listByRange(0, baseStartTime + 15 * oneDayMs);
    expect(allLogs.length).toBe(totalReviewsAnswered);
    expect(totalReviewsAnswered).toBeGreaterThan(0);

    // 4. Cards que foram revisados com Good acumularam estabilidade e passaram para Review:
    const graduatedCards = allDbCards.filter((c) => c.state === State.Review);
    expect(graduatedCards.length).toBeGreaterThan(0);
    for (const card of graduatedCards) {
      expect(card.reps).toBeGreaterThanOrEqual(1);
      expect(card.stability).toBeGreaterThan(0);
      expect(card.difficulty).toBeGreaterThan(0);
    }
  });
});
