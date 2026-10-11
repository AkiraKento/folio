import {
  calculateStreak,
  calculateEstimatedDurationMs,
  formatEstimatedMinutes,
  getTodaySummary,
  DEFAULT_CARD_REVIEW_DURATION_MS,
  SEVEN_DAYS_MS,
} from '../metrics';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import { DecksRepository } from '@/db/repositories/decks';
import { NotesRepository } from '@/db/repositories/notes';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { CardsRepository } from '@/db/repositories/cards';
import { ReviewLogsRepository } from '@/db/repositories/review-logs';
import { State } from 'ts-fsrs';
import type { FolioDatabase } from '@/db/client';

describe('src/today/metrics.ts — Métricas da Tela Hoje', () => {
  describe('calculateStreak', () => {
    const rolloverHour = 4;

    test('sem histórico de revisões retorna streak 0 e studiedToday false', () => {
      const now = new Date(2026, 9, 9, 10, 0, 0); // 9 de outubro às 10h
      const result = calculateStreak([], { now, rolloverHour });
      expect(result).toEqual({ streak: 0, studiedToday: false });
    });

    test('revisão apenas hoje retorna streak 1 e studiedToday true', () => {
      const now = new Date(2026, 9, 9, 10, 0, 0);
      const reviewedAtToday = new Date(2026, 9, 9, 8, 30, 0).getTime();
      const result = calculateStreak([reviewedAtToday], { now, rolloverHour });
      expect(result).toEqual({ streak: 1, studiedToday: true });
    });

    test('revisões hoje e ontem retorna streak 2 e studiedToday true', () => {
      const now = new Date(2026, 9, 9, 10, 0, 0);
      const today = new Date(2026, 9, 9, 8, 30, 0).getTime();
      const yesterday = new Date(2026, 9, 8, 14, 0, 0).getTime();

      const result = calculateStreak([today, yesterday], { now, rolloverHour });
      expect(result).toEqual({ streak: 2, studiedToday: true });
    });

    test('revisões ontem e anteontem, sem estudo hoje ainda, mantém streak 2 e studiedToday false', () => {
      const now = new Date(2026, 9, 9, 10, 0, 0);
      const yesterday = new Date(2026, 9, 8, 14, 0, 0).getTime();
      const twoDaysAgo = new Date(2026, 9, 7, 20, 0, 0).getTime();

      const result = calculateStreak([yesterday, twoDaysAgo], { now, rolloverHour });
      expect(result).toEqual({ streak: 2, studiedToday: false });
    });

    test('revisões anteontem mas sem estudo ontem nem hoje quebram a sequência (streak 0)', () => {
      const now = new Date(2026, 9, 9, 10, 0, 0);
      const twoDaysAgo = new Date(2026, 9, 7, 20, 0, 0).getTime();
      const threeDaysAgo = new Date(2026, 9, 6, 18, 0, 0).getTime();

      const result = calculateStreak([twoDaysAgo, threeDaysAgo], { now, rolloverHour });
      expect(result).toEqual({ streak: 0, studiedToday: false });
    });

    test('múltiplas revisões no mesmo dia contam apenas como 1 dia na sequência', () => {
      const now = new Date(2026, 9, 9, 10, 0, 0);
      const today1 = new Date(2026, 9, 9, 9, 0, 0).getTime();
      const today2 = new Date(2026, 9, 9, 8, 0, 0).getTime();
      const today3 = new Date(2026, 9, 9, 7, 0, 0).getTime();
      const yesterday = new Date(2026, 9, 8, 11, 0, 0).getTime();

      const result = calculateStreak([today1, today2, today3, yesterday], { now, rolloverHour });
      expect(result).toEqual({ streak: 2, studiedToday: true });
    });

    test('respeita a virada do dia (rolloverHour às 04:00)', () => {
      // São 02:30 do dia 9. No fuso de estudo, ainda é o dia 8!
      const now = new Date(2026, 9, 9, 2, 30, 0);
      // Estudo feito às 22:00 do dia 8 pertence ao mesmo dia de estudo atual
      const reviewLateNight = new Date(2026, 9, 8, 22, 0, 0).getTime();
      // Estudo feito às 15:00 do dia 7 pertence ao dia anterior
      const reviewPrev = new Date(2026, 9, 7, 15, 0, 0).getTime();

      const result = calculateStreak([reviewLateNight, reviewPrev], { now, rolloverHour });
      expect(result).toEqual({ streak: 2, studiedToday: true });
    });
  });

  describe('calculateEstimatedDurationMs', () => {
    test('usa 8s (8000ms) por card quando não há histórico (null)', () => {
      expect(DEFAULT_CARD_REVIEW_DURATION_MS).toBe(8000);
      const duration = calculateEstimatedDurationMs(10, null);
      expect(duration).toBe(80000); // 10 * 8s = 80s
    });

    test('usa a média dos últimos 7 dias quando informada', () => {
      const duration = calculateEstimatedDurationMs(5, 12000);
      expect(duration).toBe(60000); // 5 * 12s = 60s
    });

    test('retorna 0 quando não há cards pendentes', () => {
      expect(calculateEstimatedDurationMs(0, null)).toBe(0);
      expect(calculateEstimatedDurationMs(0, 15000)).toBe(0);
    });
  });

  describe('formatEstimatedMinutes', () => {
    test('retorna "0 min" quando 0 ms ou negativo', () => {
      expect(formatEstimatedMinutes(0)).toBe('0 min');
      expect(formatEstimatedMinutes(-100)).toBe('0 min');
    });

    test('retorna "< 1 min" quando menor que 60.000 ms', () => {
      expect(formatEstimatedMinutes(30000)).toBe('< 1 min');
      expect(formatEstimatedMinutes(59000)).toBe('< 1 min');
    });

    test('retorna "~X min" arredondado quando >= 60.000 ms', () => {
      expect(formatEstimatedMinutes(60000)).toBe('~1 min');
      expect(formatEstimatedMinutes(180000)).toBe('~3 min');
      expect(formatEstimatedMinutes(150000)).toBe('~3 min'); // 2.5 min arredonda para 3
      expect(formatEstimatedMinutes(130000)).toBe('~2 min');
    });
  });

  describe('getTodaySummary (integração)', () => {
    let db: FolioDatabase;
    let decksRepo: DecksRepository;
    let notesRepo: NotesRepository;
    let noteTypesRepo: NoteTypesRepository;
    let cardsRepo: CardsRepository;
    let reviewLogsRepo: ReviewLogsRepository;

    beforeEach(() => {
      const testDb = createTestDatabase();
      db = testDb.db;
      decksRepo = new DecksRepository(db);
      notesRepo = new NotesRepository(db);
      noteTypesRepo = new NoteTypesRepository(db);
      cardsRepo = new CardsRepository(db);
      reviewLogsRepo = new ReviewLogsRepository(db);
      noteTypesRepo.seedBuiltins();
    });

    test('retorna resumo correto com cards pendentes, estimativa de tempo e sequência', () => {
      const now = new Date(2026, 9, 9, 12, 0, 0);
      const deck = decksRepo.create({ name: 'Medicina' });
      const basicType = noteTypesRepo.list()[0];

      // Cria 3 notas com cards novos
      let firstCardId = '';
      for (let i = 0; i < 3; i++) {
        const note = notesRepo.create({
          deck_id: deck.id,
          note_type_id: basicType.id,
          fields: { Frente: `Frente ${i}`, Verso: `Verso ${i}` },
        });
        const c = cardsRepo.create({
          note_id: note.id,
          deck_id: deck.id,
          ord: 0,
          due: now.getTime(),
        });
        if (i === 0) firstCardId = c.id;
      }

      // Cria logs de revisão nos últimos 7 dias com média de 10s (10000ms)
      const yesterday = new Date(2026, 9, 8, 10, 0, 0).getTime();
      reviewLogsRepo.create({
        card_id: firstCardId,
        rating: 3,
        state: State.Review,
        due: now.getTime(),
        stability: 2,
        difficulty: 5,
        elapsed_days: 1,
        last_elapsed_days: 0,
        scheduled_days: 1,
        review_ms: 10000,
        reviewed_at: yesterday,
      });

      const summary = getTodaySummary({ db, now });

      expect(summary.pendingCount).toBe(3);
      expect(summary.newCount).toBe(3);
      expect(summary.learningCount).toBe(0);
      expect(summary.reviewCount).toBe(0);
      expect(summary.reviewedTodayCount).toBe(0);
      expect(summary.averageReviewDurationMs).toBe(10000);
      expect(summary.estimatedDurationMs).toBe(30000); // 3 * 10s = 30s
      expect(summary.estimatedMinutesText).toBe('< 1 min');
      expect(summary.streak).toBe(1); // Ontem teve estudo, hoje mantém sequência 1
      expect(summary.studiedToday).toBe(false);
    });

    test('calcula streak e reviewedToday após estudo realizado hoje', () => {
      const now = new Date(2026, 9, 9, 12, 0, 0);
      const deck = decksRepo.create({ name: 'Direito' });
      const basicType = noteTypesRepo.list()[0];

      const note = notesRepo.create({
        deck_id: deck.id,
        note_type_id: basicType.id,
        fields: { Frente: 'Frente', Verso: 'Verso' },
      });
      const card = cardsRepo.create({
        note_id: note.id,
        deck_id: deck.id,
        ord: 0,
        due: now.getTime(),
      });

      // Log de ontem
      reviewLogsRepo.create({
        card_id: card.id,
        rating: 3,
        state: State.Review,
        due: now.getTime(),
        stability: 2,
        difficulty: 5,
        elapsed_days: 1,
        last_elapsed_days: 0,
        scheduled_days: 1,
        review_ms: 6000,
        reviewed_at: new Date(2026, 9, 8, 10, 0, 0).getTime(),
      });

      // Log de hoje (estudou hoje às 11h)
      reviewLogsRepo.create({
        card_id: card.id,
        rating: 3,
        state: State.Review,
        due: now.getTime(),
        stability: 2,
        difficulty: 5,
        elapsed_days: 1,
        last_elapsed_days: 0,
        scheduled_days: 1,
        review_ms: 6000,
        reviewed_at: new Date(2026, 9, 9, 11, 0, 0).getTime(),
      });

      const summary = getTodaySummary({ db, now });

      expect(summary.streak).toBe(2);
      expect(summary.studiedToday).toBe(true);
      expect(summary.reviewedTodayCount).toBe(1);
    });

    test('retorna fallback de 8s se logs forem mais antigos que 7 dias', () => {
      const now = new Date(2026, 9, 9, 12, 0, 0);
      const tenDaysAgo = now.getTime() - (SEVEN_DAYS_MS + 24 * 60 * 60 * 1000);

      const deck = decksRepo.create({ name: 'Histórico' });
      const basicType = noteTypesRepo.list()[0];
      const note = notesRepo.create({
        deck_id: deck.id,
        note_type_id: basicType.id,
        fields: { Frente: 'Frente Antiga', Verso: 'Verso Antigo' },
      });
      const card = cardsRepo.create({
        note_id: note.id,
        deck_id: deck.id,
        ord: 0,
        due: now.getTime(),
      });

      reviewLogsRepo.create({
        card_id: card.id,
        rating: 3,
        state: State.Review,
        due: now.getTime(),
        stability: 2,
        difficulty: 5,
        elapsed_days: 1,
        last_elapsed_days: 0,
        scheduled_days: 1,
        review_ms: 25000, // 25s, mas faz mais de 7 dias!
        reviewed_at: tenDaysAgo,
      });

      const summary = getTodaySummary({ db, now });
      expect(summary.averageReviewDurationMs).toBeNull();
      expect(summary.pendingCount).toBe(1);
      expect(summary.estimatedDurationMs).toBe(8000); // 1 card novo pendente x fallback de 8000ms
      expect(summary.estimatedMinutesText).toBe('< 1 min');
    });
  });
});
