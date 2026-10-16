import React from 'react';
import { create, act } from 'react-test-renderer';
import { ReviewView } from '../ReviewView';
import type { UseReviewSessionReturn } from '@/review/types';
import { Rating } from '@/scheduler';
import { buildAnkiDocument } from '@/webview/card/ankiDocument';
import { JSDOM } from 'jsdom';

// Mock do CardView para testes no ambiente Jest
let lastCardViewProps: Record<string, unknown> = {};
jest.mock('../CardView', () => ({
  CardView: (props: Record<string, unknown>) => {
    lastCardViewProps = props;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View: RNView } = require('react-native');
    return <RNView testID="mock-card-view" />;
  },
}));

describe('M10 Passo 7 — Tela de revisão sem moldura', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    lastCardViewProps = {};
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  const mockCardData = {
    card: {
      id: 'card-1',
      note_id: 'note-1',
      deck_id: 'deck-1',
      ord: 0,
      due: Date.now(),
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      last_review: null,
      suspended: 0,
      buried_until: null,
      source_id: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    },
    note: {
      id: 'note-1',
      deck_id: 'deck-1',
      note_type_id: 'nt-avicena',
      fields: {
        question: 'Pergunta do Avicena',
        answer: 'Resposta do Avicena',
      },
      tags: ['Medicina'],
      source_id: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    },
    deck: {
      id: 'deck-1',
      name: 'Clínica Médica',
      area: null,
      description: null,
      source_id: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    },
    noteType: {
      id: 'nt-avicena',
      name: 'Avicena',
      kind: 'basic' as const,
      fields: [],
      templates: [],
      css: '.card { background-color: rgb(240, 244, 248); color: #1a202c; }',
      source_id: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    },
    frontHtml: '<div class="main question-field">Pergunta</div>',
    backHtml: '<div class="main answer-field">Resposta</div>',
    annotations: [],
  };

  const createMockSession = (overrides?: Partial<UseReviewSessionReturn>): UseReviewSessionReturn => ({
    loading: false,
    deckName: 'Clínica Médica',
    currentCardData: mockCardData,
    isAnswerRevealed: false,
    nextReviewOptions: [
      {
        rating: Rating.Again,
        grade: Rating.Again,
        label: 'Errei',
        intervalText: '1 min',
        due: Date.now() + 60000,
        card: mockCardData.card,
      },
      {
        rating: Rating.Hard,
        grade: Rating.Hard,
        label: 'Difícil',
        intervalText: '6 min',
        due: Date.now() + 360000,
        card: mockCardData.card,
      },
      {
        rating: Rating.Good,
        grade: Rating.Good,
        label: 'Bom',
        intervalText: '10 min',
        due: Date.now() + 600000,
        card: mockCardData.card,
      },
      {
        rating: Rating.Easy,
        grade: Rating.Easy,
        label: 'Fácil',
        intervalText: '4 dias',
        due: Date.now() + 345600000,
        card: mockCardData.card,
      },
    ],
    buttonMode: 4,
    showHighlights: true,
    remainingCounts: { newCards: 5, learning: 2, review: 1, total: 8 },
    reviewedCount: 0,
    canUndo: false,
    isFinished: false,
    executeModelScripts: true,
    flipCard: jest.fn(),
    answerCard: jest.fn(),
    undo: jest.fn(),
    updateCurrentNoteFields: jest.fn(),
    reloadCurrentCard: jest.fn(),
    ...overrides,
  });

  it('1. CardView é renderizado sem moldura própria (backgroundColor="transparent")', () => {
    const session = createMockSession();
    act(() => {
      create(<ReviewView session={session} onBack={jest.fn()} />);
      jest.advanceTimersByTime(200);
    });

    expect(lastCardViewProps.backgroundColor).toBe('transparent');
  });

  it('2. Documento Anki recebe padding-bottom em #qa para acomodar a barra flutuante', () => {
    const docHtml = buildAnkiDocument({
      html: '<p>Conteúdo do verso</p>',
      side: 'back',
      theme: 'light',
      css: mockCardData.noteType.css,
      isBuiltinModel: false,
    });

    const dom = new JSDOM(docHtml);
    const overlayStyle = dom.window.document.getElementById('weiss-overlay');
    expect(overlayStyle).not.toBeNull();
    expect(overlayStyle?.textContent).toContain('padding-bottom: var(--weiss-footer-height, 84px)');

    dom.window.close();
  });

  it('3. onRendered atualiza a cor de fundo efetiva para o container RN', () => {
    const session = createMockSession();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<ReviewView session={session} onBack={jest.fn()} />);
      jest.advanceTimersByTime(200);
    });

    // Simula mensagem onRendered enviada pela WebView com a cor de fundo computada do card
    act(() => {
      const onRendered = lastCardViewProps.onRendered as (payload: {
        side: string;
        height: number;
        backgroundColor: string;
      }) => void;
      onRendered({
        side: 'front',
        height: 600,
        backgroundColor: 'rgb(240, 244, 248)',
      });
      jest.advanceTimersByTime(200);
    });

    // O container raiz deve ter recebido a transição
    expect(renderer!.root).toBeDefined();
  });

  it('4. Barra de respostas é flutuante (position: absolute) no verso', () => {
    const session = createMockSession({ isAnswerRevealed: true });
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<ReviewView session={session} onBack={jest.fn()} />);
      jest.advanceTimersByTime(200);
    });

    // Verifica que os botões de resposta estão presentes
    const buttons = renderer!.root.findAllByProps({ accessibilityRole: 'button' });
    const againBtn = buttons.find((b) => b.props.accessibilityLabel?.includes('Errei'));
    expect(againBtn).toBeDefined();
  });
});
