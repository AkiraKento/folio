import { useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeTokens {
  canvas: string;
  elevated: string;
  elevated2: string;
  border: string;
  fg: string;
  fgMuted: string;
  accent: string;
  learn: string;
}

export interface AnnotationColorTokens {
  highlight: string;
  underline: string;
}

export type AnnotationColorName = 'amarelo' | 'verde' | 'azul' | 'rosa' | 'laranja';

export const lightTheme: ThemeTokens = {
  canvas: '#f0f4f0',
  elevated: '#ffffff',
  elevated2: '#e0e8e8',
  border: '#e0e6e6',
  fg: '#203e3a',
  fgMuted: '#5b858b',
  accent: '#3a9d7f',
  learn: '#b8941f',
};

export const darkTheme: ThemeTokens = {
  canvas: '#031417',
  elevated: '#062e32',
  elevated2: '#083f44',
  border: '#083f44',
  fg: '#b2cacd',
  fgMuted: '#87a7ab',
  accent: '#169fb1',
  learn: '#d5971a',
};

export const lightAnnotationColors: Record<AnnotationColorName, AnnotationColorTokens> = {
  amarelo: {
    highlight: 'rgba(255, 208, 50, 0.45)',
    underline: '#d6a400',
  },
  verde: {
    highlight: 'rgba(96, 200, 112, 0.36)',
    underline: '#34a853',
  },
  azul: {
    highlight: 'rgba(80, 160, 255, 0.32)',
    underline: '#2f80ed',
  },
  rosa: {
    highlight: 'rgba(255, 110, 165, 0.32)',
    underline: '#e0457b',
  },
  laranja: {
    highlight: 'rgba(255, 145, 50, 0.38)',
    underline: '#e8711c',
  },
};

export const darkAnnotationColors: Record<AnnotationColorName, AnnotationColorTokens> = {
  amarelo: {
    highlight: 'rgba(255, 210, 70, 0.28)',
    underline: '#f2c94c',
  },
  verde: {
    highlight: 'rgba(120, 220, 130, 0.24)',
    underline: '#6fcf7f',
  },
  azul: {
    highlight: 'rgba(100, 175, 255, 0.26)',
    underline: '#6cb2ff',
  },
  rosa: {
    highlight: 'rgba(255, 120, 175, 0.26)',
    underline: '#ff7eb0',
  },
  laranja: {
    highlight: 'rgba(255, 160, 80, 0.28)',
    underline: '#ffa25c',
  },
};

let currentGlobalThemeMode: ThemeMode = 'system';
const themeListeners = new Set<(mode: ThemeMode) => void>();

export function setAppThemeMode(mode: ThemeMode): void {
  currentGlobalThemeMode = mode;
  themeListeners.forEach((fn) => fn(mode));
}

export function getAppThemeMode(): ThemeMode {
  return currentGlobalThemeMode;
}

/**
 * Hook para obter o tema atual (claro/escuro) respeitando o sistema
 * ou a preferência selecionada pelo usuário.
 */
export function useTheme(overrideMode?: ThemeMode) {
  const systemColorScheme = useColorScheme();
  const [globalMode, setGlobalMode] = useState<ThemeMode>(currentGlobalThemeMode);

  useEffect(() => {
    const listener = (newMode: ThemeMode) => {
      setGlobalMode(newMode);
    };
    themeListeners.add(listener);
    return () => {
      themeListeners.delete(listener);
    };
  }, []);

  const activeMode = overrideMode ?? globalMode;
  const isDark = activeMode === 'system' ? systemColorScheme === 'dark' : activeMode === 'dark';

  const tokens = isDark ? darkTheme : lightTheme;
  const annotationTokens = isDark ? darkAnnotationColors : lightAnnotationColors;

  return {
    theme: tokens,
    annotationColors: annotationTokens,
    isDark,
    mode: activeMode,
    setThemeMode: setAppThemeMode,
  };
}
