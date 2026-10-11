import { createTestDatabase } from '@/db/__tests__/test-utils';
import { DecksRepository } from '@/db/repositories/decks';
import { NotesRepository } from '@/db/repositories/notes';
import { CardsRepository } from '@/db/repositories/cards';
import { AnnotationsRepository } from '@/db/repositories/annotations';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { BUILTIN_NOTE_TYPE_IDS } from '@/db/builtin-note-types';
import {
  loadDeckAnnotations,
  filterAnnotationsWithNotesOnly,
  type PanelAnnotationItem,
} from '../annotationsPanel';

describe('src/consulta/annotationsPanel.ts - MODO_CONSULTA.md §3, §5, §9', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let decksRepo: DecksRepository;
  let notesRepo: NotesRepository;
  let cardsRepo: CardsRepository;
  let annotationsRepo: AnnotationsRepository;
  let noteTypesRepo: NoteTypesRepository;

  beforeEach(() => {
    const testDb = createTestDatabase();
    db = testDb.db;
    decksRepo = new DecksRepository(db);
    notesRepo = new NotesRepository(db);
    cardsRepo = new CardsRepository(db);
    annotationsRepo = new AnnotationsRepository(db);
    noteTypesRepo = new NoteTypesRepository(db);
    noteTypesRepo.seedBuiltins();
  });

  test('retorna lista vazia e zero órfãs se o deck não possuir anotações', () => {
    const deck = decksRepo.create({ name: 'Vazio' });
    const result = loadDeckAnnotations(deck.id, { db });

    expect(result.annotations).toEqual([]);
    expect(result.orphans).toEqual([]);
  });

  test('lista anotações na ordem de leitura (decks -> notas -> start asc) com unitIndex correto', () => {
    const deckA = decksRepo.create({ name: 'Cardio' });
    const deckB = decksRepo.create({ name: 'Cardio::Arritmias' });

    // Nota 1 em Cardio
    const note1 = notesRepo.create({
      deck_id: deckA.id,
      note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
      fields: {
        Frente: 'Frente 1',
        Verso: 'Primeiro verso de teste com betabloqueador e amiodarona.',
      },
      created_at: 1000,
    });
    cardsRepo.create({
      note_id: note1.id,
      deck_id: deckA.id,
      ord: 0,
      due: Date.now(),
    });

    // Anotação 1a (start 10) e 1b (start 20) na nota 1
    const ann1a = annotationsRepo.create({
      note_id: note1.id,
      kind: 'hl',
      color: 'amarelo',
      quote: 'verso',
      start: 9,
      end: 14,
      note: 'Primeira nota explicativa',
    });
    const ann1b = annotationsRepo.create({
      note_id: note1.id,
      kind: 'ul',
      color: 'azul',
      quote: 'betabloqueador',
      start: 27,
      end: 41,
    });

    // Nota 2 em Cardio::Arritmias (vem depois na ordem de leitura do deck)
    const note2 = notesRepo.create({
      deck_id: deckB.id,
      note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
      fields: {
        Frente: 'Frente 2',
        Verso: 'Fibrilação atrial é a arritmia sustentada mais comum.',
      },
      created_at: 2000,
    });
    cardsRepo.create({
      note_id: note2.id,
      deck_id: deckB.id,
      ord: 0,
      due: Date.now(),
    });

    const ann2 = annotationsRepo.create({
      note_id: note2.id,
      kind: 'hl',
      color: 'verde',
      quote: 'Fibrilação atrial',
      start: 0,
      end: 17,
      note: 'Revisar critérios de ECG',
    });

    const result = loadDeckAnnotations(deckA.id, { db, includeSubdecks: true });

    expect(result.annotations).toHaveLength(3);
    expect(result.orphans).toHaveLength(0);

    // Ordem de leitura: note1 (unit 0) -> ann1a (start 9), ann1b (start 27); note2 (unit 1) -> ann2
    expect(result.annotations[0].id).toBe(ann1a.id);
    expect(result.annotations[0].unitIndex).toBe(0);
    expect(result.annotations[0].quote).toBe('verso');
    expect(result.annotations[0].note).toBe('Primeira nota explicativa');

    expect(result.annotations[1].id).toBe(ann1b.id);
    expect(result.annotations[1].unitIndex).toBe(0);
    expect(result.annotations[1].quote).toBe('betabloqueador');

    expect(result.annotations[2].id).toBe(ann2.id);
    expect(result.annotations[2].unitIndex).toBe(1);
    expect(result.annotations[2].quote).toBe('Fibrilação atrial');
  });

  test('filtro "só com nota" retorna apenas anotações com texto em note', () => {
    const items: PanelAnnotationItem[] = [
      {
        id: '1',
        noteId: 'n1',
        unitIndex: 0,
        deckPath: 'Cardio',
        kind: 'hl',
        color: 'amarelo',
        quote: 'teste 1',
        note: '   ',
        start: 0,
        end: 7,
        prefix: '',
        suffix: '',
      },
      {
        id: '2',
        noteId: 'n1',
        unitIndex: 0,
        deckPath: 'Cardio',
        kind: 'hl',
        color: 'verde',
        quote: 'teste 2',
        note: 'Minha anotação',
        start: 10,
        end: 17,
        prefix: '',
        suffix: '',
      },
    ];

    const filtered = filterAnnotationsWithNotesOnly(items);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('2');
  });

  test('detecta anotação órfã quando o trecho grifado foi apagado no editor (critério §9)', () => {
    const deck = decksRepo.create({ name: 'Farmacologia' });
    const note = notesRepo.create({
      deck_id: deck.id,
      note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
      fields: {
        Frente: 'Frente',
        Verso: 'Texto original com trecho importante para estudo.',
      },
    });
    cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: Date.now(),
    });

    const ann = annotationsRepo.create({
      note_id: note.id,
      kind: 'hl',
      color: 'laranja',
      quote: 'trecho importante',
      start: 19,
      end: 36,
      note: 'Lembrar deste conceito',
    });

    // Antes da edição: deve aparecer nas anotações válidas
    const beforeEdit = loadDeckAnnotations(deck.id, { db });
    expect(beforeEdit.annotations).toHaveLength(1);
    expect(beforeEdit.orphans).toHaveLength(0);

    // O usuário edita o card no editor apagando o trecho "trecho importante"
    notesRepo.update(note.id, {
      fields: {
        Frente: 'Frente',
        Verso: 'Texto modificado que removeu tudo completamente.',
      },
    });

    // Depois da edição: o trecho não é mais localizável no verso -> deve ir para Órfãs!
    const afterEdit = loadDeckAnnotations(deck.id, { db });
    expect(afterEdit.annotations).toHaveLength(0);
    expect(afterEdit.orphans).toHaveLength(1);
    expect(afterEdit.orphans[0].id).toBe(ann.id);
    expect(afterEdit.orphans[0].quote).toBe('trecho importante');
    expect(afterEdit.orphans[0].note).toBe('Lembrar deste conceito');
    expect(afterEdit.orphans[0].reason).toBe('unlocatable');
  });

  test('inclui anotações de notas excluídas na seção de órfãs (§4 e §5)', () => {
    const deck = decksRepo.create({ name: 'Neurologia' });
    const note = notesRepo.create({
      deck_id: deck.id,
      note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
      fields: {
        Frente: 'Frente',
        Verso: 'Verso neurológico relevante.',
      },
    });
    cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: Date.now(),
    });

    const ann = annotationsRepo.create({
      note_id: note.id,
      kind: 'hl',
      color: 'rosa',
      quote: 'Verso neurológico',
      start: 0,
      end: 17,
      note: 'Importante',
    });

    // Exclui a nota (soft delete)
    notesRepo.softDelete(note.id);

    const result = loadDeckAnnotations(deck.id, { db });
    expect(result.annotations).toHaveLength(0);
    expect(result.orphans).toHaveLength(1);
    expect(result.orphans[0].id).toBe(ann.id);
    expect(result.orphans[0].quote).toBe('Verso neurológico');
    expect(result.orphans[0].reason).toBe('note_deleted');
  });
});
