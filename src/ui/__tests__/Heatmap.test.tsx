import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { Heatmap } from '../Heatmap';
import { buildHeatmapData } from '@/stats/heatmap';

describe('src/ui/Heatmap.tsx', () => {
  const baseDate = new Date(2026, 9, 10, 12, 0, 0);

  it('renderiza a grade de semanas e legenda', () => {
    const data = buildHeatmapData([], {
      now: baseDate,
      weeksCount: 4,
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <Heatmap data={data} showLegend={true} showSummary={true} />
      );
    });

    const root = renderer.root;
    // Total de células do grid: 4 semanas x 7 dias = 28 células clicáveis
    const cells = root.findAllByType(TouchableOpacity);
    expect(cells.length).toBe(28);

    // Encontra rótulos da legenda (Menos, Mais)
    const texts = root.findAllByType(Text);
    const textContents = texts.map((t) => t.props.children);
    expect(textContents).toContain('Menos');
    expect(textContents).toContain('Mais');
  });

  it('chama onDayPress e exibe tooltip quando uma célula é clicada', () => {
    const ts = new Date(2026, 9, 10, 10, 0, 0).getTime();
    const data = buildHeatmapData([ts], {
      now: baseDate,
      weeksCount: 4,
    });

    const onDayPress = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <Heatmap data={data} onDayPress={onDayPress} />
      );
    });

    const root = renderer.root;
    const cells = root.findAllByType(TouchableOpacity);
    // Toca na última célula (dia 10/10/2026)
    const lastCell = cells[cells.length - 1];

    act(() => {
      lastCell.props.onPress();
    });

    expect(onDayPress).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-10-10',
        count: 1,
      })
    );

    // O tooltip com a data deve ter sido renderizado
    const jsonString = JSON.stringify(renderer.toJSON());
    expect(jsonString).toContain('2026-10-10');
    expect(jsonString).toContain('1 revisão');
  });
});
