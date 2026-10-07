import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '@/ui/theme';

export default function RootLayout() {
  const { isDark, theme } = useTheme();

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
            title: 'Folio',
            headerShown: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
