import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useTheme, type ThemeMode } from './theme';
import { strings } from './strings';
import { useBackup } from '@/backup/useBackup';
import { SettingsRepository, DEFAULT_SETTINGS, type FolioSettingsMap } from '@/db/repositories/settings';
import { getDb, type FolioDatabase } from '@/db/client';
import * as schema from '@/db/schema';
import { isNull } from 'drizzle-orm';
import { Snackbar } from './Snackbar';
import { useReminder } from '@/notifications/useReminder';
import { ReminderTimePickerModal } from './ReminderTimePickerModal';
import { useFeedback } from '@/feedback/useFeedback';
import { copyOrShareDiagnostic, logWarn } from '@/logging';

export interface SettingsViewProps {
  onBack?: () => void;
  db?: FolioDatabase;
  onRestoreSuccess?: () => void;
  onSendFeedback?: () => void;
}

export function SettingsView({
  onBack,
  db,
  onRestoreSuccess,
  onSendFeedback,
}: SettingsViewProps) {
  const { theme, mode: currentThemeMode, setThemeMode } = useTheme();
  const database = db ?? getDb();
  const [settingsRepo] = useState(() => new SettingsRepository(database));

  // Estado das configurações
  const [settingsValues, setSettingsValues] = useState<FolioSettingsMap>(() => ({
    ...DEFAULT_SETTINGS,
    theme: settingsRepo.get<ThemeMode>('theme') ?? 'system',
    buttonMode: settingsRepo.get<2 | 4>('buttonMode') ?? DEFAULT_SETTINGS.buttonMode,
    showHighlightsInReview:
      settingsRepo.get<boolean>('showHighlightsInReview') ?? DEFAULT_SETTINGS.showHighlightsInReview,
    newCardsPerDay: settingsRepo.get<number>('newCardsPerDay') ?? DEFAULT_SETTINGS.newCardsPerDay,
    maxReviewsPerDay: settingsRepo.get<number>('maxReviewsPerDay') ?? DEFAULT_SETTINGS.maxReviewsPerDay,
    desiredRetention: settingsRepo.get<number>('desiredRetention') ?? DEFAULT_SETTINGS.desiredRetention,
    dayRolloverHour: settingsRepo.get<number>('dayRolloverHour') ?? DEFAULT_SETTINGS.dayRolloverHour,
  }));

  // Estatísticas locais para o card de backup
  const [localStats, setLocalStats] = useState({
    decks: 0,
    cards: 0,
    annotations: 0,
    media: 0,
  });

  const loadLocalStats = () => {
    try {
      const decksCount = database
        .select({ id: schema.decks.id })
        .from(schema.decks)
        .where(isNull(schema.decks.deleted_at))
        .all().length;
      const cardsCount = database
        .select({ id: schema.cards.id })
        .from(schema.cards)
        .where(isNull(schema.cards.deleted_at))
        .all().length;
      const annCount = database
        .select({ id: schema.annotations.id })
        .from(schema.annotations)
        .where(isNull(schema.annotations.deleted_at))
        .all().length;
      const mediaCount = database
        .select({ id: schema.media.id })
        .from(schema.media)
        .where(isNull(schema.media.deleted_at))
        .all().length;

      setLocalStats({
        decks: decksCount,
        cards: cardsCount,
        annotations: annCount,
        media: mediaCount,
      });
    } catch (err) {
      logWarn('SettingsView', 'Falha ao carregar estatísticas locais de dados', String(err));
    }
  };

  useEffect(() => {
    loadLocalStats();
  }, [database]);

  // Hook de Backup
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  // Hook de Lembrete Diário
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const reminder = useReminder({
    db: database,
    onNotificationSent: (msg) => setSnackbarMessage(msg),
    onError: (err) => setSnackbarMessage(err),
  });

  const backup = useBackup({
    db: database,
    onExportSuccess: (res) => {
      setSnackbarMessage(strings.settings.exportSuccess(res.fileName));
    },
    onRestoreSuccess: (_res) => {
      loadLocalStats();
      setSnackbarMessage(strings.settings.restoreSuccess);
      onRestoreSuccess?.();
    },
  });

  // Hook de Feedback
  const feedback = useFeedback({
    onSuccess: (msg) => setSnackbarMessage(msg),
    onError: (err) => setSnackbarMessage(err),
  });

  // Atualização de configurações
  const handleUpdateSetting = <K extends keyof FolioSettingsMap>(
    key: K,
    value: FolioSettingsMap[K]
  ) => {
    settingsRepo.set(key, value);
    setSettingsValues((prev) => ({ ...prev, [key]: value }));

    if (key === 'theme') {
      setThemeMode(value as ThemeMode);
    }
  };

  const formatDate = (ms: number) => {
    try {
      return new Date(ms).toLocaleString('pt-BR');
    } catch {
      return '';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      {/* Cabeçalho */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.elevated, borderBottomColor: theme.border },
        ]}
      >
        {onBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={strings.settings.backButton}
            activeOpacity={0.7}
          >
            <Text style={[styles.backButtonText, { color: theme.accent }]}>
              ← {strings.settings.backButton}
            </Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, { color: theme.fg }]}>
          {strings.settings.title}
        </Text>
        {onBack && <View style={styles.backPlaceholder} />}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* SEÇÃO BACKUP */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.fgMuted }]}>
            {strings.settings.backupSectionTitle.toUpperCase()}
          </Text>

          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.elevated,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.cardDescription, { color: theme.fg }]}>
              {strings.settings.backupDescription}
            </Text>

            <View style={[styles.statsRow, { backgroundColor: theme.elevated2 }]}>
              <Text style={[styles.statsText, { color: theme.fgMuted }]}>
                {strings.backup.summaryCounts(
                  localStats.decks,
                  0,
                  localStats.cards,
                  localStats.annotations,
                  localStats.media
                ).replace(' · 0 notas', '')}
              </Text>
            </View>

            {backup.error && (
              <View style={[styles.errorBox, { backgroundColor: '#ffebee' }]}>
                <Text style={styles.errorText}>{backup.error}</Text>
              </View>
            )}

            <View style={styles.backupActionsRow}>
              <TouchableOpacity
                style={[
                  styles.backupActionButton,
                  { backgroundColor: theme.accent },
                ]}
                onPress={() => backup.exportBackupFile()}
                disabled={backup.isExporting || backup.isRestoring}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={strings.settings.exportBackupButton}
              >
                {backup.isExporting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.backupActionText}>
                    📦 {strings.settings.exportBackupButton}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.backupActionButton,
                  {
                    backgroundColor: theme.elevated2,
                    borderColor: theme.border,
                    borderWidth: 1,
                  },
                ]}
                onPress={() => backup.pickBackupFile()}
                disabled={backup.isExporting || backup.isRestoring || backup.isLoadingPreview}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={strings.settings.restoreBackupButton}
              >
                {backup.isLoadingPreview ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <Text style={[styles.backupActionSecondaryText, { color: theme.fg }]}>
                    📥 {strings.settings.restoreBackupButton}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* SEÇÃO APARÊNCIA */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.fgMuted }]}>
            {strings.settings.themeSectionTitle.toUpperCase()}
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
          >
            {(['system', 'light', 'dark'] as const).map((tMode) => {
              const selected = currentThemeMode === tMode;
              const label =
                tMode === 'system'
                  ? strings.settings.themeSystem
                  : tMode === 'light'
                  ? strings.settings.themeLight
                  : strings.settings.themeDark;
              return (
                <TouchableOpacity
                  key={tMode}
                  style={[
                    styles.radioOption,
                    { borderBottomColor: theme.border },
                  ]}
                  onPress={() => handleUpdateSetting('theme', tMode)}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.radioLabel,
                      { color: theme.fg, fontWeight: selected ? '700' : '400' },
                    ]}
                  >
                    {label}
                  </Text>
                  <View
                    style={[
                      styles.radioCircle,
                      { borderColor: selected ? theme.accent : theme.fgMuted },
                    ]}
                  >
                    {selected && (
                      <View
                        style={[
                          styles.radioInnerCircle,
                          { backgroundColor: theme.accent },
                        ]}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* SEÇÃO LEMBRETE DIÁRIO */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.fgMuted }]}>
            {strings.reminder.sectionTitle.toUpperCase()}
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
          >
            {/* Switch Lembrete Diário */}
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => reminder.toggleReminder(!reminder.enabled)}
              activeOpacity={0.7}
              accessibilityRole="switch"
              accessibilityState={{ checked: reminder.enabled }}
              accessibilityLabel={strings.reminder.enabledTitle}
            >
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.rowTitle, { color: theme.fg }]}>
                  {strings.reminder.enabledTitle}
                </Text>
                <Text style={[styles.rowSubtitle, { color: theme.fgMuted }]}>
                  {strings.reminder.enabledDesc}
                </Text>
              </View>
              <View
                style={[
                  styles.toggleTrack,
                  {
                    backgroundColor: reminder.enabled
                      ? theme.accent
                      : theme.elevated2,
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    reminder.enabled
                      ? styles.toggleThumbActive
                      : styles.toggleThumbInactive,
                  ]}
                />
              </View>
            </TouchableOpacity>

            {/* Se o lembrete estiver ativo, exibe Horário e Teste */}
            {reminder.enabled && (
              <View
                style={[
                  styles.reminderDetailBox,
                  { borderTopColor: theme.border },
                ]}
              >
                <View style={styles.reminderTimeRow}>
                  <View style={styles.toggleTextContainer}>
                    <Text style={[styles.rowTitle, { color: theme.fg }]}>
                      {strings.reminder.timeTitle}
                    </Text>
                    <Text style={[styles.rowSubtitle, { color: theme.fgMuted }]}>
                      {strings.reminder.timeDesc(reminder.time)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.changeTimeButton,
                      {
                        backgroundColor: theme.elevated2,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setIsTimePickerVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel={strings.reminder.modalTitle}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.changeTimeButtonText,
                        { color: theme.accent },
                      ]}
                    >
                      🕒 {reminder.time}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.testReminderButton,
                    {
                      backgroundColor: theme.elevated2,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => reminder.triggerTestNotification()}
                  disabled={reminder.isLoading}
                  accessibilityRole="button"
                  accessibilityLabel={strings.reminder.testNotificationButton}
                  activeOpacity={0.7}
                >
                  {reminder.isLoading ? (
                    <ActivityIndicator size="small" color={theme.accent} />
                  ) : (
                    <Text
                      style={[
                        styles.testReminderButtonText,
                        { color: theme.fg },
                      ]}
                    >
                      🔔 {strings.reminder.testNotificationButton}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* SEÇÃO AGENDAMENTO E ESTUDO */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.fgMuted }]}>
            {strings.settings.studySectionTitle.toUpperCase()}
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
          >
            {/* Modo de botões */}
            <Text style={[styles.rowTitle, { color: theme.fg }]}>
              {strings.settings.buttonMode}
            </Text>
            <View style={styles.segmentedRow}>
              <TouchableOpacity
                style={[
                  styles.segmentedButton,
                  settingsValues.buttonMode === 2
                    ? { backgroundColor: theme.accent }
                    : { backgroundColor: theme.elevated2 },
                ]}
                onPress={() => handleUpdateSetting('buttonMode', 2)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={strings.settings.buttonMode2}
              >
                <Text
                  style={[
                    styles.segmentedButtonText,
                    {
                      color:
                        settingsValues.buttonMode === 2 ? '#ffffff' : theme.fg,
                      fontWeight:
                        settingsValues.buttonMode === 2 ? '700' : '500',
                    },
                  ]}
                >
                  {strings.settings.buttonMode2}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentedButton,
                  settingsValues.buttonMode === 4
                    ? { backgroundColor: theme.accent }
                    : { backgroundColor: theme.elevated2 },
                ]}
                onPress={() => handleUpdateSetting('buttonMode', 4)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={strings.settings.buttonMode4}
              >
                <Text
                  style={[
                    styles.segmentedButtonText,
                    {
                      color:
                        settingsValues.buttonMode === 4 ? '#ffffff' : theme.fg,
                      fontWeight:
                        settingsValues.buttonMode === 4 ? '700' : '500',
                    },
                  ]}
                >
                  {strings.settings.buttonMode4}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Grifos na revisão */}
            <TouchableOpacity
              style={[styles.toggleRow, { borderTopColor: theme.border }]}
              onPress={() =>
                handleUpdateSetting(
                  'showHighlightsInReview',
                  !settingsValues.showHighlightsInReview
                )
              }
              activeOpacity={0.7}
            >
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.rowTitle, { color: theme.fg }]}>
                  {strings.settings.showHighlightsInReview}
                </Text>
                <Text style={[styles.rowSubtitle, { color: theme.fgMuted }]}>
                  {strings.settings.showHighlightsInReviewDesc}
                </Text>
              </View>
              <View
                style={[
                  styles.toggleTrack,
                  {
                    backgroundColor: settingsValues.showHighlightsInReview
                      ? theme.accent
                      : theme.elevated2,
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    settingsValues.showHighlightsInReview
                      ? styles.toggleThumbActive
                      : styles.toggleThumbInactive,
                  ]}
                />
              </View>
            </TouchableOpacity>

            {/* Virada do dia */}
            <View style={[styles.infoRow, { borderTopColor: theme.border }]}>
              <Text style={[styles.rowTitle, { color: theme.fg }]}>
                {strings.settings.dayRolloverHour}
              </Text>
              <Text style={[styles.infoValue, { color: theme.accent }]}>
                {strings.settings.dayRolloverHourDesc(
                  settingsValues.dayRolloverHour
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* SEÇÃO SOBRE E FEEDBACK */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.fgMuted }]}>
            {strings.feedback.sectionTitle.toUpperCase()}
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
          >
            <View style={styles.feedbackHeaderRow}>
              <View style={styles.feedbackTitleContainer}>
                <Text style={[styles.feedbackAppName, { color: theme.fg }]}>
                  {strings.feedback.aboutTitle}
                </Text>
                <Text style={[styles.feedbackVersionBadge, { color: theme.accent }]}>
                  {strings.feedback.versionLabel(feedback.versionInfo.appVersion)}
                </Text>
              </View>
            </View>

            <Text style={[styles.cardDescription, { color: theme.fg, marginTop: 4 }]}>
              {strings.feedback.description}
            </Text>

            <View
              style={[
                styles.privacyBox,
                { backgroundColor: theme.elevated2, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.privacyText, { color: theme.fgMuted }]}>
                {strings.feedback.privacyNotice}
              </Text>
            </View>

            <View style={styles.feedbackActionsRow}>
              <TouchableOpacity
                style={[
                  styles.feedbackPrimaryButton,
                  { backgroundColor: theme.accent },
                ]}
                onPress={() => {
                  if (onSendFeedback) {
                    onSendFeedback();
                  } else {
                    feedback.sendEmail();
                  }
                }}
                disabled={feedback.isOpening}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={strings.feedback.sendButton}
                accessibilityHint={strings.feedback.sendButtonHint}
              >
                {feedback.isOpening ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.feedbackPrimaryButtonText}>
                    ✉️ {strings.feedback.sendButton}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.feedbackSecondaryButton,
                  {
                    backgroundColor: theme.elevated2,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => feedback.openForm()}
                disabled={feedback.isOpening}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={strings.feedback.openFormButton}
                accessibilityHint={strings.feedback.openFormButtonHint}
              >
                <Text style={[styles.feedbackSecondaryButtonText, { color: theme.fg }]}>
                  🌐 {strings.feedback.openFormButton}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.feedbackSecondaryButton,
                  {
                    backgroundColor: theme.elevated2,
                    borderColor: theme.border,
                  },
                ]}
                onPress={async () => {
                  try {
                    const res = await copyOrShareDiagnostic();
                    if (res.action === 'shared' || res.action === 'copied') {
                      setSnackbarMessage(strings.diagnostics.copyDiagnosticSuccess);
                    }
                  } catch {
                    setSnackbarMessage(strings.diagnostics.copyDiagnosticError);
                  }
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={strings.diagnostics.copyDiagnosticButton}
                accessibilityHint={strings.diagnostics.copyDiagnosticHint}
              >
                <Text style={[styles.feedbackSecondaryButtonText, { color: theme.fg }]}>
                  📋 {strings.diagnostics.copyDiagnosticButton}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* MODAL DE RESTAURAÇÃO DE BACKUP */}
      <Modal
        visible={backup.preview !== null}
        transparent
        animationType="fade"
        onRequestClose={() => backup.reset()}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.fg }]}>
              {strings.backup.previewTitle}
            </Text>

            {backup.preview && (
              <>
                <Text style={[styles.modalSubtitle, { color: theme.fgMuted }]}>
                  {strings.backup.exportedAtLabel(
                    formatDate(backup.preview.exportedAt)
                  )}
                </Text>

                <View
                  style={[
                    styles.previewStatsBox,
                    { backgroundColor: theme.elevated2 },
                  ]}
                >
                  <Text style={[styles.previewStatsText, { color: theme.fg }]}>
                    {strings.backup.summaryCounts(
                      backup.preview.stats.decks,
                      backup.preview.stats.notes,
                      backup.preview.stats.cards,
                      backup.preview.stats.annotations,
                      backup.preview.mediaInZip
                    )}
                  </Text>
                </View>

                {/* Seletor de Modo de Restauração */}
                <Text style={[styles.modeSectionTitle, { color: theme.fg }]}>
                  {strings.backup.restoreModeTitle}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.modeOption,
                    backup.restoreMode === 'replace'
                      ? {
                          borderColor: theme.accent,
                          backgroundColor: theme.elevated2,
                        }
                      : { borderColor: theme.border },
                  ]}
                  onPress={() => backup.setRestoreMode('replace')}
                  activeOpacity={0.7}
                >
                  <View style={styles.modeTextContainer}>
                    <Text
                      style={[
                        styles.modeTitle,
                        {
                          color: theme.fg,
                          fontWeight:
                            backup.restoreMode === 'replace' ? '700' : '500',
                        },
                      ]}
                    >
                      {strings.backup.modeReplaceTitle}
                    </Text>
                    <Text style={[styles.modeSubtitle, { color: theme.fgMuted }]}>
                      {strings.backup.modeReplaceSubtitle}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeOption,
                    backup.restoreMode === 'merge'
                      ? {
                          borderColor: theme.accent,
                          backgroundColor: theme.elevated2,
                        }
                      : { borderColor: theme.border },
                  ]}
                  onPress={() => backup.setRestoreMode('merge')}
                  activeOpacity={0.7}
                >
                  <View style={styles.modeTextContainer}>
                    <Text
                      style={[
                        styles.modeTitle,
                        {
                          color: theme.fg,
                          fontWeight:
                            backup.restoreMode === 'merge' ? '700' : '500',
                        },
                      ]}
                    >
                      {strings.backup.modeMergeTitle}
                    </Text>
                    <Text style={[styles.modeSubtitle, { color: theme.fgMuted }]}>
                      {strings.backup.modeMergeSubtitle}
                    </Text>
                  </View>
                </TouchableOpacity>

                {backup.restoreProgress && (
                  <View style={styles.progressContainer}>
                    <ActivityIndicator size="small" color={theme.accent} />
                    <Text
                      style={[styles.progressMessage, { color: theme.fgMuted }]}
                    >
                      {backup.restoreProgress.message}
                    </Text>
                  </View>
                )}

                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.modalCancelButton,
                      { borderColor: theme.border },
                    ]}
                    onPress={() => backup.reset()}
                    disabled={backup.isRestoring}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.modalCancelText,
                        { color: theme.fgMuted },
                      ]}
                    >
                      {strings.backup.cancelButton}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalConfirmButton,
                      { backgroundColor: theme.accent },
                    ]}
                    onPress={() => backup.executeRestore()}
                    disabled={backup.isRestoring}
                    activeOpacity={0.8}
                  >
                    {backup.isRestoring ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.modalConfirmText}>
                        {strings.backup.confirmRestoreButton}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de seleção de horário do lembrete */}
      <ReminderTimePickerModal
        visible={isTimePickerVisible}
        currentTime={reminder.time}
        onSave={(newTime) => reminder.updateTime(newTime)}
        onClose={() => setIsTimePickerVisible(false)}
      />

      {/* Snackbar para confirmação de ações */}
      <Snackbar
        visible={snackbarMessage !== null}
        message={snackbarMessage ?? ''}
        durationMs={5000}
        onDismiss={() => setSnackbarMessage(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  backPlaceholder: {
    width: 60,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  statsRow: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  statsText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  backupActionsRow: {
    flexDirection: 'column',
    gap: 10,
  },
  backupActionButton: {
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backupActionText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  backupActionSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  errorBox: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 13,
    fontWeight: '500',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  radioLabel: {
    fontSize: 15,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInnerCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  rowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  segmentedButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentedButtonText: {
    fontSize: 13,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 6,
    borderTopWidth: 1,
  },
  toggleTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  toggleThumbInactive: {
    alignSelf: 'flex-start',
  },
  infoRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 8,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  previewStatsBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  previewStatsText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modeSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  modeOption: {
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 8,
  },
  modeTextContainer: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  modeSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  progressMessage: {
    fontSize: 13,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1.4,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  reminderDetailBox: {
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 8,
    gap: 12,
  },
  reminderTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  changeTimeButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeTimeButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  testReminderButton: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  testReminderButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  feedbackTitleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  feedbackAppName: {
    fontSize: 18,
    fontWeight: '700',
  },
  feedbackVersionBadge: {
    fontSize: 13,
    fontWeight: '600',
  },
  privacyBox: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 10,
  },
  privacyText: {
    fontSize: 12,
    lineHeight: 16,
  },
  feedbackActionsRow: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 4,
  },
  feedbackPrimaryButton: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  feedbackPrimaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  feedbackSecondaryButton: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  feedbackSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
