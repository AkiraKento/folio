import { createTestDatabase, seedBasicNoteType } from './test-utils';
import { DecksRepository } from '../repositories/decks';
import { NotesRepository } from '../repositories/notes';
import { AnnotationsRepository } from '../repositories/annotations';

describe('AnnotationsRepository', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let decksRepo: DecksRepository;
  let notesRepo: NotesRepository;
  let annotationsRepo: AnnotationsRepository;
  let noteId: string;
  let deckId: string;

  beforeEach(() => {
    const context = createTestDatabase();
    db = context.db;
    decksRepo = new DecksRepository(db);
    notesRepo = new NotesRepository(db);
    annotationsRepo = new AnnotationsRepository(db);

    const noteTypeId = seedBasicNoteType(db);
    const deck = decksRepo.create({ name: 'Cardiologia' });
    deckId = deck.id;

    const note = notesRepo.create({
      deck_id: deckId,
      note_type_id: noteTypeId,
      fields: { Frente: 'ICFEr', Verso: 'Os quatro pilares da ICFEr são betabloqueador e outros.' },
      tags: [],
    });
    noteId = note.id;
  });

  test('cria anotação e recupera por id e note_id', () => {
    const ann = annotationsRepo.create({
      id: 'ann-1',
      note_id: noteId,
      kind: 'hl',
      color: 'amarelo',
      quote: 'quatro pilares',
      prefix: 'Os ',
      suffix: ' da ICFEr',
      start: 3,
      end: 17,
      note: 'Lembrar na prova',
    });

    expect(ann.id).toBe('ann-1');
    expect(ann.color).toBe('amarelo');
    expect(ann.deleted_at).toBeNull();

    const byId = annotationsRepo.getById('ann-1');
    expect(byId?.id).toBe('ann-1');

    const byNote = annotationsRepo.listByNote(noteId);
    expect(byNote).toHaveLength(1);
    expect(byNote[0].id).toBe('ann-1');
  });

  test('atualizar anotação altera cor, texto e tipo, mas preserva note_id e group_key', () => {
    const ann = annotationsRepo.create({
      note_id: noteId,
      group_key: 'group-123',
      kind: 'hl',
      color: 'amarelo',
      quote: 'trecho',
      start: 0,
      end: 6,
    });

    const updated = annotationsRepo.update(ann.id, {
      color: 'verde',
      kind: 'ul',
      note: 'Nota adicionada',
      note_id: 'outra-nota',
      group_key: 'outro-group',
    } as unknown as Parameters<typeof annotationsRepo.update>[1]);

    expect(updated?.color).toBe('verde');
    expect(updated?.kind).toBe('ul');
    expect(updated?.note).toBe('Nota adicionada');
    expect(updated?.note_id).toBe(noteId); // Permanece o original
    expect(updated?.group_key).toBe('group-123'); // Permanece o original
  });

  test('soft delete oculta anotação e restore (Desfazer) restaura', () => {
    const ann = annotationsRepo.create({
      note_id: noteId,
      kind: 'hl',
      color: 'rosa',
      quote: 'trecho',
      start: 0,
      end: 6,
    });

    annotationsRepo.softDelete(ann.id);
    expect(annotationsRepo.getById(ann.id)).toBeNull();
    expect(annotationsRepo.listByNote(noteId)).toHaveLength(0);

    // Recupera com includeDeleted
    const deleted = annotationsRepo.listByNote(noteId, { includeDeleted: true });
    expect(deleted).toHaveLength(1);

    // Desfazer
    annotationsRepo.restore(ann.id);
    expect(annotationsRepo.getById(ann.id)).not.toBeNull();
    expect(annotationsRepo.listByNote(noteId)).toHaveLength(1);
  });

  test('save (upsert) insere se não existir ou atualiza se já existir', () => {
    const saved1 = annotationsRepo.save({
      id: 'ann-upsert',
      note_id: noteId,
      kind: 'hl',
      color: 'azul',
      quote: 'texto',
      start: 0,
      end: 5,
    });
    expect(saved1.color).toBe('azul');

    const saved2 = annotationsRepo.save({
      id: 'ann-upsert',
      note_id: noteId,
      kind: 'hl',
      color: 'laranja',
      quote: 'texto',
      start: 0,
      end: 5,
      note: 'Atualizado via ponte',
    });
    expect(saved2.color).toBe('laranja');
    expect(saved2.note).toBe('Atualizado via ponte');

    expect(annotationsRepo.listByNote(noteId)).toHaveLength(1);
  });

  test('detecta anotações órfãs quando a nota foi soft-deleted ou excluída', () => {
    const ann = annotationsRepo.create({
      note_id: noteId,
      kind: 'hl',
      color: 'amarelo',
      quote: 'trecho',
      start: 0,
      end: 6,
    });

    expect(annotationsRepo.listOrphans()).toHaveLength(0);

    // Exclui a nota (soft delete)
    notesRepo.softDelete(noteId);

    const orphans = annotationsRepo.listOrphans();
    expect(orphans).toHaveLength(1);
    expect(orphans[0].id).toBe(ann.id);
  });

  test('listByDeck retorna todas as anotações ativas dos cards de um deck', () => {
    annotationsRepo.create({
      note_id: noteId,
      kind: 'hl',
      color: 'amarelo',
      quote: 'trecho',
      start: 0,
      end: 6,
    });

    const deckList = annotationsRepo.listByDeck(deckId);
    expect(deckList).toHaveLength(1);
  });
});
