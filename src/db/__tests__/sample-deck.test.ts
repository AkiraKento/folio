import { createTestDatabase } from './test-utils';
import {
  SAMPLE_DECK_DEFINITION,
  loadSampleDeck,
  isSampleDeckLoaded,
  type SampleDeckNoteDefinition,
} from '../sample-deck';
import { BUILTIN_NOTE_TYPE_IDS } from '../builtin-note-types';
import { DecksRepository } from '../repositories/decks';
import { NotesRepository } from '../repositories/notes';
import { CardsRepository } from '../repositories/cards';
import { SettingsRepository } from '../repositories/settings';

describe('Deck de Exemplo Autoral', () => {
  describe('Definição estática do deck de exemplo', () => {
    test('possui exatamente 20 notas', () => {
      expect(SAMPLE_DECK_DEFINITION.notes).toHaveLength(20);
    });

    test('todas as 20 notas contêm o marcador [EXEMPLO] nos campos ou tags', () => {
      for (const note of SAMPLE_DECK_DEFINITION.notes) {
        const fieldsContent = Object.values(note.fields).join(' ');
        const hasExemploInFields = fieldsContent.includes('[EXEMPLO]');
        const hasExemploInTags = note.tags.some((tag: string) => tag.includes('[EXEMPLO]'));

        expect(hasExemploInFields).toBe(true);
        expect(hasExemploInTags).toBe(true);
      }
    });

    test('contém notas com modelo Básico e com modelo Cloze', () => {
      const basicNotes = SAMPLE_DECK_DEFINITION.notes.filter(
        (n: SampleDeckNoteDefinition) => n.note_type_id === BUILTIN_NOTE_TYPE_IDS.BASIC
      );
      const clozeNotes = SAMPLE_DECK_DEFINITION.notes.filter(
        (n: SampleDeckNoteDefinition) => n.note_type_id === BUILTIN_NOTE_TYPE_IDS.CLOZE
      );

      expect(basicNotes.length).toBeGreaterThanOrEqual(5);
      expect(clozeNotes.length).toBeGreaterThanOrEqual(5);
      expect(basicNotes.length + clozeNotes.length).toBe(20);
    });

    test('valida estrutura dos campos para notas Básicas', () => {
      const basicNotes = SAMPLE_DECK_DEFINITION.notes.filter(
        (n: SampleDeckNoteDefinition) => n.note_type_id === BUILTIN_NOTE_TYPE_IDS.BASIC
      );

      for (const note of basicNotes) {
        expect(note.fields.Frente).toBeDefined();
        expect(note.fields.Frente.trim().length).toBeGreaterThan(0);
        expect(note.fields.Verso).toBeDefined();
        expect(note.fields.Verso.trim().length).toBeGreaterThan(0);
      }
    });

    test('valida estrutura dos campos e sintaxe cloze para notas Cloze', () => {
      const clozeNotes = SAMPLE_DECK_DEFINITION.notes.filter(
        (n: SampleDeckNoteDefinition) => n.note_type_id === BUILTIN_NOTE_TYPE_IDS.CLOZE
      );

      for (const note of clozeNotes) {
        expect(note.fields.Texto).toBeDefined();
        expect(note.fields.Texto).toMatch(/\{\{c\d+::[^}]+\}\}/);
        expect(note.fields['Verso extra']).toBeDefined();
      }
    });
  });

  describe('Carga do deck de exemplo no primeiro uso (loadSampleDeck)', () => {
    test('carrega o deck de exemplo no primeiro uso e registra em settings', () => {
      const { db } = createTestDatabase();
      const settingsRepo = new SettingsRepository(db);
      const decksRepo = new DecksRepository(db);
      const notesRepo = new NotesRepository(db);
      const cardsRepo = new CardsRepository(db);

      expect(isSampleDeckLoaded(db)).toBe(false);

      const result = loadSampleDeck(db);

      expect(result.loaded).toBe(true);
      expect(result.deck).toBeDefined();
      expect(result.deck.name).toBe(SAMPLE_DECK_DEFINITION.deck.name);
      expect(result.notes).toHaveLength(20);
      expect(result.cards.length).toBeGreaterThanOrEqual(20);

      // Confirma presença no banco
      const savedDeck = decksRepo.getById(result.deck.id);
      expect(savedDeck).not.toBeNull();
      expect(savedDeck?.name).toBe(SAMPLE_DECK_DEFINITION.deck.name);

      const deckNotes = notesRepo.listByDeck(result.deck.id);
      expect(deckNotes).toHaveLength(20);

      const deckCards = cardsRepo.listByDeck(result.deck.id);
      expect(deckCards).toHaveLength(result.cards.length);

      // Todos os cards devem ter valores FSRS válidos
      for (const card of deckCards) {
        expect(card.state).toBe(0); // Novo
        expect(card.reps).toBe(0);
        expect(card.lapses).toBe(0);
        expect(card.stability).toBe(0);
        expect(card.difficulty).toBe(0);
        expect(card.due).toBeGreaterThan(0);
      }

      // Settings deve registrar que foi carregado
      expect(isSampleDeckLoaded(db)).toBe(true);
      expect(settingsRepo.get('sampleDeckLoaded')).toBe(true);
    });

    test('é idempotente: chamadas subsequentes não duplicam decks, notas ou cards', () => {
      const { db } = createTestDatabase();
      const decksRepo = new DecksRepository(db);
      const notesRepo = new NotesRepository(db);
      const cardsRepo = new CardsRepository(db);

      const firstCall = loadSampleDeck(db);
      expect(firstCall.loaded).toBe(true);

      const secondCall = loadSampleDeck(db);
      expect(secondCall.loaded).toBe(false); // Já estava carregado
      expect(secondCall.deck.id).toBe(firstCall.deck.id);
      expect(secondCall.notes).toHaveLength(20);
      expect(secondCall.cards.length).toBe(firstCall.cards.length);

      // Verificação direta no banco
      const allDecks = decksRepo.listAll();
      expect(allDecks).toHaveLength(1);

      const allNotes = notesRepo.listAll();
      expect(allNotes).toHaveLength(20);

      const allCards = cardsRepo.listByDeck(firstCall.deck.id);
      expect(allCards).toHaveLength(firstCall.cards.length);
    });

    test('permite forçar recarga se solicitado', () => {
      const { db } = createTestDatabase();
      loadSampleDeck(db);

      const forcedCall = loadSampleDeck(db, { force: true });
      expect(forcedCall.loaded).toBe(true);
      expect(forcedCall.notes).toHaveLength(20);
    });

    test('carrega decks autorais distintos para cada área de estudo', () => {
      const areas: ('medicina' | 'concursos' | 'direito' | 'psicologia' | 'geral')[] = [
        'medicina',
        'concursos',
        'direito',
        'psicologia',
        'geral',
      ];

      for (const area of areas) {
        const { db } = createTestDatabase();
        const result = loadSampleDeck(db, { area });

        expect(result.loaded).toBe(true);
        expect(result.notes).toHaveLength(20);
        expect(result.cards.length).toBeGreaterThanOrEqual(20);

        for (const note of result.notes) {
          const fieldsStr = Object.values(note.fields).join(' ');
          expect(fieldsStr.includes('[EXEMPLO]')).toBe(true);
        }
      }
    });
  });
});
