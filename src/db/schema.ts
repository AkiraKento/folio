import { relations } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

export interface NoteTypeField {
  name: string;
  ord: number;
}

export interface NoteTypeTemplate {
  name: string;
  ord: number;
  front: string;
  back: string;
}

// 1. decks
export const decks = sqliteTable(
  'decks',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    area: text('area'),
    description: text('description'),
    source_id: text('source_id'),
    created_at: integer('created_at').notNull(),
    updated_at: integer('updated_at').notNull(),
    deleted_at: integer('deleted_at'),
  },
  (table) => [
    index('ix_decks_name').on(table.name),
  ]
);

// 2. note_types
export const noteTypes = sqliteTable('note_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['basic', 'basic_reversed', 'cloze', 'custom'] }).notNull(),
  fields: text('fields', { mode: 'json' }).$type<NoteTypeField[]>().notNull(),
  templates: text('templates', { mode: 'json' }).$type<NoteTypeTemplate[]>().notNull(),
  css: text('css').notNull().default(''),
  source_id: text('source_id'),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
  deleted_at: integer('deleted_at'),
});

// 3. notes
export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    note_type_id: text('note_type_id')
      .notNull()
      .references(() => noteTypes.id),
    deck_id: text('deck_id')
      .notNull()
      .references(() => decks.id),
    fields: text('fields', { mode: 'json' }).$type<Record<string, string>>().notNull(),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull(),
    source_id: text('source_id'),
    created_at: integer('created_at').notNull(),
    updated_at: integer('updated_at').notNull(),
    deleted_at: integer('deleted_at'),
  },
  (table) => [
    index('ix_notes_deck_id').on(table.deck_id),
    index('ix_notes_note_type_id').on(table.note_type_id),
  ]
);

// 4. cards
export const cards = sqliteTable(
  'cards',
  {
    id: text('id').primaryKey(),
    note_id: text('note_id')
      .notNull()
      .references(() => notes.id),
    deck_id: text('deck_id')
      .notNull()
      .references(() => decks.id),
    ord: integer('ord').notNull(),
    // estado FSRS (espelha o Card do ts-fsrs)
    due: integer('due').notNull(),
    stability: real('stability').notNull().default(0),
    difficulty: real('difficulty').notNull().default(0),
    elapsed_days: integer('elapsed_days').notNull().default(0),
    scheduled_days: integer('scheduled_days').notNull().default(0),
    learning_steps: integer('learning_steps').notNull().default(0),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    state: integer('state').notNull().default(0),
    last_review: integer('last_review'),
    suspended: integer('suspended').notNull().default(0),
    buried_until: integer('buried_until'),
    source_id: text('source_id'),
    created_at: integer('created_at').notNull(),
    updated_at: integer('updated_at').notNull(),
    deleted_at: integer('deleted_at'),
  },
  (table) => [
    index('ix_cards_note_id').on(table.note_id),
    index('ix_cards_deck_id').on(table.deck_id),
    index('ix_cards_due').on(table.due),
  ]
);

// 5. review_logs
export const reviewLogs = sqliteTable(
  'review_logs',
  {
    id: text('id').primaryKey(),
    card_id: text('card_id')
      .notNull()
      .references(() => cards.id),
    rating: integer('rating').notNull(),
    state: integer('state').notNull(),
    due: integer('due').notNull(),
    stability: real('stability').notNull(),
    difficulty: real('difficulty').notNull(),
    elapsed_days: integer('elapsed_days').notNull(),
    last_elapsed_days: integer('last_elapsed_days').notNull(),
    scheduled_days: integer('scheduled_days').notNull(),
    review_ms: integer('review_ms').notNull(),
    reviewed_at: integer('reviewed_at').notNull(),
    created_at: integer('created_at').notNull(),
    updated_at: integer('updated_at').notNull(),
    deleted_at: integer('deleted_at'),
  },
  (table) => [
    index('ix_review_logs_card_id').on(table.card_id),
    index('ix_review_logs_reviewed_at').on(table.reviewed_at),
  ]
);

// 6. annotations (conforme MODO_CONSULTA.md §4)
export const annotations = sqliteTable(
  'annotations',
  {
    id: text('id').primaryKey(),
    note_id: text('note_id')
      .notNull()
      .references(() => notes.id),
    group_key: text('group_key'),
    kind: text('kind', { enum: ['hl', 'ul'] }).notNull(),
    color: text('color', { enum: ['amarelo', 'verde', 'azul', 'rosa', 'laranja'] }).notNull(),
    quote: text('quote').notNull(),
    prefix: text('prefix').notNull().default(''),
    suffix: text('suffix').notNull().default(''),
    start: integer('start').notNull().default(0),
    end: integer('end').notNull().default(0),
    note: text('note').notNull().default(''),
    label: text('label').notNull().default(''),
    created_at: integer('created_at').notNull(),
    updated_at: integer('updated_at').notNull(),
    deleted_at: integer('deleted_at'),
  },
  (table) => [
    index('ix_ann_note').on(table.note_id),
    index('ix_ann_group').on(table.group_key),
  ]
);

// 7. media
export const media = sqliteTable(
  'media',
  {
    id: text('id').primaryKey(),
    filename: text('filename').notNull(),
    sha1: text('sha1').notNull(),
    bytes: integer('bytes').notNull(),
    mime: text('mime').notNull(),
    created_at: integer('created_at').notNull(),
    updated_at: integer('updated_at').notNull(),
    deleted_at: integer('deleted_at'),
  },
  (table) => [
    index('ix_media_filename').on(table.filename),
  ]
);

// 8. settings
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
  deleted_at: integer('deleted_at'),
});

// 9. consulta_pos ("continuar lendo")
export const consultaPos = sqliteTable('consulta_pos', {
  deck_query: text('deck_query').primaryKey(),
  unit_index: integer('unit_index').notNull().default(0),
  scroll_offset: real('scroll_offset').notNull().default(0),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
  deleted_at: integer('deleted_at'),
});

// Relações Drizzle para conveniência de consultas relacionais
export const decksRelations = relations(decks, ({ many }) => ({
  notes: many(notes),
  cards: many(cards),
}));

export const noteTypesRelations = relations(noteTypes, ({ many }) => ({
  notes: many(notes),
}));

export const notesRelations = relations(notes, ({ one, many }) => ({
  deck: one(decks, {
    fields: [notes.deck_id],
    references: [decks.id],
  }),
  noteType: one(noteTypes, {
    fields: [notes.note_type_id],
    references: [noteTypes.id],
  }),
  cards: many(cards),
  annotations: many(annotations),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  note: one(notes, {
    fields: [cards.note_id],
    references: [notes.id],
  }),
  deck: one(decks, {
    fields: [cards.deck_id],
    references: [decks.id],
  }),
  reviewLogs: many(reviewLogs),
}));

export const reviewLogsRelations = relations(reviewLogs, ({ one }) => ({
  card: one(cards, {
    fields: [reviewLogs.card_id],
    references: [cards.id],
  }),
}));

export const annotationsRelations = relations(annotations, ({ one }) => ({
  note: one(notes, {
    fields: [annotations.note_id],
    references: [notes.id],
  }),
}));

// Tipos inferidos
export type Deck = typeof decks.$inferSelect;
export type InsertDeck = typeof decks.$inferInsert;

export type NoteType = typeof noteTypes.$inferSelect;
export type InsertNoteType = typeof noteTypes.$inferInsert;

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

export type Card = typeof cards.$inferSelect;
export type InsertCard = typeof cards.$inferInsert;

export type ReviewLog = typeof reviewLogs.$inferSelect;
export type InsertReviewLog = typeof reviewLogs.$inferInsert;

export type Annotation = typeof annotations.$inferSelect;
export type InsertAnnotation = typeof annotations.$inferInsert;

export type Media = typeof media.$inferSelect;
export type InsertMedia = typeof media.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;

export type ConsultaPos = typeof consultaPos.$inferSelect;
export type InsertConsultaPos = typeof consultaPos.$inferInsert;
