import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SettingsView } from '../SettingsView';
import { CardLabView } from '../CardLabView';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { NotesRepository } from '@/db/repositories/notes';
import { DecksRepository } from '@/db/repositories/decks';
import { strings } from '../strings';


/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockWebView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      postMessage: jest.fn(),
    }));

    return React.createElement(View, {
      ...props,
      testID: props.testID || 'mock-webview',
    });
  });

  MockWebView.displayName = 'MockWebView';

  return {
    WebView: MockWebView,
  };
});
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/notifications/notificationService', () => {
  const actual = jest.requireActual('@/notifications/notificationService');
  return {
    ...actual,
    scheduleDailyReminder: jest.fn().mockResolvedValue({ success: true, notificationId: 'test-id' }),
    cancelDailyReminder: jest.fn().mockResolvedValue(undefined),
    sendTestNotification: jest.fn().mockResolvedValue({ success: true, notificationId: 'test-id' }),
    hasNotificationPermission: jest.fn().mockResolvedValue(true),
    requestNotificationPermission: jest.fn().mockResolvedValue(true),
  };
});


describe('Laboratório de cards e modo desenvolvedor (M10 Passo 1)', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let activeRenderer: ReactTestRenderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    const context = createTestDatabase();
    db = context.db;
  });

  afterEach(() => {
    if (activeRenderer) {
      act(() => {
        activeRenderer?.unmount();
      });
      activeRenderer = null;
    }
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  test('desbloqueia Ajustes → Desenvolvedor → Laboratório de cards somente após 7 toques na versão', async () => {
    const onOpenCardLabMock = jest.fn();

    await act(async () => {
      activeRenderer = ReactTestRenderer.create(
        <SettingsView db={db} onOpenCardLab={onOpenCardLabMock} />
      );
    });

    const root = activeRenderer!.root;
    const versionTap = root.findByProps({ testID: 'settings-version-tap' });

    // 6 toques ainda não revelam a seção Desenvolvedor
    for (let i = 0; i < 6; i++) {
      act(() => {
        versionTap.props.onPress();
      });
    }

    expect(root.findAllByProps({ testID: 'settings-developer-section' })).toHaveLength(0);

    // 7º toque desbloqueia a seção Desenvolvedor
    act(() => {
      versionTap.props.onPress();
    });

    const devSections = root.findAllByProps({ testID: 'settings-developer-section' });
    expect(devSections.length).toBeGreaterThan(0);

    const openLabBtn = root.findByProps({ testID: 'open-card-lab-button' });
    act(() => {
      openLabBtn.props.onPress();
    });

    expect(onOpenCardLabMock).toHaveBeenCalledTimes(1);
  });

  test('lista fixtures (avicena e AnKing) + modelos do banco, alterna frente/verso x claro/escuro e abre nota real aleatória', async () => {
    const noteTypesRepo = new NoteTypesRepository(db);
    const notesRepo = new NotesRepository(db);
    const decksRepo = new DecksRepository(db);

    const deck = decksRepo.create({ name: 'Deck Teste' });
    const builtins = noteTypesRepo.seedBuiltins();
    const avicenaDbModel = noteTypesRepo.create({
      name: 'avicena',
      kind: 'custom',
      fields: [
        { name: 'question', ord: 0 },
        { name: 'answer', ord: 1 },
        { name: 'reference', ord: 2 },
      ],
      templates: [
        {
          name: 'Card 1',
          ord: 0,
          front: '{{question}}',
          back: '{{answer}}',
        },
      ],
      css: '.card {}',
    });

    notesRepo.create({
      deck_id: deck.id,
      note_type_id: avicenaDbModel.id,
      fields: {
        question: 'Pergunta real do banco sintética',
        answer: 'Resposta real do banco sintética',
        reference: 'Referência real',
      },
      tags: ['real::tag'],
    });


    await act(async () => {
      activeRenderer = ReactTestRenderer.create(<CardLabView db={db} />);
    });

    const root = activeRenderer!.root;

    // Verifica presença dos chips das 2 fixtures + modelos do banco
    expect(root.findByProps({ testID: 'card-lab-model-fixture-avicena' })).toBeDefined();
    expect(root.findByProps({ testID: 'card-lab-model-fixture-anking' })).toBeDefined();
    expect(root.findByProps({ testID: `card-lab-model-${builtins[0].id}` })).toBeDefined();

    // Verifica alternância Frente/Verso e Claro/Escuro no CardView
    const backBtn = root.findByProps({ testID: 'card-lab-side-back' });
    const darkBtn = root.findByProps({ testID: 'card-lab-theme-dark' });

    act(() => {
      backBtn.props.onPress();
      darkBtn.props.onPress();
    });

    const previewCard = root.findByProps({ testID: 'card-lab-preview' });
    expect(previewCard.props.side).toBe('back');
    expect(previewCard.props.theme).toBe('dark');

    // Testa abertura de nota real aleatória do modelo avicena
    const randomRealBtn = root.findByProps({ testID: 'card-lab-random-real-note' });
    act(() => {
      randomRealBtn.props.onPress();
    });

    const updatedPreview = root.findByProps({ testID: 'card-lab-preview' });
    expect(updatedPreview.props.html).toContain('Resposta real do banco sintética');

    // Testa alternância para a grade 2x2 (Frente/Verso x Claro/Escuro)
    const gridBtn = root.findByProps({ testID: 'card-lab-view-grid' });
    act(() => {
      gridBtn.props.onPress();
    });

    expect(root.findByProps({ testID: 'card-lab-grid-front-light' })).toBeDefined();
    expect(root.findByProps({ testID: 'card-lab-grid-back-light' })).toBeDefined();
    expect(root.findByProps({ testID: 'card-lab-grid-front-dark' })).toBeDefined();
    expect(root.findByProps({ testID: 'card-lab-grid-back-dark' })).toBeDefined();
    expect(strings.cardLab.title).toBe('Laboratório de cards');
  });
});
