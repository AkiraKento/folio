import { calculateRetentionRate, getReviewStats } from '../metrics';
import { Rating } from 'ts-fsrs';
import { createTestDatabase, seedBasicNoteType } from '@/db/__tests__/test-utils';
import type { FolioDatabase } from '@/db/client';
import { ReviewLogsRepository } from '@/db/repositories/review-logs';
import { CardsRepository } from '@/db/repositories/cards';
import { DecksRepository } from '@/db/repositories/decks';
import { NotesRepository } from '@/db/repositories/notes';

describe('src/stats/metrics', () => {
  describe('calculateRetentionRate', () => {
    it('retorna 0 quando não há logs', () => {
      const result = calculateRetentionRate([]);
      expect(result.rate).toBe(0);
      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
    });

    it('calcula a proporção correta de acertos', () => {
      const logs = [
        { rating: Rating.Good },
        { rating: Rating.Good },
        { rating: Rating.Hard },
        { rating: Rating.Easy },
        { rating: Rating.Again },
      ];

      const result = calculateRetentionRate(logs);
      expect(result.total).toBe(5);
      expect(result.successful).toBe(4);
      expect(result.rate).toBe(0.8);
    });

    it('trata 100% de acertos e 0% de acertos', () => {
      expect(calculateRetentionRate([{ rating: Rating.Good }]).rate).toBe(1);
      expect(calculateRetentionRate([{ rating: Rating.Again }]).rate).toBe(0);
    });
  });

  describe('getReviewStats com SQLite', () => {
    let db: FolioDatabase;
    const now = new Date(2026, 9, 10, 12, 0, 0);

    beforeEach(() => {
      const context = createTestDatabase();
      db = context.db;
      const decksRepo = new DecksRepository(db);
      const notesRepo = new NotesRepository(db);
      const cardsRepo = new CardsRepository(db);
      const reviewLogsRepo = new ReviewLogsRepository(db);

      const noteTypeId = seedBasicNoteType(db);
      const deck = decksRepo.create({ name: 'Medicina::Cardiologia' });

      // Cria algumas notas e cards
      const note1 = notesRepo.create({
        deck_id: deck.id,
        note_type_id: noteTypeId,
        fields: { Frente: 'Q1', Verso: 'A1' },
      });
      const note2 = notesRepo.create({
        deck_id: deck.id,
        note_type_id: noteTypeId,
        fields: { Frente: 'Q2', Verso: 'A2' },
      });
      const note3 = notesRepo.create({
        deck_id: deck.id,
        note_type_id: noteTypeId,
        fields: { Frente: 'Q3', Verso: 'A3' },
      });

      const card1 = cardsRepo.create({
        note_id: note1.id,
        deck_id: deck.id,
        ord: 0,
        due: 0,
        state: 0, // Novo
      });
      const card2 = cardsRepo.create({
        note_id: note2.id,
        deck_id: deck.id,
        ord: 0,
        due: 0,
        state: 1, // Learning
      });
      const card3 = cardsRepo.create({
        note_id: note3.id,
        deck_id: deck.id,
        ord: 0,
        due: 0,
        state: 2, // Review
        suspended: 1, // Suspenso
      });

      // Cria alguns logs de revisão
      const yesterday = new Date(2026, 9, 9, 15, 0, 0).getTime();
      const today1 = new Date(2026, 9, 10, 9, 0, 0).getTime();
      const today2 = new Date(2026, 9, 10, 10, 0, 0).getTime();

      reviewLogsRepo.create({
        card_id: card1.id,
        rating: Rating.Good,
        state: 0,
        due: 0,
        stability: 1,
        difficulty: 5,
        elapsed_days: 0,
        last_elapsed_days: 0,
        scheduled_days: 1,
        review_ms: 5000,
        reviewed_at: yesterday,
      });

      reviewLogsRepo.create({
        card_id: card2.id,
        rating: Rating.Good,
        state: 1,
        due: 0,
        stability: 2,
        difficulty: 4,
        elapsed_days: 1,
        last_elapsed_days: 0,
        scheduled_days: 2,
        review_ms: 6000,
        reviewed_at: today1,
      });

      reviewLogsRepo.create({
        card_id: card3.id,
        rating: Rating.Again,
        state: 2,
        due: 0,
        stability: 1,
        difficulty: 6,
        elapsed_days: 2,
        last_elapsed_days: 1,
        scheduled_days: 0,
        review_ms: 7000,
        reviewed_at: today2,
      });
    });

    it('retorna as métricas completas integradas com o banco', () => {
      const stats = getReviewStats({
        db,
        now,
        rolloverHour: 4,
        heatmapWeeks: 12,
      });

      expect(stats.totalReviews).toBe(3);
      expect(stats.activeDays).toBe(2);
      expect(stats.averageReviewsPerActiveDay).toBe(1.5);
      expect(stats.retentionReviewCount).toBe(3);
      expect(stats.retentionRate).toBeCloseTo(2 / 3);

      expect(stats.cardsByState.new).toBe(1);
      expect(stats.cardsByState.learning).toBe(1);
      expect(stats.cardsByState.suspended).toBe(1);
      expect(stats.cardsByState.total).toBe(3);

      expect(stats.streak).toBe(2);
      expect(stats.studiedToday).toBe(true);

      expect(stats.heatmap.totalReviews).toBe(3);
      expect(stats.heatmap.weeks).toHaveLength(12);
    });
  });
});
