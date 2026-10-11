import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/ui/theme';
import { useCardEditor } from '@/cards/useCardEditor';
import { CardEditorView } from '@/ui/CardEditorView';

export default function CardEditorScreen() {
  const { deckId, noteId } = useLocalSearchParams<{ deckId?: string; noteId?: string }>();
  const router = useRouter();
  const { theme } = useTheme();

  const editor = useCardEditor({
    initialDeckId: deckId,
    noteId,
  });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.canvas }]}
      edges={['top', 'bottom']}
    >
      <CardEditorView
        editor={editor}
        onBack={() => router.back()}
        isEditing={Boolean(noteId)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
