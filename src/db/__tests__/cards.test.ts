import { createTestDatabase, seedBasicNoteType } from './test-utils';
import { DecksRepository } from '../repositories/decks';
import { NotesRepository } from '../repositories/notes';
import { CardsRepository } from '../repositories/cards';

describe('CardsRepository', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let decksRepo: DecksRepository;
  let notesRepo: NotesRepository;
  let cardsRepo: CardsRepository;
  let noteId: string;
  let deckId: string;

  beforeEach(() => {
    const context = createTestDatabase();
    db = context.db;
    decksRepo = new DecksRepository(db);
    notesRepo = new NotesRepository(db);
    cardsRepo = new CardsRepository(db);

    const noteTypeId = seedBasicNoteType(db);
    const deck = decksRepo.create({ name: 'Medicina' });
    deckId = deck.id;

    const note = notesRepo.create({
      deck_id: deckId,
      note_type_id: noteTypeId,
      fields: { Frente: 'Pergunta', Verso: 'Resposta' },
      tags: [],
    });
    noteId = note.id;
  });

  test('cria card com valores padrão de FSRS', () => {
    const now = Date.now();
    const card = cardsRepo.create({
      id: 'c1',
      note_id: noteId,
      deck_id: deckId,
      ord: 0,
      due: now,
    });

    expect(card.id).toBe('c1');
    expect(card.stability).toBe(0);
    expect(card.difficulty).toBe(0);
    expect(card.state).toBe(0); // Novo
    expect(card.reps).toBe(0);
    expect(card.suspended).toBe(0);
    expect(card.buried_until).toBeNull();
  });

  test('atualiza estado FSRS do card', () => {
    const card = cardsRepo.create({
      note_id: noteId,
      deck_id: deckId,
      ord: 0,
      due: Date.now(),
    });

    const nextDue = Date.now() + 86400000;
    const updated = cardsRepo.updateFsrs(card.id, {
      due: nextDue,
      stability: 3.5,
      difficulty: 4.8,
      elapsed_days: 1,
      scheduled_days: 3,
      learning_steps: 0,
      reps: 1,
      lapses: 0,
      state: 2, // Review
      last_review: Date.now(),
    });

    expect(updated?.stability).toBe(3.5);
    expect(updated?.difficulty).toBe(4.8);
    expect(updated?.state).toBe(2);
    expect(updated?.reps).toBe(1);
    expect(updated?.due).toBe(nextDue);
  });

  test('suspender e desuspender card', () => {
    const card = cardsRepo.create({
      note_id: noteId,
      deck_id: deckId,
      ord: 0,
      due: Date.now(),
    });

    cardsRepo.suspend(card.id);
    expect(cardsRepo.getById(card.id)?.suspended).toBe(1);

    cardsRepo.unsuspend(card.id);
    expect(cardsRepo.getById(card.id)?.suspended).toBe(0);
  });

  test('enterrar (bury) e desenterrar card', () => {
    const card = cardsRepo.create({
      note_id: noteId,
      deck_id: deckId,
      ord: 0,
      due: Date.now(),
    });

    const tomorrow = Date.now() + 86400000;
    cardsRepo.bury(card.id, tomorrow);
    expect(cardsRepo.getById(card.id)?.buried_until).toBe(tomorrow);

    cardsRepo.unbury(card.id);
    expect(cardsRepo.getById(card.id)?.buried_until).toBeNull();
  });

  test('listDue retorna apenas cards vencidos e prontos para revisão', () => {
    const now = Date.now();

    // 1. Vencido ativo
    const c1 = cardsRepo.create({
      id: 'c1',
      note_id: noteId,
      deck_id: deckId,
      ord: 0,
      due: now - 1000,
      state: 2,
    });

    // 2. Não vencido (futuro)
    cardsRepo.create({
      id: 'c2',
      note_id: noteId,
      deck_id: deckId,
      ord: 1,
      due: now + 50000,
      state: 2,
    });

    // 3. Vencido mas suspenso
    const c3 = cardsRepo.create({
      id: 'c3',
      note_id: noteId,
      deck_id: deckId,
      ord: 2,
      due: now - 1000,
      state: 2,
    });
    cardsRepo.suspend(c3.id);

    // 4. Vencido mas enterrado (buried)
    const c4 = cardsRepo.create({
      id: 'c4',
      note_id: noteId,
      deck_id: deckId,
      ord: 3,
      due: now - 1000,
      state: 2,
    });
    cardsRepo.bury(c4.id, now + 10000);

    const dueList = cardsRepo.listDue(now, { deckId });
    expect(dueList.map((c) => c.id)).toEqual([c1.id]);
  });

  test('listNew retorna cards no estado 0 respeitando limites e suspensão', () => {
    const now = Date.now();

    const n1 = cardsRepo.create({
      id: 'n1',
      note_id: noteId,
      deck_id: deckId,
      ord: 0,
      due: now,
      state: 0,
    });
    const n2 = cardsRepo.create({
      id: 'n2',
      note_id: noteId,
      deck_id: deckId,
      ord: 1,
      due: now + 10,
      state: 0,
    });
    const n3 = cardsRepo.create({
      id: 'n3',
      note_id: noteId,
      deck_id: deckId,
      ord: 2,
      due: now + 20,
      state: 0,
    });
    cardsRepo.suspend(n3.id);

    const newCards = cardsRepo.listNew({ deckId, limit: 1 });
    expect(newCards).toHaveLength(1);
    expect(newCards[0].id).toBe(n1.id);

    const allNew = cardsRepo.listNew({ deckId });
    expect(allNew.map((c) => c.id)).toEqual([n1.id, n2.id]);
  });

  test('listSiblings retorna apenas cards irmãos da mesma nota', () => {
    const c1 = cardsRepo.create({
      id: 'sib-c1',
      note_id: noteId,
      deck_id: deckId,
      ord: 0,
      due: Date.now(),
    });
    const c2 = cardsRepo.create({
      id: 'sib-c2',
      note_id: noteId,
      deck_id: deckId,
      ord: 1,
      due: Date.now(),
    });
    const note2 = notesRepo.create({
      deck_id: deckId,
      note_type_id: 'nt-basic',
      fields: { Frente: 'Outra', Verso: 'Outra' },
      tags: [],
    });
    cardsRepo.create({
      id: 'sib-other',
      note_id: note2.id,
      deck_id: deckId,
      ord: 0,
      due: Date.now(),
    });

    const siblings = cardsRepo.listSiblings(c1.id);
    expect(siblings).toHaveLength(1);
    expect(siblings[0].id).toBe(c2.id);
  });

  test('burySiblings enterra apenas irmãs e preserva sepultamento posterior', () => {
    const tomorrow = Date.now() + 86400000;
    const nextWeek = Date.now() + 7 * 86400000;

    const c1 = cardsRepo.create({
      id: 'bury-c1',
      note_id: noteId,
      deck_id: deckId,
      ord: 0,
      due: Date.now(),
    });
    const c2 = cardsRepo.create({
      id: 'bury-c2',
      note_id: noteId,
      deck_id: deckId,
      ord: 1,
      due: Date.now(),
    });
    const c3 = cardsRepo.create({
      id: 'bury-c3',
      note_id: noteId,
      deck_id: deckId,
      ord: 2,
      due: Date.now(),
      buried_until: nextWeek,
    });

    const result = cardsRepo.burySiblings(c1.id, tomorrow);
    expect(result).toHaveLength(1);
    expect(result[0].card.id).toBe(c2.id);
    expect(result[0].previousBuriedUntil).toBeNull();

    expect(cardsRepo.getById(c1.id)?.buried_until).toBeNull(); // Não enterra a si mesmo
    expect(cardsRepo.getById(c2.id)?.buried_until).toBe(tomorrow);
    expect(cardsRepo.getById(c3.id)?.buried_until).toBe(nextWeek); // Preserva enterro posterior

    // Restaura
    cardsRepo.restoreBuriedSiblings([
      { cardId: c2.id, previousBuriedUntil: result[0].previousBuriedUntil },
    ]);
    expect(cardsRepo.getById(c2.id)?.buried_until).toBeNull();
  });
});
