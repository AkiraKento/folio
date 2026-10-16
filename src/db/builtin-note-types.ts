import { eq } from 'drizzle-orm';
import type { FolioDatabase } from './client';
import { noteTypes, type NoteType } from './schema';
import { extractClozeNumbers } from '../render/cloze';
import { strings } from '../ui/strings';

export const BUILTIN_NOTE_TYPE_IDS = {
  BASIC: '00000000-0000-4000-8000-000000000001',
  BASIC_REVERSED: '00000000-0000-4000-8000-000000000002',
  CLOZE: '00000000-0000-4000-8000-000000000003',
} as const;

export type BuiltinNoteTypeId =
  (typeof BUILTIN_NOTE_TYPE_IDS)[keyof typeof BUILTIN_NOTE_TYPE_IDS];

/**
 * CSS Legado do MVP (utilizado para verificação de hash e migração segura no Passo 9).
 */
export const LEGACY_DEFAULT_CARD_CSS = `.card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 18px;
  line-height: 1.5;
  text-align: center;
  color: #203e3a;
  background-color: transparent;
}

hr#answer {
  border: 0;
  border-top: 1px solid #e0e6e6;
  margin: 1.5em 0;
}`;

export const LEGACY_CLOZE_CARD_CSS = `.card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 18px;
  line-height: 1.5;
  text-align: center;
  color: #203e3a;
  background-color: transparent;
}

.cloze {
  font-weight: 700;
  color: #3a9d7f;
}

hr#answer {
  border: 0;
  border-top: 1px solid #e0e6e6;
  margin: 1.5em 0;
}`;

/**
 * CSS unificado com estrutura do Avicena e cores Calmcoder / Noctis Obscuro (M10 Passo 9):
 * - Cartão com profundidade (.main com border-radius, padding, sombra suave)
 * - Pílulas de tags minimalistas com ciclo de 5 cores (.tags-container, .tag-pill)
 * - Cores Calmcoder (claro: texto #203e3a, fundo #f0f4f0, superfície #ffffff)
 * - Cores Noctis Obscuro (escuro: texto #b2cacd, fundo #031417, superfície #062e32)
 * - Imagens responsivas adaptadas para .question-field e .answer-field
 */
export const WEISS_BUILTIN_CARD_CSS = `/*~~~~~~~~~CORES (Calmcoder)~~~~~~~~~*/
.card {
  color: #203e3a;
  background-color: #f0f4f0;
}

.cloze {
  color: #3a9d7f;
  font-weight: 700;
}

#extra, .reference {
  color: #3a9d7f;
  font-size: 17px;
  text-align: right;
  margin-top: 15px;
}

hr#answer, hr {
  border: 0;
  border-top: 1px solid #e0e6e6;
  margin: 1.5em 0;
}

/*~~~~~~~~MODO ESCURO (Noctis Obscuro)~~~~~~~~*/
.nightMode.card,
.night_mode .card,
.night-mode .card,
.nightMode .card {
  color: #b2cacd !important;
  background-color: #031417 !important;
}

.nightMode .cloze,
.night_mode .cloze,
.night-mode .cloze {
  color: #169fb1 !important;
}

.nightMode hr#answer,
.night_mode hr#answer,
.night-mode hr#answer,
.nightMode hr,
.night_mode hr,
.night-mode hr {
  border-top-color: #083f44;
}

.nightMode .reference,
.night_mode .reference,
.night-mode .reference,
.nightMode #extra,
.night_mode #extra,
.night-mode #extra {
  color: #87a7ab;
}

/*~~~~~~~~ESTRUTURA DO CARD~~~~~~~~*/
.card {
  font-family: 'Lato', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  text-align: center;
  font-size: 1rem;
  height: 100%;
  margin: 0 auto;
  flex-grow: 1;
  padding-bottom: 1em;
  width: 90%;
  min-width: 200px;
  max-width: 750px;
  display: block;
}

/* Superfície com profundidade */
.main {
  font-family: 'Lato', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 20px;
  line-height: 1.5;
  text-align: justify;
  background-color: #ffffff;
  border-radius: 12px;
  padding: 20px;
  margin: 15px auto;
  border: none;
  box-shadow: 0 4px 10px rgba(0, 86, 97, 0.1), 0 1px 3px rgba(0, 86, 97, 0.08);
}

.nightMode .main,
.night_mode .main,
.night-mode .main {
  background-color: #062e32 !important;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* Tags em pílulas minimalistas */
.tags-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 25px;
  margin-bottom: 10px;
}

.tag-pill {
  font-family: 'Lato', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 11px;
  font-weight: 700;
  text-transform: lowercase;
  padding: 3px 10px;
  border-radius: 12px;
  background-color: transparent !important;
  border-width: 1.5px;
  border-style: solid;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(0, 86, 97, 0.15);
  display: inline-block;
}

.nightMode .tag-pill,
.night_mode .tag-pill,
.night-mode .tag-pill {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

/* Ciclo de 5 cores nas pílulas */
.tag-pill:nth-child(5n+1) { border-color: #b8941f; color: #b8941f !important; }
.tag-pill:nth-child(5n+2) { border-color: #5b858b; color: #5b858b !important; }
.tag-pill:nth-child(5n+3) { border-color: #3a9d7f; color: #3a9d7f !important; }
.tag-pill:nth-child(5n+4) { border-color: #203e3a; color: #203e3a !important; }
.tag-pill:nth-child(5n+5) { border-color: #4a90a4; color: #4a90a4 !important; }

.nightMode .tag-pill:nth-child(5n+1), .night_mode .tag-pill:nth-child(5n+1), .night-mode .tag-pill:nth-child(5n+1) { border-color: #d5971a; color: #d5971a !important; }
.nightMode .tag-pill:nth-child(5n+2), .night_mode .tag-pill:nth-child(5n+2), .night-mode .tag-pill:nth-child(5n+2) { border-color: #87a7ab; color: #87a7ab !important; }
.nightMode .tag-pill:nth-child(5n+3), .night_mode .tag-pill:nth-child(5n+3), .night-mode .tag-pill:nth-child(5n+3) { border-color: #169fb1; color: #169fb1 !important; }
.nightMode .tag-pill:nth-child(5n+4), .night_mode .tag-pill:nth-child(5n+4), .night-mode .tag-pill:nth-child(5n+4) { border-color: #49e9a6; color: #49e9a6 !important; }
.nightMode .tag-pill:nth-child(5n+5), .night_mode .tag-pill:nth-child(5n+5), .night-mode .tag-pill:nth-child(5n+5) { border-color: #df769b; color: #df769b !important; }

/* Imagens responsivas */
img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  margin: 15px auto;
  display: block;
}

.question-field img {
  max-width: min(100%, 550px) !important;
  max-height: min(45vh, 400px) !important;
  object-fit: contain;
}

.answer-field img {
  max-width: 100% !important;
  max-height: 80vh !important;
  object-fit: contain;
}`;

export const DEFAULT_CARD_CSS = WEISS_BUILTIN_CARD_CSS;
export const CLOZE_CARD_CSS = WEISS_BUILTIN_CARD_CSS;

export type BuiltinNoteTypeDefinition = Omit<
  NoteType,
  'created_at' | 'updated_at' | 'deleted_at'
>;

/**
 * Definições originais do MVP (usadas como base de comparação de hash para migração).
 */
export const LEGACY_BUILTIN_NOTE_TYPES: Record<
  'BASIC' | 'BASIC_REVERSED' | 'CLOZE',
  BuiltinNoteTypeDefinition
> = {
  BASIC: {
    id: BUILTIN_NOTE_TYPE_IDS.BASIC,
    name: strings.noteTypes.basic,
    kind: 'basic',
    fields: [
      { name: strings.noteTypes.fieldFront, ord: 0 },
      { name: strings.noteTypes.fieldBack, ord: 1 },
    ],
    templates: [
      {
        name: strings.noteTypes.card1,
        ord: 0,
        front: '{{Frente}}',
        back: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Verso}}',
      },
    ],
    css: LEGACY_DEFAULT_CARD_CSS,
    source_id: null,
  },
  BASIC_REVERSED: {
    id: BUILTIN_NOTE_TYPE_IDS.BASIC_REVERSED,
    name: strings.noteTypes.basicReversed,
    kind: 'basic_reversed',
    fields: [
      { name: strings.noteTypes.fieldFront, ord: 0 },
      { name: strings.noteTypes.fieldBack, ord: 1 },
    ],
    templates: [
      {
        name: strings.noteTypes.card1,
        ord: 0,
        front: '{{Frente}}',
        back: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Verso}}',
      },
      {
        name: strings.noteTypes.card2,
        ord: 1,
        front: '{{Verso}}',
        back: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Frente}}',
      },
    ],
    css: LEGACY_DEFAULT_CARD_CSS,
    source_id: null,
  },
  CLOZE: {
    id: BUILTIN_NOTE_TYPE_IDS.CLOZE,
    name: strings.noteTypes.cloze,
    kind: 'cloze',
    fields: [
      { name: strings.noteTypes.fieldText, ord: 0 },
      { name: strings.noteTypes.fieldBackExtra, ord: 1 },
    ],
    templates: [
      {
        name: strings.noteTypes.cloze,
        ord: 0,
        front: '{{cloze:Texto}}',
        back: '{{cloze:Texto}}\n\n<hr id="answer">\n\n{{Verso extra}}',
      },
    ],
    css: LEGACY_CLOZE_CARD_CSS,
    source_id: null,
  },
};

/**
 * Modelos embutidos reescritos com estrutura Avicena (M10 Passo 9).
 */
export const BUILTIN_NOTE_TYPES: Record<
  'BASIC' | 'BASIC_REVERSED' | 'CLOZE',
  BuiltinNoteTypeDefinition
> = {
  BASIC: {
    id: BUILTIN_NOTE_TYPE_IDS.BASIC,
    name: strings.noteTypes.basic,
    kind: 'basic',
    fields: [
      { name: strings.noteTypes.fieldFront, ord: 0 },
      { name: strings.noteTypes.fieldBack, ord: 1 },
    ],
    templates: [
      {
        name: strings.noteTypes.card1,
        ord: 0,
        front: '<div class="main question-field" id="question">{{Frente}}</div>',
        back: '{{FrontSide}}\n\n<hr id="answer">\n\n<div class="main answer-field" id="answer">{{Verso}}</div>\n\n{{#Extra}}<div class="reference">{{Extra}}</div>{{/Extra}}\n{{#Referência}}<div class="reference">{{Referência}}</div>{{/Referência}}\n\n{{#Tags}}\n<div class="tags-container">{{weiss-tags:Tags}}</div>\n{{/Tags}}',
      },
    ],
    css: WEISS_BUILTIN_CARD_CSS,
    source_id: null,
  },
  BASIC_REVERSED: {
    id: BUILTIN_NOTE_TYPE_IDS.BASIC_REVERSED,
    name: strings.noteTypes.basicReversed,
    kind: 'basic_reversed',
    fields: [
      { name: strings.noteTypes.fieldFront, ord: 0 },
      { name: strings.noteTypes.fieldBack, ord: 1 },
    ],
    templates: [
      {
        name: strings.noteTypes.card1,
        ord: 0,
        front: '<div class="main question-field" id="question">{{Frente}}</div>',
        back: '{{FrontSide}}\n\n<hr id="answer">\n\n<div class="main answer-field" id="answer">{{Verso}}</div>\n\n{{#Extra}}<div class="reference">{{Extra}}</div>{{/Extra}}\n{{#Referência}}<div class="reference">{{Referência}}</div>{{/Referência}}\n\n{{#Tags}}\n<div class="tags-container">{{weiss-tags:Tags}}</div>\n{{/Tags}}',
      },
      {
        name: strings.noteTypes.card2,
        ord: 1,
        front: '<div class="main question-field" id="question">{{Verso}}</div>',
        back: '{{FrontSide}}\n\n<hr id="answer">\n\n<div class="main answer-field" id="answer">{{Frente}}</div>\n\n{{#Extra}}<div class="reference">{{Extra}}</div>{{/Extra}}\n{{#Referência}}<div class="reference">{{Referência}}</div>{{/Referência}}\n\n{{#Tags}}\n<div class="tags-container">{{weiss-tags:Tags}}</div>\n{{/Tags}}',
      },
    ],
    css: WEISS_BUILTIN_CARD_CSS,
    source_id: null,
  },
  CLOZE: {
    id: BUILTIN_NOTE_TYPE_IDS.CLOZE,
    name: strings.noteTypes.cloze,
    kind: 'cloze',
    fields: [
      { name: strings.noteTypes.fieldText, ord: 0 },
      { name: strings.noteTypes.fieldBackExtra, ord: 1 },
    ],
    templates: [
      {
        name: strings.noteTypes.cloze,
        ord: 0,
        front: '<div class="main question-field" id="question">{{cloze:Texto}}</div>\n\n{{#Tags}}\n<div class="tags-container">{{weiss-tags:Tags}}</div>\n{{/Tags}}',
        back: '<div class="main answer-field" id="answer">{{cloze:Texto}}</div>\n\n<hr id="answer">\n\n{{#Verso extra}}<div class="reference">{{Verso extra}}</div>{{/Verso extra}}\n{{#Extra}}<div class="reference">{{Extra}}</div>{{/Extra}}\n{{#Referência}}<div class="reference">{{Referência}}</div>{{/Referência}}\n\n{{#Tags}}\n<div class="tags-container">{{weiss-tags:Tags}}</div>\n{{/Tags}}',
      },
    ],
    css: WEISS_BUILTIN_CARD_CSS,
    source_id: null,
  },
};

/**
 * Normaliza templates e CSS para geração de hash determinístico.
 */
export function normalizeTemplateCss(templates: unknown, css: string | null | undefined): string {
  const normTemplates = JSON.stringify(templates ?? [])
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
  const normCss = (css || '').replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  return `${normTemplates}:::${normCss}`;
}

/**
 * Gera um hash determinístico de templates + CSS (algoritmo djb2).
 */
export function computeNoteTypeHash(templates: unknown, css: string | null | undefined): string {
  const str = normalizeTemplateCss(templates, css);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

/**
 * Verifica se um modelo salvo no banco ainda possui os templates e CSS originais do MVP (intocados).
 * Se o usuário tiver alterado templates ou CSS, retorna false.
 */
export function isLegacyUntouchedBuiltin(
  existing: Pick<NoteType, 'id' | 'templates' | 'css'>
): boolean {
  if (existing.id === BUILTIN_NOTE_TYPE_IDS.BASIC) {
    const isLegacyBasicTpl =
      computeNoteTypeHash(existing.templates, '') ===
      computeNoteTypeHash(LEGACY_BUILTIN_NOTE_TYPES.BASIC.templates, '');
    const isLegacyCss =
      computeNoteTypeHash([], existing.css) ===
      computeNoteTypeHash([], LEGACY_DEFAULT_CARD_CSS);
    return isLegacyBasicTpl && isLegacyCss;
  }

  if (existing.id === BUILTIN_NOTE_TYPE_IDS.BASIC_REVERSED) {
    const isLegacyRevTpl =
      computeNoteTypeHash(existing.templates, '') ===
      computeNoteTypeHash(LEGACY_BUILTIN_NOTE_TYPES.BASIC_REVERSED.templates, '');
    const isLegacyCss =
      computeNoteTypeHash([], existing.css) ===
      computeNoteTypeHash([], LEGACY_DEFAULT_CARD_CSS);
    return isLegacyRevTpl && isLegacyCss;
  }

  if (existing.id === BUILTIN_NOTE_TYPE_IDS.CLOZE) {
    const isLegacyClozeTpl =
      computeNoteTypeHash(existing.templates, '') ===
      computeNoteTypeHash(LEGACY_BUILTIN_NOTE_TYPES.CLOZE.templates, '');
    const isLegacyCss =
      computeNoteTypeHash([], existing.css) ===
      computeNoteTypeHash([], LEGACY_CLOZE_CARD_CSS) ||
      computeNoteTypeHash([], existing.css) ===
      computeNoteTypeHash([], LEGACY_DEFAULT_CARD_CSS);
    return isLegacyClozeTpl && isLegacyCss;
  }

  return false;
}

/**
 * Migra modelos embutidos no banco para a estrutura Avicena (M10 Passo 9).
 * - Atualiza apenas modelos com templates e CSS originais intocados (compara por hash).
 * - Se o usuário tiver editado templates ou CSS, NÃO toca no modelo.
 * - Se não existirem ainda, insere-os.
 */
export function migrateBuiltinNoteTypes(db: FolioDatabase): {
  migratedCount: number;
  untouchedIds: string[];
  migratedIds: string[];
} {
  const now = Date.now();
  let migratedCount = 0;
  const untouchedIds: string[] = [];
  const migratedIds: string[] = [];

  for (const item of Object.values(BUILTIN_NOTE_TYPES)) {
    const rows = db
      .select()
      .from(noteTypes)
      .where(eq(noteTypes.id, item.id))
      .all();
    const existing = rows[0] ?? null;

    if (!existing) {
      db.insert(noteTypes).values({
        ...item,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      }).run();
      migratedCount++;
      migratedIds.push(item.id);
      continue;
    }

    // Se já possui o novo hash do Avicena, já está atualizado
    if (
      computeNoteTypeHash(existing.templates, existing.css) ===
      computeNoteTypeHash(item.templates, item.css)
    ) {
      continue;
    }

    // Se possui templates e CSS originais intocados, aplica a migração
    if (isLegacyUntouchedBuiltin(existing)) {
      db.update(noteTypes)
        .set({
          templates: item.templates,
          css: item.css,
          updated_at: now,
        })
        .where(eq(noteTypes.id, item.id))
        .run();
      migratedCount++;
      migratedIds.push(item.id);
    } else {
      // Usuário editou o modelo! Não mexer.
      untouchedIds.push(item.id);
    }
  }

  return { migratedCount, untouchedIds, migratedIds };
}

/**
 * Retorna os 3 note types embutidos como instâncias completas de NoteType com timestamps.
 */
export function getBuiltinNoteTypes(timestamp: number = Date.now()): NoteType[] {
  return [
    { ...BUILTIN_NOTE_TYPES.BASIC, created_at: timestamp, updated_at: timestamp, deleted_at: null },
    {
      ...BUILTIN_NOTE_TYPES.BASIC_REVERSED,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    },
    { ...BUILTIN_NOTE_TYPES.CLOZE, created_at: timestamp, updated_at: timestamp, deleted_at: null },
  ];
}

/**
 * Retorna os números ordinais (ord) de cards esperados para uma nota,
 * de acordo com o note type e o preenchimento de seus campos.
 */
export function getExpectedCardOrdsForNote(
  noteType: Pick<NoteType, 'kind' | 'templates'>,
  fields: Record<string, string>
): number[] {
  if (noteType.kind === 'cloze') {
    const clozeNumbers = new Set<number>();

    for (const val of Object.values(fields)) {
      if (!val) continue;
      for (const num of extractClozeNumbers(val)) {
        clozeNumbers.add(num - 1);
      }
    }

    if (clozeNumbers.size === 0) {
      return [0];
    }

    return Array.from(clozeNumbers).sort((a, b) => a - b);
  }

  if (noteType.kind === 'basic_reversed') {
    const ords: number[] = [];
    const frontText = fields[strings.noteTypes.fieldFront]?.trim();
    const backText = fields[strings.noteTypes.fieldBack]?.trim();

    if (frontText) {
      ords.push(0);
    }
    if (backText) {
      ords.push(1);
    }

    return ords.length > 0 ? ords : [0];
  }

  // Modelos básicos ou customizados geram um card para cada template existente
  return noteType.templates.map((t) => t.ord);
}
