import { renderCard } from '../card';
import { buildAnkiDocument } from '@/webview/card/ankiDocument';
import { AVICENA_FIXTURE, ANKING_FIXTURE } from '@/webview/card/__fixtures__';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import { DecksRepository } from '@/db/repositories/decks';
import { NotesRepository } from '@/db/repositories/notes';
import { CardsRepository } from '@/db/repositories/cards';
import { ReviewLogsRepository } from '@/db/repositories/review-logs';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { Rating, State } from '@/scheduler';
import { getErrorLogs, clearErrorLogs } from '@/logging';

describe('M10 Passo 10 — Metas de desempenho e teste de 50 revisões', () => {
  beforeEach(async () => {
    await clearErrorLogs();
  });

  describe('1. Desempenho do renderizador puro (renderCard + buildAnkiDocument)', () => {
    test('renderiza 50 cards Avicena (frente e verso) com média < 15 ms por card', () => {
      const avicenaNoteType = AVICENA_FIXTURE.toNoteType();
      const example = AVICENA_FIXTURE.example;

      const times: number[] = [];
      const totalCards = 50;

      for (let i = 0; i < totalCards; i++) {
        const start = performance.now();

        const rendered = renderCard({
          noteType: avicenaNoteType,
          fields: example.fields,
          cardOrd: example.cardOrd ?? 0,
          tags: example.tags,
          deckName: 'Cardiologia::Valvopatias',
          theme: i % 2 === 0 ? 'light' : 'dark',
        });

        const frontDoc = buildAnkiDocument({
          html: rendered.front,
          side: 'front',
          theme: i % 2 === 0 ? 'light' : 'dark',
          css: avicenaNoteType.css ?? '',
          isBuiltinModel: false,
        });

        const backDoc = buildAnkiDocument({
          html: rendered.back,
          side: 'back',
          theme: i % 2 === 0 ? 'light' : 'dark',
          css: avicenaNoteType.css ?? '',
          isBuiltinModel: false,
        });

        const elapsed = performance.now() - start;
        times.push(elapsed);

        expect(frontDoc).toContain('id="qa"');
        expect(backDoc).toContain('id="qa"');
      }

      const totalElapsed = times.reduce((a, b) => a + b, 0);
      const avgElapsed = totalElapsed / totalCards;

      // Meta: virar card em < 150 ms e próximo em < 250 ms.
      // A renderização pura em JS deve ficar bem abaixo de 15 ms por card.
      expect(avgElapsed).toBeLessThan(15);
      expect(times.every((t) => t < 50)).toBe(true);
    });

    test('renderiza 50 cards AnKing (frente e verso) com média < 25 ms por card', () => {
      const ankingNoteType = ANKING_FIXTURE.toNoteType();
      const example = ANKING_FIXTURE.example;

      const times: number[] = [];
      const totalCards = 50;

      for (let i = 0; i < totalCards; i++) {
        const start = performance.now();

        const rendered = renderCard({
          noteType: ankingNoteType,
          fields: example.fields,
          cardOrd: example.cardOrd ?? 0,
          tags: example.tags,
          deckName: 'AnKing::Step1',
          theme: i % 2 === 0 ? 'light' : 'dark',
          adjustFixedColorsInDarkMode: true,
        });

        const frontDoc = buildAnkiDocument({
          html: rendered.front,
          side: 'front',
          theme: i % 2 === 0 ? 'light' : 'dark',
          css: ankingNoteType.css ?? '',
          isBuiltinModel: false,
        });

        const backDoc = buildAnkiDocument({
          html: rendered.back,
          side: 'back',
          theme: i % 2 === 0 ? 'light' : 'dark',
          css: ankingNoteType.css ?? '',
          isBuiltinModel: false,
        });

        const elapsed = performance.now() - start;
        times.push(elapsed);

        expect(frontDoc).toContain('id="qa"');
        expect(backDoc).toContain('id="qa"');
      }

      const totalElapsed = times.reduce((a, b) => a + b, 0);
      const avgElapsed = totalElapsed / totalCards;

      expect(avgElapsed).toBeLessThan(25);
      expect(times.every((t) => t < 60)).toBe(true);
    });
  });

  describe('2. Teste de 50 revisões consecutivas num deck Avicena real', () => {
    test('executa 50 revisões seguidas sem erros no log e dentro das metas de tempo', async () => {
      const { db } = createTestDatabase();
      const decksRepo = new DecksRepository(db);
      const notesRepo = new NotesRepository(db);
      const cardsRepo = new CardsRepository(db);
      const noteTypesRepo = new NoteTypesRepository(db);
      const reviewLogsRepo = new ReviewLogsRepository(db);

      const avicenaNoteType = noteTypesRepo.create({
        id: 'nt-avicena-perf',
        name: 'Avicena Perf Test',
        kind: 'basic',
        fields: AVICENA_FIXTURE.model.fields.map((f, i) => ({ name: f, ord: i })),
        templates: [
          {
            name: 'Card 1',
            ord: 0,
            front: AVICENA_FIXTURE.frontHtml,
            back: AVICENA_FIXTURE.backHtml,
          },
        ],
        css: AVICENA_FIXTURE.styleCss,
      });

      const deck = decksRepo.create({ name: 'Deck Avicena 50' });

      // Cria 50 notas e 50 cards
      const totalReviews = 50;
      const createdCards = [];
      const baseNow = Date.now();

      for (let i = 0; i < totalReviews; i++) {
        const note = notesRepo.create({
          note_type_id: avicenaNoteType.id,
          deck_id: deck.id,
          fields: {
            ...AVICENA_FIXTURE.example.fields,
            question: `<p>Questão de teste clínico #${i + 1}: qual é a conduta?</p>`,
            answer: `<p>Resposta da questão #${i + 1}: estabilização e conduta cirúrgica.</p>`,
          },
          tags: ['Cardiologia', `caso_${i + 1}`],
        });

        const card = cardsRepo.create({
          note_id: note.id,
          deck_id: deck.id,
          ord: 0,
          due: baseNow - (totalReviews - i) * 1000,
          state: State.Learning,
        });

        createdCards.push(card);
      }

      // Executa o ciclo de 50 revisões medindo os tempos de cada etapa
      const nextCardTimes: number[] = [];
      const flipTimes: number[] = [];
      const answerTimes: number[] = [];

      for (let i = 0; i < totalReviews; i++) {
        // 1. Próximo card (busca do banco + hidratação + pré-renderização frente/verso)
        const nextStart = performance.now();
        const currentCard = cardsRepo.getById(createdCards[i].id);
        expect(currentCard).not.toBeNull();

        const currentNote = notesRepo.getById(currentCard!.note_id);
        expect(currentNote).not.toBeNull();

        const preRendered = renderCard({
          noteType: avicenaNoteType,
          fields: currentNote!.fields,
          cardOrd: currentCard!.ord,
          tags: currentNote!.tags,
          deckName: deck.name,
          theme: 'light',
        });

        const nextElapsed = performance.now() - nextStart;
        nextCardTimes.push(nextElapsed);

        // 2. Virar o card (troca para o verso já pré-renderizado / double-buffered)
        const flipStart = performance.now();
        const backHtml = preRendered.back;
        const backDoc = buildAnkiDocument({
          html: backHtml,
          side: 'back',
          theme: 'light',
          css: avicenaNoteType.css ?? '',
          isBuiltinModel: false,
        });
        expect(backDoc).toContain('id="qa"');
        const flipElapsed = performance.now() - flipStart;
        flipTimes.push(flipElapsed);

        // 3. Responder o card (atualização do estado + gravação do review log)
        const answerStart = performance.now();
        cardsRepo.update(currentCard!.id, {
          state: State.Review,
          reps: currentCard!.reps + 1,
          last_review: Date.now(),
        });
        reviewLogsRepo.create({
          card_id: currentCard!.id,
          rating: Rating.Good,
          state: State.Learning,
          due: currentCard!.due,
          stability: currentCard!.stability,
          difficulty: currentCard!.difficulty,
          elapsed_days: 0,
          last_elapsed_days: 0,
          scheduled_days: 1,
          review_ms: 1200,
        });
        const answerElapsed = performance.now() - answerStart;
        answerTimes.push(answerElapsed);
      }

      // Verificação das metas de desempenho:
      // Próximo card < 250 ms (meta)
      const avgNext = nextCardTimes.reduce((a, b) => a + b, 0) / totalReviews;
      expect(avgNext).toBeLessThan(50);
      expect(nextCardTimes.every((t) => t < 250)).toBe(true);

      // Virar o card < 150 ms (meta)
      const avgFlip = flipTimes.reduce((a, b) => a + b, 0) / totalReviews;
      expect(avgFlip).toBeLessThan(20);
      expect(flipTimes.every((t) => t < 150)).toBe(true);

      // Submissão da resposta < 100 ms
      const avgAnswer = answerTimes.reduce((a, b) => a + b, 0) / totalReviews;
      expect(avgAnswer).toBeLessThan(30);

      // Verificação de ausência de erros no log
      const logs = await getErrorLogs();
      expect(logs).toHaveLength(0);
    });
  });
});
