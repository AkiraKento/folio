import { useState, useCallback } from 'react';
import type { ThemeMode } from '@/ui/theme';
import type { StudyArea } from '@/db/sample-deck';
import {
  validateExamDate,
  formatExamDateInput,
  completeOnboarding,
} from './onboardingService';
import type {
  OnboardingPreferences,
  ExamDateValidation,
  CompleteOnboardingResult,
} from './types';

import type { FolioDatabase } from '@/db/client';

export interface UseOnboardingReturn {
  step: 1 | 2 | 3;
  area: StudyArea;
  dailyMinutes: number;
  hasExamDate: boolean;
  examDateRaw: string;
  theme: ThemeMode;
  examDateValidation: ExamDateValidation;
  isSubmitting: boolean;
  canProceed: boolean;
  setStep: (step: 1 | 2 | 3) => void;
  nextStep: () => void;
  prevStep: () => void;
  setArea: (area: StudyArea) => void;
  setDailyMinutes: (minutes: number) => void;
  setHasExamDate: (has: boolean) => void;
  handleExamDateChange: (text: string) => void;
  setTheme: (theme: ThemeMode) => void;
  finishOnboarding: (onSuccess?: (result: CompleteOnboardingResult) => void) => void;
}

export function useOnboarding(
  initialArea: StudyArea = 'medicina',
  db?: FolioDatabase
): UseOnboardingReturn {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [area, setArea] = useState<StudyArea>(initialArea);
  const [dailyMinutes, setDailyMinutes] = useState<number>(30);
  const [hasExamDate, setHasExamDate] = useState<boolean>(false);
  const [examDateRaw, setExamDateRaw] = useState<string>('');
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const examDateValidation = hasExamDate
    ? validateExamDate(examDateRaw)
    : { valid: true };

  const canProceed = step === 2 && hasExamDate ? examDateValidation.valid : true;

  const handleExamDateChange = useCallback((text: string) => {
    const formatted = formatExamDateInput(text);
    setExamDateRaw(formatted);
  }, []);

  const nextStep = useCallback(() => {
    setStep((prev) => (prev < 3 ? ((prev + 1) as 1 | 2 | 3) : prev));
  }, []);

  const prevStep = useCallback(() => {
    setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3) : prev));
  }, []);

  const finishOnboarding = useCallback(
    (onSuccess?: (result: CompleteOnboardingResult) => void) => {
      if (isSubmitting) return;
      setIsSubmitting(true);

      let examDateIso: string | null = null;
      if (hasExamDate && examDateValidation.valid) {
        const parts = examDateRaw.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        examDateIso = d.toISOString();
      }

      const prefs: OnboardingPreferences = {
        area,
        dailyMinutes,
        hasExamDate,
        examDateRaw,
        examDateIso,
        theme,
      };

      try {
        const result = completeOnboarding(prefs, db);
        if (onSuccess) {
          onSuccess(result);
        }
      } catch (err) {
        console.error('Erro ao concluir onboarding:', err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isSubmitting,
      hasExamDate,
      examDateValidation.valid,
      examDateRaw,
      area,
      dailyMinutes,
      theme,
      db,
    ]
  );

  return {
    step,
    area,
    dailyMinutes,
    hasExamDate,
    examDateRaw,
    theme,
    examDateValidation,
    isSubmitting,
    canProceed,
    setStep,
    nextStep,
    prevStep,
    setArea,
    setDailyMinutes,
    setHasExamDate,
    handleExamDateChange,
    setTheme,
    finishOnboarding,
  };
}
