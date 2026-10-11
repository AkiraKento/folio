import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Share, TouchableOpacity } from 'react-native';
import { StatsView } from '../StatsView';
import { buildHeatmapData } from '@/stats/heatmap';
import type { ReviewStatsSummary } from '@/stats/types';

describe('src/ui/StatsView.tsx', () => {
  const baseDate = new Date(2026, 9, 10, 12, 0, 0);

  const mockStats: ReviewStatsSummary = {
    totalReviews: 25,
    activeDays: 5,
    averageReviewsPerActiveDay: 5,
    retentionRate: 0.84,
    retentionReviewCount: 25,
    cardsByState: {
      new: 10,
      learning: 5,
      review: 15,
      suspended: 2,
      total: 32,
    },
    streak: 5,
    studiedToday: true,
    heatmap: buildHeatmapData([], {
      now: baseDate,
      weeksCount: 12,
    }),
    testStats: {
      hypothesis1: {
        daysReviewedIn14Days: 11,
        targetDays: 10,
        windowDays: 14,
        isMet: true,
        currentStreak: 5,
        totalReviews: 25,
      },
      hypothesis2: {
        consultaOpenCount: 4,
        targetOpens: 3,
        isOpensMet: true,
        annotationsCount: 8,
        targetAnnotations: 5,
        isAnnotationsMet: true,
        isMet: true,
      },
      hypothesis3: {
        hasImportedApkg: true,
        apkgImportCount: 1,
        importedDecksCount: 2,
        importedCardsCount: 32,
        isMet: true,
      },
      totalGoalsMet: 3,
      retentionRate: 0.84,
      generatedAt: baseDate.getTime(),
      exportText: '=== FOLIO · ESTATÍSTICAS DO TESTE (PRD §4) ===\nMetas atingidas: 3/3',
    },
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renderiza as métricas principais, retenção, cards por estado e heatmap', () => {
    const onSettingsPress = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <StatsView stats={mockStats} onSettingsPress={onSettingsPress} />
      );
    });

    const root = renderer.root;
    const json = renderer.toJSON();
    const jsonString = JSON.stringify(json);

    // Deve exibir o título
    expect(jsonString).toContain('Estatísticas');

    // Deve exibir retenção formatada em 84%
    expect(jsonString).toContain('84%');

    // Deve exibir sequência de estudos
    expect(jsonString).toContain('5');

    // Deve conter os estados dos cards
    expect(jsonString).toContain('Novos');
    expect(jsonString).toContain('Aprendendo');
    expect(jsonString).toContain('Revisão');
    expect(jsonString).toContain('Suspensos');

    // Clica no botão de ajustes ⚙️
    const buttons = root.findAllByType(TouchableOpacity);
    const settingsButton = buttons.find(
      (b) => b.props.accessibilityLabel === 'Ajustes'
    );
    expect(settingsButton).toBeDefined();

    act(() => {
      settingsButton?.props.onPress();
    });

    expect(onSettingsPress).toHaveBeenCalled();
  });

  it('renderiza o bloco "Estatísticas do teste" com as 3 hipóteses do PRD §4', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<StatsView stats={mockStats} />);
    });

    const jsonString = JSON.stringify(renderer.toJSON());

    // Bloco presente
    expect(jsonString).toContain('Estatísticas do Teste');
    expect(jsonString).toContain('Validação local das 3 hipóteses do protótipo (PRD §4)');
    expect(jsonString).toContain('3 de 3 metas atingidas');

    // Hipótese 1
    expect(jsonString).toContain('1. Hábito de Revisão (14 dias)');
    expect(jsonString).toContain('11/14 dias com revisão');

    // Hipótese 2
    expect(jsonString).toContain('2. Adoção da Consulta');
    expect(jsonString).toContain('Aberturas: 4/3');
    expect(jsonString).toContain('Grifos: 8/5');

    // Hipótese 3
    expect(jsonString).toContain('3. Importação do Anki (.apkg)');
    expect(jsonString).toContain('Importou: Sim');
  });

  it('aciona o botão "Exportar como texto" chamando onExportText quando fornecido', () => {
    const onExportText = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <StatsView stats={mockStats} onExportText={onExportText} />
      );
    });

    const root = renderer.root;
    const buttons = root.findAllByType(TouchableOpacity);
    const exportButton = buttons.find(
      (b) => b.props.accessibilityLabel === 'Exportar como texto'
    );

    expect(exportButton).toBeDefined();

    act(() => {
      exportButton?.props.onPress();
      jest.runAllTimers();
    });

    expect(onExportText).toHaveBeenCalledWith(mockStats.testStats.exportText);
  });

  it('aciona Share.share nativo quando onExportText não é fornecido', async () => {
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<StatsView stats={mockStats} />);
    });

    const root = renderer.root;
    const buttons = root.findAllByType(TouchableOpacity);
    const exportButton = buttons.find(
      (b) => b.props.accessibilityLabel === 'Exportar como texto'
    );

    expect(exportButton).toBeDefined();

    await act(async () => {
      await exportButton?.props.onPress();
      jest.runAllTimers();
    });

    expect(shareSpy).toHaveBeenCalledWith({
      message: mockStats.testStats.exportText,
      title: 'Estatísticas do Teste',
    });

    shareSpy.mockRestore();
  });

  it('aciona o botão "Enviar feedback" chamando onSendFeedback quando fornecido', () => {
    const onSendFeedback = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <StatsView stats={mockStats} onSendFeedback={onSendFeedback} />
      );
    });

    const root = renderer.root;
    const buttons = root.findAllByType(TouchableOpacity);
    const feedbackButton = buttons.find(
      (b) => b.props.accessibilityLabel === 'Enviar feedback'
    );

    expect(feedbackButton).toBeDefined();

    act(() => {
      feedbackButton?.props.onPress();
    });

    expect(onSendFeedback).toHaveBeenCalledTimes(1);
  });
});
