import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme';
import { strings } from './strings';

export interface DeckActionButtonsProps {
  onStudy: () => void;
  onConsult: () => void;
  onAddCard: () => void;
}

export function DeckActionButtons({ onStudy, onConsult, onAddCard }: DeckActionButtonsProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* 1. Estudar */}
      <TouchableOpacity
        style={[
          styles.actionButton,
          {
            backgroundColor: theme.accent,
            borderColor: theme.accent,
          },
        ]}
        onPress={onStudy}
        accessibilityRole="button"
        accessibilityLabel={strings.deckDetail.studyAction}
        activeOpacity={0.8}
      >
        <Text style={styles.actionIcon}>▶</Text>
        <Text style={[styles.actionLabel, { color: '#ffffff' }]}>
          {strings.deckDetail.studyAction}
        </Text>
      </TouchableOpacity>

      {/* 2. Consultar */}
      <TouchableOpacity
        style={[
          styles.actionButton,
          {
            backgroundColor: theme.elevated2,
            borderColor: theme.border,
          },
        ]}
        onPress={onConsult}
        accessibilityRole="button"
        accessibilityLabel={strings.deckDetail.consultAction}
        activeOpacity={0.8}
      >
        <Text style={[styles.actionIconSecondary, { color: theme.fg }]}>📖</Text>
        <Text style={[styles.actionLabel, { color: theme.fg }]}>
          {strings.deckDetail.consultAction}
        </Text>
      </TouchableOpacity>

      {/* 3. Adicionar card */}
      <TouchableOpacity
        style={[
          styles.actionButton,
          {
            backgroundColor: theme.elevated2,
            borderColor: theme.border,
          },
        ]}
        onPress={onAddCard}
        accessibilityRole="button"
        accessibilityLabel={strings.deckDetail.addCardAction}
        activeOpacity={0.8}
      >
        <Text style={[styles.actionIconSecondary, { color: theme.fg }]}>＋</Text>
        <Text style={[styles.actionLabel, { color: theme.fg }]}>
          {strings.deckDetail.addCardAction}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 15,
    marginBottom: 4,
    color: '#ffffff',
  },
  actionIconSecondary: {
    fontSize: 15,
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
