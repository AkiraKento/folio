import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from './theme';
import { strings } from './strings';
import type {
  ImportPreview,
  ImportProgress,
  ImportResult,
  ScheduleImportMode,
} from '@/import/types';

export interface ImportViewProps {
  selectedFile: { name: string; size?: number } | null;
  preview: ImportPreview | null;
  scheduleMode?: ScheduleImportMode;
  onSelectScheduleMode?: (mode: ScheduleImportMode) => void;
  isLoadingPreview: boolean;
  isImporting: boolean;
  progress: ImportProgress | null;
  error: string | null;
  result: ImportResult | null;
  onPickFile: () => void;
  onStartImport: () => void;
  onReset: () => void;
  onBack?: () => void;
  onViewDecks?: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportView({
  selectedFile,
  preview,
  scheduleMode = 'keep_intervals',
  onSelectScheduleMode,
  isLoadingPreview,
  isImporting,
  progress,
  error,
  result,
  onPickFile,
  onStartImport,
  onReset,
  onBack,
  onViewDecks,
}: ImportViewProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      {/* Barra superior */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.elevated,
            borderBottomColor: theme.border,
          },
        ]}
      >
        {onBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={strings.import.backButton}
            activeOpacity={0.7}
          >
            <Text style={[styles.backButtonText, { color: theme.fg }]}>←</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.fg }]}>{strings.import.title}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.fgMuted }]}>
            {strings.import.subtitle}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Mensagem de erro */}
        {error && (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: theme.elevated,
                borderColor: '#e74c3c',
              },
            ]}
          >
            <Text style={[styles.errorTitle, { color: '#e74c3c' }]}>
              {strings.import.errorTitle}
            </Text>
            <Text style={[styles.errorMessage, { color: theme.fg }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.errorRetryButton, { backgroundColor: theme.elevated2 }]}
              onPress={onPickFile}
              accessibilityRole="button"
              accessibilityLabel={strings.import.pickFile}
            >
              <Text style={[styles.errorRetryText, { color: theme.fg }]}>
                {strings.import.changeFile}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Estado de Sucesso */}
        {result ? (
          <View
            style={[
              styles.successCard,
              {
                backgroundColor: theme.elevated,
                borderColor: theme.accent,
              },
            ]}
          >
            <Text style={styles.successIcon}>✓</Text>
            <Text style={[styles.successTitle, { color: theme.fg }]}>
              {strings.import.successTitle}
            </Text>
            <Text style={[styles.successSummary, { color: theme.fgMuted }]}>
              {strings.import.successSummary(
                result.importedDecks,
                result.importedNotes,
                result.importedCards,
                result.importedMedia,
                result.importedRevlogs
              )}
            </Text>
            {((result.updatedNotes ?? 0) > 0 || (result.updatedCards ?? 0) > 0) && (
              <Text style={[styles.reimportSummary, { color: theme.accent }]}>
                {strings.import.reimportSummary(
                  result.createdNotes ?? 0,
                  result.updatedNotes ?? 0,
                  result.createdCards ?? 0,
                  result.updatedCards ?? 0
                )}
              </Text>
            )}

            <View style={styles.actionRow}>
              {onViewDecks && (
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: theme.accent }]}
                  onPress={onViewDecks}
                  accessibilityRole="button"
                  accessibilityLabel={strings.import.viewDecksAction}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>{strings.import.viewDecksAction}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  { backgroundColor: theme.elevated2, borderColor: theme.border },
                ]}
                onPress={onReset}
                accessibilityRole="button"
                accessibilityLabel={strings.import.importAnotherAction}
                activeOpacity={0.7}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.fg }]}>
                  {strings.import.importAnotherAction}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : isLoadingPreview ? (
          /* Carregando prévia */
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.fgMuted }]}>
              {strings.import.loadingPreview}
            </Text>
          </View>
        ) : !selectedFile || !preview ? (
          /* Estado inicial: selecionar arquivo */
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: theme.elevated,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={[styles.emptyText, { color: theme.fgMuted }]}>
              {strings.import.emptyStateText}
            </Text>

            <TouchableOpacity
              style={[styles.pickFileButton, { backgroundColor: theme.accent }]}
              onPress={onPickFile}
              accessibilityRole="button"
              accessibilityLabel={strings.import.pickFile}
              activeOpacity={0.8}
            >
              <Text style={styles.pickFileButtonText}>{strings.import.pickFile}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Prévia do arquivo selecionado */
          <View style={styles.previewContainer}>
            {/* Informações do arquivo */}
            <View
              style={[
                styles.fileInfoCard,
                {
                  backgroundColor: theme.elevated,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.fileName, { color: theme.fg }]}>
                {strings.import.selectedFile(selectedFile.name, formatBytes(selectedFile.size))}
              </Text>

              {!isImporting && (
                <TouchableOpacity
                  style={styles.changeFileButton}
                  onPress={onPickFile}
                  accessibilityRole="button"
                  accessibilityLabel={strings.import.changeFile}
                >
                  <Text style={[styles.changeFileText, { color: theme.accent }]}>
                    {strings.import.changeFile}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Resumo da importação */}
            <View
              style={[
                styles.previewCard,
                {
                  backgroundColor: theme.elevated,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.previewTitle, { color: theme.fg }]}>
                {strings.import.previewTitle}
              </Text>

              {preview.hasFsrsData && (
                <View
                  style={[
                    styles.fsrsBadge,
                    {
                      backgroundColor: theme.elevated2,
                      borderColor: theme.accent,
                    },
                  ]}
                >
                  <Text style={[styles.fsrsBadgeText, { color: theme.accent }]}>
                    ✦ {strings.import.fsrsDetected}
                  </Text>
                </View>
              )}

              {preview.fileFormat === 'csv' && (
                <View
                  style={[
                    styles.fsrsBadge,
                    {
                      backgroundColor: theme.elevated2,
                      borderColor: theme.accent,
                    },
                  ]}
                >
                  <Text style={[styles.fsrsBadgeText, { color: theme.accent }]}>
                    ✦ {strings.import.csvDetected}
                  </Text>
                </View>
              )}

              {/* Estatísticas gerais */}
              <View style={styles.statsRow}>
                <View style={[styles.statBox, { backgroundColor: theme.elevated2 }]}>
                  <Text style={[styles.statValue, { color: theme.accent }]}>
                    {preview.totalNotes}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.fgMuted }]}>
                    {strings.import.notesCount(preview.totalNotes)}
                  </Text>
                </View>

                <View style={[styles.statBox, { backgroundColor: theme.elevated2 }]}>
                  <Text style={[styles.statValue, { color: theme.accent }]}>
                    {preview.totalCards}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.fgMuted }]}>
                    {strings.import.cardsCount(preview.totalCards)}
                  </Text>
                </View>

                {(preview.fileFormat !== 'csv' || preview.totalMedia > 0) && (
                  <View style={[styles.statBox, { backgroundColor: theme.elevated2 }]}>
                    <Text style={[styles.statValue, { color: theme.accent }]}>
                      {preview.totalMedia}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.fgMuted }]}>
                      {strings.import.mediaCount(preview.totalMedia)}
                    </Text>
                  </View>
                )}

                {preview.totalRevlogs !== undefined && preview.totalRevlogs > 0 && (
                  <View style={[styles.statBox, { backgroundColor: theme.elevated2 }]}>
                    <Text style={[styles.statValue, { color: theme.accent }]}>
                      {preview.totalRevlogs}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.fgMuted }]}>
                      {strings.import.revlogsCount(preview.totalRevlogs)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Lista de decks */}
              <Text style={[styles.decksSectionTitle, { color: theme.fg }]}>
                {strings.import.decksFound} ({preview.decks.length}):
              </Text>

              <View style={styles.deckList}>
                {preview.decks.map((deck) => (
                  <View
                    key={deck.sourceId}
                    style={[
                      styles.deckItem,
                      {
                        backgroundColor: theme.elevated2,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text style={[styles.deckName, { color: theme.fg }]}>{deck.name}</Text>
                    <Text style={[styles.deckCount, { color: theme.fgMuted }]}>
                      {strings.import.notesCount(deck.notesCount)} · {strings.import.cardsCount(deck.cardsCount)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Opções de Agendamento */}
              {(preview.hasExistingIntervals || preview.hasFsrsData) && (
                <View style={styles.scheduleSection}>
                  <Text style={[styles.scheduleSectionTitle, { color: theme.fg }]}>
                    {strings.import.scheduleModeTitle}
                  </Text>
                  <View style={styles.scheduleOptionsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.scheduleOptionCard,
                        {
                          backgroundColor:
                            scheduleMode === 'keep_intervals'
                              ? theme.elevated2
                              : theme.elevated,
                          borderColor:
                            scheduleMode === 'keep_intervals'
                              ? theme.accent
                              : theme.border,
                        },
                      ]}
                      onPress={() => onSelectScheduleMode?.('keep_intervals')}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: scheduleMode === 'keep_intervals' }}
                      accessibilityLabel={strings.import.keepIntervalsTitle}
                      activeOpacity={0.7}
                    >
                      <View style={styles.radioRow}>
                        <View
                          style={[
                            styles.radioCircle,
                            {
                              borderColor:
                                scheduleMode === 'keep_intervals'
                                  ? theme.accent
                                  : theme.border,
                            },
                          ]}
                        >
                          {scheduleMode === 'keep_intervals' && (
                            <View
                              style={[
                                styles.radioDot,
                                { backgroundColor: theme.accent },
                              ]}
                            />
                          )}
                        </View>
                        <View style={styles.scheduleTextContainer}>
                          <Text
                            style={[
                              styles.scheduleOptionTitle,
                              { color: theme.fg },
                            ]}
                          >
                            {strings.import.keepIntervalsTitle}
                          </Text>
                          <Text
                            style={[
                              styles.scheduleOptionSubtitle,
                              { color: theme.fgMuted },
                            ]}
                          >
                            {strings.import.keepIntervalsSubtitle}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.scheduleOptionCard,
                        {
                          backgroundColor:
                            scheduleMode === 'reset_new'
                              ? theme.elevated2
                              : theme.elevated,
                          borderColor:
                            scheduleMode === 'reset_new'
                              ? theme.accent
                              : theme.border,
                        },
                      ]}
                      onPress={() => onSelectScheduleMode?.('reset_new')}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: scheduleMode === 'reset_new' }}
                      accessibilityLabel={strings.import.resetNewTitle}
                      activeOpacity={0.7}
                    >
                      <View style={styles.radioRow}>
                        <View
                          style={[
                            styles.radioCircle,
                            {
                              borderColor:
                                scheduleMode === 'reset_new'
                                  ? theme.accent
                                  : theme.border,
                            },
                          ]}
                        >
                          {scheduleMode === 'reset_new' && (
                            <View
                              style={[
                                styles.radioDot,
                                { backgroundColor: theme.accent },
                              ]}
                            />
                          )}
                        </View>
                        <View style={styles.scheduleTextContainer}>
                          <Text
                            style={[
                              styles.scheduleOptionTitle,
                              { color: theme.fg },
                            ]}
                          >
                            {strings.import.resetNewTitle}
                          </Text>
                          <Text
                            style={[
                              styles.scheduleOptionSubtitle,
                              { color: theme.fgMuted },
                            ]}
                          >
                            {strings.import.resetNewSubtitle}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Barra de progresso durante importação */}
              {isImporting && (
                <View style={styles.progressContainer}>
                  <View
                    style={[
                      styles.progressBarTrack,
                      { backgroundColor: theme.elevated2 },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          backgroundColor: theme.accent,
                          width: `${Math.min(
                            100,
                            Math.max(
                              5,
                              progress?.total && progress.total > 0
                                ? (progress.current / progress.total) * 100
                                : 20
                            )
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressMessage, { color: theme.fgMuted }]}>
                    {progress?.message ?? strings.import.importingTitle}
                  </Text>
                </View>
              )}

              {/* Botão de ação */}
              {!isImporting && (
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: theme.accent }]}
                  onPress={onStartImport}
                  accessibilityRole="button"
                  accessibilityLabel={strings.import.importAction}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>{strings.import.importAction}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 22,
    fontWeight: '600',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyCard: {
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  pickFileButton: {
    height: 48,
    minHeight: 44,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickFileButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  previewContainer: {
    gap: 16,
  },
  fileInfoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  changeFileButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  changeFileText: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  decksSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  deckList: {
    gap: 8,
    marginBottom: 20,
  },
  deckItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deckName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  deckCount: {
    fontSize: 12,
    marginLeft: 8,
  },
  progressContainer: {
    marginVertical: 16,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressMessage: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  primaryButton: {
    height: 48,
    minHeight: 44,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 48,
    minHeight: 44,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  errorCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  errorRetryButton: {
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorRetryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  successCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 48,
    color: '#27ae60',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  successSummary: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  reimportSummary: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  actionRow: {
    width: '100%',
    gap: 8,
  },
  fsrsBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  fsrsBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  scheduleSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  scheduleOptionsContainer: {
    gap: 8,
  },
  scheduleOptionCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    minHeight: 48,
    justifyContent: 'center',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scheduleTextContainer: {
    flex: 1,
  },
  scheduleOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleOptionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
