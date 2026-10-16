import type { NoteType, NoteTypeTemplate } from '../db/schema';

export type { NoteType, NoteTypeTemplate };

export type CardSide = 'front' | 'back';

export interface RenderContext {
  /** Campos da nota como pares nome -> valor HTML/texto */
  fields: Record<string, string>;
  /** Lista de tags da nota */
  tags?: string[];
  /** Nome do deck completo (ex: Medicina::Cardiologia) */
  deckName?: string;
  /** Nome do modelo de card (ex: Card 1) */
  cardName?: string;
  /** Nome do noteType/modelo (ex: avicena, AnKing) para deduplicação de avisos no log */
  modelName?: string;
  /** Bandeira do card (CardFlag) */
  cardFlag?: number | string;
  /** Índice ordinal do card (0-indexed) */
  cardOrd?: number;
  /** Número da lacuna cloze ativa (1-indexed: 1 para c1, 2 para c2...) */
  clozeNumber?: number;
  /** Lado sendo renderizado ('front' | 'back') */
  side?: CardSide;
  /** HTML da frente já renderizado, usado para preencher {{FrontSide}} no verso */
  frontHtml?: string;
  /** No Modo Consulta: todas as lacunas são reveladas e marcadas com <span class="cloze"> */
  allClozesRevealed?: boolean;
}

export interface RenderTemplateOptions extends RenderContext {
  /** Template em si (ex: '{{Frente}}') quando passado em objeto único */
  template?: string;
}

export interface RenderCardInput {
  /** Note type com os templates e tipo ('basic', 'cloze', etc.) */
  noteType: Pick<NoteType, 'kind' | 'templates'> & { name?: string };
  /** Campos da nota */
  fields: Record<string, string>;
  /** Índice ordinal do card sendo gerado (0, 1, 2...) */
  cardOrd: number;
  /** Lado a ser renderizado */
  side: CardSide;
  /** Tags opcionais */
  tags?: string[];
  /** Nome do deck opcional */
  deckName?: string;
  /** No Modo Consulta: todas as lacunas são reveladas e marcadas com <span class="cloze"> */
  allClozesRevealed?: boolean;
}

export interface RenderCardFullInput {
  /** Note type com os templates e tipo ('basic', 'cloze', etc.) */
  noteType: Pick<NoteType, 'kind' | 'templates'> & { name?: string };
  /** Campos da nota */
  fields: Record<string, string>;
  /** Índice ordinal do card sendo gerado (0, 1, 2...) */
  cardOrd: number;
  /** Tags opcionais */
  tags?: string[];
  /** Nome do deck opcional */
  deckName?: string;
  /** No Modo Consulta: todas as lacunas são reveladas e marcadas com <span class="cloze"> */
  allClozesRevealed?: boolean;
}


export interface RenderCardResult {
  front: string;
  back: string;
}

export interface ClozeProcessOptions {
  /** Lado atual ('front' | 'back') */
  side: CardSide;
  /** Número da lacuna ativa (1 para c1, 2 para c2...) */
  targetClozeNumber: number;
  /** Se verdadeiro, todas as lacunas aparecem reveladas como no Modo Consulta */
  allClozesRevealed?: boolean;
}
