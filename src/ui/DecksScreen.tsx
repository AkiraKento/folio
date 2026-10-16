import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from './theme';
import { strings } from './strings';
import { DeckTreeItem } from './DeckTreeItem';
import { Snackbar } from './Snackbar';
import { deckUndoStore } from './deckUndo';
import {
  CreateDeckModal,
  RenameDeckModal,
  MoveDeckModal,
  DeckOptionsMenuModal,
} from './DeckModals';
import type { DeckTreeNodeWithCounts } from '@/db/repositories/decks';
import type { Deck } from '@/db/schema';

export interface ContinueReadingInfo {
  deckId: string;
  deckName: string;
  unitIndex: number;
  offset?: number;
}

export interface DecksScreenProps {
  tree: DeckTreeNodeWithCounts[];
  allDecks?: Deck[];
  loading?: boolean;
  continueReading?: ContinueReadingInfo | null;
  onRefresh?: () => void;
  onSelectDeck: (deckId: string) => void;
  onContinueReading?: (deckId: string) => void;
  onCreateDeck?: (name: string, description?: string | null) => void;
  onRenameDeck?: (deckId: string, newName: string) => void;
  onMoveDeck?: (deckId: string, newParentId: string | null) => void;
  onDeleteDeck?: (deckId: string) => void;
  onRestoreDeck?: (deckId: string) => void;
  onImportPress?: () => void;
  onSettingsPress?: () => void;
}

export function DecksScreen({
  tree,
  allDecks = [],
  loading = false,
  continueReading,
  onRefresh,
  onSelectDeck,
  onContinueReading,
  onCreateDeck,
  onRenameDeck,
  onMoveDeck,
  onDeleteDeck,
  onRestoreDeck,
  onImportPress,
  onSettingsPress,
}: DecksScreenProps) {
  const { theme } = useTheme();

  // Expansão da árvore
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    return new Set(tree.map((node) => node.id));
  });

  // Modais e ações
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createInitialParentId, setCreateInitialParentId] = useState<string | null>(null);

  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);

  // Snackbar para Desfazer
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [deletedDeckId, setDeletedDeckId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = deckUndoStore.subscribe((undo) => {
      if (undo) {
        setSnackbarMessage(undo.message);
        setSnackbarVisible(true);
      }
    });

    const pending = deckUndoStore.get();
    if (pending) {
      setSnackbarMessage(pending.message);
      setSnackbarVisible(true);
    }

    return unsubscribe;
  }, []);

  const handleToggleExpand = (nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleOpenCreate = (parentId: string | null = null) => {
    setCreateInitialParentId(parentId);
    setIsCreateModalOpen(true);
  };

  const handleOpenMenu = (deck: Deck) => {
    setActiveDeck(deck);
    setIsMenuOpen(true);
  };

  const handleDelete = (deck: Deck) => {
    if (onDeleteDeck) {
      onDeleteDeck(deck.id);
      setDeletedDeckId(deck.id);
      deckUndoStore.set({
        message: strings.decks.deckDeleted(deck.name),
        onUndo: () => onRestoreDeck?.(deck.id),
      });
    }
  };

  const handleUndoDelete = () => {
    const pending = deckUndoStore.get();
    if (pending) {
      pending.onUndo();
      deckUndoStore.clear();
      setSnackbarVisible(false);
      onRefresh?.();
    } else if (deletedDeckId && onRestoreDeck) {
      onRestoreDeck(deletedDeckId);
      setSnackbarVisible(false);
      setDeletedDeckId(null);
      onRefresh?.();
    }
  };

  /**
   * Renderiza recursivamente nós da árvore respeitando o estado de expansão.
   */
  const renderNodes = (nodes: DeckTreeNodeWithCounts[], depth = 0): React.ReactNode => {
    return nodes.map((node) => {
      const isExpanded = expandedIds.has(node.id);
      return (
        <React.Fragment key={node.id}>
          <DeckTreeItem
            node={node}
            depth={depth}
            isExpanded={isExpanded}
            onToggleExpand={handleToggleExpand}
            onSelectDeck={onSelectDeck}
            onOptionsPress={handleOpenMenu}
          />
          {isExpanded && node.children.length > 0 && renderNodes(node.children, depth + 1)}
        </React.Fragment>
      );
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      {/* Cabeçalho da tela */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.elevated,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.fg }]}>{strings.decks.title}</Text>

        <View style={styles.headerActions}>
          {onSettingsPress && (
            <TouchableOpacity
              testID="decks-settings-button"
              style={[
                styles.settingsButton,
                { backgroundColor: theme.elevated2, borderColor: theme.border },
              ]}
              onPress={onSettingsPress}
              accessibilityRole="button"
              accessibilityLabel={strings.settings.title}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsButtonText}>⚙️</Text>
            </TouchableOpacity>
          )}

          {onImportPress && (
            <TouchableOpacity
              style={[
                styles.importButton,
                { backgroundColor: theme.elevated2, borderColor: theme.border },
              ]}
              onPress={onImportPress}
              accessibilityRole="button"
              accessibilityLabel={strings.import.importDeckAction}
              activeOpacity={0.7}
            >
              <Text style={[styles.importButtonText, { color: theme.fg }]}>
                📥 {strings.import.title}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.newDeckButton, { backgroundColor: theme.accent }]}
            onPress={() => handleOpenCreate(null)}
            accessibilityRole="button"
            accessibilityLabel={strings.decks.newDeck}
            activeOpacity={0.8}
          >
            <Text style={styles.newDeckButtonText}>+ {strings.decks.newDeck}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Conteúdo principal */}
      {loading && tree.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.fgMuted }]}>
            {strings.common.loading}
          </Text>
        </View>
      ) : tree.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyIcon, { color: theme.fgMuted }]}>📁</Text>
          <Text style={[styles.emptyTitle, { color: theme.fg }]}>
            {strings.decks.emptyTitle}
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.fgMuted }]}>
            {strings.decks.emptySubtitle}
          </Text>

          <View style={styles.emptyActionsRow}>
            <TouchableOpacity
              style={[styles.emptyCreateButton, { backgroundColor: theme.accent }]}
              onPress={() => handleOpenCreate(null)}
              accessibilityRole="button"
              accessibilityLabel={strings.decks.newDeck}
            >
              <Text style={styles.newDeckButtonText}>+ {strings.decks.newDeck}</Text>
            </TouchableOpacity>

            {onImportPress && (
              <TouchableOpacity
                style={[
                  styles.emptyImportButton,
                  { backgroundColor: theme.elevated2, borderColor: theme.border },
                ]}
                onPress={onImportPress}
                accessibilityRole="button"
                accessibilityLabel={strings.import.importDeckAction}
              >
                <Text style={[styles.importButtonText, { color: theme.fg }]}>
                  📥 {strings.import.importDeckAction}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={loading}
                onRefresh={onRefresh}
                tintColor={theme.accent}
                colors={[theme.accent]}
              />
            ) : undefined
          }
        >
          {continueReading && (
            <TouchableOpacity
              style={[
                styles.continueReadingCard,
                {
                  backgroundColor: theme.elevated,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => onContinueReading?.(continueReading.deckId)}
              accessibilityRole="button"
              accessibilityLabel={`${strings.consulta.continueReading}: ${continueReading.deckName}`}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.continueReadingIconContainer,
                  { backgroundColor: theme.elevated2 },
                ]}
              >
                <Text style={styles.continueReadingIcon}>📖</Text>
              </View>
              <View style={styles.continueReadingTextContainer}>
                <Text
                  style={[styles.continueReadingTitle, { color: theme.accent }]}
                >
                  {strings.consulta.continueReading}
                </Text>
                <Text
                  style={[styles.continueReadingSubtitle, { color: theme.fg }]}
                  numberOfLines={1}
                >
                  {continueReading.deckName}
                  {continueReading.unitIndex > 0
                    ? ` · ${strings.consulta.readingPositionUnit(continueReading.unitIndex + 1)}`
                    : ` · ${strings.consulta.readingPositionStart}`}
                </Text>
              </View>
              <Text style={[styles.continueReadingArrow, { color: theme.fgMuted }]}>
                ›
              </Text>
            </TouchableOpacity>
          )}

          <View style={[styles.treeWrapper, { borderColor: theme.border }]}>
            {renderNodes(tree)}
          </View>
        </ScrollView>
      )}

      {/* Snackbar flutuante com Desfazer */}
      <Snackbar
        visible={snackbarVisible}
        message={snackbarMessage}
        actionText={strings.common.undo}
        onAction={handleUndoDelete}
        onDismiss={() => setSnackbarVisible(false)}
      />

      {/* Modais de Gerenciamento de Decks */}
      <CreateDeckModal
        visible={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={(name, description) => onCreateDeck?.(name, description)}
        availableDecks={allDecks}
        initialParentId={createInitialParentId}
      />

      {activeDeck && (
        <>
          <DeckOptionsMenuModal
            visible={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            deckName={activeDeck.name}
            onRename={() => setIsRenameOpen(true)}
            onMove={() => setIsMoveOpen(true)}
            onCreateSubdeck={() => handleOpenCreate(activeDeck.id)}
            onDelete={() => handleDelete(activeDeck)}
          />

          <RenameDeckModal
            visible={isRenameOpen}
            onClose={() => setIsRenameOpen(false)}
            currentName={activeDeck.name}
            onRename={(newName) => onRenameDeck?.(activeDeck.id, newName)}
          />

          <MoveDeckModal
            visible={isMoveOpen}
            onClose={() => setIsMoveOpen(false)}
            currentDeck={activeDeck}
            availableDecks={allDecks}
            onMove={(newParentId) => onMoveDeck?.(activeDeck.id, newParentId)}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonText: {
    fontSize: 16,
  },
  importButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  newDeckButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newDeckButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  emptyCreateButton: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyImportButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 12,
  },
  treeWrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 8,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  continueReadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  continueReadingIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueReadingIcon: {
    fontSize: 20,
  },
  continueReadingTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  continueReadingTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  continueReadingSubtitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  continueReadingArrow: {
    fontSize: 22,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
});
