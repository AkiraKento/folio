import type { NoteType } from './schema';
import { extractClozeNumbers } from '../render/cloze';
import { strings } from '../ui/strings';

export const BUILTIN_NOTE_TYPE_IDS = {
  BASIC: '00000000-0000-4000-8000-000000000001',
  BASIC_REVERSED: '00000000-0000-4000-8000-000000000002',
  CLOZE: '00000000-0000-4000-8000-000000000003',
} as const;

export type BuiltinNoteTypeId =
  (typeof BUILTIN_NOTE_TYPE_IDS)[keyof typeof BUILTIN_NOTE_TYPE_IDS];

export const DEFAULT_CARD_CSS = `.card {
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

export const CLOZE_CARD_CSS = `.card {
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

export type BuiltinNoteTypeDefinition = Omit<
  NoteType,
  'created_at' | 'updated_at' | 'deleted_at'
>;

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
        front: '{{Frente}}',
        back: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Verso}}',
      },
    ],
    css: DEFAULT_CARD_CSS,
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
    css: DEFAULT_CARD_CSS,
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
    css: CLOZE_CARD_CSS,
    source_id: null,
  },
};

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
