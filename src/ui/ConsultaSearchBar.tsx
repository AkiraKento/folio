import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from './theme';
import { strings } from './strings';

export interface ConsultaSearchBarProps {
  visible: boolean;
  query: string;
  onlyWithNotes: boolean;
  matchingCount: number;
  onQueryChange: (query: string) => void;
  onToggleOnlyWithNotes: (enabled: boolean) => void;
  onReviewFiltered: () => void;
  onClose: () => void;
  testID?: string;
}

const DEBOUNCE_DELAY_MS = 250;

/**
 * Barra e controles de busca do Modo Consulta (MODO_CONSULTA.md §3).
 * - Filtra unidades por texto (frente + verso + tags), ignorando acento e caixa.
 * - Espera de 250 ms enquanto digita (debounce).
 * - Interruptor "Apenas com anotações".
 * - Botão "Revisar estes" e contador de unidades correspondentes.
 */
export function ConsultaSearchBar({
  visible,
  query,
  onlyWithNotes,
  matchingCount,
  onQueryChange,
  onToggleOnlyWithNotes,
  onReviewFiltered,
  onClose,
  testID = 'consulta-search-bar',
}: ConsultaSearchBarProps) {
  const { theme, isDark } = useTheme();
  const [localQuery, setLocalQuery] = useState(query);
  const inputRef = useRef<TextInput>(null);

  // Sincroniza estado local caso query mude externamente
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  // Foco automático ao abrir
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Debounce de 250 ms para notificar o componente pai (MODO_CONSULTA.md §3)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localQuery !== query) {
        onQueryChange(localQuery);
      }
    }, DEBOUNCE_DELAY_MS);

    return () => {
      clearTimeout(handler);
    };
  }, [localQuery, query, onQueryChange]);

  if (!visible) return null;

  const handleClear = () => {
    setLocalQuery('');
    onQueryChange('');
    inputRef.current?.focus();
  };

  const isFiltering = localQuery.trim().length > 0 || onlyWithNotes;

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: theme.elevated,
          borderBottomColor: theme.border,
        },
      ]}
    >
      {/* Linha do campo de busca textual */}
      <View style={styles.inputRow}>
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: theme.elevated2,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.searchIcon, { color: theme.fgMuted }]}>🔍</Text>
          <TextInput
            ref={inputRef}
            testID={`${testID}-input`}
            style={[styles.input, { color: theme.fg }]}
            value={localQuery}
            onChangeText={setLocalQuery}
            placeholder={strings.consulta.searchPlaceholder}
            placeholderTextColor={theme.fgMuted}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="never"
            accessibilityLabel={strings.consulta.searchPlaceholder}
          />
          {localQuery.length > 0 ? (
            <TouchableOpacity
              testID={`${testID}-clear`}
              style={styles.clearButton}
              onPress={handleClear}
              accessibilityRole="button"
              accessibilityLabel={strings.consulta.searchClear}
              activeOpacity={0.7}
            >
              <Text style={[styles.clearIcon, { color: theme.fgMuted }]}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          testID={`${testID}-close`}
          style={styles.closeButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={strings.consulta.searchClose}
          activeOpacity={0.7}
        >
          <Text style={[styles.closeText, { color: theme.accent }]}>
            {strings.common.close}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Linha de filtros e ações: Interruptor "Só com anotação" e "Revisar estes" */}
      <View style={styles.actionsRow}>
        <View style={styles.switchContainer}>
          <Switch
            testID={`${testID}-switch`}
            value={onlyWithNotes}
            onValueChange={onToggleOnlyWithNotes}
            trackColor={{ false: theme.elevated2, true: theme.accent }}
            thumbColor={isDark ? theme.canvas : theme.elevated}
            accessibilityLabel={strings.consulta.onlyWithNotes}
          />
          <TouchableOpacity
            onPress={() => onToggleOnlyWithNotes(!onlyWithNotes)}
            activeOpacity={0.8}
            style={styles.switchLabelButton}
          >
            <Text style={[styles.switchLabel, { color: theme.fg }]}>
              {strings.consulta.onlyWithNotes}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rightActions}>
          {isFiltering ? (
            <View
              testID={`${testID}-count`}
              style={[styles.countBadge, { backgroundColor: theme.elevated2 }]}
            >
              <Text style={[styles.countText, { color: theme.fgMuted }]}>
                {strings.consulta.searchUnitsCount(matchingCount)}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            testID={`${testID}-review`}
            style={[
              styles.reviewButton,
              {
                backgroundColor: theme.accent,
                opacity: matchingCount > 0 ? 1 : 0.5,
              },
            ]}
            onPress={onReviewFiltered}
            disabled={matchingCount === 0}
            accessibilityRole="button"
            accessibilityLabel={strings.consulta.reviewFiltered}
            activeOpacity={0.7}
          >
            <Text style={[styles.reviewButtonText, { color: isDark ? theme.canvas : '#ffffff' }]}>
              {strings.consulta.reviewFiltered}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
    paddingHorizontal: 10,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    height: '100%',
  },
  clearButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  clearIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  closeButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  switchLabelButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reviewButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
