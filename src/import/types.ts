export interface AnkiFieldDef {
  name: string;
  ord: number;
}

export interface AnkiTemplateDef {
  name: string;
  ord: number;
  qfmt: string;
  afmt: string;
}

export interface AnkiModel {
  id: number | string;
  name: string;
  type: number; // 0 = standard, 1 = cloze
  flds: AnkiFieldDef[];
  tmpls: AnkiTemplateDef[];
  css: string;
}

export interface AnkiDeck {
  id: number | string;
  name: string;
  desc?: string;
}

export interface AnkiRawNote {
  id: number | string;
  mid: number | string;
  tags: string;
  flds: string; // Separado por \x1f
  sfld?: string;
  data?: string;
}

export interface AnkiParsedNote {
  id: string; // source_id
  modelId: string;
  deckId?: string;
  fields: Record<string, string>;
  tags: string[];
  rawFields: string[];
}

export interface AnkiRawCard {
  id: number | string;
  nid: number | string;
  did: number | string;
  ord: number;
  type?: number;
  queue?: number;
  due?: number;
  ivl?: number;
  factor?: number;
  reps?: number;
  lapses?: number;
  data?: string;
}

export interface AnkiParsedCard {
  id: string; // source_id
  noteId: string; // Anki note id
  deckId: string; // Anki deck id
  ord: number;
  queue: number;
  due: number;
  ivl: number;
  type: number;
  reps: number;
  lapses: number;
  suspended: boolean;
  data?: string;
}

export interface AnkiRawRevlog {
  id: number | bigint;
  cid: number | bigint | string;
  usn?: number;
  ease: number;
  ivl: number;
  lastIvl?: number;
  factor?: number;
  time: number;
  type: number;
}

export interface AnkiParsedRevlog {
  id: number; // timestamp em ms da revisão
  cardId: string; // source_id do card
  ease: number;
  ivl: number;
  lastIvl: number;
  factor: number;
  time: number;
  type: number;
}

export interface AnkiCollectionData {
  crt?: number; // collection creation timestamp (em segundos)
  models: Map<string, AnkiModel>;
  decks: Map<string, AnkiDeck>;
  notes: AnkiParsedNote[];
  cards: AnkiParsedCard[];
  revlogs: AnkiParsedRevlog[];
}

export interface AnkiSqliteReader {
  all<T = Record<string, unknown>>(query: string, params?: unknown[]): T[];
  get<T = Record<string, unknown>>(query: string, params?: unknown[]): T | null | undefined;
}

export type AnkiMediaMap = Record<string, string>;

export interface ExtractedApkg {
  databaseBytes: Uint8Array;
  dbFileName: 'collection.anki2' | 'collection.anki21';
  mediaMap: AnkiMediaMap;
  getMediaFile: (key: string) => Promise<Uint8Array | null>;
}

export interface ImportPreviewDeck {
  sourceId: string;
  name: string;
  notesCount: number;
  cardsCount: number;
}

export interface ImportPreview {
  decks: ImportPreviewDeck[];
  totalNotes: number;
  totalCards: number;
  totalMedia: number;
  modelsCount: number;
  hasFsrsData?: boolean;
  hasExistingIntervals?: boolean;
  totalRevlogs?: number;
  warning?: string;
  fileFormat?: 'apkg' | 'csv';
}

export type ScheduleImportMode = 'keep_intervals' | 'reset_new';

export type ImportProgressStage =
  | 'unzipping'
  | 'reading_db'
  | 'importing_decks'
  | 'importing_notes'
  | 'importing_cards'
  | 'importing_revlogs'
  | 'importing_media'
  | 'completed';

export interface ImportProgress {
  stage: ImportProgressStage;
  current: number;
  total: number;
  message: string;
}

export interface ImportOptions {
  scheduleMode?: ScheduleImportMode;
  onProgress?: (progress: ImportProgress) => void;
  openSqliteReader?: (databaseBytes: Uint8Array) => Promise<AnkiSqliteReader> | AnkiSqliteReader;
}

export interface ImportResult {
  importedDecks: number;
  importedNotes: number;
  importedCards: number;
  importedMedia: number;
  importedRevlogs: number;
  deckIds: string[];
  createdNotes?: number;
  updatedNotes?: number;
  createdCards?: number;
  updatedCards?: number;
}
