import React, { useEffect, useState, useCallback } from 'react';
import { Stack, SplashScreen, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme, setAppThemeMode, type ThemeMode } from '@/ui/theme';
import { initAppDatabase, getDb, SettingsRepository } from '@/db';
import { setupNotifications } from '@/notifications';
import { logError, logWarn } from '@/logging';
import { AppErrorScreen } from '@/ui/AppErrorScreen';
import { strings } from '@/ui/strings';

// Previne o fechamento prematuro da tela de splash nativa até o banco estar pronto
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * ErrorBoundary raiz exportado para captura de erros de renderização no Expo Router.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    logError('RootErrorBoundary', error);
  }, [error]);

  return (
    <SafeAreaProvider>
      <AppErrorScreen
        title={strings.diagnostics.errorBoundaryTitle}
        message={strings.diagnostics.errorBoundaryMessage}
        error={error}
        onRetry={retry}
      />
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const { isDark, theme } = useTheme();
  const [dbState, setDbState] = useState<'initializing' | 'ready' | 'error'>('initializing');
  const [dbError, setDbError] = useState<Error | null>(null);

  const initDatabase = useCallback(async () => {
    setDbState('initializing');
    setDbError(null);

    try {
      // 1. Configura notificações locais sem bloquear o banco
      setupNotifications().catch((err) => {
        logWarn('NotificationsInit', err);
      });

      // 2. Executa migrações obrigatórias
      await initAppDatabase();

      // 3. Aplica tema salvo
      try {
        const settingsRepo = new SettingsRepository(getDb());
        const savedTheme = settingsRepo.get<ThemeMode>('theme');
        if (savedTheme) {
          setAppThemeMode(savedTheme);
        }
      } catch (err) {
        logWarn('ThemeInit', err);
      }

      setDbState('ready');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logError('DatabaseInit', err);
      setDbError(err);
      setDbState('error');
    } finally {
      // Oculta a splash screen quando o processo concluir (com sucesso ou erro)
      SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  useEffect(() => {
    initDatabase();
  }, [initDatabase]);

  // Enquanto inicializa, a Splash nativa segura a tela
  if (dbState === 'initializing') {
    return null;
  }

  // Se a migração falhar, exibe a tela de erro com diagnóstico em vez de crashar
  if (dbState === 'error') {
    return (
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AppErrorScreen
          title={strings.diagnostics.databaseInitErrorTitle}
          message={strings.diagnostics.databaseInitErrorMessage}
          error={dbError}
          onRetry={initDatabase}
        />
      </SafeAreaProvider>
    );
  }

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
