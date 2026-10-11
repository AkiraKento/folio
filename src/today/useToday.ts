import { useState, useCallback, useEffect } from 'react';
import type { FolioDatabase } from '@/db/client';
import { getDb } from '@/db/client';
import { ConsultaPosRepository } from '@/db/repositories/consulta-pos';
import { DecksRepository } from '@/db/repositories/decks';
import { getTodaySummary } from './metrics';
import type { TodaySummary } from './types';
import type { ContinueReadingInfo } from '@/ui/DecksScreen';

export interface UseTodayOptions {
  db?: FolioDatabase;
  now?: Date | number;
}

export interface UseTodayReturn {
  summary: TodaySummary | null;
  continueReading: ContinueReadingInfo | null;
  loading: boolean;
  refresh: () => void;
}

export function useToday(options: UseTodayOptions = {}): UseTodayReturn {
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [continueReading, setContinueReading] = useState<ContinueReadingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      const database = options.db ?? getDb();

      // 1. Resumo do dia (fila, estimativa, streak)
      const todaySummary = getTodaySummary({
        db: database,
        now: options.now,
      });
      setSummary(todaySummary);

      // 2. Atalho "Continuar lendo" (última posição na Consulta)
      try {
        const posRepo = new ConsultaPosRepository(database);
        const latestPos = posRepo.getLatest();
        if (latestPos) {
          const decksRepo = new DecksRepository(database);
          const deck = decksRepo.getById(latestPos.deck_query);
          if (deck) {
            const shortName = deck.name.split('::').pop() ?? deck.name;
            setContinueReading({
              deckId: deck.id,
              deckName: shortName,
              unitIndex: latestPos.unit_index,
              offset: latestPos.scroll_offset,
            });
          } else {
            setContinueReading(null);
          }
        } else {
          setContinueReading(null);
        }
      } catch {
        setContinueReading(null);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados da tela Hoje:', err);
    } finally {
      setLoading(false);
    }
  }, [options.db, options.now]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    summary,
    continueReading,
    loading,
    refresh,
  };
}
