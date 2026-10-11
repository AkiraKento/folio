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
import { DeckCountsBadge } from './DeckCountsBadge';
import { DeckActionButtons } from './DeckActionButtons';
import {
  CreateDeckModal,
  RenameDeckModal,
  MoveDeckModal,
  DeckOptionsMenuModal,
} from './DeckModals';
import type { Deck } from '@/db/schema';
import type { DeckCounts } from '@/db/repositories/decks';

export interface DeckDetailViewProps {
  deck: Deck;
  counts: DeckCounts;
  subdecks: Deck[];
  availableDecks?: Deck[];
  onBack: () => void;
  onSelectSubdeck?: (subdeckId: string) => void;
  onStudy?: () => void;
  onConsult?: () => void;
  onAddCard?: () => void;
  onRenameDeck?: (newName: string) => void;
  onMoveDeck?: (newParentId: string | null) => void;
  onCreateSubdeck?: (name: string, description?: string | null) => void;
  onDeleteDeck?: () => void;
}

export function DeckDetailView({
  deck,
  counts,
  subdecks,
  availableDecks = [],
  onBack,
  onSelectSubdeck,
  onStudy,
  onConsult,
  onAddCard,
  onRenameDeck,
  onMoveDeck,
  onCreateSubdeck,
  onDeleteDeck,
}: DeckDetailViewProps) {
  const { theme } = useTheme();
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Estados dos modais de gerenciamento
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isCreateSubdeckOpen, setIsCreateSubdeckOpen] = useState(false);

  const parts = deck.name.split('::');
  const shortName = parts[parts.length - 1];
  const parentPath = parts.length > 1 ? parts.slice(0, -1).join(' :: ') : null;

  const handleStudy = () => {
    if (onStudy) {
      onStudy();
    } else {
      setNoticeMessage(strings.deckDetail.actionStudyNotice);
    }
  };

  const handleConsult = () => {
    if (onConsult) {
      onConsult();
    } else {
      setNoticeMessage(strings.deckDetail.actionConsultNotice);
    }
  };

  const handleAddCard = () => {
    if (onAddCard) {
      onAddCard();
    } else {
      setNoticeMessage(strings.deckDetail.actionAddNotice);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      {/* Barra superior de navegação */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: theme.elevated,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={strings.deckDetail.backButton}
          activeOpacity={0.7}
        >
          <Text style={[styles.backArrow, { color: theme.fg }]}>←</Text>
          <Text style={[styles.backText, { color: theme.fg }]}>
            {strings.deckDetail.backButton}
          </Text>
        </TouchableOpacity>

        {/* Botão de Mais Opções (⋯) */}
        <TouchableOpacity
          style={styles.optionsButton}
          onPress={() => setIsMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={strings.decks.moreOptions}
          activeOpacity={0.7}
        >
          <Text style={[styles.optionsIcon, { color: theme.fg }]}>⋯</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Identificação do Deck */}
        <View
          style={[
            styles.cardSection,
            {
              backgroundColor: theme.elevated,
              borderColor: theme.border,
            },
          ]}
        >
          {parentPath && (
            <Text style={[styles.parentPathText, { color: theme.fgMuted }]}>
              {parentPath}
            </Text>
          )}

          <Text style={[styles.deckTitle, { color: theme.fg }]}>{shortName}</Text>

          {deck.description && (
            <Text style={[styles.deckDescription, { color: theme.fgMuted }]}>
              {deck.description}
            </Text>
          )}

          <View style={styles.totalBadgeRow}>
            <View style={[styles.totalPill, { backgroundColor: theme.elevated2 }]}>
              <Text style={[styles.totalPillText, { color: theme.fgMuted }]}>
                {strings.decks.cardsCount(counts.total)}
              </Text>
            </View>
          </View>
        </View>

        {/* Três Ações Principais do Mesmo Tamanho (PRD §6) */}
        <View style={styles.actionsSection}>
          <DeckActionButtons
            onStudy={handleStudy}
            onConsult={handleConsult}
            onAddCard={handleAddCard}
          />
        </View>

        {/* Mensagem informativa / Snackbar */}
        {noticeMessage && (
          <View
            style={[
              styles.noticeCard,
              {
                backgroundColor: theme.elevated2,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.noticeText, { color: theme.fg }]}>
              {noticeMessage}
            </Text>
            <TouchableOpacity
              onPress={() => setNoticeMessage(null)}
              style={styles.noticeCloseButton}
            >
              <Text style={[styles.noticeCloseText, { color: theme.accent }]}>
                {strings.common.close}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Detalhamento dos Contadores */}
        <View
          style={[
            styles.countsCard,
            {
              backgroundColor: theme.elevated,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.sectionHeading, { color: theme.fg }]}>
            {strings.deckDetail.title}
          </Text>
          <DeckCountsBadge counts={counts} showLabels />
        </View>

        {/* Subdecks (se houver) */}
        {subdecks.length > 0 && (
          <View
            style={[
              styles.subdecksCard,
              {
                backgroundColor: theme.elevated,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.sectionHeading, { color: theme.fg }]}>
              {strings.deckDetail.subdecksHeader} ({subdecks.length})
            </Text>

            {subdecks.map((sub) => {
              const subShortName = sub.name.split('::').pop() ?? sub.name;
              return (
                <TouchableOpacity
                  key={sub.id}
                  style={[
                    styles.subdeckRow,
                    { borderTopColor: theme.border },
                  ]}
                  onPress={() => onSelectSubdeck?.(sub.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Subdeck ${sub.name}`}
                  accessibilityHint="Abre os detalhes e ações deste subdeck"
                  activeOpacity={0.7}
                >
                  <Text style={[styles.subdeckName, { color: theme.fg }]}>
                    {subShortName}
                  </Text>
                  <Text style={[styles.chevron, { color: theme.fgMuted }]}>→</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modais de Gerenciamento do Deck */}
      <DeckOptionsMenuModal
        visible={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        deckName={deck.name}
        onRename={() => setIsRenameOpen(true)}
        onMove={() => setIsMoveOpen(true)}
        onCreateSubdeck={() => setIsCreateSubdeckOpen(true)}
        onDelete={() => onDeleteDeck?.()}
      />

      <RenameDeckModal
        visible={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        currentName={deck.name}
        onRename={(newName) => onRenameDeck?.(newName)}
      />

      <MoveDeckModal
        visible={isMoveOpen}
        onClose={() => setIsMoveOpen(false)}
        currentDeck={deck}
        availableDecks={availableDecks}
        onMove={(newParentId) => onMoveDeck?.(newParentId)}
      />

      <CreateDeckModal
        visible={isCreateSubdeckOpen}
        onClose={() => setIsCreateSubdeckOpen(false)}
        onCreate={(name, description) => onCreateSubdeck?.(name, description)}
        availableDecks={availableDecks}
        initialParentId={deck.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    gap: 8,
  },
  backArrow: {
    fontSize: 20,
    fontWeight: '600',
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionsButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  optionsIcon: {
    fontSize: 22,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  cardSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  parentPathText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  deckTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  deckDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  totalBadgeRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  totalPill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  totalPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsSection: {
    width: '100%',
  },
  noticeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  noticeCloseButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeCloseText: {
    fontSize: 13,
    fontWeight: '700',
  },
  countsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  subdecksCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  subdeckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  subdeckName: {
    fontSize: 15,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 16,
  },
});
