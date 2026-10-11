import { createTestDatabase, seedBasicNoteType } from './test-utils';
import { DecksRepository } from '../repositories/decks';
import { NotesRepository } from '../repositories/notes';
import { CardsRepository } from '../repositories/cards';

describe('NotesRepository', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let decksRepo: DecksRepository;
  let notesRepo: NotesRepository;
  let cardsRepo: CardsRepository;
  let noteTypeId: string;
  let deckId: string;

  beforeEach(() => {
    const context = createTestDatabase();
    db = context.db;
    decksRepo = new DecksRepository(db);
    notesRepo = new NotesRepository(db);
    cardsRepo = new CardsRepository(db);
    noteTypeId = seedBasicNoteType(db);
    const deck = decksRepo.create({ name: 'Direito Constitucional' });
    deckId = deck.id;
  });

  test('cria e recupera nota por id e por deck', () => {
    const note = notesRepo.create({
      id: 'note-1',
      deck_id: deckId,
      note_type_id: noteTypeId,
      fields: {
        Frente: 'O que é soberania?',
        Verso: 'Poder supremo dentro dos limites da ordem jurídica.',
      },
      tags: ['direito', 'constitucional'],
    });

    expect(note.id).toBe('note-1');
    expect(note.fields.Frente).toBe('O que é soberania?');
    expect(note.tags).toEqual(['direito', 'constitucional']);

    const fetched = notesRepo.getById('note-1');
    expect(fetched?.id).toBe('note-1');

    const byDeck = notesRepo.listByDeck(deckId);
    expect(byDeck).toHaveLength(1);
    expect(byDeck[0].id).toBe('note-1');
  });

  test('atualiza campos e tags de uma nota', () => {
    const note = notesRepo.create({
      deck_id: deckId,
      note_type_id: noteTypeId,
      fields: { Frente: 'Original', Verso: 'Verso Original' },
      tags: ['antiga'],
    });

    const updated = notesRepo.update(note.id, {
      fields: { Frente: 'Editada', Verso: 'Verso Editado' },
      tags: ['nova', 'editada'],
    });

    expect(updated?.fields.Frente).toBe('Editada');
    expect(updated?.tags).toEqual(['nova', 'editada']);
    expect(updated?.updated_at).toBeGreaterThanOrEqual(note.created_at);
  });

  test('soft delete oculta nota e cascateia para seus cards, e restore recupera ambos', () => {
    const note = notesRepo.create({
      deck_id: deckId,
      note_type_id: noteTypeId,
      fields: { Frente: 'Q', Verso: 'R' },
      tags: [],
    });

    const card = cardsRepo.create({
      note_id: note.id,
      deck_id: deckId,
      ord: 0,
      due: Date.now(),
    });

    notesRepo.softDelete(note.id);

    expect(notesRepo.getById(note.id)).toBeNull();
    expect(cardsRepo.getById(card.id)).toBeNull();

    notesRepo.restore(note.id);

    expect(notesRepo.getById(note.id)).not.toBeNull();
    expect(cardsRepo.getById(card.id)).not.toBeNull();
  });

  test('getWithCards retorna nota acompanhada dos seus cards', () => {
    const note = notesRepo.create({
      deck_id: deckId,
      note_type_id: noteTypeId,
      fields: { Frente: 'Q', Verso: 'R' },
      tags: [],
    });

    cardsRepo.create({
      id: 'c1',
      note_id: note.id,
      deck_id: deckId,
      ord: 0,
      due: Date.now(),
    });
    cardsRepo.create({
      id: 'c2',
      note_id: note.id,
      deck_id: deckId,
      ord: 1,
      due: Date.now() + 1000,
    });

    const noteWithCards = notesRepo.getWithCards(note.id);
    expect(noteWithCards?.cards).toHaveLength(2);
    expect(noteWithCards?.cards.map((c) => c.ord)).toEqual([0, 1]);
  });

  test('listForConsulta ordena por caminho do deck e created_at da nota', () => {
    const deckB = decksRepo.create({ name: 'B::Sub' });
    const deckA = decksRepo.create({ name: 'A::Sub' });

    const noteB1 = notesRepo.create({
      deck_id: deckB.id,
      note_type_id: noteTypeId,
      fields: { Frente: 'B1', Verso: 'VB1' },
      tags: [],
    });
    const noteA1 = notesRepo.create({
      deck_id: deckA.id,
      note_type_id: noteTypeId,
      fields: { Frente: 'A1', Verso: 'VA1' },
      tags: [],
    });

    const units = notesRepo.listForConsulta();
    expect(units.map((u) => u.id)).toEqual([noteA1.id, noteB1.id]);
  });
});
