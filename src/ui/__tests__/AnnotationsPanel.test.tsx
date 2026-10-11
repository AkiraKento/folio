import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TouchableOpacity, Text } from 'react-native';
import { AnnotationsPanel } from '../AnnotationsPanel';
import { strings } from '../strings';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import { DecksRepository } from '@/db/repositories/decks';
import { NotesRepository } from '@/db/repositories/notes';
import { CardsRepository } from '@/db/repositories/cards';
import { AnnotationsRepository } from '@/db/repositories/annotations';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { BUILTIN_NOTE_TYPE_IDS } from '@/db/builtin-note-types';

describe('Componente <AnnotationsPanel /> (MODO_CONSULTA.md §3, §5)', () => {
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

  test('renderiza estado vazio quando o deck não possui anotações', () => {
    const deck = decksRepo.create({ name: 'Vazio' });
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <AnnotationsPanel
          visible={true}
          onClose={jest.fn()}
          deckId={deck.id}
          deckName={deck.name}
          onSelectAnnotation={jest.fn()}
          db={db}
        />
      );
    });

    const texts = renderer.root.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toContain(strings.consulta.panelEmpty);
  });

  test('fecha o painel ao tocar no botão de fechar', () => {
    const deck = decksRepo.create({ name: 'Cardio' });
    const onClose = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <AnnotationsPanel
          visible={true}
          onClose={onClose}
          deckId={deck.id}
          onSelectAnnotation={jest.fn()}
          db={db}
        />
      );
    });

    const closeBtn = renderer.root.findByProps({
      testID: 'annotations-panel-close-button',
    });

    act(() => {
      closeBtn.props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('renderiza anotações na ordem de leitura e dispara onSelectAnnotation ao tocar no item', () => {
    const deck = decksRepo.create({ name: 'Cardiologia' });
    const note = notesRepo.create({
      deck_id: deck.id,
      note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
      fields: {
        Frente: 'Conceito',
        Verso: 'Tratamento com espironolactona e dapagliflozina.',
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
      color: 'amarelo',
      quote: 'espironolactona',
      start: 15,
      end: 31,
      note: 'Antagonista mineralocorticoide',
    });

    const onSelect = jest.fn();
    const onClose = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <AnnotationsPanel
          visible={true}
          onClose={onClose}
          deckId={deck.id}
          deckName={deck.name}
          onSelectAnnotation={onSelect}
          db={db}
        />
      );
    });

    const itemBtn = renderer.root.findByProps({
      testID: `annotations-panel-item-${ann.id}`,
    });

    act(() => {
      itemBtn.props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      unitIndex: 0,
      annotationId: ann.id,
    });
  });

  test('filtra apenas anotações com nota ao clicar no chip "Só com nota"', () => {
    const deck = decksRepo.create({ name: 'Cardiologia' });
    const note = notesRepo.create({
      deck_id: deck.id,
      note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
      fields: {
        Frente: 'Frente',
        Verso: 'Texto com dois grifos sendo um sem nota e outro com nota.',
      },
    });
    cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: Date.now(),
    });

    const annWithoutNote = annotationsRepo.create({
      note_id: note.id,
      kind: 'hl',
      color: 'azul',
      quote: 'sem nota',
      start: 26,
      end: 34,
      note: '',
    });

    const annWithNote = annotationsRepo.create({
      note_id: note.id,
      kind: 'hl',
      color: 'verde',
      quote: 'com nota',
      start: 45,
      end: 53,
      note: 'Exemplo de anotação de estudo',
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <AnnotationsPanel
          visible={true}
          onClose={jest.fn()}
          deckId={deck.id}
          onSelectAnnotation={jest.fn()}
          db={db}
        />
      );
    });

    const findItemsById = (id: string) =>
      renderer.root.findAll(
        (node) =>
          node.type === TouchableOpacity &&
          node.props.testID === `annotations-panel-item-${id}`
      );

    // Inicialmente mostra as 2
    expect(findItemsById(annWithoutNote.id)).toHaveLength(1);
    expect(findItemsById(annWithNote.id)).toHaveLength(1);

    // Clica no filtro "Só com nota"
    const filterOnlyNotesBtn = renderer.root.findByProps({
      testID: 'annotations-panel-filter-only-notes',
    });
    act(() => {
      filterOnlyNotesBtn.props.onPress();
    });

    // Apenas a anotação com nota permanece visível
    expect(findItemsById(annWithoutNote.id)).toHaveLength(0);
    expect(findItemsById(annWithNote.id)).toHaveLength(1);

    // Clica no filtro "Todas" e ambas retornam
    const filterAllBtn = renderer.root.findByProps({
      testID: 'annotations-panel-filter-all',
    });
    act(() => {
      filterAllBtn.props.onPress();
    });

    expect(findItemsById(annWithoutNote.id)).toHaveLength(1);
  });

  test('exibe órfãs no final e permite apagar com callback onDeleteOrphan', () => {
    const deck = decksRepo.create({ name: 'Farmacologia' });
    const note = notesRepo.create({
      deck_id: deck.id,
      note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
      fields: {
        Frente: 'Frente',
        Verso: 'Texto original com trecho órfão.',
      },
    });
    cardsRepo.create({
      note_id: note.id,
      deck_id: deck.id,
      ord: 0,
      due: Date.now(),
    });

    const orphanAnn = annotationsRepo.create({
      note_id: note.id,
      kind: 'hl',
      color: 'rosa',
      quote: 'trecho órfão',
      start: 19,
      end: 31,
    });

    // Remove o trecho do card para torná-lo órfão
    notesRepo.update(note.id, {
      fields: {
        Frente: 'Frente',
        Verso: 'Texto modificado sem o trecho.',
      },
    });

    const onDeleteOrphan = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <AnnotationsPanel
          visible={true}
          onClose={jest.fn()}
          deckId={deck.id}
          onSelectAnnotation={jest.fn()}
          onDeleteOrphan={onDeleteOrphan}
          annotationsRepo={annotationsRepo}
          db={db}
        />
      );
    });

    // Verifica que a órfã aparece no painel
    const orphanCard = renderer.root.findByProps({
      testID: `annotations-panel-orphan-${orphanAnn.id}`,
    });
    expect(orphanCard).toBeTruthy();

    // Clica no botão Apagar da órfã
    const deleteBtn = renderer.root.findByProps({
      testID: `annotations-panel-orphan-delete-${orphanAnn.id}`,
    });
    act(() => {
      deleteBtn.props.onPress();
    });

    // Confirma callback chamado e registro com soft delete no banco
    expect(onDeleteOrphan).toHaveBeenCalledTimes(1);
    expect(onDeleteOrphan.mock.calls[0][0].id).toBe(orphanAnn.id);

    const dbRecord = annotationsRepo.getById(orphanAnn.id, { includeDeleted: true });
    expect(dbRecord?.deleted_at).not.toBeNull();
  });
});
