import { eq, and, isNull, inArray, like, sql } from 'drizzle-orm';
import type { FolioDatabase } from '../db/client';
import { getDb } from '../db/client';
import {
  notes,
  decks,
  cards,
  noteTypes,
  annotations,
  type Note,
  type Deck,
  type Card,
  type NoteType,
  type Annotation,
} from '../db/schema';
import { renderCard } from '../render';
import { matchesConsultaUnit } from './search';

/**
 * Representação de uma unidade no Modo Consulta conforme MODO_CONSULTA.md §8.
 * Uma unidade = uma nota (não um card).
 */
export interface ConsultaUnit {
  /** Índice ordinal da unidade na lista (0-indexed) */
  index: number;
  /** ID da nota */
  noteId: string;
  /** Identidade de irmãs (P2) ou null */
  groupKey?: string | null;
  /** Caminho completo do deck (ex: "Medicina::Cardiologia") */
  deckPath: string;
  /** HTML da frente renderizado com allClozesRevealed */
  frontHtml: string;
  /** HTML do verso renderizado com allClozesRevealed */
  backHtml: string;
  /** Tags da nota */
  tags: string[];
  /** Verdadeiro se todos os cards associados à nota estiverem suspensos */
  suspended: boolean;
  /** Anotações ativas da nota ordenadas por start asc */
  annotations: Annotation[];
}

export type Unit = ConsultaUnit;

export interface AssembleUnitInput {
  note: Note;
  deck: Pick<Deck, 'name'>;
  noteType: Pick<NoteType, 'kind' | 'templates'>;
  cards?: Card[];
  annotations?: Annotation[];
  groupKey?: string | null;
}

export interface LoadConsultaUnitsOptions {
  /** ID do deck base */
  deckId?: string;
  /** Se verdadeiro, inclui subdecks (ex: Deck::Sub). Padrão: true */
  includeSubdecks?: boolean;
  /** Filtro por IDs específicos de notas (ex: busca global) */
  noteIds?: string[];
  /** Termo de busca textual (filtra por frente, verso e tags sem acento e sem caixa) */
  searchQuery?: string;
  /** Se verdadeiro, filtra apenas unidades que possuem anotações ativas */
  onlyWithAnnotations?: boolean;
  /** Quantidade máxima de unidades a retornar */
  limit?: number;
  /** Deslocamento inicial na lista ordenada */
  offset?: number;
  /** Conexão opcional com o banco */
  db?: FolioDatabase;
}

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/**
 * Compara dois caminhos de deck respeitando a ordem natural (ignora acento e caixa),
 * preservando a hierarquia (segmento a segmento separado por '::').
 */
export function compareDeckPaths(pathA: string, pathB: string): number {
  if (pathA === pathB) return 0;

  const partsA = pathA.split('::');
  const partsB = pathB.split('::');
  const minLen = Math.min(partsA.length, partsB.length);

  for (let i = 0; i < minLen; i++) {
    const cmp = collator.compare(partsA[i], partsB[i]);
    if (cmp !== 0) return cmp;

    // Desempate estável para segmentos que diferem apenas em maiúsculas/acentos
    const strictCmp = partsA[i].localeCompare(partsB[i], 'pt-BR');
    if (strictCmp !== 0) return strictCmp;
  }

  // Se os segmentos comuns forem iguais, o caminho com menos segmentos vem primeiro
  if (partsA.length !== partsB.length) {
    return partsA.length - partsB.length;
  }

  return pathA.localeCompare(pathB, 'pt-BR');
}

/**
 * Compara dois inputs de unidade segundo a regra central de MODO_CONSULTA.md §2:
 * caminho do deck (ordem natural, ignorando acento e caixa) -> notes.created_at -> cards.ord.
 */
export function compareConsultaInputs(a: AssembleUnitInput, b: AssembleUnitInput): number {
  // 1. Caminho do deck
  const deckCmp = compareDeckPaths(a.deck.name, b.deck.name);
  if (deckCmp !== 0) return deckCmp;

  // 2. notes.created_at
  const createdA = a.note.created_at ?? 0;
  const createdB = b.note.created_at ?? 0;
  if (createdA !== createdB) {
    return createdA - createdB;
  }

  // 3. cards.ord (menor ord dos cards associados, padrão 0)
  const minOrdA =
    a.cards && a.cards.length > 0 ? Math.min(...a.cards.map((c) => c.ord)) : 0;
  const minOrdB =
    b.cards && b.cards.length > 0 ? Math.min(...b.cards.map((c) => c.ord)) : 0;
  if (minOrdA !== minOrdB) {
    return minOrdA - minOrdB;
  }

  // Desempate estável por ID da nota
  return a.note.id.localeCompare(b.note.id);
}

/**
 * Monta uma única ConsultaUnit a partir de uma nota, deck, noteType, cards e anotações.
 * Garante que:
 * - cardOrd = 0 é utilizado para renderização.
 * - allClozesRevealed = true (todas as lacunas reveladas como <span class="cloze">).
 * - suspended = true se e somente se todos os cards associados estiverem suspensos.
 * - anotações são ordenadas por start asc.
 */
export function assembleConsultaUnit(
  input: AssembleUnitInput,
  index: number
): ConsultaUnit {
  const { note, deck, noteType } = input;

  // Renderiza a nota com todas as lacunas reveladas
  const { front, back } = renderCard({
    noteType,
    fields: note.fields ?? {},
    cardOrd: 0,
    tags: note.tags ?? [],
    deckName: deck.name,
    allClozesRevealed: true,
  });

  const cardsList = input.cards ?? [];
  const suspended =
    cardsList.length > 0 && cardsList.every((c) => Boolean(c.suspended));

  const rawAnnotations = input.annotations ?? [];
  const activeAnnotations = rawAnnotations
    .filter((a) => a.deleted_at === null || a.deleted_at === undefined)
    .slice()
    .sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));

  return {
    index,
    noteId: note.id,
    groupKey: input.groupKey ?? null,
    deckPath: deck.name,
    frontHtml: front,
    backHtml: back,
    tags: note.tags ?? [],
    suspended,
    annotations: activeAnnotations,
  };
}

/**
 * Ordena uma coleção de AssembleUnitInput conforme a especificação do Modo Consulta
 * e monta as unidades atribuindo índices sequenciais a partir de 0.
 */
export function assembleConsultaUnits(inputs: AssembleUnitInput[]): ConsultaUnit[] {
  const sorted = inputs.slice().sort(compareConsultaInputs);
  return sorted.map((item, idx) => assembleConsultaUnit(item, idx));
}

/**
 * Divide um array em fatias menores de tamanho máximo especificado para
 * prevenir estouro de limite de variáveis no SQLite (SQLITE_MAX_VARIABLE_NUMBER).
 */
export function chunkArray<T>(items: T[], size = 500): T[][] {
  if (items.length <= size) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Busca cards ativos no banco para uma lista de note_ids utilizando chunking seguro.
 */
function fetchCardsForNoteIds(db: FolioDatabase, noteIds: string[]): Card[] {
  if (noteIds.length === 0) return [];
  const chunks = chunkArray(noteIds, 500);
  const results: Card[] = [];
  for (const chunk of chunks) {
    const chunkCards = db
      .select()
      .from(cards)
      .where(and(inArray(cards.note_id, chunk), isNull(cards.deleted_at)))
      .all();
    results.push(...chunkCards);
  }
  return results;
}

/**
 * Busca anotações ativas no banco para uma lista de note_ids utilizando chunking seguro.
 */
function fetchAnnotationsForNoteIds(db: FolioDatabase, noteIds: string[]): Annotation[] {
  if (noteIds.length === 0) return [];
  const chunks = chunkArray(noteIds, 500);
  const results: Annotation[] = [];
  for (const chunk of chunks) {
    const chunkAnns = db
      .select()
      .from(annotations)
      .where(and(inArray(annotations.note_id, chunk), isNull(annotations.deleted_at)))
      .all();
    results.push(...chunkAnns);
  }
  return results;
}

/**
 * Retorna os IDs de decks que devem ser consultados com base no deckId e includeSubdecks.
 */
function resolveTargetDeckIds(
  db: FolioDatabase,
  deckId?: string,
  includeSubdecks = true
): string[] | undefined {
  if (!deckId) return undefined;

  const baseDeck = db
    .select()
    .from(decks)
    .where(and(eq(decks.id, deckId), isNull(decks.deleted_at)))
    .all()[0];

  if (!baseDeck) return [];

  if (includeSubdecks) {
    const subdecks = db
      .select({ id: decks.id })
      .from(decks)
      .where(and(like(decks.name, `${baseDeck.name}::%`), isNull(decks.deleted_at)))
      .all();
    return [baseDeck.id, ...subdecks.map((s) => s.id)];
  }

  return [baseDeck.id];
}

/**
 * Carrega e monta as unidades do Modo Consulta a partir do banco de dados local.
 * Suporta filtro por deck (incluindo subdecks), filtro por lista de IDs de notas e paginação.
 * Otimizado para responder em milissegundos mesmo com 5.000+ notas (MODO_CONSULTA.md §9).
 */
export function loadConsultaUnits(options?: LoadConsultaUnitsOptions): ConsultaUnit[] {
  const db = options?.db ?? getDb();
  const includeSubdecks = options?.includeSubdecks ?? true;

  // 1. Determina quais decks consultar
  const targetDeckIds = resolveTargetDeckIds(db, options?.deckId, includeSubdecks);
  if (targetDeckIds !== undefined && targetDeckIds.length === 0) {
    return [];
  }

  // 2. Busca notas ativas com seus decks e note_types
  const noteConditions = [
    isNull(notes.deleted_at),
    isNull(decks.deleted_at),
    isNull(noteTypes.deleted_at),
  ];

  if (targetDeckIds && targetDeckIds.length > 0) {
    noteConditions.push(inArray(notes.deck_id, targetDeckIds));
  }

  if (options?.noteIds && options.noteIds.length > 0) {
    noteConditions.push(inArray(notes.id, options.noteIds));
  }

  // 3. Caso SEM busca textual e SEM filtro de anotações (caso padrão de rolagem de decks de 5.000 notas):
  // Projeta apenas identificadores e campos de ordenação, fatiando antes de hidratar o HTML completo.
  const hasSearch = Boolean(options?.searchQuery && options.searchQuery.trim().length > 0);
  const hasAnnotationFilter = Boolean(options?.onlyWithAnnotations);

  if (!hasSearch && !hasAnnotationFilter) {
    const candidateNotes = db
      .select({
        id: notes.id,
        createdAt: notes.created_at,
        deckName: decks.name,
      })
      .from(notes)
      .innerJoin(decks, eq(notes.deck_id, decks.id))
      .innerJoin(noteTypes, eq(notes.note_type_id, noteTypes.id))
      .where(and(...noteConditions))
      .all();

    if (candidateNotes.length === 0) {
      return [];
    }

    // Ordena as notas pelo critério natural da Consulta:
    // deckPath natural -> notes.created_at -> notes.id
    candidateNotes.sort((a, b) => {
      const deckCmp = compareDeckPaths(a.deckName, b.deckName);
      if (deckCmp !== 0) return deckCmp;
      const createdA = a.createdAt ?? 0;
      const createdB = b.createdAt ?? 0;
      if (createdA !== createdB) return createdA - createdB;
      return a.id.localeCompare(b.id);
    });

    const offset = options?.offset ?? 0;
    const limit = options?.limit;
    const sliceEnd = limit !== undefined ? offset + limit : candidateNotes.length;
    const pagedCandidates = candidateNotes.slice(offset, sliceEnd);

    if (pagedCandidates.length === 0) {
      return [];
    }

    const pagedNoteIds = pagedCandidates.map((c) => c.id);

    // Hidrata os dados completos das notas apenas para as unidades do lote fatiado
    const fullRows = db
      .select({
        note: notes,
        deck: decks,
        noteType: noteTypes,
      })
      .from(notes)
      .innerJoin(decks, eq(notes.deck_id, decks.id))
      .innerJoin(noteTypes, eq(notes.note_type_id, noteTypes.id))
      .where(inArray(notes.id, pagedNoteIds))
      .all();

    const fullRowsById = new Map(fullRows.map((r) => [r.note.id, r]));
    const orderedRows = pagedCandidates
      .map((c) => fullRowsById.get(c.id))
      .filter((r): r is NonNullable<typeof r> => r !== undefined);

    // Busca cards e anotações estritamente para o lote de unidades fatiado
    const cardRows = fetchCardsForNoteIds(db, pagedNoteIds);
    const annotationRows = fetchAnnotationsForNoteIds(db, pagedNoteIds);

    const cardsByNoteId = new Map<string, Card[]>();
    for (const card of cardRows) {
      let list = cardsByNoteId.get(card.note_id);
      if (!list) {
        list = [];
        cardsByNoteId.set(card.note_id, list);
      }
      list.push(card);
    }

    const annotationsByNoteId = new Map<string, Annotation[]>();
    for (const ann of annotationRows) {
      let list = annotationsByNoteId.get(ann.note_id);
      if (!list) {
        list = [];
        annotationsByNoteId.set(ann.note_id, list);
      }
      list.push(ann);
    }

    return orderedRows.map((r, idx) =>
      assembleConsultaUnit(
        {
          note: r.note,
          deck: r.deck,
          noteType: r.noteType,
          cards: cardsByNoteId.get(r.note.id) ?? [],
          annotations: annotationsByNoteId.get(r.note.id) ?? [],
        },
        offset + idx
      )
    );
  }

  // 4. Caso COM busca textual e/ou filtro de anotações:
  const rows = db
    .select({
      note: notes,
      deck: decks,
      noteType: noteTypes,
    })
    .from(notes)
    .innerJoin(decks, eq(notes.deck_id, decks.id))
    .innerJoin(noteTypes, eq(notes.note_type_id, noteTypes.id))
    .where(and(...noteConditions))
    .all();

  if (rows.length === 0) {
    return [];
  }
  const foundNoteIds = rows.map((r) => r.note.id);
  const cardRows = fetchCardsForNoteIds(db, foundNoteIds);
  const annotationRows = fetchAnnotationsForNoteIds(db, foundNoteIds);

  const cardsByNoteId = new Map<string, Card[]>();
  for (const card of cardRows) {
    let list = cardsByNoteId.get(card.note_id);
    if (!list) {
      list = [];
      cardsByNoteId.set(card.note_id, list);
    }
    list.push(card);
  }

  const annotationsByNoteId = new Map<string, Annotation[]>();
  for (const ann of annotationRows) {
    let list = annotationsByNoteId.get(ann.note_id);
    if (!list) {
      list = [];
      annotationsByNoteId.set(ann.note_id, list);
    }
    list.push(ann);
  }

  const inputs: AssembleUnitInput[] = rows.map((r) => ({
    note: r.note,
    deck: r.deck,
    noteType: r.noteType,
    cards: cardsByNoteId.get(r.note.id) ?? [],
    annotations: annotationsByNoteId.get(r.note.id) ?? [],
  }));

  inputs.sort(compareConsultaInputs);

  const filter = {
    query: options?.searchQuery,
    onlyWithAnnotations: options?.onlyWithAnnotations,
  };

  const candidateInputs = inputs.filter((inp) => {
    if (filter.onlyWithAnnotations) {
      const activeAnns = (inp.annotations ?? []).filter(
        (a) => a.deleted_at === null || a.deleted_at === undefined
      );
      if (activeAnns.length === 0) return false;
    }
    if (!filter.query || filter.query.trim().length === 0) return true;

    const unit = assembleConsultaUnit(inp, 0);
    return matchesConsultaUnit(unit, filter);
  });

  const offset = options?.offset ?? 0;
  const limit = options?.limit;
  const sliceEnd = limit !== undefined ? offset + limit : candidateInputs.length;
  const pagedInputs = candidateInputs.slice(offset, sliceEnd);

  return pagedInputs.map((input, idx) => assembleConsultaUnit(input, offset + idx));
}

/**
 * Retorna a quantidade total de unidades correspondentes aos critérios de filtro (deck, busca, anotações).
 * Otimizado com contagem direta no banco em O(1) quando não há filtros de busca (MODO_CONSULTA.md §9).
 */
export function countConsultaUnits(
  options?: Omit<LoadConsultaUnitsOptions, 'limit' | 'offset'>
): number {
  const hasSearch = Boolean(options?.searchQuery && options.searchQuery.trim().length > 0);
  const hasAnnotationFilter = Boolean(options?.onlyWithAnnotations);

  // Sem filtros dinâmicos de busca/anotação, executa contagem direta no banco
  if (!hasSearch && !hasAnnotationFilter) {
    const db = options?.db ?? getDb();
    const includeSubdecks = options?.includeSubdecks ?? true;
    const targetDeckIds = resolveTargetDeckIds(db, options?.deckId, includeSubdecks);

    if (targetDeckIds !== undefined && targetDeckIds.length === 0) {
      return 0;
    }

    const noteConditions = [
      isNull(notes.deleted_at),
      isNull(decks.deleted_at),
      isNull(noteTypes.deleted_at),
    ];

    if (targetDeckIds && targetDeckIds.length > 0) {
      noteConditions.push(inArray(notes.deck_id, targetDeckIds));
    }

    if (options?.noteIds && options.noteIds.length > 0) {
      noteConditions.push(inArray(notes.id, options.noteIds));
    }

    const countRows = db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .innerJoin(decks, eq(notes.deck_id, decks.id))
      .innerJoin(noteTypes, eq(notes.note_type_id, noteTypes.id))
      .where(and(...noteConditions))
      .all();

    return countRows[0]?.count ?? 0;
  }

  // Com filtros de texto/anotação, utiliza a lista filtrada
  const allUnits = loadConsultaUnits({
    ...options,
    limit: undefined,
    offset: 0,
  });
  return allUnits.length;
}
