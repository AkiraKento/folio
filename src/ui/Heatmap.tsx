import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from './theme';
import { strings } from './strings';
import type { HeatmapData, HeatmapDayData } from '@/stats/types';

export interface HeatmapProps {
  data: HeatmapData;
  compact?: boolean;
  showLegend?: boolean;
  showSummary?: boolean;
  onDayPress?: (day: HeatmapDayData) => void;
}

const MONTH_NAMES_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

/**
 * Converte cor hex em rgba com a opacidade indicada.
 */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

export function Heatmap({
  data,
  compact = false,
  showLegend = true,
  showSummary = false,
  onDayPress,
}: HeatmapProps) {
  const { theme } = useTheme();
  const [selectedDay, setSelectedDay] = useState<HeatmapDayData | null>(null);

  const cellSize = compact ? 11 : 13;
  const cellGap = compact ? 2.5 : 3;
  const borderRadius = compact ? 2.5 : 3;

  const getCellColor = (level: number) => {
    switch (level) {
      case 1:
        return hexToRgba(theme.accent, 0.25);
      case 2:
        return hexToRgba(theme.accent, 0.5);
      case 3:
        return hexToRgba(theme.accent, 0.75);
      case 4:
        return theme.accent;
      case 0:
      default:
        return theme.elevated2;
    }
  };

  const handleCellPress = (day: HeatmapDayData) => {
    setSelectedDay(day);
    if (onDayPress) {
      onDayPress(day);
    }
  };

  // Mapeia onde colocar os rótulos de mês
  const monthLabels = React.useMemo(() => {
    const labels: Array<{ weekIndex: number; name: string }> = [];
    let lastMonth = -1;

    data.weeks.forEach((week, wIdx) => {
      // Pega o primeiro dia da semana ou dia do meio
      const firstDay = week[0];
      if (firstDay) {
        const date = new Date(firstDay.dateMs);
        const month = date.getMonth();
        if (month !== lastMonth) {
          labels.push({ weekIndex: wIdx, name: MONTH_NAMES_SHORT[month] });
          lastMonth = month;
        }
      }
    });

    return labels;
  }, [data.weeks]);

  // Dias da semana visíveis à esquerda: Segunda (1), Quarta (3), Sexta (5)
  const weekdaysLabels = [
    { index: 1, label: 'Seg' },
    { index: 3, label: 'Qua' },
    { index: 5, label: 'Sex' },
  ];

  return (
    <View style={styles.container}>
      {showSummary && (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryText, { color: theme.fg }]}>
            {strings.heatmap.reviewsCount(data.totalReviews)}
          </Text>
          <Text style={[styles.summarySubtext, { color: theme.fgMuted }]}>
            {data.activeDays} {data.activeDays === 1 ? 'dia ativo' : 'dias ativos'}
          </Text>
        </View>
      )}

      {/* Grid com ScrollView horizontal */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Coluna de rótulos dos dias da semana */}
        <View style={[styles.weekdaysCol, { marginTop: 18 }]}>
          {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
            const found = weekdaysLabels.find((w) => w.index === dayIdx);
            return (
              <View
                key={`weekday-${dayIdx}`}
                style={[
                  styles.weekdayCell,
                  {
                    height: cellSize,
                    marginBottom: cellGap,
                  },
                ]}
              >
                {found ? (
                  <Text
                    style={[
                      styles.weekdayText,
                      { color: theme.fgMuted, fontSize: compact ? 8 : 9 },
                    ]}
                  >
                    {found.label}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Colunas de semanas com rótulo de mês acima */}
        <View>
          {/* Linha de meses */}
          <View style={[styles.monthsRow, { height: 16 }]}>
            {monthLabels.map((m) => {
              const leftPos = m.weekIndex * (cellSize + cellGap);
              return (
                <Text
                  key={`month-${m.weekIndex}-${m.name}`}
                  style={[
                    styles.monthText,
                    {
                      left: leftPos,
                      color: theme.fgMuted,
                      fontSize: compact ? 9 : 10,
                    },
                  ]}
                >
                  {m.name}
                </Text>
              );
            })}
          </View>

          {/* Matriz de semanas (colunas) */}
          <View style={styles.weeksContainer}>
            {data.weeks.map((week, wIdx) => (
              <View
                key={`week-${wIdx}`}
                style={[styles.weekCol, { marginRight: cellGap }]}
              >
                {week.map((day) => {
                  const isSelected = selectedDay?.date === day.date;
                  return (
                    <TouchableOpacity
                      key={day.date}
                      onPress={() => handleCellPress(day)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={strings.heatmap.dayReviewsTooltip(
                        day.date,
                        day.count
                      )}
                      style={[
                        styles.dayCell,
                        {
                          width: cellSize,
                          height: cellSize,
                          marginBottom: cellGap,
                          borderRadius,
                          backgroundColor: getCellColor(day.level),
                          borderColor: isSelected ? theme.fg : 'transparent',
                          borderWidth: isSelected ? 1 : 0,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Tooltip informativo do dia selecionado */}
      {selectedDay && (
        <View
          style={[
            styles.tooltipContainer,
            { backgroundColor: theme.elevated2, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.tooltipText, { color: theme.fg }]}>
            {selectedDay.date}:{' '}
            <Text style={{ fontWeight: '700', color: theme.accent }}>
              {selectedDay.count > 0
                ? strings.heatmap.reviewsCount(selectedDay.count)
                : strings.heatmap.noReviews}
            </Text>
          </Text>
        </View>
      )}

      {/* Legenda na base (Menos [0, 1, 2, 3, 4] Mais) */}
      {showLegend && (
        <View style={styles.legendContainer}>
          <Text style={[styles.legendLabel, { color: theme.fgMuted }]}>
            {strings.heatmap.less}
          </Text>
          <View style={styles.legendSquares}>
            {[0, 1, 2, 3, 4].map((lvl) => (
              <View
                key={`legend-lvl-${lvl}`}
                style={[
                  styles.legendCell,
                  {
                    width: cellSize - 1,
                    height: cellSize - 1,
                    borderRadius: borderRadius - 0.5,
                    backgroundColor: getCellColor(lvl),
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.legendLabel, { color: theme.fgMuted }]}>
            {strings.heatmap.more}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '700',
  },
  summarySubtext: {
    fontSize: 12,
  },
  scrollContent: {
    paddingVertical: 4,
    alignItems: 'flex-start',
  },
  weekdaysCol: {
    marginRight: 6,
    justifyContent: 'flex-start',
  },
  weekdayCell: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: 22,
  },
  weekdayText: {
    fontWeight: '500',
  },
  monthsRow: {
    position: 'relative',
    width: '100%',
    marginBottom: 2,
  },
  monthText: {
    position: 'absolute',
    fontWeight: '500',
  },
  weeksContainer: {
    flexDirection: 'row',
  },
  weekCol: {
    flexDirection: 'column',
  },
  dayCell: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipContainer: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  tooltipText: {
    fontSize: 12,
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 6,
  },
  legendLabel: {
    fontSize: 11,
  },
  legendSquares: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  legendCell: {},
});
