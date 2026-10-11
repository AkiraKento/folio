import { eq, and, isNull } from 'drizzle-orm';
import type { FolioDatabase } from '@/db/client';
import * as schema from '@/db/schema';
import { generateId } from '@/db/repositories/utils';
import { BUILTIN_NOTE_TYPE_IDS, BUILTIN_NOTE_TYPES } from '@/db/builtin-note-types';
import type { ImportPreview, ImportProgress, ImportResult } from './types';

export interface CsvParsedRow {
  front: string;
  back: string;
  tags: string[];
}

export interface CsvParseResult {
  rows: CsvParsedRow[];
  delimiter: string;
  hasHeader: boolean;
  totalRows: number;
}

export interface CsvParserOptions {
  delimiter?: string;
}

export interface CsvImportOptions {
  deckId?: string;
  deckName?: string;
  fileName?: string;
  onProgress?: (progress: ImportProgress) => void;
}

/**
 * Remove extensão e diretório do nome do arquivo para servir como nome de deck padrão.
 */
export function extractDeckNameFromFileName(fileName?: string): string {
  if (!fileName) return 'CSV Importado';
  const clean = fileName
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.(csv|tsv|txt)$/i, '')
    .trim();
  return clean || 'CSV Importado';
}

/**
 * Detecta se uma string contém tags HTML.
 */
function containsHtml(text: string): boolean {
  return /<[a-z/][^>]*>/i.test(text);
}

/**
 * Normaliza quebras de linha em texto puro para <br>
 * preservando formatação sem alterar tags se já contiver HTML.
 */
function formatTextField(text: string): string {
  const trimmed = text.trim();
  if (containsHtml(trimmed)) {
    return trimmed;
  }
  return trimmed.replace(/\r?\n/g, '<br>');
}

/**
 * Extrai tags de uma string de tags (separadas por espaço ou vírgula).
 */
function parseTags(rawTags: string): string[] {
  if (!rawTags) return [];
  const parts = rawTags
    .split(/[,\s]+/)
    .map((t) => t.trim().replace(/^#+/, ''))
    .filter((t) => t.length > 0);
  return Array.from(new Set(parts));
}

/**
 * Detecta o delimitador mais provável analisando as primeiras linhas.
 * Prioriza ';' conforme a especificação do Folio (frente;verso;tags).
 */
function detectDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 5);

  let semicolons = 0;
  let commas = 0;
  let tabs = 0;

  for (const line of lines) {
    semicolons += (line.match(/;/g) || []).length;
    commas += (line.match(/,/g) || []).length;
    tabs += (line.match(/\t/g) || []).length;
  }

  if (semicolons > 0) return ';';
  if (commas > 0) return ',';
  if (tabs > 0) return '\t';
  return ';';
}

/**
 * Parser de CSV conforme a RFC 4180 com suporte a aspas duplas,
 * campos multilinhas e delimitadores customizados.
 */
function tokenizeCsv(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // Aspas duplas escapadas ("")
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Fim do campo entre aspas
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === delimiter) {
        currentRecord.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
        currentRecord.push(currentField);
        records.push(currentRecord);
        currentRecord = [];
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRecord.push(currentField);
        records.push(currentRecord);
        currentRecord = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Adiciona último campo e registro se não estiverem vazios
  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField);
    records.push(currentRecord);
  }

  return records;
}

/**
 * Verifica se a primeira linha é um cabeçalho descritivo.
 */
function isHeaderRow(fields: string[]): boolean {
  if (fields.length < 2) return false;
  const col0 = fields[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const col1 = fields[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const isCol0Header = ['frente', 'front', 'pergunta', 'question'].includes(col0);
  const isCol1Header = ['verso', 'back', 'resposta', 'answer'].includes(col1);

  return isCol0Header && isCol1Header;
}

/**
 * Faz o parse do texto CSV retornando as linhas estruturadas.
 */
export function parseCsv(content: string, options?: CsvParserOptions): CsvParseResult {
  const delimiter = options?.delimiter ?? detectDelimiter(content);
  const rawRecords = tokenizeCsv(content, delimiter);

  if (rawRecords.length === 0) {
    return {
      rows: [],
      delimiter,
      hasHeader: false,
      totalRows: 0,
    };
  }

  let hasHeader = false;
  let startIndex = 0;

  if (isHeaderRow(rawRecords[0])) {
    hasHeader = true;
    startIndex = 1;
  }

  const rows: CsvParsedRow[] = [];

  for (let i = startIndex; i < rawRecords.length; i++) {
    const record = rawRecords[i];
    // Ignora linhas totalmente vazias
    if (record.length === 0 || record.every((f) => f.trim().length === 0)) {
      continue;
    }

    const frontRaw = record[0] ?? '';
    const backRaw = record[1] ?? '';
    const tagsRaw = record[2] ?? '';

    // Se frente e verso forem ambos vazios, pula
    if (frontRaw.trim().length === 0 && backRaw.trim().length === 0) {
      continue;
    }

    rows.push({
      front: formatTextField(frontRaw),
      back: formatTextField(backRaw),
      tags: parseTags(tagsRaw),
    });
  }

  return {
    rows,
    delimiter,
    hasHeader,
    totalRows: rows.length,
  };
}

/**
 * Gera os dados de prévia para exibição na tela de importação.
 */
export function getCsvPreview(
  csvContent: string,
  fileName?: string,
  defaultDeckName?: string
): ImportPreview {
  const { rows } = parseCsv(csvContent);
  const deckName = defaultDeckName ?? extractDeckNameFromFileName(fileName);

  return {
    decks: [
      {
        sourceId: 'csv-default',
        name: deckName,
        notesCount: rows.length,
        cardsCount: rows.length,
      },
    ],
    totalNotes: rows.length,
    totalCards: rows.length,
    totalMedia: 0,
    modelsCount: 1,
    hasFsrsData: false,
    hasExistingIntervals: false,
  };
}

/**
 * Importa o conteúdo CSV para o banco de dados Folio.
 */
export async function importCsv(
  csvContent: string,
  db: FolioDatabase,
  options?: CsvImportOptions
): Promise<ImportResult> {
  const { rows } = parseCsv(csvContent);

  if (rows.length === 0) {
    throw new Error('Nenhuma nota encontrada no arquivo CSV.');
  }

  const now = Date.now();
  const deckName =
    options?.deckName ||
    extractDeckNameFromFileName(options?.fileName);

  const notify = (
    stage: ImportProgress['stage'],
    current: number,
    total: number,
    message: string
  ) => {
    options?.onProgress?.({ stage, current, total, message });
  };

  notify('importing_decks', 0, 1, 'Configurando deck...');

  let finalDeckId = options?.deckId;

  // Garante existência do deck
  if (!finalDeckId) {
    const existingDeck = db
      .select()
      .from(schema.decks)
      .where(and(eq(schema.decks.name, deckName), isNull(schema.decks.deleted_at)))
      .get();

    if (existingDeck) {
      finalDeckId = existingDeck.id;
    } else {
      finalDeckId = generateId();
      db.insert(schema.decks)
        .values({
          id: finalDeckId,
          name: deckName,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        })
        .run();
    }
  }

  // Garante que o note type básico existe
  const basicNoteType = db
    .select()
    .from(schema.noteTypes)
    .where(eq(schema.noteTypes.id, BUILTIN_NOTE_TYPE_IDS.BASIC))
    .get();

  if (!basicNoteType) {
    const def = BUILTIN_NOTE_TYPES.BASIC;
    db.insert(schema.noteTypes)
      .values({
        id: def.id,
        name: def.name,
        kind: def.kind,
        fields: def.fields,
        templates: def.templates,
        css: def.css,
        source_id: def.source_id,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .run();
  }

  notify('importing_notes', 0, rows.length, 'Importando notas...');

  db.transaction((tx) => {
    let noteIndex = 0;
    for (const row of rows) {
      const noteId = generateId();
      const cardId = generateId();
      const noteCreatedAt = now + noteIndex;

      // Inserção da nota com os campos Frente e Verso
      tx.insert(schema.notes)
        .values({
          id: noteId,
          note_type_id: BUILTIN_NOTE_TYPE_IDS.BASIC,
          deck_id: finalDeckId!,
          fields: {
            Frente: row.front,
            Verso: row.back,
          },
          tags: row.tags,
          created_at: noteCreatedAt,
          updated_at: now,
          deleted_at: null,
        })
        .run();

      // Inserção do card correspondente no estado inicial FSRS (state 0 = novo)
      tx.insert(schema.cards)
        .values({
          id: cardId,
          note_id: noteId,
          deck_id: finalDeckId!,
          ord: 0,
          due: now,
          stability: 0,
          difficulty: 0,
          elapsed_days: 0,
          scheduled_days: 0,
          learning_steps: 0,
          reps: 0,
          lapses: 0,
          state: 0,
          last_review: null,
          suspended: 0,
          buried_until: null,
          created_at: noteCreatedAt,
          updated_at: now,
          deleted_at: null,
        })
        .run();

      noteIndex++;
      if (noteIndex % 50 === 0 || noteIndex === rows.length) {
        notify(
          'importing_notes',
          noteIndex,
          rows.length,
          `Importando notas (${noteIndex}/${rows.length})...`
        );
      }
    }
  });

  notify('importing_cards', rows.length, rows.length, 'Cards criados.');
  notify('completed', rows.length, rows.length, 'Importação concluída.');

  return {
    importedDecks: 1,
    importedNotes: rows.length,
    importedCards: rows.length,
    importedMedia: 0,
    importedRevlogs: 0,
    deckIds: [finalDeckId!],
    createdNotes: rows.length,
    createdCards: rows.length,
  };
}
