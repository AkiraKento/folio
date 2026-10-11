import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from './theme';
import { strings } from './strings';
import { CardView } from './CardView';
import type { UseReviewSessionReturn } from '@/review/types';
import { Rating } from '@/scheduler';

export interface ReviewViewProps {
  session: UseReviewSessionReturn;
  onBack: () => void;
  onEditCard?: (noteId: string) => void;
  onOpenConsulta?: (deckId: string, noteId?: string) => void;
}

export function ReviewView({
  session,
  onBack,
  onEditCard,
  onOpenConsulta,
}: ReviewViewProps) {
  const { theme, isDark } = useTheme();

  const {
    loading,
    deckName,
    currentCardData,
    isAnswerRevealed,
    nextReviewOptions,
    buttonMode,
    showHighlights,
    remainingCounts,
    reviewedCount,
    canUndo,
    isFinished,
    flipCard,
    answerCard,
    undo,
  } = session;

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.canvas }]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.fgMuted }]}>
          {strings.common.loading}
        </Text>
      </View>
    );
  }

  // Estado de sessão concluída
  if (isFinished || !currentCardData) {
    return (
      <View style={[styles.container, { backgroundColor: theme.canvas }]}>
        {/* Barra superior mínima */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={strings.review.backButton}
          >
            <Text style={[styles.headerButtonIcon, { color: theme.fg }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.fg }]} numberOfLines={1}>
            {deckName}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Mensagem de parabéns */}
        <View style={[styles.finishedContainer, styles.center]}>
          <View
            style={[
              styles.finishedIconCircle,
              { backgroundColor: theme.elevated2, borderColor: theme.accent },
            ]}
          >
            <Text style={[styles.finishedIconText, { color: theme.accent }]}>✓</Text>
          </View>
          <Text style={[styles.finishedTitle, { color: theme.fg }]}>
            {strings.review.emptyTitle}
          </Text>
          <Text style={[styles.finishedSubtitle, { color: theme.fgMuted }]}>
            {strings.review.emptySubtitle}
          </Text>

          {reviewedCount > 0 && (
            <View style={[styles.finishedBadge, { backgroundColor: theme.elevated2 }]}>
              <Text style={[styles.finishedBadgeText, { color: theme.fg }]}>
                {strings.review.reviewedCount(reviewedCount)}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.accent }]}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={strings.review.backToDecks}
          >
            <Text style={styles.primaryButtonText}>{strings.review.backToDecks}</Text>
          </TouchableOpacity>

          {onOpenConsulta && currentCardData?.deck.id && (
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                { backgroundColor: theme.elevated, borderColor: theme.border },
              ]}
              onPress={() => onOpenConsulta(currentCardData.deck.id)}
              accessibilityRole="button"
              accessibilityLabel={strings.review.openConsulta}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.fg }]}>
                {strings.review.openConsulta}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Cores semânticas dos botões de resposta
  const getButtonBg = (rating: Rating) => {
    switch (rating) {
      case Rating.Again:
        return isDark ? 'rgba(224, 69, 123, 0.16)' : 'rgba(224, 69, 123, 0.10)';
      case Rating.Hard:
        return isDark ? 'rgba(213, 151, 26, 0.16)' : 'rgba(184, 148, 31, 0.10)';
      case Rating.Good:
        return theme.accent;
      case Rating.Easy:
        return theme.elevated2;
      default:
        return theme.elevated2;
    }
  };

  const getButtonBorder = (rating: Rating) => {
    switch (rating) {
      case Rating.Again:
        return '#e0457b';
      case Rating.Hard:
        return theme.learn;
      case Rating.Good:
        return theme.accent;
      case Rating.Easy:
        return theme.border;
      default:
        return theme.border;
    }
  };

  const getButtonTextColor = (rating: Rating) => {
    if (rating === Rating.Good) {
      return '#ffffff';
    }
    return theme.fg;
  };

  const getButtonSubtextColor = (rating: Rating) => {
    if (rating === Rating.Good) {
      return 'rgba(255, 255, 255, 0.85)';
    }
    return theme.fgMuted;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      {/* 1. Barra superior */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={strings.review.backButton}
        >
          <Text style={[styles.headerButtonIcon, { color: theme.fg }]}>←</Text>
        </TouchableOpacity>

        {/* Título e contadores */}
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.fg }]} numberOfLines={1}>
            {deckName}
          </Text>
          <View style={styles.countsRow}>
            {remainingCounts.newCards > 0 && (
              <Text style={[styles.countBadge, { color: theme.accent }]}>
                {remainingCounts.newCards}
              </Text>
            )}
            {remainingCounts.learning > 0 && (
              <Text style={[styles.countBadge, { color: theme.learn }]}>
                {remainingCounts.learning}
              </Text>
            )}
            {remainingCounts.review > 0 && (
              <Text style={[styles.countBadge, { color: theme.fgMuted }]}>
                {remainingCounts.review}
              </Text>
            )}
          </View>
        </View>

        {/* Ações da barra superior */}
        <View style={styles.headerActions}>
          {/* Desfazer */}
          <TouchableOpacity
            style={[
              styles.headerButton,
              !canUndo && styles.headerButtonDisabled,
            ]}
            onPress={() => {
              if (canUndo) undo();
            }}
            disabled={!canUndo}
            accessibilityRole="button"
            accessibilityLabel={strings.review.undoReview}
          >
            <Text
              style={[
                styles.headerActionIcon,
                { color: canUndo ? theme.fg : theme.fgMuted },
              ]}
            >
              ↶
            </Text>
          </TouchableOpacity>

          {/* Editar */}
          {onEditCard && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => onEditCard(currentCardData.note.id)}
              accessibilityRole="button"
              accessibilityLabel={strings.review.editCard}
            >
              <Text style={[styles.headerActionIcon, { color: theme.fg }]}>✎</Text>
            </TouchableOpacity>
          )}

          {/* Abrir na Consulta */}
          {onOpenConsulta && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() =>
                onOpenConsulta(currentCardData.deck.id, currentCardData.note.id)
              }
              accessibilityRole="button"
              accessibilityLabel={strings.review.openInConsulta}
            >
              <Text style={[styles.headerActionIcon, { color: theme.fg }]}>📖</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Área Central do Card */}
      <View style={styles.cardArea}>
        <CardView
          html={isAnswerRevealed ? currentCardData.backHtml : currentCardData.frontHtml}
          side={isAnswerRevealed ? 'back' : 'front'}
          css={currentCardData.noteType.css ?? undefined}
          cardOrd={currentCardData.card.ord}
          tags={currentCardData.note.tags}
          annotations={currentCardData.annotations}
          showHighlights={showHighlights}
          style={styles.cardView}
        />
      </View>

      {/* 3. Barra Inferior de Ação / Avaliação */}
      <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.elevated }]}>
        {!isAnswerRevealed ? (
          // Frente: Botão "Mostrar resposta"
          <TouchableOpacity
            style={[styles.showAnswerButton, { backgroundColor: theme.accent }]}
            onPress={flipCard}
            accessibilityRole="button"
            accessibilityLabel={strings.review.showAnswer}
            activeOpacity={0.85}
          >
            <Text style={styles.showAnswerButtonText}>
              {strings.review.showAnswer}
            </Text>
          </TouchableOpacity>
        ) : (
          // Verso: Botões FSRS com próximo intervalo
          <View style={styles.ratingButtonsRow}>
            {nextReviewOptions.map((option) => {
              const bg = getButtonBg(option.rating);
              const borderColor = getButtonBorder(option.rating);
              const textColor = getButtonTextColor(option.rating);
              const subtextColor = getButtonSubtextColor(option.rating);

              return (
                <TouchableOpacity
                  key={option.rating}
                  style={[
                    styles.ratingButton,
                    {
                      backgroundColor: bg,
                      borderColor,
                    },
                  ]}
                  onPress={() => answerCard(option.rating)}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label}, próximo intervalo ${option.intervalText}`}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.ratingInterval, { color: subtextColor }]}>
                    {option.intervalText}
                  </Text>
                  <Text style={[styles.ratingLabel, { color: textColor }]}>
                    {buttonMode === 4 && option.rating === Rating.Good
                      ? strings.review.good4
                      : option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  headerButtonDisabled: {
    opacity: 0.35,
  },
  headerButtonIcon: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerActionIcon: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  countBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  cardArea: {
    flex: 1,
  },
  cardView: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  showAnswerButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showAnswerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  ratingButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  ratingButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingInterval: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  finishedContainer: {
    flex: 1,
    padding: 24,
  },
  finishedIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  finishedIconText: {
    fontSize: 36,
    fontWeight: '700',
  },
  finishedTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  finishedSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  finishedBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 28,
  },
  finishedBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    width: '100%',
    maxWidth: 280,
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    maxWidth: 280,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
