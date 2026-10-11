import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { TodayView } from '../TodayView';
import type { TodaySummary } from '@/today/types';

describe('src/ui/TodayView.tsx — Componente da Tela Hoje', () => {
  const mockSummaryWithPending: TodaySummary = {
    pendingCount: 15,
    newCount: 10,
    learningCount: 2,
    reviewCount: 3,
    reviewedTodayCount: 5,
    averageReviewDurationMs: 8000,
    estimatedDurationMs: 120000,
    estimatedMinutesText: '~2 min',
    streak: 4,
    studiedToday: true,
    queueResult: {
      newCards: [],
      learning: [],
      review: [],
      queue: [],
      sisterBuriedCount: 0,
    },
  };

  const mockSummaryAllDone: TodaySummary = {
    pendingCount: 0,
    newCount: 0,
    learningCount: 0,
    reviewCount: 0,
    reviewedTodayCount: 12,
    averageReviewDurationMs: 6500,
    estimatedDurationMs: 0,
    estimatedMinutesText: '0 min',
    streak: 5,
    studiedToday: true,
    queueResult: {
      newCards: [],
      learning: [],
      review: [],
      queue: [],
      sisterBuriedCount: 0,
    },
  };

  test('renderiza cards pendentes, tempo estimado e sequência quando há pendentes', () => {
    const onStudy = jest.fn();
    const onOpenDecks = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <TodayView
          summary={mockSummaryWithPending}
          onStudy={onStudy}
          onOpenDecks={onOpenDecks}
        />
      );
    });

    const texts = renderer.root.findAllByType(Text).map((t) => t.props.children);
    const joinedTexts = texts.flat(Infinity).join(' ');

    // Sequência
    expect(joinedTexts).toContain('4 dias');
    expect(joinedTexts).toContain('Sequência de estudos');
    expect(joinedTexts).toContain('Meta de hoje cumprida!');

    // Pendentes e tempo estimado
    expect(joinedTexts).toContain('15 cards para revisar · ~2 min');
    expect(joinedTexts).toContain('10');
    expect(joinedTexts).toContain('2');
    expect(joinedTexts).toContain('3');

    // Botão estudar
    const studyBtn = renderer.root
      .findAllByType(TouchableOpacity)
      .find((b) => b.props.accessibilityLabel === 'Estudar');
    expect(studyBtn).toBeDefined();

    act(() => {
      studyBtn?.props.onPress();
    });
    expect(onStudy).toHaveBeenCalledTimes(1);
  });

  test('renderiza estado de "Tudo em dia!" quando não há cards pendentes', () => {
    const onStudy = jest.fn();
    const onOpenDecks = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <TodayView
          summary={mockSummaryAllDone}
          onStudy={onStudy}
          onOpenDecks={onOpenDecks}
        />
      );
    });

    const texts = renderer.root.findAllByType(Text).map((t) => t.props.children);
    const joinedTexts = texts.flat(Infinity).join(' ');

    // Estado concluído
    expect(joinedTexts).toContain('Tudo em dia!');
    expect(joinedTexts).toContain('Você revisou todos os cards pendentes por hoje.');
    expect(joinedTexts).toContain('12 cards revisados hoje');

    // Botão para ver decks
    const viewDecksBtn = renderer.root
      .findAllByType(TouchableOpacity)
      .find((b) => {
        const childText = b.findAllByType(Text).map((t) => t.props.children).join(' ');
        return childText.includes('Ver decks');
      });
    expect(viewDecksBtn).toBeDefined();

    act(() => {
      viewDecksBtn?.props.onPress();
    });
    expect(onOpenDecks).toHaveBeenCalledTimes(1);
  });

  test('renderiza atalho "Continuar lendo" se houver histórico', () => {
    const onContinueReading = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <TodayView
          summary={mockSummaryWithPending}
          continueReading={{
            deckId: 'deck-1',
            deckName: 'Cardiologia',
            unitIndex: 4,
          }}
          onStudy={jest.fn()}
          onOpenDecks={jest.fn()}
          onContinueReading={onContinueReading}
        />
      );
    });

    const texts = renderer.root.findAllByType(Text).map((t) => t.props.children);
    const joinedTexts = texts.flat(Infinity).join(' ');

    expect(joinedTexts).toContain('Continuar lendo');
    expect(joinedTexts).toContain('Cardiologia · Unidade 5');

    const continueBtn = renderer.root
      .findAllByType(TouchableOpacity)
      .find((b) => b.props.accessibilityLabel === 'Continuar');
    expect(continueBtn).toBeDefined();

    act(() => {
      continueBtn?.props.onPress();
    });
    expect(onContinueReading).toHaveBeenCalledWith('deck-1');
  });

  test('mostra aviso de estudo pendente quando streak > 0 mas não estudou hoje', () => {
    const pendingStreakSummary: TodaySummary = {
      ...mockSummaryWithPending,
      studiedToday: false,
      streak: 3,
    };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <TodayView
          summary={pendingStreakSummary}
          onStudy={jest.fn()}
          onOpenDecks={jest.fn()}
        />
      );
    });

    const texts = renderer.root.findAllByType(Text).map((t) => t.props.children);
    const joinedTexts = texts.flat(Infinity).join(' ');

    expect(joinedTexts).toContain('3 dias');
    expect(joinedTexts).toContain('Estude hoje para manter sua sequência');
  });

  test('renderiza o Heatmap na tela Hoje e dispara onOpenStats', () => {
    const onOpenStats = jest.fn();
    const summaryWithHeatmap: TodaySummary = {
      ...mockSummaryWithPending,
      heatmap: {
        weeks: [
          [
            { date: '2026-10-10', dateMs: 0, count: 5, level: 2, dayOfWeek: 0 },
            { date: '2026-10-11', dateMs: 0, count: 0, level: 0, dayOfWeek: 1 },
            { date: '2026-10-12', dateMs: 0, count: 0, level: 0, dayOfWeek: 2 },
            { date: '2026-10-13', dateMs: 0, count: 0, level: 0, dayOfWeek: 3 },
            { date: '2026-10-14', dateMs: 0, count: 0, level: 0, dayOfWeek: 4 },
            { date: '2026-10-15', dateMs: 0, count: 0, level: 0, dayOfWeek: 5 },
            { date: '2026-10-16', dateMs: 0, count: 0, level: 0, dayOfWeek: 6 },
          ],
        ],
        totalReviews: 5,
        activeDays: 1,
        maxCount: 5,
        startDate: '2026-10-10',
        endDate: '2026-10-16',
      },
    };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <TodayView
          summary={summaryWithHeatmap}
          onStudy={jest.fn()}
          onOpenDecks={jest.fn()}
          onOpenStats={onOpenStats}
        />
      );
    });

    const jsonString = JSON.stringify(renderer.toJSON());
    expect(jsonString).toContain('Atividade de revisões');

    const statsBtn = renderer.root
      .findAllByType(TouchableOpacity)
      .find((b) => b.props.accessibilityLabel === 'Ver todas as estatísticas');
    expect(statsBtn).toBeDefined();

    act(() => {
      statsBtn?.props.onPress();
    });

    expect(onOpenStats).toHaveBeenCalledTimes(1);
  });
});

