import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/ui/theme';
import { useReviewSession } from '@/review';
import { ReviewView } from '@/ui/ReviewView';

export default function ReviewDeckScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const { theme } = useTheme();

  const session = useReviewSession({ deckId });

  // Recarrega o card se voltar da tela de edição
  useFocusEffect(
    useCallback(() => {
      session.reloadCurrentCard();
    }, [session.reloadCurrentCard])
  );

  const handleEditCard = (noteId: string) => {
    router.push({
      pathname: '/card/editor',
      params: { noteId },
    });
  };

  const handleOpenConsulta = (targetDeckId: string, noteId?: string) => {
    router.push({
      pathname: '/consulta/[id]',
      params: {
        id: targetDeckId,
        ...(noteId ? { noteId } : {}),
      },
    });
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.canvas }]}
      edges={['top', 'bottom']}
    >
      <ReviewView
        session={session}
        onBack={() => router.back()}
        onEditCard={handleEditCard}
        onOpenConsulta={handleOpenConsulta}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
