import { createTestDatabase, seedBasicNoteType } from './test-utils';
import { ReviewLogsRepository } from '../repositories/review-logs';
import { CardsRepository } from '../repositories/cards';
import { NotesRepository } from '../repositories/notes';
import { DecksRepository } from '../repositories/decks';

describe('ReviewLogsRepository', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let reviewLogsRepo: ReviewLogsRepository;
  let cardsRepo: CardsRepository;
  let notesRepo: NotesRepository;
  let decksRepo: DecksRepository;
  let cardId: string;
  let noteId: string;
  let deckId: string;

  beforeEach(() => {
    const testDb = createTestDatabase();
    db = testDb.db;
    seedBasicNoteType(db, 'nt-basic');
    reviewLogsRepo = new ReviewLogsRepository(db);
    cardsRepo = new CardsRepository(db);
    notesRepo = new NotesRepository(db);
    decksRepo = new DecksRepository(db);

    const deck = decksRepo.create({ name: 'Deck Teste' });
    deckId = deck.id;
    const note = notesRepo.create({
      note_type_id: 'nt-basic',
      deck_id: deck.id,
      fields: { Frente: 'Pergunta', Verso: 'Resposta' },
      tags: [],
    });
    noteId = note.id;

    const card = cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: Date.now(),
    });
    cardId = card.id;
  });

  test('cria log de revisão com todos os campos FSRS e recupera por ID', () => {
    const now = Date.now();
    const log = reviewLogsRepo.create({
      card_id: cardId,
      rating: 3,
      state: 0,
      due: now + 86400000,
      stability: 2.5,
      difficulty: 4.8,
      elapsed_days: 0,
      last_elapsed_days: 0,
      scheduled_days: 1,
      review_ms: 4500,
      reviewed_at: now,
    });

    expect(log.id).toBeTruthy();
    expect(log.card_id).toBe(cardId);
    expect(log.rating).toBe(3);
    expect(log.state).toBe(0);
    expect(log.review_ms).toBe(4500);

    const found = reviewLogsRepo.getById(log.id);
    expect(found).not.toBeNull();
    expect(found?.stability).toBe(2.5);
    expect(found?.difficulty).toBe(4.8);
  });

  test('lista por card e por período', () => {
    const t1 = 1000;
    const t2 = 2000;

    reviewLogsRepo.create({
      card_id: cardId,
      rating: 1,
      state: 0,
      due: t1 + 60000,
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      last_elapsed_days: 0,
      scheduled_days: 0,
      review_ms: 3000,
      reviewed_at: t1,
    });

    reviewLogsRepo.create({
      card_id: cardId,
      rating: 3,
      state: 1,
      due: t2 + 86400000,
      stability: 2,
      difficulty: 4.5,
      elapsed_days: 0,
      last_elapsed_days: 0,
      scheduled_days: 1,
      review_ms: 5000,
      reviewed_at: t2,
    });

    const byCard = reviewLogsRepo.listByCard(cardId);
    expect(byCard).toHaveLength(2);
    // Ordenado por reviewed_at desc
    expect(byCard[0].reviewed_at).toBe(t2);
    expect(byCard[1].reviewed_at).toBe(t1);

    const inRange = reviewLogsRepo.listByRange(1500, 2500);
    expect(inRange).toHaveLength(1);
    expect(inRange[0].reviewed_at).toBe(t2);

    expect(reviewLogsRepo.countReviewedInRange(500, 3500)).toBe(2);
  });

  test('listByNote lista logs de todos os cards da nota', () => {
    const card2 = cardsRepo.create({
      note_id: noteId,
      deck_id: deckId,
      ord: 1,
      due: Date.now(),
    });

    reviewLogsRepo.create({
      card_id: cardId,
      rating: 3,
      state: 0,
      due: 100,
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      last_elapsed_days: 0,
      scheduled_days: 1,
      review_ms: 2000,
      reviewed_at: 100,
    });

    reviewLogsRepo.create({
      card_id: card2.id,
      rating: 4,
      state: 0,
      due: 200,
      stability: 2,
      difficulty: 4,
      elapsed_days: 0,
      last_elapsed_days: 0,
      scheduled_days: 3,
      review_ms: 4000,
      reviewed_at: 200,
    });

    const byNote = reviewLogsRepo.listByNote(noteId);
    expect(byNote).toHaveLength(2);
  });

  test('getAverageReviewDurationMs calcula média corretamente', () => {
    expect(reviewLogsRepo.getAverageReviewDurationMs()).toBeNull();

    reviewLogsRepo.create({
      card_id: cardId,
      rating: 3,
      state: 0,
      due: 100,
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      last_elapsed_days: 0,
      scheduled_days: 1,
      review_ms: 4000,
      reviewed_at: 100,
    });

    reviewLogsRepo.create({
      card_id: cardId,
      rating: 3,
      state: 1,
      due: 200,
      stability: 2,
      difficulty: 5,
      elapsed_days: 0,
      last_elapsed_days: 0,
      scheduled_days: 1,
      review_ms: 6000,
      reviewed_at: 200,
    });

    expect(reviewLogsRepo.getAverageReviewDurationMs()).toBe(5000);
    expect(reviewLogsRepo.getAverageReviewDurationMs(150)).toBe(6000);
  });

  test('softDelete e delete removem ou desativam log', () => {
    const log = reviewLogsRepo.create({
      card_id: cardId,
      rating: 3,
      state: 0,
      due: 100,
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      last_elapsed_days: 0,
      scheduled_days: 1,
      review_ms: 3000,
      reviewed_at: 100,
    });

    reviewLogsRepo.softDelete(log.id);
    expect(reviewLogsRepo.getById(log.id)).toBeNull();

    // delete permanente
    expect(reviewLogsRepo.delete(log.id)).toBe(true);
  });
});
