import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme, setAppThemeMode, type ThemeMode } from '@/ui/theme';
import { initAppDatabase, getDb, SettingsRepository } from '@/db';
import { setupNotifications } from '@/notifications';

export default function RootLayout() {
  const { isDark, theme } = useTheme();

  useEffect(() => {
    // Configura canais e handlers de notificações locais
    setupNotifications().catch(() => {});

    initAppDatabase()
      .then(() => {
        try {
          const settingsRepo = new SettingsRepository(getDb());
          const savedTheme = settingsRepo.get<ThemeMode>('theme');
          if (savedTheme) {
            setAppThemeMode(savedTheme);
          }
        } catch {
          // Mantém tema padrão
        }
      })
      .catch((error) => {
        console.warn('Falha na inicialização do banco Weiss:', error);
      });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.elevated },
          headerTintColor: theme.fg,
          contentStyle: { backgroundColor: theme.canvas },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Decks',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{
            title: 'Boas-vindas',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="deck/[id]"
          options={{
            title: 'Detalhes do deck',
            headerShown: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
