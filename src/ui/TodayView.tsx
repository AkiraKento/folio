import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from './theme';
import { strings } from './strings';
import { Heatmap } from './Heatmap';
import type { TodaySummary } from '@/today/types';
import type { ContinueReadingInfo } from './DecksScreen';
import { logWarn } from '@/logging';

export interface TodayViewProps {
  summary: TodaySummary | null;
  continueReading?: ContinueReadingInfo | null;
  loading?: boolean;
  onRefresh?: () => void;
  onStudy: () => void;
  onOpenDecks: () => void;
  onContinueReading?: (deckId: string) => void;
  onSettingsPress?: () => void;
  onOpenStats?: () => void;
}

export function TodayView({
  summary,
  continueReading,
  loading = false,
  onRefresh,
  onStudy,
  onOpenDecks,
  onContinueReading,
  onSettingsPress,
  onOpenStats,
}: TodayViewProps) {
  const { theme } = useTheme();

  const formattedDate = React.useMemo(() => {
    try {
      const now = new Date();
      return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(now);
    } catch (err) {
      logWarn('TodayView', 'Falha ao formatar data do cabeçalho', String(err));
      return '';
    }
  }, []);

  const capitalizedDate = formattedDate
    ? formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)
    : '';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.canvas }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        ) : undefined
      }
    >
      {/* 1. Header calmo */}
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <Text style={[styles.appTitle, { color: theme.fg }]}>{strings.common.appName}</Text>
          {capitalizedDate ? (
            <Text style={[styles.dateText, { color: theme.fgMuted }]}>{capitalizedDate}</Text>
          ) : null}
        </View>
        {onSettingsPress && (
          <TouchableOpacity
            testID="today-settings-button"
            style={[
              styles.settingsButton,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
            onPress={onSettingsPress}
            accessibilityRole="button"
            accessibilityLabel={strings.settings.title}
            activeOpacity={0.7}
          >
            <Text style={styles.settingsButtonText}>⚙️</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && !summary ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.fgMuted }]}>
            {strings.common.loading}
          </Text>
        </View>
      ) : summary ? (
        <>
          {/* 2. Card de Sequência (Streak) */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
          >
            <View style={styles.streakHeader}>
              <View style={[styles.streakIconContainer, { backgroundColor: theme.elevated2 }]}>
                <Text style={styles.streakEmoji}>🔥</Text>
              </View>
              <View style={styles.streakInfo}>
                <Text style={[styles.streakCount, { color: theme.fg }]}>
                  {strings.today.streakDays(summary.streak)}
                </Text>
                <Text style={[styles.streakLabel, { color: theme.fgMuted }]}>
                  {strings.today.streakLabel}
                </Text>
              </View>
            </View>

            <View style={styles.streakStatusRow}>
              <View
                style={[
                  styles.streakDot,
                  {
                    backgroundColor: summary.studiedToday
                      ? theme.accent
                      : summary.streak > 0
                        ? theme.learn
                        : theme.border,
                  },
                ]}
              />
              <Text
                style={[
                  styles.streakStatusText,
                  {
                    color: summary.studiedToday
                      ? theme.accent
                      : summary.streak > 0
                        ? theme.learn
                        : theme.fgMuted,
                  },
                ]}
              >
                {summary.studiedToday
                  ? strings.today.streakActive
                  : summary.streak > 0
                    ? strings.today.streakPending
                    : strings.today.streakNone}
              </Text>
            </View>
          </View>

          {/* 3. Card Principal de Estudo / Pendentes */}
          <View
            style={[
              styles.card,
              styles.studyCard,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
          >
            {summary.pendingCount > 0 ? (
              <>
                <Text style={[styles.pendingSummaryText, { color: theme.fg }]}>
                  {strings.today.pendingSummary(
                    summary.pendingCount,
                    summary.estimatedMinutesText
                  )}
                </Text>

                {/* Badges de contagem: novos / aprendendo / revisão */}
                <View style={styles.countsRow}>
                  <View style={[styles.countBadge, { backgroundColor: theme.elevated2 }]}>
                    <Text style={[styles.countNumber, { color: theme.accent }]}>
                      {summary.newCount}
                    </Text>
                    <Text style={[styles.countLabel, { color: theme.fgMuted }]}>
                      {strings.today.newCards}
                    </Text>
                  </View>

                  <View style={[styles.countBadge, { backgroundColor: theme.elevated2 }]}>
                    <Text style={[styles.countNumber, { color: theme.learn }]}>
                      {summary.learningCount}
                    </Text>
                    <Text style={[styles.countLabel, { color: theme.fgMuted }]}>
                      {strings.today.learningCards}
                    </Text>
                  </View>

                  <View style={[styles.countBadge, { backgroundColor: theme.elevated2 }]}>
                    <Text style={[styles.countNumber, { color: theme.fg }]}>
                      {summary.reviewCount}
                    </Text>
                    <Text style={[styles.countLabel, { color: theme.fgMuted }]}>
                      {strings.today.reviewCards}
                    </Text>
                  </View>
                </View>

                {/* Botão grande Estudar */}
                <TouchableOpacity
                  style={[styles.studyButton, { backgroundColor: theme.accent }]}
                  onPress={onStudy}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={strings.today.studyButton}
                >
                  <Text style={styles.studyButtonText}>{strings.today.studyButton}</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Estado quando tudo foi revisado */
              <View style={styles.allDoneContainer}>
                <View
                  style={[
                    styles.doneCheckCircle,
                    { backgroundColor: theme.elevated2, borderColor: theme.accent },
                  ]}
                >
                  <Text style={[styles.doneCheckText, { color: theme.accent }]}>✓</Text>
                </View>

                <Text style={[styles.allDoneTitle, { color: theme.fg }]}>
                  {strings.today.allDoneTitle}
                </Text>
                <Text style={[styles.allDoneSubtitle, { color: theme.fgMuted }]}>
                  {strings.today.allDoneSubtitle}
                </Text>

                {summary.reviewedTodayCount > 0 ? (
                  <View
                    style={[
                      styles.reviewedTodayBadge,
                      { backgroundColor: theme.elevated2 },
                    ]}
                  >
                    <Text style={[styles.reviewedTodayText, { color: theme.fgMuted }]}>
                      {strings.today.reviewedTodayCount(summary.reviewedTodayCount)}
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.viewDecksButton,
                    { borderColor: theme.border, backgroundColor: theme.canvas },
                  ]}
                  onPress={onOpenDecks}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={strings.today.allDoneAction}
                >
                  <Text style={[styles.viewDecksButtonText, { color: theme.fg }]}>
                    {strings.today.allDoneAction}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 4. Heatmap de Atividade Recente (P1) */}
          {summary.heatmap && (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.elevated, borderColor: theme.border },
              ]}
            >
              <View style={styles.heatmapHeaderRow}>
                <View style={styles.heatmapTitleGroup}>
                  <Text style={[styles.heatmapTitle, { color: theme.fg }]}>
                    {strings.today.heatmapTitle}
                  </Text>
                  <Text style={[styles.heatmapSubtitle, { color: theme.fgMuted }]}>
                    {strings.heatmap.reviewsCount(summary.heatmap.totalReviews)}
                  </Text>
                </View>
                {onOpenStats && (
                  <TouchableOpacity
                    onPress={onOpenStats}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={strings.today.viewFullStats}
                    style={styles.viewStatsBtn}
                  >
                    <Text style={[styles.viewStatsText, { color: theme.accent }]}>
                      {strings.tabs.stats} ›
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Heatmap
                data={summary.heatmap}
                compact={true}
                showLegend={true}
                showSummary={false}
              />
            </View>
          )}

          {/* 5. Card "Continuar lendo" da Consulta (se houver histórico) */}
          {continueReading && onContinueReading ? (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.elevated, borderColor: theme.border },
              ]}
            >
              <View style={styles.readingHeader}>
                <View style={styles.readingInfo}>
                  <Text style={[styles.readingTitle, { color: theme.fg }]}>
                    {strings.today.continueReadingTitle}
                  </Text>
                  <Text style={[styles.readingSubtitle, { color: theme.fgMuted }]}>
                    {strings.today.continueReadingSubtitle(
                      continueReading.deckName,
                      continueReading.unitIndex + 1
                    )}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.readingActionBtn, { backgroundColor: theme.elevated2 }]}
                  onPress={() => onContinueReading(continueReading.deckId)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={strings.today.continueReadingAction}
                >
                  <Text style={[styles.readingActionText, { color: theme.accent }]}>
                    {strings.today.continueReadingAction}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* 5. Acesso aos Decks */}
          <TouchableOpacity
            style={[
              styles.navCard,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
            onPress={onOpenDecks}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={strings.today.allDoneAction}
          >
            <Text style={[styles.navCardTitle, { color: theme.fg }]}>
              {strings.tabs.decks}
            </Text>
            <Text style={[styles.navCardArrow, { color: theme.fgMuted }]}>›</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitleGroup: {
    flex: 1,
  },
  settingsButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonText: {
    fontSize: 18,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: 14,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  streakIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  streakEmoji: {
    fontSize: 22,
  },
  streakInfo: {
    flex: 1,
  },
  streakCount: {
    fontSize: 20,
    fontWeight: '700',
  },
  streakLabel: {
    fontSize: 13,
    marginTop: 1,
  },
  streakStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  streakStatusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  studyCard: {
    paddingVertical: 22,
  },
  pendingSummaryText: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  countsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  },
  countBadge: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  countNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  countLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  studyButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studyButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  allDoneContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  doneCheckCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  doneCheckText: {
    fontSize: 28,
    fontWeight: '700',
  },
  allDoneTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  allDoneSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  reviewedTodayBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 18,
  },
  reviewedTodayText: {
    fontSize: 13,
    fontWeight: '500',
  },
  viewDecksButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDecksButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  readingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readingInfo: {
    flex: 1,
    marginRight: 12,
  },
  readingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  readingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  readingActionBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readingActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  navCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navCardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  navCardArrow: {
    fontSize: 20,
    fontWeight: '500',
  },
  heatmapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heatmapTitleGroup: {
    flex: 1,
  },
  heatmapTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  heatmapSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  viewStatsBtn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewStatsText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
