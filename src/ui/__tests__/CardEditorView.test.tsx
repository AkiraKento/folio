import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import { CardEditorView } from '../CardEditorView';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import { DecksRepository } from '@/db/repositories/decks';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { BUILTIN_NOTE_TYPE_IDS } from '@/db/builtin-note-types';
import type { useCardEditor } from '@/cards/useCardEditor';

// Mock CardView para simplificar o teste de renderização da WebView
jest.mock('../CardView', () => ({
  CardView: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text: RNText } = require('react-native');
    return <RNText testID="mock-card-view">Mock CardView</RNText>;
  },
}));

describe('CardEditorView', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let decksRepo: DecksRepository;
  let noteTypesRepo: NoteTypesRepository;
  let sampleDeckId: string;

  beforeEach(() => {
    const context = createTestDatabase();
    db = context.db;
    decksRepo = new DecksRepository(db);
    noteTypesRepo = new NoteTypesRepository(db);
    noteTypesRepo.seedBuiltins();

    const deck = decksRepo.create({ name: 'Farmacologia' });
    sampleDeckId = deck.id;
  });

  function createMockEditor(overrides?: Partial<ReturnType<typeof useCardEditor>>) {
    const defaultEditor: ReturnType<typeof useCardEditor> = {
      loading: false,
      saving: false,
      availableDecks: decksRepo.listAll(),
      availableNoteTypes: noteTypesRepo.list(),
      currentDeck: decksRepo.getById(sampleDeckId) ?? undefined,
      currentNoteType: noteTypesRepo.getById(BUILTIN_NOTE_TYPE_IDS.BASIC) ?? undefined,
      selectedDeckId: sampleDeckId,
      selectedNoteTypeId: BUILTIN_NOTE_TYPE_IDS.BASIC,
      fields: { Frente: '', Verso: '' },
      tags: '',
      activeFieldName: 'Frente',
      activeTab: 'edit',
      previewSide: 'front',
      previewCardOrd: 0,
      expectedOrds: [0],
      mediaBasePath: 'file:///media/',
      previewHtml: '<p>Frente do card</p>',
      errorMessage: null,
      successMessage: null,
      setSelectedDeckId: jest.fn(),
      setSelectedNoteTypeId: jest.fn(),
      setFieldValue: jest.fn(),
      setTags: jest.fn(),
      setActiveFieldName: jest.fn(),
      setActiveTab: jest.fn(),
      setPreviewSide: jest.fn(),
      setPreviewCardOrd: jest.fn(),
      insertClozeShortcut: jest.fn(),
      insertImageFromGallery: jest.fn(),
      save: jest.fn().mockResolvedValue(true),
      clearError: jest.fn(),
      clearSuccess: jest.fn(),
      ...overrides,
    };
    return defaultEditor;
  }

  test('renderiza campos do modelo Básico por padrão', () => {
    const editor = createMockEditor();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CardEditorView editor={editor} onBack={jest.fn()} />
      );
    });

    const root = renderer.root;
    const texts = root.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toContain('Novo card');
    expect(texts).toContain('Frente');
    expect(texts).toContain('Verso');
  });

  test('permite digitar nos campos e chama setFieldValue', () => {
    const editor = createMockEditor();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CardEditorView editor={editor} onBack={jest.fn()} />
      );
    });

    const root = renderer.root;
    const textInputs = root.findAllByType(TextInput);
    expect(textInputs.length).toBeGreaterThan(0);

    const frenteInput = textInputs.find((ti) => ti.props.placeholder === 'Frente...');
    expect(frenteInput).toBeDefined();

    act(() => {
      frenteInput!.props.onChangeText('Qual o mecanismo de ação da Dipirona?');
    });

    expect(editor.setFieldValue).toHaveBeenCalledWith(
      'Frente',
      'Qual o mecanismo de ação da Dipirona?'
    );
  });

  test('exibe botão de atalho cloze se modelo for Cloze', () => {
    const clozeNoteType = noteTypesRepo.getById(BUILTIN_NOTE_TYPE_IDS.CLOZE);
    const editor = createMockEditor({
      selectedNoteTypeId: BUILTIN_NOTE_TYPE_IDS.CLOZE,
      currentNoteType: clozeNoteType ?? undefined,
      fields: { Texto: '', 'Verso extra': '' },
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CardEditorView editor={editor} onBack={jest.fn()} />
      );
    });

    const root = renderer.root;
    const texts = root.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toContain('Cloze');
    expect(texts).toContain('[...]');

    // Clica no botão cloze
    const clozeButton = root.findAll((node) => node.props.accessibilityLabel === 'Cloze')[0];
    expect(clozeButton).toBeDefined();

    act(() => {
      clozeButton.props.onPress();
    });

    expect(editor.insertClozeShortcut).toHaveBeenCalled();
  });

  test('chama save ao clicar no botão Salvar', async () => {
    const editor = createMockEditor();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CardEditorView editor={editor} onBack={jest.fn()} />
      );
    });

    const root = renderer.root;
    const saveButton = root.findAll((node) => node.props.accessibilityLabel === 'Salvar')[0];
    expect(saveButton).toBeDefined();

    await act(async () => {
      await saveButton.props.onPress();
    });

    expect(editor.save).toHaveBeenCalled();
  });

  test('alterna para a aba Prévia e exibe CardView', () => {
    const editor = createMockEditor({
      activeTab: 'preview',
      previewHtml: '<p>Visualização da Frente</p>',
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CardEditorView editor={editor} onBack={jest.fn()} />
      );
    });

    const root = renderer.root;
    const texts = root.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toContain('Frente');
    expect(texts).toContain('Verso');
    expect(texts).toContain('Mock CardView');
  });

  test('exibe banner de erro quando errorMessage existe', () => {
    const editor = createMockEditor({
      errorMessage: 'Preencha o primeiro campo para salvar o card.',
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CardEditorView editor={editor} onBack={jest.fn()} />
      );
    });

    const root = renderer.root;
    const texts = root.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toContain('Preencha o primeiro campo para salvar o card.');
  });
});
