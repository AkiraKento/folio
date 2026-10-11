import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme';
import { strings } from './strings';

export interface SnackbarProps {
  visible: boolean;
  message: string;
  actionText?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  durationMs?: number;
}

export function Snackbar({
  visible,
  message,
  actionText = strings.common.undo,
  onAction,
  onDismiss,
  durationMs = 5000,
}: SnackbarProps) {
  const { theme } = useTheme();
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      onDismissRef.current?.();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [visible, durationMs]);

  if (!visible) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.elevated,
          borderColor: theme.border,
          shadowColor: '#000',
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text
        style={[styles.message, { color: theme.fg }]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {message}
      </Text>

      {onAction && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionText}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionText, { color: theme.accent }]}>
            {actionText}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 9999,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    paddingRight: 8,
  },
  actionButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
