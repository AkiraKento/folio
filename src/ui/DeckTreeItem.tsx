import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme';
import { strings } from './strings';
import { DeckCountsBadge } from './DeckCountsBadge';
import type { DeckTreeNodeWithCounts } from '@/db/repositories/decks';
import type { Deck } from '@/db/schema';

export interface DeckTreeItemProps {
  node: DeckTreeNodeWithCounts;
  depth: number;
  isExpanded: boolean;
  onToggleExpand: (nodeId: string) => void;
  onSelectDeck: (deckId: string) => void;
  onOptionsPress?: (deck: Deck) => void;
}

export const DeckTreeItem = React.memo(function DeckTreeItem({
  node,
  depth,
  isExpanded,
  onToggleExpand,
  onSelectDeck,
  onOptionsPress,
}: DeckTreeItemProps) {
  const { theme } = useTheme();
  const hasChildren = node.children.length > 0;
  const countsToShow = isExpanded ? node.directCounts : node.totalCounts;

  const deckAccessibilityLabel = strings.decks.deckWithCountsLabel(
    node.name,
    countsToShow.new,
    countsToShow.learning,
    countsToShow.review
  );

  return (
    <View
      style={[
        styles.rowContainer,
        {
          backgroundColor: theme.elevated,
          borderBottomColor: theme.border,
          paddingLeft: 12 + depth * 20,
        },
      ]}
    >
      {/* Botão de expansão (se tiver filhos) ou espaçador */}
      {hasChildren ? (
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => onToggleExpand(node.id)}
          accessibilityRole="button"
          accessibilityLabel={
            isExpanded ? strings.decks.collapseSubdecks : strings.decks.expandSubdecks
          }
          accessibilityHint={
            isExpanded ? 'Recolhe os subdecks deste deck' : 'Expande os subdecks deste deck'
          }
          accessibilityState={{ expanded: isExpanded }}
          activeOpacity={0.7}
        >
          <Text style={[styles.expandIcon, { color: theme.fgMuted }]}>
            {isExpanded ? '▼' : '▶'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.expandSpacer} />
      )}

      {/* Área tocável do deck */}
      <TouchableOpacity
        style={styles.deckContentButton}
        onPress={() => onSelectDeck(node.id)}
        accessibilityRole="button"
        accessibilityLabel={deckAccessibilityLabel}
        accessibilityHint="Abre o detalhe e as ações do deck"
        activeOpacity={0.7}
      >
        <View style={styles.textColumn}>
          <Text
            style={[styles.deckTitle, { color: theme.fg }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {node.shortName}
          </Text>
          {hasChildren && !isExpanded && (
            <Text style={[styles.subdeckHint, { color: theme.fgMuted }]}>
              {node.children.length} {node.children.length === 1 ? 'subdeck' : 'subdecks'}
            </Text>
          )}
        </View>

        <View style={styles.countsWrapper}>
          <DeckCountsBadge counts={countsToShow} />
        </View>
      </TouchableOpacity>

      {/* Botão de opções rápidas (⋯) */}
      {onOptionsPress && (
        <TouchableOpacity
          style={styles.optionsButton}
          onPress={() => onOptionsPress(node.deck)}
          accessibilityRole="button"
          accessibilityLabel={`${strings.decks.moreOptions}: ${node.name}`}
          accessibilityHint="Abre menu para renomear, mover, adicionar subdeck ou apagar"
          activeOpacity={0.7}
        >
          <Text style={[styles.optionsIcon, { color: theme.fgMuted }]}>⋯</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  expandButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandIcon: {
    fontSize: 10,
    fontWeight: '700',
  },
  expandSpacer: {
    width: 20,
  },
  deckContentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: 10,
  },
  textColumn: {
    flex: 1,
    paddingRight: 12,
  },
  deckTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subdeckHint: {
    fontSize: 11,
    marginTop: 2,
  },
  countsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionsButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  optionsIcon: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
});
