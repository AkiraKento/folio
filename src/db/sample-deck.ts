import type { FolioDatabase } from './client';
import { getDb } from './client';
import { DecksRepository } from './repositories/decks';
import { NotesRepository } from './repositories/notes';
import { CardsRepository } from './repositories/cards';
import { NoteTypesRepository } from './repositories/note-types';
import { SettingsRepository } from './repositories/settings';
import { getExpectedCardOrdsForNote } from './builtin-note-types';
import type { Deck, Note, Card } from './schema';
import medicinaRawData from '../../assets/decks-exemplo/medicina-cardiologia.json';
import concursosRawData from '../../assets/decks-exemplo/concursos-constitucional.json';
import direitoRawData from '../../assets/decks-exemplo/direito-civil.json';
import psicologiaRawData from '../../assets/decks-exemplo/psicologia-cognicao.json';
import geralRawData from '../../assets/decks-exemplo/geral-aprendizagem.json';

export type StudyArea = 'medicina' | 'concursos' | 'direito' | 'psicologia' | 'geral';

export interface SampleDeckNoteDefinition {
  id: string;
  note_type_id: string;
  fields: Record<string, string>;
  tags: string[];
}

export interface SampleDeckDefinition {
  deck: {
    id: string;
    name: string;
    area: string;
    description: string;
  };
  notes: SampleDeckNoteDefinition[];
}

export const SAMPLE_DECKS_BY_AREA: Record<StudyArea, SampleDeckDefinition> = {
  medicina: medicinaRawData as unknown as SampleDeckDefinition,
  concursos: concursosRawData as unknown as SampleDeckDefinition,
  direito: direitoRawData as unknown as SampleDeckDefinition,
  psicologia: psicologiaRawData as unknown as SampleDeckDefinition,
  geral: geralRawData as unknown as SampleDeckDefinition,
};

export const SAMPLE_DECK_DEFINITION: SampleDeckDefinition = SAMPLE_DECKS_BY_AREA.medicina;

export interface LoadSampleDeckResult {
  loaded: boolean;
  deck: Deck;
  notes: Note[];
  cards: Card[];
}

export interface LoadSampleDeckOptions {
  force?: boolean;
  area?: StudyArea;
}

/**
 * Verifica se o deck de exemplo já foi carregado neste banco.
 */
export function isSampleDeckLoaded(db?: FolioDatabase): boolean {
  const targetDb = db ?? getDb();
  const settingsRepo = new SettingsRepository(targetDb);
  return settingsRepo.get<boolean>('sampleDeckLoaded') === true;
}

/**
 * Carrega o deck de exemplo autoral no banco de dados.
 * Idempotente: se já tiver sido carregado previamente e não for forçado,
 * retorna os registros existentes sem duplicar nada.
 */
export function loadSampleDeck(
  db?: FolioDatabase,
  options?: LoadSampleDeckOptions
): LoadSampleDeckResult {
  const targetDb = db ?? getDb();
  const settingsRepo = new SettingsRepository(targetDb);
  const decksRepo = new DecksRepository(targetDb);
  const notesRepo = new NotesRepository(targetDb);
  const cardsRepo = new CardsRepository(targetDb);
  const noteTypesRepo = new NoteTypesRepository(targetDb);

  const selectedArea = options?.area ?? 'medicina';
  const deckDef = SAMPLE_DECKS_BY_AREA[selectedArea] ?? SAMPLE_DECK_DEFINITION;

  const alreadyLoaded = isSampleDeckLoaded(targetDb);

  // Se já foi carregado e não é recarga forçada, busca e retorna os dados existentes
  if (alreadyLoaded && !options?.force) {
    const existingDeck = decksRepo.getById(deckDef.deck.id);
    if (existingDeck) {
      const existingNotes = notesRepo.listByDeck(existingDeck.id);
      const existingCards = cardsRepo.listByDeck(existingDeck.id);
      return {
        loaded: false,
        deck: existingDeck,
        notes: existingNotes,
        cards: existingCards,
      };
    }
  }

  // 1. Garante que os modelos embutidos (Básico, Cloze) existem no banco
  noteTypesRepo.seedBuiltins();

  const now = Date.now();

  // 2. Garante o deck no banco
  let targetDeck = decksRepo.getById(deckDef.deck.id);
  if (!targetDeck) {
    targetDeck = decksRepo.create({
      id: deckDef.deck.id,
      name: deckDef.deck.name,
      area: deckDef.deck.area,
      description: deckDef.deck.description,
      source_id: 'sample-deck',
      created_at: now,
      updated_at: now,
    });
  }

  const loadedNotes: Note[] = [];
  const loadedCards: Card[] = [];

  // Cache dos note types para não consultar repetidamente
  const noteTypesCache = new Map<string, ReturnType<typeof noteTypesRepo.getById>>();

  // 3. Insere ou carrega as 20 notas de exemplo
  for (const noteDef of deckDef.notes) {
    let note = notesRepo.getById(noteDef.id);
    if (!note) {
      note = notesRepo.create({
        id: noteDef.id,
        note_type_id: noteDef.note_type_id,
        deck_id: targetDeck.id,
        fields: noteDef.fields,
        tags: noteDef.tags,
        source_id: 'sample-deck',
        created_at: now,
        updated_at: now,
      });
    }
    loadedNotes.push(note);

    let nt = noteTypesCache.get(note.note_type_id);
    if (nt === undefined) {
      nt = noteTypesRepo.getById(note.note_type_id);
      noteTypesCache.set(note.note_type_id, nt);
    }

    if (nt) {
      // 4. Resolve e gera os cartões esperados de acordo com os campos e o modelo
      const ords = getExpectedCardOrdsForNote(nt, note.fields);
      const existingCards = cardsRepo.listByDeck(targetDeck.id).filter((c) => c.note_id === note.id);
      const existingOrds = new Set(existingCards.map((c) => c.ord));

      for (const ord of ords) {
        if (!existingOrds.has(ord)) {
          const card = cardsRepo.create({
            note_id: note.id,
            deck_id: targetDeck.id,
            ord,
            due: now,
            stability: 0,
            difficulty: 0,
            elapsed_days: 0,
            scheduled_days: 0,
            learning_steps: 0,
            reps: 0,
            lapses: 0,
            state: 0, // Novo
            suspended: 0,
            source_id: 'sample-deck',
            created_at: now,
            updated_at: now,
          });
          loadedCards.push(card);
        } else {
          const existingCard = existingCards.find((c) => c.ord === ord);
          if (existingCard) {
            loadedCards.push(existingCard);
          }
        }
      }
    }
  }

  // 5. Marca em settings que o deck de exemplo foi carregado
  settingsRepo.set('sampleDeckLoaded', true);

  return {
    loaded: true,
    deck: targetDeck,
    notes: loadedNotes,
    cards: loadedCards,
  };
}
