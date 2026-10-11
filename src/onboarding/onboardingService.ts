import type { FolioDatabase } from '@/db/client';
import { getDb } from '@/db/client';
import { SettingsRepository } from '@/db/repositories/settings';
import { loadSampleDeck } from '@/db/sample-deck';
import { setAppThemeMode } from '@/ui/theme';
import { strings } from '@/ui/strings';
import type {
  OnboardingPreferences,
  ExamDateValidation,
  CompleteOnboardingResult,
} from './types';

/**
 * Valida uma string de data no formato DD/MM/AAAA.
 * Deve ser uma data válida de calendário e deve ser hoje ou no futuro.
 */
export function validateExamDate(
  dateStr: string,
  referenceDate: Date = new Date()
): ExamDateValidation {
  const trimmed = dateStr.trim();
  const parts = trimmed.split('/');

  if (parts.length !== 3) {
    return {
      valid: false,
      errorMessage: strings.onboarding.step2.examDateInvalid,
    };
  }

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return {
      valid: false,
      errorMessage: strings.onboarding.step2.examDateInvalid,
    };
  }

  if (month < 1 || month > 12 || year < 2024 || year > 2100) {
    return {
      valid: false,
      errorMessage: strings.onboarding.step2.examDateInvalid,
    };
  }

  // Verifica validade dos dias no mês especificado
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return {
      valid: false,
      errorMessage: strings.onboarding.step2.examDateInvalid,
    };
  }

  // Compara com a data de referência normalizada para o início do dia
  const refStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const targetStart = new Date(year, month - 1, day);

  const diffMs = targetStart.getTime() - refStart.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      valid: false,
      errorMessage: strings.onboarding.step2.examDateInvalid,
    };
  }

  return {
    valid: true,
    daysRemaining: diffDays,
    isToday: diffDays === 0,
  };
}

/**
 * Formata a digitação do campo de data adicionando as barras automaticamente (DD/MM/AAAA).
 */
export function formatExamDateInput(text: string): string {
  // Mantém apenas dígitos (máximo 8 dígitos: DDMMAAAA)
  const digits = text.replace(/\D/g, '').slice(0, 8);

  if (digits.length < 2) {
    return digits;
  }
  if (digits.length === 2) {
    return `${digits}/`;
  }
  if (digits.length < 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  if (digits.length === 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}/`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Verifica se o usuário já completou o onboarding.
 */
export function isOnboardingCompleted(db?: FolioDatabase): boolean {
  const targetDb = db ?? getDb();
  const settingsRepo = new SettingsRepository(targetDb);
  return settingsRepo.get<boolean>('onboardingCompleted') === true;
}

/**
 * Conclui o onboarding:
 * 1. Grava as configurações escolhidas (área, minutos, data da prova, tema).
 * 2. Atualiza o tema global da UI.
 * 3. Carrega o deck de exemplo autoral da área selecionada.
 * 4. Marca onboardingCompleted = true.
 */
export function completeOnboarding(
  preferences: OnboardingPreferences,
  db?: FolioDatabase
): CompleteOnboardingResult {
  const targetDb = db ?? getDb();
  const settingsRepo = new SettingsRepository(targetDb);

  // 1. Grava preferências
  settingsRepo.set('onboardingCompleted', true);
  settingsRepo.set('userArea', preferences.area);
  settingsRepo.set('dailyStudyMinutes', preferences.dailyMinutes);

  if (preferences.hasExamDate && preferences.examDateIso) {
    settingsRepo.set('examDate', preferences.examDateIso);
  } else {
    settingsRepo.delete('examDate');
  }

  settingsRepo.set('theme', preferences.theme);

  // 2. Aplica o tema na UI
  setAppThemeMode(preferences.theme);

  // 3. Cria / carrega o deck de exemplo da área escolhida
  const sampleResult = loadSampleDeck(targetDb, { area: preferences.area });

  return {
    completed: true,
    deckId: sampleResult.deck.id,
    deckName: sampleResult.deck.name,
    cardsCount: sampleResult.cards.length,
  };
}
