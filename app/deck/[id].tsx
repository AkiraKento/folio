import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/ui/theme';
import { strings } from '@/ui/strings';
import { useDeckDetail, useDecks } from '@/decks/useDecks';
import { DeckDetailView } from '@/ui/DeckDetailView';
import { deckUndoStore } from '@/ui/deckUndo';

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();

  const {
    deck,
    counts,
    subdecks,
    loading,
    refresh: refreshDetail,
    renameDeck,
    moveDeck,
    deleteDeck,
  } = useDeckDetail(id);

  const { allDecks, createDeck, restoreDeck } = useDecks();

  useFocusEffect(
    useCallback(() => {
      refreshDetail();
    }, [refreshDetail])
  );

  const handleDelete = () => {
    if (!deck) return;
    const deletedId = deck.id;
    const deletedName = deck.name;
    deleteDeck();
    deckUndoStore.set({
      message: strings.decks.deckDeleted(deletedName),
      onUndo: () => restoreDeck(deletedId),
    });
    router.back();
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: theme.canvas }]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.fgMuted }]}>
          {strings.common.loading}
        </Text>
      </SafeAreaView>
    );
  }

  if (!deck) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: theme.canvas }]}>
        <Text style={[styles.errorTitle, { color: theme.fg }]}>
          {strings.deckDetail.deckNotFound}
        </Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.elevated2 }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={strings.deckDetail.backButton}
        >
          <Text style={[styles.backButtonText, { color: theme.fg }]}>
            {strings.deckDetail.backButton}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.canvas }]} edges={['top', 'bottom']}>
      <DeckDetailView
        deck={deck}
        counts={counts}
        subdecks={subdecks}
        availableDecks={allDecks}
        onBack={() => router.back()}
        onSelectSubdeck={(subdeckId) => router.push(`/deck/${subdeckId}`)}
        onRenameDeck={(newName) => renameDeck(newName)}
        onMoveDeck={(newParentId) => moveDeck(newParentId)}
        onCreateSubdeck={(name, description) => {
          createDeck({ name, description });
          refreshDetail();
        }}
        onStudy={() =>
          router.push({
            pathname: '/review/[deckId]',
            params: { deckId: deck.id },
          })
        }
        onConsult={() =>
          router.push({
            pathname: '/consulta/[id]',
            params: { id: deck.id },
          })
        }
        onAddCard={() =>
          router.push({
            pathname: '/card/editor',
            params: { deckId: deck.id },
          })
        }
        onDeleteDeck={handleDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  backButton: {
    minHeight: 44,
    minWidth: 100,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
