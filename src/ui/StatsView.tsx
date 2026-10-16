import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from './theme';
import { strings } from './strings';
import { Heatmap } from './Heatmap';
import { Snackbar } from './Snackbar';
import type { ReviewStatsSummary } from '@/stats/types';
import { sendFeedbackEmail } from '@/feedback/feedbackService';
import { logError } from '@/logging';

export interface StatsViewProps {
  stats: ReviewStatsSummary | null;
  loading?: boolean;
  onRefresh?: () => void;
  onSettingsPress?: () => void;
  onExportText?: (text: string) => void;
  onSendFeedback?: () => void;
}

export function StatsView({
  stats,
  loading = false,
  onRefresh,
  onSettingsPress,
  onExportText,
  onSendFeedback,
}: StatsViewProps) {
  const { theme } = useTheme();
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>(
    strings.stats.exportSuccessSnackbar
  );

  const retentionPercent = React.useMemo(() => {
    if (!stats || stats.retentionReviewCount === 0) return '0%';
    return `${Math.round(stats.retentionRate * 100)}%`;
  }, [stats]);

  const handleExport = useCallback(async () => {
    if (!stats?.testStats?.exportText) return;

    try {
      if (onExportText) {
        onExportText(stats.testStats.exportText);
      } else {
        await Share.share({
          message: stats.testStats.exportText,
          title: strings.stats.testSectionTitle,
        });
      }
      setSnackbarMessage(strings.stats.exportSuccessSnackbar);
      setSnackbarVisible(true);
    } catch (err) {
      logError('StatsView', err, 'Falha ao exportar texto do teste');
      setSnackbarMessage(strings.stats.exportError);
      setSnackbarVisible(true);
    }
  }, [stats?.testStats?.exportText, onExportText]);

  const handleFeedback = useCallback(async () => {
    if (onSendFeedback) {
      onSendFeedback();
      return;
    }

    try {
      const res = await sendFeedbackEmail();
      if (res.success) {
        setSnackbarMessage(strings.feedback.emailSuccessSnackbar);
        setSnackbarVisible(true);
      } else {
        setSnackbarMessage(strings.feedback.emailAppNotFound);
        setSnackbarVisible(true);
      }
    } catch (err) {
      logError('StatsView', err, 'Falha ao enviar e-mail de feedback');
      setSnackbarMessage(strings.feedback.errorOpening);
      setSnackbarVisible(true);
    }
  }, [onSendFeedback]);

  return (
    <View style={styles.outerContainer}>
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
        {/* 1. Cabeçalho */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.fg }]}>
            {strings.stats.title}
          </Text>
          {onSettingsPress && (
            <TouchableOpacity
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

        {loading && !stats ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.fgMuted }]}>
              {strings.common.loading}
            </Text>
          </View>
        ) : stats ? (
          <>
            {/* 2. Card do Heatmap de Revisões */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.elevated, borderColor: theme.border },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardTitle, { color: theme.fg }]}>
                  {strings.stats.activitySection}
                </Text>
                <Text style={[styles.cardSubtitle, { color: theme.fgMuted }]}>
                  {strings.stats.weeksCountLabel(stats.heatmap.weeks.length)}
                </Text>
              </View>

              <Heatmap
                data={stats.heatmap}
                compact={false}
                showLegend={true}
                showSummary={true}
              />
            </View>

            {/* 3. Grid de Métricas Principais (Retenção e Totais) */}
            <View style={styles.metricsGrid}>
              {/* Card de Retenção Real */}
              <View
                style={[
                  styles.card,
                  styles.metricCard,
                  { backgroundColor: theme.elevated, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.metricLabel, { color: theme.fgMuted }]}>
                  {strings.stats.retentionRate}
                </Text>
                <Text style={[styles.metricValueLarge, { color: theme.accent }]}>
                  {retentionPercent}
                </Text>
                <Text style={[styles.metricDescription, { color: theme.fgMuted }]}>
                  {stats.retentionReviewCount > 0
                    ? strings.stats.retentionReviewsEvaluated(
                        stats.retentionReviewCount
                      )
                    : strings.stats.retentionDesc}
                </Text>
              </View>

              {/* Card de Sequência */}
              <View
                style={[
                  styles.card,
                  styles.metricCard,
                  { backgroundColor: theme.elevated, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.metricLabel, { color: theme.fgMuted }]}>
                  {strings.stats.streakLabel}
                </Text>
                <Text style={[styles.metricValueLarge, { color: theme.learn }]}>
                  🔥 {stats.streak}
                </Text>
                <Text style={[styles.metricDescription, { color: theme.fgMuted }]}>
                  {strings.stats.streakDays(stats.streak)}
                </Text>
              </View>
            </View>

            {/* 4. Resumo Geral de Revisões */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.elevated, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.fg, marginBottom: 14 }]}>
                {strings.stats.overviewSection}
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statItemValue, { color: theme.fg }]}>
                    {stats.totalReviews}
                  </Text>
                  <Text style={[styles.statItemLabel, { color: theme.fgMuted }]}>
                    {strings.stats.totalReviews}
                  </Text>
                </View>

                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

                <View style={styles.statItem}>
                  <Text style={[styles.statItemValue, { color: theme.fg }]}>
                    {stats.activeDays}
                  </Text>
                  <Text style={[styles.statItemLabel, { color: theme.fgMuted }]}>
                    {strings.stats.activeDays}
                  </Text>
                </View>

                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

                <View style={styles.statItem}>
                  <Text style={[styles.statItemValue, { color: theme.fg }]}>
                    {stats.averageReviewsPerActiveDay}
                  </Text>
                  <Text style={[styles.statItemLabel, { color: theme.fgMuted }]}>
                    {strings.stats.dailyAverage}
                  </Text>
                </View>
              </View>
            </View>

            {/* 5. Cards por Estado (PRD §6.8) */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.elevated, borderColor: theme.border },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardTitle, { color: theme.fg }]}>
                  {strings.stats.cardsSection}
                </Text>
                <Text style={[styles.cardSubtitle, { color: theme.fgMuted }]}>
                  {strings.stats.cardsTotal(stats.cardsByState.total)}
                </Text>
              </View>

              {/* Barra de distribuição proporcional */}
              {stats.cardsByState.total > 0 ? (
                <View style={styles.barContainer}>
                  {stats.cardsByState.new > 0 && (
                    <View
                      style={{
                        flex: stats.cardsByState.new,
                        backgroundColor: theme.accent,
                        height: 10,
                        borderTopLeftRadius: 5,
                        borderBottomLeftRadius: 5,
                      }}
                    />
                  )}
                  {stats.cardsByState.learning > 0 && (
                    <View
                      style={{
                        flex: stats.cardsByState.learning,
                        backgroundColor: theme.learn,
                        height: 10,
                      }}
                    />
                  )}
                  {stats.cardsByState.review > 0 && (
                    <View
                      style={{
                        flex: stats.cardsByState.review,
                        backgroundColor: theme.fg,
                        height: 10,
                      }}
                    />
                  )}
                  {stats.cardsByState.suspended > 0 && (
                    <View
                      style={{
                        flex: stats.cardsByState.suspended,
                        backgroundColor: theme.fgMuted,
                        height: 10,
                        borderTopRightRadius: 5,
                        borderBottomRightRadius: 5,
                      }}
                    />
                  )}
                </View>
              ) : null}

              {/* Badges dos estados */}
              <View style={styles.stateCountsGrid}>
                <View style={[styles.stateBadge, { backgroundColor: theme.elevated2 }]}>
                  <View style={[styles.stateDot, { backgroundColor: theme.accent }]} />
                  <Text style={[styles.stateNumber, { color: theme.fg }]}>
                    {stats.cardsByState.new}
                  </Text>
                  <Text style={[styles.stateLabel, { color: theme.fgMuted }]}>
                    {strings.stats.cardsNew}
                  </Text>
                </View>

                <View style={[styles.stateBadge, { backgroundColor: theme.elevated2 }]}>
                  <View style={[styles.stateDot, { backgroundColor: theme.learn }]} />
                  <Text style={[styles.stateNumber, { color: theme.fg }]}>
                    {stats.cardsByState.learning}
                  </Text>
                  <Text style={[styles.stateLabel, { color: theme.fgMuted }]}>
                    {strings.stats.cardsLearning}
                  </Text>
                </View>

                <View style={[styles.stateBadge, { backgroundColor: theme.elevated2 }]}>
                  <View style={[styles.stateDot, { backgroundColor: theme.fg }]} />
                  <Text style={[styles.stateNumber, { color: theme.fg }]}>
                    {stats.cardsByState.review}
                  </Text>
                  <Text style={[styles.stateLabel, { color: theme.fgMuted }]}>
                    {strings.stats.cardsReview}
                  </Text>
                </View>

                <View style={[styles.stateBadge, { backgroundColor: theme.elevated2 }]}>
                  <View style={[styles.stateDot, { backgroundColor: theme.fgMuted }]} />
                  <Text style={[styles.stateNumber, { color: theme.fg }]}>
                    {stats.cardsByState.suspended}
                  </Text>
                  <Text style={[styles.stateLabel, { color: theme.fgMuted }]}>
                    {strings.stats.cardsSuspended}
                  </Text>
                </View>
              </View>
            </View>

            {/* 6. Bloco "Estatísticas do teste" (PRD §4 e §6.8) */}
            {stats.testStats ? (
              <View
                style={[
                  styles.card,
                  styles.testSectionCard,
                  { backgroundColor: theme.elevated, borderColor: theme.border },
                ]}
              >
                {/* Cabeçalho do Bloco */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.testHeaderTitles}>
                    <Text style={[styles.cardTitle, { color: theme.fg }]}>
                      🧪 {strings.stats.testSectionTitle}
                    </Text>
                    <Text
                      style={[styles.cardSubtitle, { color: theme.fgMuted, marginTop: 2 }]}
                    >
                      {strings.stats.testSectionSubtitle}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.testGoalBadge,
                      {
                        backgroundColor:
                          stats.testStats.totalGoalsMet === 3
                            ? theme.accent
                            : theme.elevated2,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.testGoalBadgeText,
                        {
                          color:
                            stats.testStats.totalGoalsMet === 3
                              ? theme.elevated
                              : theme.fg,
                        },
                      ]}
                    >
                      {strings.stats.testGoalsMet(stats.testStats.totalGoalsMet, 3)}
                    </Text>
                  </View>
                </View>

                {/* Hipótese 1 */}
                <View
                  style={[
                    styles.hypothesisBox,
                    { backgroundColor: theme.elevated2, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.hypothesisHeader}>
                    <Text style={[styles.hypothesisTitle, { color: theme.fg }]}>
                      {strings.stats.hypothesis1Title}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: stats.testStats.hypothesis1.isMet
                            ? theme.accent
                            : theme.canvas,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          {
                            color: stats.testStats.hypothesis1.isMet
                              ? theme.elevated
                              : theme.fgMuted,
                          },
                        ]}
                      >
                        {stats.testStats.hypothesis1.isMet
                          ? `✓ ${strings.stats.statusMet}`
                          : strings.stats.statusInProgress}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.hypothesisTarget, { color: theme.fgMuted }]}>
                    {strings.stats.hypothesis1Target}
                  </Text>

                  {/* Barra de progresso da Hipótese 1 */}
                  <View
                    style={[
                      styles.progressTrack,
                      { backgroundColor: theme.border, marginTop: 8 },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: stats.testStats.hypothesis1.isMet
                            ? theme.accent
                            : theme.learn,
                          width: `${Math.min(
                            100,
                            Math.round(
                              (stats.testStats.hypothesis1.daysReviewedIn14Days / 14) *
                                100
                            )
                          )}%`,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.hypothesisFooterRow}>
                    <Text
                      style={[
                        styles.hypothesisHighlight,
                        {
                          color: stats.testStats.hypothesis1.isMet
                            ? theme.accent
                            : theme.fg,
                        },
                      ]}
                    >
                      {strings.stats.hypothesis1Progress(
                        stats.testStats.hypothesis1.daysReviewedIn14Days,
                        stats.testStats.hypothesis1.windowDays
                      )}
                    </Text>
                    <Text style={[styles.hypothesisDetail, { color: theme.fgMuted }]}>
                      {strings.stats.hypothesis1Details(
                        stats.testStats.hypothesis1.currentStreak,
                        stats.testStats.hypothesis1.totalReviews
                      )}
                    </Text>
                  </View>
                </View>

                {/* Hipótese 2 */}
                <View
                  style={[
                    styles.hypothesisBox,
                    { backgroundColor: theme.elevated2, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.hypothesisHeader}>
                    <Text style={[styles.hypothesisTitle, { color: theme.fg }]}>
                      {strings.stats.hypothesis2Title}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: stats.testStats.hypothesis2.isMet
                            ? theme.accent
                            : theme.canvas,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          {
                            color: stats.testStats.hypothesis2.isMet
                              ? theme.elevated
                              : theme.fgMuted,
                          },
                        ]}
                      >
                        {stats.testStats.hypothesis2.isMet
                          ? `✓ ${strings.stats.statusMet}`
                          : strings.stats.statusInProgress}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.hypothesisTarget, { color: theme.fgMuted }]}>
                    {strings.stats.hypothesis2Target}
                  </Text>

                  <View style={styles.hypothesisSubItemsRow}>
                    <View
                      style={[
                        styles.subMetricChip,
                        { backgroundColor: theme.elevated, borderColor: theme.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subMetricText,
                          {
                            color: stats.testStats.hypothesis2.isOpensMet
                              ? theme.accent
                              : theme.fg,
                          },
                        ]}
                      >
                        {stats.testStats.hypothesis2.isOpensMet ? '✓ ' : '○ '}
                        {strings.stats.hypothesis2Opens(
                          stats.testStats.hypothesis2.consultaOpenCount,
                          stats.testStats.hypothesis2.targetOpens
                        )}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.subMetricChip,
                        { backgroundColor: theme.elevated, borderColor: theme.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subMetricText,
                          {
                            color: stats.testStats.hypothesis2.isAnnotationsMet
                              ? theme.accent
                              : theme.fg,
                          },
                        ]}
                      >
                        {stats.testStats.hypothesis2.isAnnotationsMet ? '✓ ' : '○ '}
                        {strings.stats.hypothesis2Annotations(
                          stats.testStats.hypothesis2.annotationsCount,
                          stats.testStats.hypothesis2.targetAnnotations
                        )}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Hipótese 3 */}
                <View
                  style={[
                    styles.hypothesisBox,
                    { backgroundColor: theme.elevated2, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.hypothesisHeader}>
                    <Text style={[styles.hypothesisTitle, { color: theme.fg }]}>
                      {strings.stats.hypothesis3Title}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: stats.testStats.hypothesis3.isMet
                            ? theme.accent
                            : theme.canvas,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          {
                            color: stats.testStats.hypothesis3.isMet
                              ? theme.elevated
                              : theme.fgMuted,
                          },
                        ]}
                      >
                        {stats.testStats.hypothesis3.isMet
                          ? `✓ ${strings.stats.statusMet}`
                          : strings.stats.statusPending}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.hypothesisTarget, { color: theme.fgMuted }]}>
                    {strings.stats.hypothesis3Target}
                  </Text>

                  <Text
                    style={[
                      styles.hypothesisDetail,
                      {
                        color: stats.testStats.hypothesis3.isMet
                          ? theme.accent
                          : theme.fgMuted,
                        marginTop: 6,
                        fontWeight: stats.testStats.hypothesis3.isMet ? '600' : '400',
                      },
                    ]}
                  >
                    {stats.testStats.hypothesis3.isMet
                      ? strings.stats.hypothesis3Imported(
                          stats.testStats.hypothesis3.importedDecksCount,
                          stats.testStats.hypothesis3.importedCardsCount
                        )
                      : strings.stats.hypothesis3NotImported}
                  </Text>
                </View>

                {/* Botão "Exportar como texto" */}
                <TouchableOpacity
                  style={[
                    styles.exportButton,
                    { backgroundColor: theme.accent },
                  ]}
                  onPress={handleExport}
                  accessibilityRole="button"
                  accessibilityLabel={strings.stats.exportButton}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.exportButtonText, { color: theme.elevated }]}>
                    📤 {strings.stats.exportButton}
                  </Text>
                </TouchableOpacity>

                {/* Botão "Enviar feedback" */}
                <TouchableOpacity
                  style={[
                    styles.feedbackButton,
                    {
                      backgroundColor: theme.elevated,
                      borderColor: theme.border,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={handleFeedback}
                  accessibilityRole="button"
                  accessibilityLabel={strings.feedback.sendButton}
                  accessibilityHint={strings.feedback.sendButtonHint}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.feedbackButtonText, { color: theme.fg }]}>
                    💬 {strings.feedback.sendButton}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {/* Snackbar de confirmação ao exportar */}
      <Snackbar
        visible={snackbarVisible}
        message={snackbarMessage}
        durationMs={4000}
        onDismiss={() => setSnackbarVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 13,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
  },
  metricCard: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  metricValueLarge: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  metricDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemValue: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 2,
  },
  statItemLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
  },
  barContainer: {
    flexDirection: 'row',
    width: '100%',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 16,
    marginTop: 4,
  },
  stateCountsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  stateBadge: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  stateNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  stateLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  /* Estilos específicos do bloco "Estatísticas do teste" */
  testSectionCard: {
    paddingVertical: 20,
  },
  testHeaderTitles: {
    flex: 1,
    marginRight: 8,
  },
  testGoalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testGoalBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  hypothesisBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 10,
  },
  hypothesisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  hypothesisTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  hypothesisTarget: {
    fontSize: 12,
    lineHeight: 16,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  hypothesisFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  hypothesisHighlight: {
    fontSize: 13,
    fontWeight: '700',
  },
  hypothesisDetail: {
    fontSize: 12,
  },
  hypothesisSubItemsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  subMetricChip: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  subMetricText: {
    fontSize: 12,
    fontWeight: '600',
  },
  exportButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  exportButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  feedbackButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 16,
  },
  feedbackButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
