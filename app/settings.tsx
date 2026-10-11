import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/ui/theme';
import { SettingsView } from '@/ui/SettingsView';

export default function SettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.canvas }]}
      edges={['top', 'bottom']}
    >
      <SettingsView
        onBack={() => router.back()}
        onRestoreSuccess={() => {
          // Permanece na tela exibindo o resumo atualizado e notificação
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
