import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from './theme';
import type { DeckCounts } from '@/db/repositories/decks';

export interface DeckCountsBadgeProps {
  counts: DeckCounts;
  /**
   * Se verdadeiro, exibe rótulos textuais ao lado ou abaixo dos números.
   * Padrão: false (pílulas compactas na lista).
   */
  showLabels?: boolean;
}

export function DeckCountsBadge({ counts, showLabels = false }: DeckCountsBadgeProps) {
  const { theme, isDark } = useTheme();

  const newColor = isDark ? '#6cb2ff' : '#2b6cb0';
  const learnColor = theme.learn;
  const reviewColor = theme.accent;

  if (showLabels) {
    return (
      <View style={styles.labelsContainer}>
        <View style={[styles.labelCard, { backgroundColor: theme.elevated2 }]}>
          <Text style={[styles.largeValue, { color: newColor }]}>{counts.new}</Text>
          <Text style={[styles.labelText, { color: theme.fgMuted }]}>Novos</Text>
        </View>

        <View style={[styles.labelCard, { backgroundColor: theme.elevated2 }]}>
          <Text style={[styles.largeValue, { color: learnColor }]}>{counts.learning}</Text>
          <Text style={[styles.labelText, { color: theme.fgMuted }]}>Aprendendo</Text>
        </View>

        <View style={[styles.labelCard, { backgroundColor: theme.elevated2 }]}>
          <Text style={[styles.largeValue, { color: reviewColor }]}>{counts.review}</Text>
          <Text style={[styles.labelText, { color: theme.fgMuted }]}>A revisar</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.compactContainer}>
      <View
        style={[
          styles.badgePill,
          {
            backgroundColor: counts.new > 0 ? (isDark ? 'rgba(108, 178, 255, 0.18)' : 'rgba(43, 108, 176, 0.12)') : 'transparent',
          },
        ]}
      >
        <Text
          style={[
            styles.badgeValue,
            { color: counts.new > 0 ? newColor : theme.fgMuted },
          ]}
        >
          {counts.new}
        </Text>
      </View>

      <View
        style={[
          styles.badgePill,
          {
            backgroundColor: counts.learning > 0 ? (isDark ? 'rgba(213, 151, 26, 0.18)' : 'rgba(184, 148, 31, 0.12)') : 'transparent',
          },
        ]}
      >
        <Text
          style={[
            styles.badgeValue,
            { color: counts.learning > 0 ? learnColor : theme.fgMuted },
          ]}
        >
          {counts.learning}
        </Text>
      </View>

      <View
        style={[
          styles.badgePill,
          {
            backgroundColor: counts.review > 0 ? (isDark ? 'rgba(22, 159, 177, 0.18)' : 'rgba(58, 157, 127, 0.12)') : 'transparent',
          },
        ]}
      >
        <Text
          style={[
            styles.badgeValue,
            { color: counts.review > 0 ? reviewColor : theme.fgMuted },
          ]}
        >
          {counts.review}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgePill: {
    minWidth: 26,
    height: 22,
    borderRadius: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeValue: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  labelsContainer: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  labelCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeValue: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  labelText: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
});
