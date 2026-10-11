import { createTestDatabase } from '@/db/__tests__/test-utils';
import { DecksRepository } from '@/db/repositories/decks';
import { NotesRepository } from '@/db/repositories/notes';
import { CardsRepository } from '@/db/repositories/cards';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { BUILTIN_NOTE_TYPE_IDS } from '@/db/builtin-note-types';
import {
  createNoteWithCards,
  updateNoteWithCards,
} from '../cardCreationService';

describe('cardCreationService', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let decksRepo: DecksRepository;
  let notesRepo: NotesRepository;
  let cardsRepo: CardsRepository;
  let noteTypesRepo: NoteTypesRepository;
  let deckId: string;

  beforeEach(() => {
    const context = createTestDatabase();
    db = context.db;
    decksRepo = new DecksRepository(db);
    notesRepo = new NotesRepository(db);
    cardsRepo = new CardsRepository(db);
    noteTypesRepo = new NoteTypesRepository(db);
    noteTypesRepo.seedBuiltins();

    const deck = decksRepo.create({ name: 'Cardiologia' });
    deckId = deck.id;
  });

  test('cria nota e card para modelo Básico', () => {
    const result = createNoteWithCards({
      deckId,
      noteTypeId: BUILTIN_NOTE_TYPE_IDS.BASIC,
      fields: {
        Frente: 'O que é sístole?',
        Verso: 'Contração ventricular.',
      },
      tags: ['cardiologia', 'fisiologia'],
      repos: { notesRepo, cardsRepo, noteTypesRepo },
    });

    expect(result.note.id).toBeDefined();
    expect(result.note.deck_id).toBe(deckId);
    expect(result.note.fields['Frente']).toBe('O que é sístole?');
    expect(result.note.tags).toEqual(['cardiologia', 'fisiologia']);

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].note_id).toBe(result.note.id);
    expect(result.cards[0].ord).toBe(0);
    expect(result.cards[0].state).toBe(0); // Novo
  });

  test('cria dois cards para modelo Básico + invertido se frente e verso preenchidos', () => {
    const result = createNoteWithCards({
      deckId,
      noteTypeId: BUILTIN_NOTE_TYPE_IDS.BASIC_REVERSED,
      fields: {
        Frente: 'Bradicardia',
        Verso: 'FC < 50 bpm',
      },
      tags: ['ritmo'],
      repos: { notesRepo, cardsRepo, noteTypesRepo },
    });

    expect(result.cards).toHaveLength(2);
    expect(result.cards.map((c: { ord: number }) => c.ord)).toEqual([0, 1]);
  });

  test('cria cards correspondentes a cada lacuna cloze c1, c2', () => {
    const result = createNoteWithCards({
      deckId,
      noteTypeId: BUILTIN_NOTE_TYPE_IDS.CLOZE,
      fields: {
        Texto: 'A {{c1::hipertensão}} é fator de risco para {{c2::AVC}} e {{c1::infarto}}.',
        'Verso extra': 'Importante controlar PA.',
      },
      tags: ['has'],
      repos: { notesRepo, cardsRepo, noteTypesRepo },
    });

    // c1 (ord 0) e c2 (ord 1)
    expect(result.cards).toHaveLength(2);
    expect(result.cards[0].ord).toBe(0);
    expect(result.cards[1].ord).toBe(1);
  });

  test('atualiza nota e sincroniza novos cards gerados', () => {
    const created = createNoteWithCards({
      deckId,
      noteTypeId: BUILTIN_NOTE_TYPE_IDS.CLOZE,
      fields: {
        Texto: 'O coração tem {{c1::4 câmaras}}.',
        'Verso extra': '',
      },
      repos: { notesRepo, cardsRepo, noteTypesRepo },
    });

    expect(created.cards).toHaveLength(1);

    // Agora adiciona uma nova lacuna c2
    const updated = updateNoteWithCards({
      noteId: created.note.id,
      deckId,
      noteTypeId: BUILTIN_NOTE_TYPE_IDS.CLOZE,
      fields: {
        Texto: 'O coração tem {{c1::4 câmaras}}: 2 {{c2::átrios}} e 2 ventrículos.',
        'Verso extra': 'Anatomia',
      },
      tags: ['anatomia'],
      repos: { notesRepo, cardsRepo, noteTypesRepo },
    });

    expect(updated.note.fields['Verso extra']).toBe('Anatomia');
    expect(updated.cards).toHaveLength(2);
    expect(updated.cards.map((c: { ord: number }) => c.ord)).toEqual([0, 1]);
  });
});
