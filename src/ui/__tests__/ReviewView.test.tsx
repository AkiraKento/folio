import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TouchableOpacity, Text } from 'react-native';
import { ReviewView } from '../ReviewView';
import type { UseReviewSessionReturn, ReviewCardData } from '@/review/types';
import { Rating } from '@/scheduler';

// Mock do CardView para simplificar o teste de UI sem WebView nativa
jest.mock('../CardView', () => ({
  CardView: (props: { html: string; side: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text: RNText, View: RNView } = require('react-native');
    return (
      <RNView testID="mock-card-view">
        <RNText testID="mock-card-side">{props.side}</RNText>
        <RNText testID="mock-card-html">{props.html}</RNText>
      </RNView>
    );
  },
}));

describe('ReviewView — Interface de Revisão FSRS', () => {
  const sampleCardData: ReviewCardData = {
    card: {
      id: 'card-1',
      note_id: 'note-1',
      deck_id: 'deck-1',
      ord: 0,
      due: Date.now(),
      stability: 2,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 1,
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
      note_type_id: 'nt-basic',
      deck_id: 'deck-1',
      fields: { Frente: 'Qual a conduta?', Verso: 'Iniciar IECA' },
      tags: ['cardio'],
      source_id: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    },
    noteType: {
      id: 'nt-basic',
      name: 'Básico',
      kind: 'basic',
      fields: [{ name: 'Frente', ord: 0 }, { name: 'Verso', ord: 1 }],
      templates: [{ name: 'Card 1', ord: 0, front: '{{Frente}}', back: '{{Verso}}' }],
      css: '',
      source_id: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    },
    deck: {
      id: 'deck-1',
      name: 'Cardiologia',
      area: null,
      description: null,
      source_id: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    },
    frontHtml: 'Qual a conduta?',
    backHtml: 'Iniciar IECA',
    annotations: [],
  };

  function createMockSession(
    overrides?: Partial<UseReviewSessionReturn>
  ): UseReviewSessionReturn {
    return {
      loading: false,
      deckName: 'Cardiologia',
      currentCardData: sampleCardData,
      isAnswerRevealed: false,
      nextReviewOptions: [
        {
          rating: Rating.Again,
          grade: Rating.Again,
          label: 'Errei',
          intervalText: '10 min',
          due: Date.now() + 600000,
          card: sampleCardData.card,
        },
        {
          rating: Rating.Good,
          grade: Rating.Good,
          label: 'Acertei',
          intervalText: '1 d',
          due: Date.now() + 86400000,
          card: sampleCardData.card,
        },
      ],
      buttonMode: 2,
      showHighlights: true,
      remainingCounts: { newCards: 1, learning: 0, review: 0, total: 1 },
      reviewedCount: 0,
      canUndo: false,
      isFinished: false,
      flipCard: jest.fn(),
      answerCard: jest.fn(),
      undo: jest.fn(),
      reloadCurrentCard: jest.fn(),
      ...overrides,
    };
  }

  test('renderiza frente e botão Mostrar resposta quando isAnswerRevealed é falso', () => {
    const session = createMockSession({ isAnswerRevealed: false });
    const onBack = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ReviewView session={session} onBack={onBack} />
      );
    });

    const root = renderer.root;

    // CardView deve receber side='front' e o HTML da frente
    const sideText = root.findByProps({ testID: 'mock-card-side' });
    expect(sideText.props.children).toBe('front');

    const htmlText = root.findByProps({ testID: 'mock-card-html' });
    expect(htmlText.props.children).toBe('Qual a conduta?');

    // Botão Mostrar resposta deve estar presente
    const buttons = root.findAllByType(TouchableOpacity);
    const showAnswerBtn = buttons.find(
      (b) => b.props.accessibilityLabel === 'Mostrar resposta'
    );
    expect(showAnswerBtn).toBeDefined();

    // Tocar no botão chama flipCard
    act(() => {
      showAnswerBtn?.props.onPress();
    });
    expect(session.flipCard).toHaveBeenCalledTimes(1);
  });

  test('renderiza verso e botões com próximo intervalo quando isAnswerRevealed é verdadeiro', () => {
    const session = createMockSession({ isAnswerRevealed: true });
    const onBack = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ReviewView session={session} onBack={onBack} />
      );
    });

    const root = renderer.root;

    // CardView deve receber side='back' e o HTML do verso
    const sideText = root.findByProps({ testID: 'mock-card-side' });
    expect(sideText.props.children).toBe('back');

    const htmlText = root.findByProps({ testID: 'mock-card-html' });
    expect(htmlText.props.children).toBe('Iniciar IECA');

    // Botões de avaliação com intervalos
    const buttons = root.findAllByType(TouchableOpacity);
    const againBtn = buttons.find((b) =>
      b.props.accessibilityLabel?.includes('Errei')
    );
    const goodBtn = buttons.find((b) =>
      b.props.accessibilityLabel?.includes('Acertei')
    );

    expect(againBtn).toBeDefined();
    expect(goodBtn).toBeDefined();

    // Tocar em Acertei chama answerCard(Rating.Good)
    act(() => {
      goodBtn?.props.onPress();
    });
    expect(session.answerCard).toHaveBeenCalledWith(Rating.Good);
  });

  test('ações da barra superior: Desfazer, Editar e Abrir na Consulta', () => {
    const session = createMockSession({ canUndo: true });
    const onBack = jest.fn();
    const onEditCard = jest.fn();
    const onOpenConsulta = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ReviewView
          session={session}
          onBack={onBack}
          onEditCard={onEditCard}
          onOpenConsulta={onOpenConsulta}
        />
      );
    });

    const root = renderer.root;
    const buttons = root.findAllByType(TouchableOpacity);

    // Desfazer
    const undoBtn = buttons.find(
      (b) => b.props.accessibilityLabel === 'Desfazer'
    );
    expect(undoBtn).toBeDefined();
    act(() => {
      undoBtn?.props.onPress();
    });
    expect(session.undo).toHaveBeenCalledTimes(1);

    // Editar card
    const editBtn = buttons.find(
      (b) => b.props.accessibilityLabel === 'Editar card'
    );
    expect(editBtn).toBeDefined();
    act(() => {
      editBtn?.props.onPress();
    });
    expect(onEditCard).toHaveBeenCalledWith('note-1');

    // Abrir na Consulta
    const consultaBtn = buttons.find(
      (b) => b.props.accessibilityLabel === 'Abrir na Consulta'
    );
    expect(consultaBtn).toBeDefined();
    act(() => {
      consultaBtn?.props.onPress();
    });
    expect(onOpenConsulta).toHaveBeenCalledWith('deck-1', 'note-1');

    // Voltar
    const backBtn = buttons.find(
      (b) => b.props.accessibilityLabel === 'Voltar'
    );
    expect(backBtn).toBeDefined();
    act(() => {
      backBtn?.props.onPress();
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('tela de conclusão quando a fila é finalizada (isFinished)', () => {
    const session = createMockSession({
      isFinished: true,
      currentCardData: null,
      reviewedCount: 5,
    });
    const onBack = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ReviewView session={session} onBack={onBack} />
      );
    });

    const root = renderer.root;
    const texts = root.findAllByType(Text);
    const hasParabens = texts.some((t) => t.props.children === 'Parabéns!');
    expect(hasParabens).toBe(true);

    const hasCardCount = texts.some(
      (t) => typeof t.props.children === 'string' && t.props.children.includes('5 cards revisados')
    );
    expect(hasCardCount).toBe(true);
  });
});
