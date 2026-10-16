import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Card } from '@/db/schema';
import { CardsRepository } from '@/db/repositories/cards';
import { NotesRepository } from '@/db/repositories/notes';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { DecksRepository } from '@/db/repositories/decks';
import { AnnotationsRepository } from '@/db/repositories/annotations';
import { ReviewLogsRepository } from '@/db/repositories/review-logs';
import { SettingsRepository, DEFAULT_SETTINGS } from '@/db/repositories/settings';
import {
  buildDailyQueue,
  calculateNextReviews,
  applyReview,
  Rating,
  getStudyDayRange,
  type NextReviewOption,
  type SchedulerConfig,
} from '@/scheduler';
import { renderCard } from '@/render';
import type {
  ReviewCardData,
  ReviewQueueCounts,
  ReviewUndoItem,
  UseReviewSessionOptions,
  UseReviewSessionReturn,
} from './types';

export function useReviewSession(options: UseReviewSessionOptions = {}): UseReviewSessionReturn {
  const { deckId, now: nowOption, db } = options;

  const [loading, setLoading] = useState(true);
  const [deckName, setDeckName] = useState<string>('Revisão');
  const [queue, setQueue] = useState<Card[]>([]);
  const [currentCardData, setCurrentCardData] = useState<ReviewCardData | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [undoStack, setUndoStack] = useState<ReviewUndoItem[]>([]);

  // Repositórios instanciados
  const cardsRepo = useMemo(() => new CardsRepository(db), [db]);
  const notesRepo = useMemo(() => new NotesRepository(db), [db]);
  const noteTypesRepo = useMemo(() => new NoteTypesRepository(db), [db]);
  const decksRepo = useMemo(() => new DecksRepository(db), [db]);
  const annotationsRepo = useMemo(() => new AnnotationsRepository(db), [db]);
  const reviewLogsRepo = useMemo(() => new ReviewLogsRepository(db), [db]);
  const settingsRepo = useMemo(() => new SettingsRepository(db), [db]);

  // Configurações do agendador
  const buttonMode = settingsRepo.getWithDefault<2 | 4>('buttonMode', DEFAULT_SETTINGS.buttonMode);
  const showHighlights = settingsRepo.getWithDefault<boolean>(
    'showHighlightsInReview',
    DEFAULT_SETTINGS.showHighlightsInReview
  );
  const executeModelScripts = settingsRepo.getWithDefault<boolean>(
    'executeModelScripts',
    DEFAULT_SETTINGS.executeModelScripts
  );
  const desiredRetention = settingsRepo.getWithDefault<number>(
    'desiredRetention',
    DEFAULT_SETTINGS.desiredRetention
  );
  const dayRolloverHour = settingsRepo.getWithDefault<number>(
    'dayRolloverHour',
    DEFAULT_SETTINGS.dayRolloverHour
  );
  const newCardsPerDay = settingsRepo.getWithDefault<number>(
    'newCardsPerDay',
    DEFAULT_SETTINGS.newCardsPerDay
  );
  const maxReviewsPerDay = settingsRepo.getWithDefault<number>(
    'maxReviewsPerDay',
    DEFAULT_SETTINGS.maxReviewsPerDay
  );

  const schedulerConfig: SchedulerConfig = useMemo(
    () => ({
      desiredRetention,
      enableShortTerm: true,
      buttonMode,
      dayRolloverHour,
      newCardsPerDay,
      maxReviewsPerDay,
    }),
    [desiredRetention, buttonMode, dayRolloverHour, newCardsPerDay, maxReviewsPerDay]
  );

  // Momento em que o card atual começou a ser visualizado (para review_ms)
  const cardStartTimestampRef = useRef<number>(Date.now());

  // Helper para hidratar um card com nota, templates e anotações
  const hydrateCard = useCallback(
    (card: Card): ReviewCardData | null => {
      const note = notesRepo.getById(card.note_id);
      if (!note) return null;

      const noteType = noteTypesRepo.getById(note.note_type_id);
      if (!noteType) return null;

      const deck = decksRepo.getById(card.deck_id);
      if (!deck) return null;

      const activeAnnotations = annotationsRepo.listByNote(note.id);

      const rendered = renderCard({
        noteType,
        fields: note.fields,
        cardOrd: card.ord,
        tags: note.tags,
        deckName: deck.name,
      });

      return {
        card,
        note,
        noteType,
        deck,
        frontHtml: rendered.front,
        backHtml: rendered.back,
        annotations: activeAnnotations,
      };
    },
    [notesRepo, noteTypesRepo, decksRepo, annotationsRepo]
  );

  // Inicialização da sessão e montagem da fila
  const startSession = useCallback(() => {
    setLoading(true);

    // 1. Resolve o nome do deck para o cabeçalho
    if (deckId) {
      const deck = decksRepo.getById(deckId);
      if (deck) {
        const shortName = deck.name.split('::').pop() ?? deck.name;
        setDeckName(shortName);
      } else {
        setDeckName('Deck');
      }
    } else {
      setDeckName('Todos os decks');
    }

    // 2. Monta a fila diária
    const dailyResult = buildDailyQueue({
      deckId,
      now: nowOption,
      db,
      settings: schedulerConfig,
    });

    const initialQueue = dailyResult.queue;
    setQueue(initialQueue);

    if (initialQueue.length > 0) {
      const firstCard = initialQueue[0];
      const hydrated = hydrateCard(firstCard);
      setCurrentCardData(hydrated);
      setIsAnswerRevealed(false);
      cardStartTimestampRef.current = Date.now();
    } else {
      setCurrentCardData(null);
    }

    setLoading(false);
  }, [deckId, nowOption, schedulerConfig, decksRepo, hydrateCard]);

  useEffect(() => {
    startSession();
  }, [startSession]);

  // Virar o card (revelar resposta)
  const flipCard = useCallback(() => {
    setIsAnswerRevealed(true);
  }, []);

  // Próximas opções de revisão FSRS com intervalo estimado
  const nextReviewOptions = useMemo<NextReviewOption[]>(() => {
    if (!currentCardData) return [];
    return calculateNextReviews(currentCardData.card, Date.now(), schedulerConfig);
  }, [currentCardData, schedulerConfig]);

  // Contadores de fila
  const remainingCounts = useMemo<ReviewQueueCounts>(() => {
    let newCards = 0;
    let learning = 0;
    let review = 0;

    for (const c of queue) {
      if (c.state === 0) newCards++;
      else if (c.state === 1 || c.state === 3) learning++;
      else review++;
    }

    return {
      newCards,
      learning,
      review,
      total: queue.length,
    };
  }, [queue]);

  // Responder o card atual
  const answerCard = useCallback(
    (rating: Rating) => {
      if (!currentCardData) return;

      const nowMs = Date.now();
      const reviewDurationMs = Math.max(0, nowMs - cardStartTimestampRef.current);
      const currentCard = currentCardData.card;

      // 1. Executa FSRS
      const result = applyReview(
        currentCard,
        rating,
        nowMs,
        schedulerConfig,
        reviewDurationMs
      );

      // 2. Persiste card atualizado e review log
      cardsRepo.update(result.updatedCard.id, result.updatedCard);
      reviewLogsRepo.create(result.reviewLog);

      // 3. Enterra irmãs no mesmo dia (até o final do dia de estudo)
      const { endMs } = getStudyDayRange(new Date(nowMs), dayRolloverHour);
      const buriedSiblingsResult = cardsRepo.burySiblingsByNote(
        currentCard.note_id,
        currentCard.id,
        endMs
      );

      // 4. Determina se o card deve ser reinserido na fila de hoje
      const shouldReinsert =
        schedulerConfig.enableShortTerm &&
        result.updatedCard.due <= endMs;

      // 5. Atualiza a fila removendo o card atual e qualquer irmã da mesma nota
      const siblingIdsSet = new Set(buriedSiblingsResult.map((b) => b.card.id));
      const remainingQueue: Card[] = [];
      const removedSiblingsFromQueue: Array<{ card: Card; index: number }> = [];

      queue.slice(1).forEach((c, idx) => {
        if (siblingIdsSet.has(c.id)) {
          removedSiblingsFromQueue.push({ card: c, index: idx });
        } else {
          remainingQueue.push(c);
        }
      });

      let nextQueue: Card[];
      if (shouldReinsert) {
        nextQueue = [...remainingQueue, result.updatedCard];
      } else {
        nextQueue = remainingQueue;
      }

      // 6. Atualiza pilha de desfazer
      const undoItem: ReviewUndoItem = {
        previousCard: currentCard,
        updatedCard: result.updatedCard,
        reviewLogId: result.reviewLog.id,
        cardData: currentCardData,
        reinsertedInQueue: shouldReinsert,
        buriedSiblings: buriedSiblingsResult.map((b) => {
          const inQueue = removedSiblingsFromQueue.find((rq) => rq.card.id === b.card.id);
          return {
            cardId: b.card.id,
            previousBuriedUntil: b.previousBuriedUntil,
            removedFromQueueIndex: inQueue?.index,
            removedCard: inQueue?.card,
          };
        }),
      };
      setUndoStack((prev) => [...prev, undoItem]);
      setReviewedCount((prev) => prev + 1);

      // 7. Avança para o próximo card
      setQueue(nextQueue);
      if (nextQueue.length > 0) {
        const nextHydrated = hydrateCard(nextQueue[0]);
        setCurrentCardData(nextHydrated);
        setIsAnswerRevealed(false);
        cardStartTimestampRef.current = Date.now();
      } else {
        setCurrentCardData(null);
      }
    },
    [
      currentCardData,
      schedulerConfig,
      dayRolloverHour,
      cardsRepo,
      reviewLogsRepo,
      queue,
      hydrateCard,
    ]
  );

  // Desfazer a última resposta
  const undo = useCallback((): boolean => {
    if (undoStack.length === 0) return false;

    const lastUndoItem = undoStack[undoStack.length - 1];

    // 1. Reverte o card no SQLite para o estado anterior
    cardsRepo.update(lastUndoItem.previousCard.id, lastUndoItem.previousCard);

    // 2. Remove o log de revisão correspondente
    reviewLogsRepo.delete(lastUndoItem.reviewLogId);

    // 3. Desenterra as irmãs que foram enterradas nesta resposta
    if (lastUndoItem.buriedSiblings && lastUndoItem.buriedSiblings.length > 0) {
      cardsRepo.restoreBuriedSiblings(
        lastUndoItem.buriedSiblings.map((b) => ({
          cardId: b.cardId,
          previousBuriedUntil: b.previousBuriedUntil,
        }))
      );
    }

    // 4. Reconstrói a fila
    let baseQueue = [...queue];
    if (lastUndoItem.reinsertedInQueue && baseQueue.length > 0) {
      // Remove a cópia que havia sido reinserida no final
      baseQueue = baseQueue.slice(0, baseQueue.length - 1);
    }

    // Reinsere as irmãs removidas da fila nas suas posições
    if (lastUndoItem.buriedSiblings) {
      const siblingsToRestore = lastUndoItem.buriedSiblings
        .filter((b) => b.removedCard && b.removedFromQueueIndex !== undefined)
        .sort((a, b) => (a.removedFromQueueIndex ?? 0) - (b.removedFromQueueIndex ?? 0));

      for (const sib of siblingsToRestore) {
        if (sib.removedCard && sib.removedFromQueueIndex !== undefined) {
          const insertIdx = Math.min(sib.removedFromQueueIndex, baseQueue.length);
          baseQueue.splice(insertIdx, 0, sib.removedCard);
        }
      }
    }

    const restoredQueue = [lastUndoItem.previousCard, ...baseQueue];

    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setReviewedCount((prev) => Math.max(0, prev - 1));
    setQueue(restoredQueue);

    // Restaura o card como o atual
    const restoredHydrated = hydrateCard(lastUndoItem.previousCard);
    setCurrentCardData(restoredHydrated);
    setIsAnswerRevealed(false);
    cardStartTimestampRef.current = Date.now();

    return true;
  }, [undoStack, cardsRepo, reviewLogsRepo, queue, hydrateCard]);

  // Recarregar os dados do card atual (ex: após voltar do editor)
  const reloadCurrentCard = useCallback(() => {
    if (!currentCardData) return;
    const refreshed = hydrateCard(currentCardData.card);
    if (refreshed) {
      setCurrentCardData(refreshed);
    }
  }, [currentCardData, hydrateCard]);

  // Atualiza campos apenas da nota atual (usado pelo Bloco de Notas do AnKing via shim AnkiConnect)
  const updateCurrentNoteFields = useCallback(
    (noteId: string, updatedFields: Record<string, string>) => {
      if (!currentCardData || currentCardData.note.id !== noteId) {
        return;
      }

      const mergedFields: Record<string, string> = {
        ...currentCardData.note.fields,
        ...updatedFields,
      };

      const updatedNote = notesRepo.update(noteId, { fields: mergedFields });
      if (updatedNote) {
        setCurrentCardData((prev) =>
          prev && prev.note.id === noteId
            ? {
                ...prev,
                note: updatedNote,
              }
            : prev
        );
      }
    },
    [currentCardData, notesRepo]
  );

  const isFinished = !loading && queue.length === 0;

  return {
    loading,
    deckName,
    currentCardData,
    isAnswerRevealed,
    nextReviewOptions,
    buttonMode,
    showHighlights,
    executeModelScripts,
    remainingCounts,
    reviewedCount,
    canUndo: undoStack.length > 0,
    isFinished,
    flipCard,
    answerCard,
    undo,
    reloadCurrentCard,
    updateCurrentNoteFields,
  };
}
