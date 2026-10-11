import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, type ThemeMode } from './theme';
import { strings } from './strings';
import type { UseOnboardingReturn } from '@/onboarding/useOnboarding';
import type { StudyArea } from '@/db/sample-deck';

export interface OnboardingViewProps {
  onboarding: UseOnboardingReturn;
  onFinish?: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  onboarding,
  onFinish,
}) => {
  const { theme, isDark } = useTheme();

  const {
    step,
    area,
    dailyMinutes,
    hasExamDate,
    examDateRaw,
    theme: chosenTheme,
    examDateValidation,
    isSubmitting,
    canProceed,
    nextStep,
    prevStep,
    setArea,
    setDailyMinutes,
    setHasExamDate,
    handleExamDateChange,
    setTheme,
    finishOnboarding,
  } = onboarding;

  const handleFinish = () => {
    finishOnboarding(() => {
      if (onFinish) {
        onFinish();
      }
    });
  };

  const areas: { id: StudyArea; icon: string; title: string; desc: string; deck: string }[] = [
    {
      id: 'medicina',
      icon: '🩺',
      title: strings.onboarding.step1.areas.medicina.title,
      desc: strings.onboarding.step1.areas.medicina.description,
      deck: strings.onboarding.step1.areas.medicina.deckName,
    },
    {
      id: 'concursos',
      icon: '🏛️',
      title: strings.onboarding.step1.areas.concursos.title,
      desc: strings.onboarding.step1.areas.concursos.description,
      deck: strings.onboarding.step1.areas.concursos.deckName,
    },
    {
      id: 'direito',
      icon: '⚖️',
      title: strings.onboarding.step1.areas.direito.title,
      desc: strings.onboarding.step1.areas.direito.description,
      deck: strings.onboarding.step1.areas.direito.deckName,
    },
    {
      id: 'psicologia',
      icon: '🧠',
      title: strings.onboarding.step1.areas.psicologia.title,
      desc: strings.onboarding.step1.areas.psicologia.description,
      deck: strings.onboarding.step1.areas.psicologia.deckName,
    },
    {
      id: 'geral',
      icon: '📚',
      title: strings.onboarding.step1.areas.geral.title,
      desc: strings.onboarding.step1.areas.geral.description,
      deck: strings.onboarding.step1.areas.geral.deckName,
    },
  ];

  const paceOptions: { minutes: number; label: string }[] = [
    { minutes: 15, label: strings.onboarding.step2.paceOptions.min15 },
    { minutes: 30, label: strings.onboarding.step2.paceOptions.min30 },
    { minutes: 45, label: strings.onboarding.step2.paceOptions.min45 },
    { minutes: 60, label: strings.onboarding.step2.paceOptions.min60 },
  ];

  const themeOptions: {
    id: ThemeMode;
    icon: string;
    title: string;
    desc: string;
    colors: [string, string, string];
  }[] = [
    {
      id: 'system',
      icon: '📱',
      title: strings.onboarding.step3.themeOptions.system.title,
      desc: strings.onboarding.step3.themeOptions.system.description,
      colors: ['#f0f4f0', '#031417', '#3a9d7f'],
    },
    {
      id: 'light',
      icon: '☀️',
      title: strings.onboarding.step3.themeOptions.light.title,
      desc: strings.onboarding.step3.themeOptions.light.description,
      colors: ['#f0f4f0', '#ffffff', '#3a9d7f'],
    },
    {
      id: 'dark',
      icon: '🌙',
      title: strings.onboarding.step3.themeOptions.dark.title,
      desc: strings.onboarding.step3.themeOptions.dark.description,
      colors: ['#031417', '#062e32', '#169fb1'],
    },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.canvas }]}
      edges={['top', 'bottom']}
    >
      {/* Top Header: Badge e Indicador de Progresso */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <Text style={[styles.badgeText, { color: theme.accent }]}>
            {strings.onboarding.welcomeBadge}
          </Text>
          <Text style={[styles.stepCounterText, { color: theme.fgMuted }]}>
            {strings.onboarding.stepCounter(step, 3)}
          </Text>
        </View>

        {/* 3 Barras de Progresso */}
        <View style={styles.progressRow}>
          {[1, 2, 3].map((stepNum) => (
            <View
              key={stepNum}
              style={[
                styles.progressBar,
                {
                  backgroundColor:
                    step >= stepNum ? theme.accent : isDark ? '#083f44' : '#e0e6e6',
                },
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* PASSO 1: ÁREA DE ESTUDO */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: theme.fg }]}>
              {strings.onboarding.step1.title}
            </Text>
            <Text style={[styles.stepSubtitle, { color: theme.fgMuted }]}>
              {strings.onboarding.step1.subtitle}
            </Text>

            <View style={styles.optionsList}>
              {areas.map((item) => {
                const isSelected = area === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.areaCard,
                      {
                        backgroundColor: isSelected ? theme.elevated2 : theme.elevated,
                        borderColor: isSelected ? theme.accent : theme.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                    onPress={() => setArea(item.id)}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={item.title}
                  >
                    <Text style={styles.areaIcon}>{item.icon}</Text>
                    <View style={styles.areaTextContainer}>
                      <Text style={[styles.areaTitle, { color: theme.fg }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.areaDesc, { color: theme.fgMuted }]}>
                        {item.desc}
                      </Text>
                      <Text style={[styles.areaDeck, { color: theme.accent }]}>
                        📖 {item.deck}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radioIndicator,
                        {
                          borderColor: isSelected ? theme.accent : theme.border,
                          backgroundColor: isSelected ? theme.accent : 'transparent',
                        },
                      ]}
                    >
                      {isSelected && <Text style={styles.radioCheck}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* PASSO 2: RITMO E DATA DA PROVA */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: theme.fg }]}>
              {strings.onboarding.step2.title}
            </Text>
            <Text style={[styles.stepSubtitle, { color: theme.fgMuted }]}>
              {strings.onboarding.step2.subtitle}
            </Text>

            {/* Minutos diários */}
            <Text style={[styles.sectionTitle, { color: theme.fg }]}>
              {strings.onboarding.step2.timeSectionTitle}
            </Text>
            <View style={styles.optionsList}>
              {paceOptions.map((opt) => {
                const isSelected = dailyMinutes === opt.minutes;
                return (
                  <TouchableOpacity
                    key={opt.minutes}
                    style={[
                      styles.choiceCard,
                      {
                        backgroundColor: isSelected ? theme.elevated2 : theme.elevated,
                        borderColor: isSelected ? theme.accent : theme.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                    onPress={() => setDailyMinutes(opt.minutes)}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={opt.label}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        {
                          color: theme.fg,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <View
                      style={[
                        styles.radioIndicator,
                        {
                          borderColor: isSelected ? theme.accent : theme.border,
                          backgroundColor: isSelected ? theme.accent : 'transparent',
                        },
                      ]}
                    >
                      {isSelected && <Text style={styles.radioCheck}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Data da prova */}
            <Text style={[styles.sectionTitle, { color: theme.fg, marginTop: 20 }]}>
              {strings.onboarding.step2.examSectionTitle}
            </Text>

            <View style={styles.examToggleContainer}>
              <TouchableOpacity
                style={[
                  styles.examToggleBtn,
                  {
                    backgroundColor: !hasExamDate ? theme.elevated2 : theme.elevated,
                    borderColor: !hasExamDate ? theme.accent : theme.border,
                    borderWidth: !hasExamDate ? 2 : 1,
                  },
                ]}
                onPress={() => setHasExamDate(false)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={strings.onboarding.step2.examChoiceNoDate}
              >
                <Text
                  style={[
                    styles.examToggleText,
                    { color: !hasExamDate ? theme.accent : theme.fgMuted },
                  ]}
                >
                  {strings.onboarding.step2.examChoiceNoDate}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.examToggleBtn,
                  {
                    backgroundColor: hasExamDate ? theme.elevated2 : theme.elevated,
                    borderColor: hasExamDate ? theme.accent : theme.border,
                    borderWidth: hasExamDate ? 2 : 1,
                  },
                ]}
                onPress={() => setHasExamDate(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={strings.onboarding.step2.examChoiceHasDate}
              >
                <Text
                  style={[
                    styles.examToggleText,
                    { color: hasExamDate ? theme.accent : theme.fgMuted },
                  ]}
                >
                  {strings.onboarding.step2.examChoiceHasDate}
                </Text>
              </TouchableOpacity>
            </View>

            {hasExamDate && (
              <View style={styles.examDateInputWrapper}>
                <Text style={[styles.inputLabel, { color: theme.fg }]}>
                  {strings.onboarding.step2.examDateLabel}
                </Text>
                <TextInput
                  style={[
                    styles.dateInput,
                    {
                      backgroundColor: theme.elevated,
                      borderColor:
                        examDateRaw.length >= 10 && !examDateValidation.valid
                          ? '#e0457b'
                          : theme.border,
                      color: theme.fg,
                    },
                  ]}
                  value={examDateRaw}
                  onChangeText={handleExamDateChange}
                  placeholder={strings.onboarding.step2.examDatePlaceholder}
                  placeholderTextColor={theme.fgMuted}
                  keyboardType="numeric"
                  maxLength={10}
                  accessibilityLabel={strings.onboarding.step2.examDateLabel}
                />

                {examDateRaw.length >= 10 && !examDateValidation.valid && (
                  <Text style={styles.errorText}>
                    {examDateValidation.errorMessage}
                  </Text>
                )}

                {hasExamDate && examDateValidation.valid && examDateRaw.length === 10 && (
                  <View style={[styles.daysNotice, { backgroundColor: theme.elevated2 }]}>
                    <Text style={[styles.daysNoticeText, { color: theme.accent }]}>
                      {examDateValidation.isToday
                        ? strings.onboarding.step2.examDateToday
                        : strings.onboarding.step2.examDateDaysRemaining(
                            examDateValidation.daysRemaining ?? 0
                          )}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* PASSO 3: TEMA */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: theme.fg }]}>
              {strings.onboarding.step3.title}
            </Text>
            <Text style={[styles.stepSubtitle, { color: theme.fgMuted }]}>
              {strings.onboarding.step3.subtitle}
            </Text>

            <View style={styles.optionsList}>
              {themeOptions.map((item) => {
                const isSelected = chosenTheme === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.themeCard,
                      {
                        backgroundColor: isSelected ? theme.elevated2 : theme.elevated,
                        borderColor: isSelected ? theme.accent : theme.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                    onPress={() => setTheme(item.id)}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={item.title}
                  >
                    <Text style={styles.areaIcon}>{item.icon}</Text>
                    <View style={styles.areaTextContainer}>
                      <Text style={[styles.areaTitle, { color: theme.fg }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.areaDesc, { color: theme.fgMuted }]}>
                        {item.desc}
                      </Text>
                      {/* Paleta de cores da prévia */}
                      <View style={styles.paletteRow}>
                        {item.colors.map((c, i) => (
                          <View
                            key={i}
                            style={[styles.colorSwatch, { backgroundColor: c }]}
                          />
                        ))}
                      </View>
                    </View>
                    <View
                      style={[
                        styles.radioIndicator,
                        {
                          borderColor: isSelected ? theme.accent : theme.border,
                          backgroundColor: isSelected ? theme.accent : 'transparent',
                        },
                      ]}
                    >
                      {isSelected && <Text style={styles.radioCheck}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer Fixo: Ações Voltar / Continuar / Concluir */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.elevated,
            borderTopColor: theme.border,
          },
        ]}
      >
        {step > 1 ? (
          <TouchableOpacity
            style={[styles.backButton, { borderColor: theme.border }]}
            onPress={prevStep}
            disabled={isSubmitting}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={strings.onboarding.backAction}
          >
            <Text style={[styles.backButtonText, { color: theme.fg }]}>
              {strings.onboarding.backAction}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        {step < 3 ? (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: canProceed ? theme.accent : theme.border,
                opacity: canProceed ? 1 : 0.6,
              },
            ]}
            onPress={nextStep}
            disabled={!canProceed}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={strings.onboarding.continueAction}
          >
            <Text style={styles.primaryButtonText}>
              {strings.onboarding.continueAction}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: theme.accent,
                opacity: isSubmitting ? 0.8 : 1,
              },
            ]}
            onPress={handleFinish}
            disabled={isSubmitting}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={strings.onboarding.finishAction}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {strings.onboarding.finishAction}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stepCounterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  stepContainer: {
    paddingTop: 12,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 28,
  },
  stepSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  optionsList: {
    gap: 12,
  },
  areaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    minHeight: 64,
  },
  areaIcon: {
    fontSize: 26,
    marginRight: 14,
  },
  areaTextContainer: {
    flex: 1,
  },
  areaTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  areaDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  areaDeck: {
    fontSize: 12,
    fontWeight: '600',
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    minHeight: 52,
  },
  choiceText: {
    fontSize: 15,
  },
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    minHeight: 64,
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  colorSwatch: {
    width: 20,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  radioIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  radioCheck: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  examToggleContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  examToggleBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  examToggleText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  examDateInputWrapper: {
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  dateInput: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  errorText: {
    color: '#e0457b',
    fontSize: 12,
    marginTop: 4,
  },
  daysNotice: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
  },
  daysNoticeText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  backPlaceholder: {
    width: 90,
  },
  backButton: {
    width: 90,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
