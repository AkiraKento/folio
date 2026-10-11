import type { ThemeMode } from '@/ui/theme';
import type { StudyArea } from '@/db/sample-deck';

export type { StudyArea };

export interface OnboardingPreferences {
  area: StudyArea;
  dailyMinutes: number;
  hasExamDate: boolean;
  examDateRaw: string;
  examDateIso: string | null;
  theme: ThemeMode;
}

export interface ExamDateValidation {
  valid: boolean;
  daysRemaining?: number;
  isToday?: boolean;
  errorMessage?: string;
}

export interface CompleteOnboardingResult {
  completed: boolean;
  deckId: string;
  deckName: string;
  cardsCount: number;
}
