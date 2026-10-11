import { createTestDatabase, seedBasicNoteType } from '@/db/__tests__/test-utils';
import { DecksRepository } from '@/db/repositories/decks';
import { NotesRepository } from '@/db/repositories/notes';
import { CardsRepository } from '@/db/repositories/cards';
import { ReviewLogsRepository } from '@/db/repositories/review-logs';
import { State, Rating } from 'ts-fsrs';
import type { Card } from '@/db/schema';
import { buildDailyQueue } from '../queue';

describe('src/scheduler/queue.ts — montagem da fila do dia (PRD §9)', () => {
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

  test('prioridade estrita: aprendizado vencido -> revisões vencidas -> novos', () => {
    const deck = decksRepo.create({ name: 'Medicina' });
    const note = notesRepo.create({
      note_type_id: 'nt-basic',
      deck_id: deck.id,
      fields: { Frente: 'F1', Verso: 'V1' },
      tags: [],
    });

    const now = new Date(2026, 9, 9, 10, 0, 0).getTime();

    // Novo (state = 0)
    const cardNew = cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: now,
      state: State.New,
    });

    // Outra nota para não colidir no sister burying
    const note2 = notesRepo.create({
      note_type_id: 'nt-basic',
      deck_id: deck.id,
      fields: { Frente: 'F2', Verso: 'V2' },
      tags: [],
    });
    // Revisão vencida (state = 2)
    const cardReview = cardsRepo.create({
      note_id: note2.id,
      deck_id: deck.id,
      ord: 0,
      due: now - 3600000,
      state: State.Review,
    });

    const note3 = notesRepo.create({
      note_type_id: 'nt-basic',
      deck_id: deck.id,
      fields: { Frente: 'F3', Verso: 'V3' },
      tags: [],
    });
    // Aprendizado vencido (state = 1)
    const cardLearning = cardsRepo.create({
      note_id: note3.id,
      deck_id: deck.id,
      ord: 0,
      due: now - 1800000,
      state: State.Learning,
    });

    const queue = buildDailyQueue({
      db,
      now,
      deckId: deck.id,
    });

    expect(queue.queue.map((c: Card) => c.id)).toEqual([
      cardLearning.id,
      cardReview.id,
      cardNew.id,
    ]);
  });

  test('revisões vencidas são ordenadas por mais atrasadas primeiro', () => {
    const deck = decksRepo.create({ name: 'Direito' });
    const now = new Date(2026, 9, 9, 10, 0, 0).getTime();

    const n1 = notesRepo.create({ note_type_id: 'nt-basic', deck_id: deck.id, fields: { Frente: 'A', Verso: 'A' }, tags: [] });
    const n2 = notesRepo.create({ note_type_id: 'nt-basic', deck_id: deck.id, fields: { Frente: 'B', Verso: 'B' }, tags: [] });
    const n3 = notesRepo.create({ note_type_id: 'nt-basic', deck_id: deck.id, fields: { Frente: 'C', Verso: 'C' }, tags: [] });

    // C atrasado há 3 dias, B atrasado há 1 dia, A atrasado há 1 hora
    const cA = cardsRepo.create({ note_id: n1.id, deck_id: deck.id, ord: 0, due: now - 3600000, state: State.Review });
    const cB = cardsRepo.create({ note_id: n2.id, deck_id: deck.id, ord: 0, due: now - 86400000, state: State.Review });
    const cC = cardsRepo.create({ note_id: n3.id, deck_id: deck.id, ord: 0, due: now - 3 * 86400000, state: State.Review });

    const queue = buildDailyQueue({ db, now, deckId: deck.id });

    // Ordem deve ser C (mais atrasado), depois B, depois A
    expect(queue.review.map((c: Card) => c.id)).toEqual([cC.id, cB.id, cA.id]);
  });

  test('respeita os limites diários de novos cards e revisões', () => {
    const deck = decksRepo.create({ name: 'Psicologia' });
    const now = new Date(2026, 9, 9, 10, 0, 0).getTime();

    // 5 novos cards
    for (let i = 0; i < 5; i++) {
      const n = notesRepo.create({
        note_type_id: 'nt-basic',
        deck_id: deck.id,
        fields: { Frente: `N${i}`, Verso: `V${i}` },
        tags: [],
      });
      cardsRepo.create({ note_id: n.id, deck_id: deck.id, ord: 0, due: now, state: State.New });
    }

    // 5 revisões
    for (let i = 0; i < 5; i++) {
      const n = notesRepo.create({
        note_type_id: 'nt-basic',
        deck_id: deck.id,
        fields: { Frente: `R${i}`, Verso: `V${i}` },
        tags: [],
      });
      cardsRepo.create({ note_id: n.id, deck_id: deck.id, ord: 0, due: now - 1000, state: State.Review });
    }

    const queue = buildDailyQueue({
      db,
      now,
      deckId: deck.id,
      settings: {
        newCardsPerDay: 2,
        maxReviewsPerDay: 3,
      },
    });

    expect(queue.newCards).toHaveLength(2);
    expect(queue.review).toHaveLength(3);
    expect(queue.queue).toHaveLength(5);
  });

  test('desconta do limite cards novos e revisões já estudados hoje', () => {
    const deck = decksRepo.create({ name: 'Concursos' });
    const now = new Date(2026, 9, 9, 10, 0, 0).getTime();

    // 3 novos no banco
    for (let i = 0; i < 3; i++) {
      const n = notesRepo.create({
        note_type_id: 'nt-basic',
        deck_id: deck.id,
        fields: { Frente: `N${i}`, Verso: `V${i}` },
        tags: [],
      });
      cardsRepo.create({ note_id: n.id, deck_id: deck.id, ord: 0, due: now, state: State.New });
    }

    const alreadyLearnedNote = notesRepo.create({
      note_type_id: 'nt-basic',
      deck_id: deck.id,
      fields: { Frente: 'Already', Verso: 'Already' },
      tags: [],
    });
    const alreadyLearnedCard = cardsRepo.create({
      note_id: alreadyLearnedNote.id,
      deck_id: deck.id,
      ord: 0,
      due: now + 86400000,
      state: State.Learning,
    });

    // Cria um log de novo card estudado hoje (state inicial New = 0)
    reviewLogsRepo.create({
      card_id: alreadyLearnedCard.id,
      rating: Rating.Good,
      state: State.New,
      due: now + 86400000,
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      last_elapsed_days: 0,
      scheduled_days: 1,
      review_ms: 4000,
      reviewed_at: now - 3600000,
    });

    // Se o limite de novos é 2, e 1 já foi feito hoje, restam apenas 1 novo card!
    const queue = buildDailyQueue({
      db,
      now,
      deckId: deck.id,
      settings: {
        newCardsPerDay: 2,
      },
    });

    expect(queue.newCards).toHaveLength(1);
  });

  test('bury simples de irmãs da mesma nota (só 1 card da mesma nota por dia)', () => {
    const deck = decksRepo.create({ name: 'Farmacologia' });
    const now = new Date(2026, 9, 9, 10, 0, 0).getTime();

    // Nota com 2 cards irmãos (ex: cloze c1 e c2)
    const noteMulti = notesRepo.create({
      note_type_id: 'nt-basic',
      deck_id: deck.id,
      fields: { Frente: 'Frente Multi', Verso: 'Verso Multi' },
      tags: [],
    });

    const c1 = cardsRepo.create({
      note_id: noteMulti.id,
      deck_id: deck.id,
      ord: 0,
      due: now,
      state: State.New,
    });
    const c2 = cardsRepo.create({
      note_id: noteMulti.id,
      deck_id: deck.id,
      ord: 1,
      due: now,
      state: State.New,
    });

    const queue = buildDailyQueue({ db, now, deckId: deck.id });

    // Apenas um dos dois entra na fila de hoje
    const queueCardIds = queue.queue.map((c: Card) => c.id);
    expect(queueCardIds.includes(c1.id)).toBe(true);
    expect(queueCardIds.includes(c2.id)).toBe(false);
    expect(queue.sisterBuriedCount).toBe(1);
  });

  test('ignora cards suspensos ou com buried_until futuro', () => {
    const deck = decksRepo.create({ name: 'Pediatria' });
    const now = new Date(2026, 9, 9, 10, 0, 0).getTime();

    const n1 = notesRepo.create({ note_type_id: 'nt-basic', deck_id: deck.id, fields: { Frente: 'A', Verso: 'A' }, tags: [] });
    const n2 = notesRepo.create({ note_type_id: 'nt-basic', deck_id: deck.id, fields: { Frente: 'B', Verso: 'B' }, tags: [] });

    // Suspenso
    cardsRepo.create({
      note_id: n1.id,
      deck_id: deck.id,
      ord: 0,
      due: now - 1000,
      state: State.Review,
      suspended: 1,
    });

    // Enterrado até amanhã
    cardsRepo.create({
      note_id: n2.id,
      deck_id: deck.id,
      ord: 0,
      due: now - 1000,
      state: State.Review,
      buried_until: now + 86400000,
    });

    const queue = buildDailyQueue({ db, now, deckId: deck.id });
    expect(queue.queue).toHaveLength(0);
  });

  test('filtro por deck inclui recursivamente subdecks Pai::Filho', () => {
    const deckParent = decksRepo.create({ name: 'Medicina' });
    const deckChild = decksRepo.create({ name: 'Medicina::Cardiologia' });
    const deckOther = decksRepo.create({ name: 'Direito' });

    const now = new Date(2026, 9, 9, 10, 0, 0).getTime();

    const nParent = notesRepo.create({ note_type_id: 'nt-basic', deck_id: deckParent.id, fields: { Frente: 'P', Verso: 'P' }, tags: [] });
    const nChild = notesRepo.create({ note_type_id: 'nt-basic', deck_id: deckChild.id, fields: { Frente: 'C', Verso: 'C' }, tags: [] });
    const nOther = notesRepo.create({ note_type_id: 'nt-basic', deck_id: deckOther.id, fields: { Frente: 'O', Verso: 'O' }, tags: [] });

    const cP = cardsRepo.create({ note_id: nParent.id, deck_id: deckParent.id, ord: 0, due: now, state: State.New });
    const cC = cardsRepo.create({ note_id: nChild.id, deck_id: deckChild.id, ord: 0, due: now, state: State.New });
    cardsRepo.create({ note_id: nOther.id, deck_id: deckOther.id, ord: 0, due: now, state: State.New });

    const queue = buildDailyQueue({ db, now, deckId: deckParent.id });

    expect(queue.queue.map((c: Card) => c.id).sort()).toEqual([cP.id, cC.id].sort());
  });

  test('não inclui irmãs se um card da mesma nota já foi revisado hoje', () => {
    const deck = decksRepo.create({ name: 'Farmacologia' });
    const now = new Date(2026, 9, 9, 14, 0, 0).getTime();

    const note = notesRepo.create({
      note_type_id: 'nt-basic',
      deck_id: deck.id,
      fields: { Frente: 'Beta 1', Verso: 'Coração' },
      tags: [],
    });

    const c1 = cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: now - 3600000,
      state: State.Review,
    });

    const c2 = cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 1,
      due: now - 1800000,
      state: State.Review,
    });

    // Registra que c1 já foi revisado às 10h da manhã hoje (mesmo dia de estudo)
    const reviewLogsRepo = new ReviewLogsRepository(db);
    reviewLogsRepo.create({
      card_id: c1.id,
      rating: 3,
      state: State.Review,
      due: now + 86400000,
      stability: 3,
      difficulty: 5,
      elapsed_days: 1,
      last_elapsed_days: 1,
      scheduled_days: 2,
      review_ms: 4000,
      reviewed_at: new Date(2026, 9, 9, 10, 0, 0).getTime(),
    });
    cardsRepo.update(c1.id, { due: now + 86400000 });

    const queueResult = buildDailyQueue({ db, now, deckId: deck.id });

    // Como c1 já foi estudado hoje, c2 não deve entrar na fila de hoje
    expect(queueResult.queue.map((c: Card) => c.id)).not.toContain(c2.id);
    expect(queueResult.sisterBuriedCount).toBe(1);
  });
});
