import { createTestDatabase } from '@/db/__tests__/test-utils';
import { SettingsRepository } from '@/db/repositories/settings';
import { DecksRepository } from '@/db/repositories/decks';
import { NotesRepository } from '@/db/repositories/notes';
import { CardsRepository } from '@/db/repositories/cards';
import {
  validateExamDate,
  formatExamDateInput,
  completeOnboarding,
  isOnboardingCompleted,
} from '../onboardingService';
import type { OnboardingPreferences } from '../types';

describe('onboardingService', () => {
  describe('validateExamDate', () => {
    const fixedNow = new Date('2026-10-10T12:00:00Z');

    test('aceita data futura no formato DD/MM/AAAA e calcula dias restantes', () => {
      // 10 dias no futuro
      const result = validateExamDate('20/10/2026', fixedNow);
      expect(result.valid).toBe(true);
      expect(result.daysRemaining).toBe(10);
      expect(result.isToday).toBe(false);
      expect(result.errorMessage).toBeUndefined();
    });

    test('detecta se a data é hoje', () => {
      const result = validateExamDate('10/10/2026', fixedNow);
      expect(result.valid).toBe(true);
      expect(result.daysRemaining).toBe(0);
      expect(result.isToday).toBe(true);
    });

    test('rejeita data passada', () => {
      const result = validateExamDate('05/10/2026', fixedNow);
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toBeDefined();
    });

    test('rejeita formatos inválidos ou dias inexistentes', () => {
      expect(validateExamDate('32/10/2026', fixedNow).valid).toBe(false);
      expect(validateExamDate('29/02/2025', fixedNow).valid).toBe(false); // 2025 não é bissexto
      expect(validateExamDate('abc', fixedNow).valid).toBe(false);
      expect(validateExamDate('', fixedNow).valid).toBe(false);
    });
  });

  describe('formatExamDateInput', () => {
    test('insere barras automaticamente conforme digita', () => {
      expect(formatExamDateInput('1')).toBe('1');
      expect(formatExamDateInput('15')).toBe('15/');
      expect(formatExamDateInput('151')).toBe('15/1');
      expect(formatExamDateInput('1510')).toBe('15/10/');
      expect(formatExamDateInput('15102026')).toBe('15/10/2026');
    });

    test('remove caracteres não numéricos e limita a 10 caracteres', () => {
      expect(formatExamDateInput('15/10/2026extra')).toBe('15/10/2026');
      expect(formatExamDateInput('15-a-10')).toBe('15/10/');
    });
  });

  describe('completeOnboarding', () => {
    test('grava configurações, conclui onboarding e carrega o deck da área escolhida', () => {
      const { db } = createTestDatabase();
      const settingsRepo = new SettingsRepository(db);
      const decksRepo = new DecksRepository(db);
      const notesRepo = new NotesRepository(db);
      const cardsRepo = new CardsRepository(db);

      expect(isOnboardingCompleted(db)).toBe(false);

      const prefs: OnboardingPreferences = {
        area: 'direito',
        dailyMinutes: 45,
        hasExamDate: true,
        examDateRaw: '20/12/2026',
        examDateIso: '2026-12-20T00:00:00.000Z',
        theme: 'dark',
      };

      const result = completeOnboarding(prefs, db);

      expect(result.completed).toBe(true);
      expect(result.deckName).toBe('Direito::Direito Civil');
      expect(result.cardsCount).toBeGreaterThanOrEqual(20);

      // Verifica settings persistidos
      expect(isOnboardingCompleted(db)).toBe(true);
      expect(settingsRepo.get('userArea')).toBe('direito');
      expect(settingsRepo.get('dailyStudyMinutes')).toBe(45);
      expect(settingsRepo.get('examDate')).toBe('2026-12-20T00:00:00.000Z');
      expect(settingsRepo.get('theme')).toBe('dark');
      expect(settingsRepo.get('sampleDeckLoaded')).toBe(true);

      // Verifica dados no SQLite
      const deck = decksRepo.getById(result.deckId);
      expect(deck).not.toBeNull();
      expect(deck?.name).toBe('Direito::Direito Civil');

      const notes = notesRepo.listByDeck(result.deckId);
      expect(notes).toHaveLength(20);

      const cards = cardsRepo.listByDeck(result.deckId);
      expect(cards.length).toBeGreaterThanOrEqual(20);
    });

    test('funciona com área sem data de prova (hasExamDate: false)', () => {
      const { db } = createTestDatabase();
      const settingsRepo = new SettingsRepository(db);

      const prefs: OnboardingPreferences = {
        area: 'concursos',
        dailyMinutes: 30,
        hasExamDate: false,
        examDateRaw: '',
        examDateIso: null,
        theme: 'light',
      };

      const result = completeOnboarding(prefs, db);

      expect(result.completed).toBe(true);
      expect(result.deckName).toBe('Concursos::Direito Constitucional');
      expect(settingsRepo.get('examDate')).toBeNull();
      expect(settingsRepo.get('userArea')).toBe('concursos');
    });

    test('é idempotente se chamado novamente', () => {
      const { db } = createTestDatabase();
      const decksRepo = new DecksRepository(db);

      const prefs: OnboardingPreferences = {
        area: 'psicologia',
        dailyMinutes: 30,
        hasExamDate: false,
        examDateRaw: '',
        examDateIso: null,
        theme: 'system',
      };

      const result1 = completeOnboarding(prefs, db);
      const result2 = completeOnboarding(prefs, db);

      expect(result1.deckId).toBe(result2.deckId);
      // Não duplica decks
      const allDecks = decksRepo.listAll();
      expect(allDecks).toHaveLength(1);
    });
  });
});
