import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/ui/theme';
import { strings } from '@/ui/strings';
import { copyOrShareDiagnostic } from '@/logging';

export interface AppErrorScreenProps {
  title?: string;
  message?: string;
  error?: Error | unknown;
  onRetry?: () => void | Promise<void>;
}

export function AppErrorScreen({
  title = strings.diagnostics.errorBoundaryTitle,
  message = strings.diagnostics.errorBoundaryMessage,
  error,
  onRetry,
}: AppErrorScreenProps) {
  const { theme } = useTheme();
  const [showDetails, setShowDetails] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const errorMessage = error instanceof Error ? error.message : String(error ?? '');
  const errorStack = error instanceof Error ? error.stack : undefined;

  const handleShare = async () => {
    setSharing(true);
    try {
      const res = await copyOrShareDiagnostic();
      if (res.action === 'shared' || res.action === 'copied') {
        setFeedbackMessage(strings.diagnostics.copyDiagnosticSuccess);
      }
    } catch {
      setFeedbackMessage(strings.diagnostics.copyDiagnosticError);
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.canvas }]}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: theme.elevated, borderColor: theme.border },
          ]}
        >
          <Text style={styles.icon}>⚠️</Text>
          <Text style={[styles.title, { color: theme.fg }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.fgMuted }]}>{message}</Text>

          {feedbackMessage && (
            <View
              style={[
                styles.feedbackBox,
                { backgroundColor: theme.elevated2, borderColor: theme.accent },
              ]}
            >
              <Text style={[styles.feedbackText, { color: theme.accent }]}>
                {feedbackMessage}
              </Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            {onRetry && (
              <TouchableOpacity
                style={[styles.button, styles.retryButton, { backgroundColor: theme.accent }]}
                onPress={onRetry}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={strings.diagnostics.retryButton}
              >
                <Text style={styles.retryButtonText}>{strings.diagnostics.retryButton}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                styles.shareButton,
                { backgroundColor: theme.elevated2, borderColor: theme.border },
              ]}
              onPress={handleShare}
              disabled={sharing}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={strings.diagnostics.copyDiagnosticButton}
              accessibilityHint={strings.diagnostics.copyDiagnosticHint}
            >
              {sharing ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : (
                <Text style={[styles.shareButtonText, { color: theme.fg }]}>
                  {strings.diagnostics.copyDiagnosticButton}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {errorMessage ? (
            <View style={styles.detailsContainer}>
              <TouchableOpacity
                style={styles.detailsToggle}
                onPress={() => setShowDetails(!showDetails)}
                activeOpacity={0.6}
              >
                <Text style={[styles.detailsToggleText, { color: theme.accent }]}>
                  {showDetails ? '▼ Ocultar detalhes técnicos' : '▶ Ver detalhes técnicos'}
                </Text>
              </TouchableOpacity>

              {showDetails && (
                <View
                  style={[
                    styles.detailsBox,
                    { backgroundColor: theme.canvas, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.errorText, { color: theme.fg }]}>
                    {errorMessage}
                  </Text>
                  {errorStack && (
                    <Text style={[styles.stackText, { color: theme.fgMuted }]}>
                      {errorStack}
                    </Text>
                  )}
                </View>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  feedbackBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: {
    width: '100%',
    gap: 12,
  },
  button: {
    minHeight: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  retryButton: {
    width: '100%',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  shareButton: {
    width: '100%',
    borderWidth: 1,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  detailsContainer: {
    width: '100%',
    marginTop: 20,
  },
  detailsToggle: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsToggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailsBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: 13,
    marginBottom: 8,
  },
  stackText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
});
