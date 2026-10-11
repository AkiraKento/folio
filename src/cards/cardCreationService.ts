import { NotesRepository } from '@/db/repositories/notes';
import { CardsRepository } from '@/db/repositories/cards';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { getExpectedCardOrdsForNote } from '@/db/builtin-note-types';
import type { Note, Card } from '@/db/schema';

export interface CardCreationRepos {
  notesRepo?: NotesRepository;
  cardsRepo?: CardsRepository;
  noteTypesRepo?: NoteTypesRepository;
}

export interface CreateNoteWithCardsInput {
  deckId: string;
  noteTypeId: string;
  fields: Record<string, string>;
  tags?: string[];
  repos?: CardCreationRepos;
}

export interface UpdateNoteWithCardsInput {
  noteId: string;
  deckId: string;
  noteTypeId: string;
  fields: Record<string, string>;
  tags?: string[];
  repos?: CardCreationRepos;
}

export interface NoteWithCreatedCards {
  note: Note;
  cards: Card[];
}

/**
 * Cria uma nova nota e gera automaticamente os cards correspondentes
 * aos templates ou lacunas do modelo (Básico, Invertido, Cloze, etc.).
 */
export function createNoteWithCards(input: CreateNoteWithCardsInput): NoteWithCreatedCards {
  const notesRepo = input.repos?.notesRepo ?? new NotesRepository();
  const cardsRepo = input.repos?.cardsRepo ?? new CardsRepository();
  const noteTypesRepo = input.repos?.noteTypesRepo ?? new NoteTypesRepository();

  const noteType = noteTypesRepo.getById(input.noteTypeId);
  if (!noteType) {
    throw new Error(`Note type not found: ${input.noteTypeId}`);
  }

  // Cria o registro da nota
  const note = notesRepo.create({
    deck_id: input.deckId,
    note_type_id: input.noteTypeId,
    fields: input.fields,
    tags: input.tags ?? [],
  });

  // Calcula os ords de cards que devem existir para a nota
  const expectedOrds = getExpectedCardOrdsForNote(noteType, input.fields);
  const now = Date.now();

  const createdCards: Card[] = [];
  for (const ord of expectedOrds) {
    const card = cardsRepo.create({
      note_id: note.id,
      deck_id: input.deckId,
      ord,
      due: now,
      state: 0, // Novo
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
    });
    createdCards.push(card);
  }

  return {
    note,
    cards: createdCards,
  };
}

/**
 * Atualiza uma nota existente e sincroniza seus cards:
 * - Se novas lacunas (ou cards) surgiram, cria os cards correspondentes.
 * - Se o deck da nota mudou, atualiza também nos cards associados.
 */
export function updateNoteWithCards(input: UpdateNoteWithCardsInput): NoteWithCreatedCards {
  const notesRepo = input.repos?.notesRepo ?? new NotesRepository();
  const cardsRepo = input.repos?.cardsRepo ?? new CardsRepository();
  const noteTypesRepo = input.repos?.noteTypesRepo ?? new NoteTypesRepository();

  const noteType = noteTypesRepo.getById(input.noteTypeId);
  if (!noteType) {
    throw new Error(`Note type not found: ${input.noteTypeId}`);
  }

  // Atualiza a nota
  const updatedNote = notesRepo.update(input.noteId, {
    deck_id: input.deckId,
    note_type_id: input.noteTypeId,
    fields: input.fields,
    tags: input.tags ?? [],
  });

  if (!updatedNote) {
    throw new Error(`Note not found: ${input.noteId}`);
  }

  // Lista cards existentes ativos
  const existingCards = cardsRepo.listByNote(input.noteId);
  const existingOrds = new Set(existingCards.map((c) => c.ord));

  // Calcula ords esperados
  const expectedOrds = getExpectedCardOrdsForNote(noteType, input.fields);
  const expectedOrdsSet = new Set(expectedOrds);
  const now = Date.now();

  const currentCards: Card[] = [];

  // Atualiza ou desativa cards existentes
  for (const card of existingCards) {
    if (expectedOrdsSet.has(card.ord)) {
      // Se o deck mudou na nota, atualiza no card também
      if (card.deck_id !== input.deckId) {
        const updatedCard = cardsRepo.update(card.id, { deck_id: input.deckId });
        currentCards.push(updatedCard ?? card);
      } else {
        currentCards.push(card);
      }
    } else {
      // Ord não mais existente (ex.: lacuna removida)
      cardsRepo.softDelete(card.id);
    }
  }

  // Cria cards novos que ainda não existiam (ex.: c2 adicionado)
  for (const ord of expectedOrds) {
    if (!existingOrds.has(ord)) {
      const newCard = cardsRepo.create({
        note_id: updatedNote.id,
        deck_id: input.deckId,
        ord,
        due: now,
        state: 0,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
      });
      currentCards.push(newCard);
    }
  }

  currentCards.sort((a, b) => a.ord - b.ord);

  return {
    note: updatedNote,
    cards: currentCards,
  };
}
