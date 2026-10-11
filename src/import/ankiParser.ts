import type {
  AnkiCollectionData,
  AnkiDeck,
  AnkiModel,
  AnkiParsedCard,
  AnkiParsedNote,
  AnkiParsedRevlog,
  AnkiRawCard,
  AnkiRawNote,
  AnkiRawRevlog,
  AnkiSqliteReader,
} from './types';

type NodeSqliteParam = null | number | bigint | string | Uint8Array;

export interface NodeSqliteLikeDb {
  prepare(sql: string): {
    all(...params: NodeSqliteParam[]): unknown[];
    get(...params: NodeSqliteParam[]): unknown;
  };
}

/**
 * Cria um leitor compatível com node:sqlite (usado em testes e scripts Node).
 */
export function createNodeSqliteReader(db: NodeSqliteLikeDb): AnkiSqliteReader {
  return {
    all<T = Record<string, unknown>>(query: string, params: unknown[] = []): T[] {
      const stmt = db.prepare(query);
      return (stmt.all as (...p: unknown[]) => unknown[])(...(params as NodeSqliteParam[])) as T[];
    },
    get<T = Record<string, unknown>>(query: string, params: unknown[] = []): T | null | undefined {
      const stmt = db.prepare(query);
      return ((stmt.get as (...p: unknown[]) => unknown)(...(params as NodeSqliteParam[])) as T) ?? null;
    },
  };
}

/**
 * Extrai tags separadas por espaço (formato padrão do Anki com espaços no início e fim).
 */
export function parseAnkiTags(rawTags: string): string[] {
  if (!rawTags || typeof rawTags !== 'string') return [];
  return rawTags
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Extrai estabilidade e dificuldade FSRS da coluna cards.data (Anki 23.10+).
 */
export function parseAnkiCardFsrsData(
  dataStr?: string | null
): { stability: number; difficulty: number } | null {
  if (!dataStr || typeof dataStr !== 'string') return null;
  try {
    const parsed = JSON.parse(dataStr) as Record<string, unknown>;
    if (typeof parsed.s === 'number' && typeof parsed.d === 'number') {
      return { stability: parsed.s, difficulty: parsed.d };
    }
    if (parsed.cd && typeof parsed.cd === 'object') {
      const cd = parsed.cd as Record<string, unknown>;
      if (typeof cd.s === 'number' && typeof cd.d === 'number') {
        return { stability: cd.s, difficulty: cd.d };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Detecta o tipo do note type (basic, basic_reversed, cloze, custom).
 */
export function detectModelKind(
  model: Partial<AnkiModel>
): 'basic' | 'basic_reversed' | 'cloze' | 'custom' {
  // 1. Tipo cloze oficial do Anki (type = 1) ou se contém filtro {{cloze:}}
  if (model.type === 1) {
    return 'cloze';
  }

  const tmpls = model.tmpls || [];
  const hasClozeFilter = tmpls.some(
    (t) =>
      (t.qfmt && t.qfmt.includes('{{cloze:')) ||
      (t.afmt && t.afmt.includes('{{cloze:'))
  );
  if (hasClozeFilter) {
    return 'cloze';
  }

  // 2. Modelo básico padrão (1 template)
  if (tmpls.length === 1) {
    return 'basic';
  }

  // 3. Modelo básico invertido (2 templates espelhados)
  if (tmpls.length === 2) {
    const t0 = tmpls[0];
    const t1 = tmpls[1];
    const q0 = t0.qfmt || '';
    const q1 = t1.qfmt || '';
    const a0 = t0.afmt || '';
    const a1 = t1.afmt || '';

    // Se um pergunta Frente e outro Verso
    const isReversedPattern =
      (q0.includes('{{Frente}}') && q1.includes('{{Verso}}')) ||
      (q0.includes('{{Front}}') && q1.includes('{{Back}}')) ||
      (a0.includes('{{Verso}}') && a1.includes('{{Frente}}')) ||
      (a0.includes('{{Back}}') && a1.includes('{{Front}}')) ||
      (model.name ? model.name.toLowerCase().includes('invert') : false) ||
      (model.name ? model.name.toLowerCase().includes('reversed') : false);

    if (isReversedPattern) {
      return 'basic_reversed';
    }
  }

  return 'custom';
}

/**
 * Faz o parsing da base SQLite do Anki (suporta esquema legado e normalizado anki21).
 */
export function parseAnkiCollection(reader: AnkiSqliteReader): AnkiCollectionData {
  const models = new Map<string, AnkiModel>();
  const decks = new Map<string, AnkiDeck>();

  // 1. Verifica se a tabela 'col' existe (esquema legado do Anki)
  const colTableExists = reader.get<{ count: number }>(
    "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='col'"
  );

  let parsedFromCol = false;
  let crt: number | undefined;

  if (colTableExists && colTableExists.count > 0) {
    const colRow = reader.get<{ crt?: number; models?: string; decks?: string }>(
      'SELECT crt, models, decks FROM col LIMIT 1'
    );
    if (colRow?.crt) {
      crt = Number(colRow.crt);
    }
    if (colRow?.models && colRow?.decks) {
      try {
        const rawModels = JSON.parse(colRow.models) as Record<string, AnkiModel>;
        for (const [id, m] of Object.entries(rawModels)) {
          models.set(String(id), {
            id: String(m.id ?? id),
            name: m.name ?? 'Modelo',
            type: m.type ?? 0,
            flds: Array.isArray(m.flds)
              ? m.flds.map((f, idx) => ({ name: f.name, ord: f.ord ?? idx }))
              : [],
            tmpls: Array.isArray(m.tmpls)
              ? m.tmpls.map((t, idx) => ({
                  name: t.name ?? `Card ${idx + 1}`,
                  ord: t.ord ?? idx,
                  qfmt: t.qfmt ?? '',
                  afmt: t.afmt ?? '',
                }))
              : [],
            css: m.css ?? '',
          });
        }

        const rawDecks = JSON.parse(colRow.decks) as Record<string, AnkiDeck>;
        for (const [id, d] of Object.entries(rawDecks)) {
          decks.set(String(id), {
            id: String(d.id ?? id),
            name: d.name ?? 'Deck',
            desc: d.desc ?? '',
          });
        }

        parsedFromCol = true;
      } catch {
        // Fallback para ler das tabelas normalizadas
      }
    }
  }

  // 2. Se não veio de col.models / col.decks, tenta o esquema normalizado (tabelas notetypes/decks/fields/templates)
  if (!parsedFromCol) {
    const notetypesTableExists = reader.get<{ count: number }>(
      "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='notetypes'"
    );

    if (notetypesTableExists && notetypesTableExists.count > 0) {
      interface RawNotetypeRow {
        id: number | string;
        name: string;
      }
      interface RawFieldRow {
        ntid: number | string;
        ord: number;
        name: string;
      }
      interface RawTemplateRow {
        ntid: number | string;
        ord: number;
        name: string;
        qfmt?: string;
        afmt?: string;
      }

      const rawNoteTypes = reader.all<RawNotetypeRow>('SELECT id, name FROM notetypes');
      const rawFields = reader.all<RawFieldRow>('SELECT ntid, ord, name FROM fields ORDER BY ntid, ord');
      const rawTemplates = reader.all<RawTemplateRow>('SELECT ntid, ord, name FROM templates ORDER BY ntid, ord');

      for (const nt of rawNoteTypes) {
        const ntId = String(nt.id);
        const fields = rawFields
          .filter((f) => String(f.ntid) === ntId)
          .map((f, idx) => ({ name: f.name, ord: f.ord ?? idx }));
        const templates = rawTemplates
          .filter((t) => String(t.ntid) === ntId)
          .map((t, idx) => ({
            name: t.name,
            ord: t.ord ?? idx,
            qfmt: t.qfmt ?? '',
            afmt: t.afmt ?? '',
          }));

        models.set(ntId, {
          id: ntId,
          name: nt.name,
          type: 0,
          flds: fields,
          tmpls: templates,
          css: '',
        });
      }
    }

    const decksTableExists = reader.get<{ count: number }>(
      "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='decks'"
    );
    if (decksTableExists && decksTableExists.count > 0) {
      interface RawDeckRow {
        id: number | string;
        name: string;
      }
      const rawDecks = reader.all<RawDeckRow>('SELECT id, name FROM decks');
      for (const d of rawDecks) {
        decks.set(String(d.id), {
          id: String(d.id),
          name: d.name,
        });
      }
    }
  }

  // 3. Lê as notas (tabela notes)
  const rawNotes = reader.all<AnkiRawNote>(
    'SELECT id, mid, tags, flds FROM notes ORDER BY id ASC'
  );

  const notes: AnkiParsedNote[] = rawNotes.map((n) => {
    const modelId = String(n.mid);
    const model = models.get(modelId);
    const rawFields = (n.flds || '').split('\x1f');
    const fields: Record<string, string> = {};

    if (model && model.flds.length > 0) {
      model.flds.forEach((fieldDef, idx) => {
        fields[fieldDef.name] = rawFields[idx] ?? '';
      });
      // Caso existam mais valores de campo do que a definição do modelo
      for (let i = model.flds.length; i < rawFields.length; i++) {
        fields[`Campo ${i + 1}`] = rawFields[i];
      }
    } else {
      rawFields.forEach((val, idx) => {
        fields[`Campo ${idx + 1}`] = val;
      });
    }

    return {
      id: String(n.id),
      modelId,
      fields,
      tags: parseAnkiTags(n.tags || ''),
      rawFields,
    };
  });

  // 4. Lê os cards (tabela cards)
  const rawCards = reader.all<AnkiRawCard>(
    'SELECT id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses, data FROM cards ORDER BY id ASC'
  );

  const cards: AnkiParsedCard[] = rawCards.map((c) => {
    const queue = c.queue ?? 0;
    const isSuspended = queue === -1;

    return {
      id: String(c.id),
      noteId: String(c.nid),
      deckId: String(c.did),
      ord: c.ord ?? 0,
      queue,
      due: c.due ?? 0,
      ivl: c.ivl ?? 0,
      type: c.type ?? 0,
      reps: c.reps ?? 0,
      lapses: c.lapses ?? 0,
      suspended: isSuspended,
      data: c.data,
    };
  });

  // 5. Lê os registros de histórico de revisão (tabela revlog, se existir)
  const revlogTableExists = reader.get<{ count: number }>(
    "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='revlog'"
  );

  const revlogs: AnkiParsedRevlog[] = [];
  if (revlogTableExists && revlogTableExists.count > 0) {
    const rawRevlogs = reader.all<AnkiRawRevlog>(
      'SELECT id, cid, ease, ivl, lastIvl, factor, time, type FROM revlog ORDER BY id ASC'
    );
    for (const r of rawRevlogs) {
      revlogs.push({
        id: Number(r.id),
        cardId: String(r.cid),
        ease: Number(r.ease),
        ivl: Number(r.ivl ?? 0),
        lastIvl: Number(r.lastIvl ?? 0),
        factor: Number(r.factor ?? 0),
        time: Number(r.time ?? 0),
        type: Number(r.type ?? 0),
      });
    }
  }

  return {
    crt,
    models,
    decks,
    notes,
    cards,
    revlogs,
  };
}
