import { Rating, State } from 'ts-fsrs';
import type { Card } from '@/db/schema';
import {
  cardToFsrs,
  fsrsToCardFields,
  calculateNextReviews,
  applyReview,
  createFsrsInstance,
} from '../fsrs';

describe('src/scheduler/fsrs.ts', () => {
  const baseCard: Card = {
    id: 'test-card-1',
    note_id: 'test-note-1',
    deck_id: 'test-deck-1',
    ord: 0,
    due: Date.UTC(2026, 9, 9, 12, 0, 0),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: 0, // State.New
    last_review: null,
    suspended: 0,
    buried_until: null,
    source_id: null,
    created_at: Date.UTC(2026, 9, 9, 10, 0, 0),
    updated_at: Date.UTC(2026, 9, 9, 10, 0, 0),
    deleted_at: null,
  };

  test('cardToFsrs e fsrsToCardFields convertem de forma bidirecional e coerente', () => {
    const fsrsCard = cardToFsrs(baseCard);

    expect(fsrsCard.due.getTime()).toBe(baseCard.due);
    expect(fsrsCard.state).toBe(State.New);
    expect(fsrsCard.stability).toBe(0);
    expect(fsrsCard.difficulty).toBe(0);
    expect(fsrsCard.last_review).toBeUndefined();

    const backToFields = fsrsToCardFields(fsrsCard);
    expect(backToFields.due).toBe(baseCard.due);
    expect(backToFields.state).toBe(baseCard.state);
    expect(backToFields.stability).toBe(0);
    expect(backToFields.reps).toBe(0);
  });

  test('createFsrsInstance respeita request_retention e enable_short_term', () => {
    const f1 = createFsrsInstance({ desiredRetention: 0.9 });
    expect(f1.parameters.request_retention).toBe(0.9);
    expect(f1.parameters.enable_short_term).toBe(true);

    const f2 = createFsrsInstance({ desiredRetention: 0.85 });
    expect(f2.parameters.request_retention).toBe(0.85);
  });

  describe('calculateNextReviews', () => {
    test('modo de 2 botões retorna opções para Errei (Again) e Acertei (Good)', () => {
      const now = new Date(2026, 9, 9, 12, 0, 0);
      const options = calculateNextReviews(baseCard, now, { buttonMode: 2, desiredRetention: 0.9 });

      expect(options).toHaveLength(2);
      expect(options[0].rating).toBe(Rating.Again);
      expect(options[0].label).toBe('Errei');
      expect(typeof options[0].intervalText).toBe('string');
      expect(options[0].intervalText.length).toBeGreaterThan(0);

      expect(options[1].rating).toBe(Rating.Good);
      expect(options[1].label).toBe('Acertei');
      expect(typeof options[1].intervalText).toBe('string');
      expect(options[1].intervalText.length).toBeGreaterThan(0);
    });

    test('modo de 4 botões retorna Again, Hard, Good e Easy com próximos intervalos', () => {
      const now = new Date(2026, 9, 9, 12, 0, 0);
      const options = calculateNextReviews(baseCard, now, { buttonMode: 4, desiredRetention: 0.9 });

      expect(options).toHaveLength(4);
      expect(options[0].rating).toBe(Rating.Again);
      expect(options[0].label).toBe('Errei');

      expect(options[1].rating).toBe(Rating.Hard);
      expect(options[1].label).toBe('Difícil');

      expect(options[2].rating).toBe(Rating.Good);
      expect(options[2].label).toBe('Bom');

      expect(options[3].rating).toBe(Rating.Easy);
      expect(options[3].label).toBe('Fácil');

      // Good ou Easy tem intervalo maior que Again
      expect(options[3].card.due).toBeGreaterThan(options[0].card.due);
    });
  });

  describe('applyReview', () => {
    test('aplicar Errei (Again) em card novo atualiza para Learning e gera reviewLog', () => {
      const now = new Date(2026, 9, 9, 12, 0, 0);
      const result = applyReview(baseCard, Rating.Again, now, {
        desiredRetention: 0.9,
        reviewDurationMs: 5000,
      });

      expect(result.updatedCard.id).toBe(baseCard.id);
      expect(result.updatedCard.state).toBe(State.Learning);
      expect(result.updatedCard.reps).toBe(1);
      expect(result.updatedCard.lapses).toBe(0);
      expect(result.updatedCard.last_review).toBe(now.getTime());

      expect(result.reviewLog.card_id).toBe(baseCard.id);
      expect(result.reviewLog.rating).toBe(Rating.Again);
      expect(result.reviewLog.state).toBe(State.New); // Estado anterior registrado no log
      expect(result.reviewLog.review_ms).toBe(5000);
      expect(result.reviewLog.reviewed_at).toBe(now.getTime());
    });

    test('aplicar Acertei (Good) em card em revisão incrementa reps e avança due no futuro', () => {
      const reviewCard: Card = {
        ...baseCard,
        state: State.Review,
        stability: 3.5,
        difficulty: 4.8,
        reps: 2,
        lapses: 0,
        last_review: Date.UTC(2026, 9, 6, 12, 0, 0),
        due: Date.UTC(2026, 9, 9, 12, 0, 0),
      };

      const now = new Date(2026, 9, 9, 12, 0, 0);
      const result = applyReview(reviewCard, Rating.Good, now, {
        desiredRetention: 0.9,
        reviewDurationMs: 3200,
      });

      expect(result.updatedCard.state).toBe(State.Review);
      expect(result.updatedCard.reps).toBe(3);
      expect(result.updatedCard.stability).toBeGreaterThan(reviewCard.stability);
      expect(result.updatedCard.due).toBeGreaterThan(now.getTime());
      expect(result.reviewLog.rating).toBe(Rating.Good);
      expect(result.reviewLog.review_ms).toBe(3200);
    });
  });
});
