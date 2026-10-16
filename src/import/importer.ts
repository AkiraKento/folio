import { eq, isNotNull, inArray } from 'drizzle-orm';
import type { FolioDatabase } from '@/db/client';
import * as schema from '@/db/schema';
import { generateId } from '@/db/repositories/utils';
import { MediaRepository } from '@/db/repositories/media';
import { SettingsRepository } from '@/db/repositories/settings';
import { getMediaDirectory } from '@/media/mediaService';
import { logWarn } from '@/logging';
import { readApkgPackage } from './apkgReader';
import {
  parseAnkiCollection,
  detectModelKind,
  parseAnkiCardFsrsData,
  createNodeSqliteReader,
} from './ankiParser';
import type {
  AnkiSqliteReader,
  ExtractedApkg,
  ImportOptions,
  ImportPreview,
  ImportPreviewDeck,
  ImportResult,
  ScheduleImportMode,
} from './types';

/**
 * Calcula o hash SHA-1 de um array binário de forma compatível com Expo e Node.
 */
async function computeSha1(bytes: Uint8Array): Promise<string> {
  try {
    const nodeCrypto = await import('node:crypto');
    return nodeCrypto.createHash('sha1').update(bytes).digest('hex');
  } catch {
    // Ambiente sem node:crypto
  }

  try {
    const Crypto = await import('expo-crypto');
    if (Crypto?.digestStringAsync) {
      let binary = '';
      const CHUNK_SIZE = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, i + CHUNK_SIZE))
        );
      }
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA1,
        binary
      );
    }
  } catch (err) {
    logWarn('Importer', 'Falha ao calcular SHA-1 via expo-crypto', String(err));
  }

  // Fallback determinístico de hash em caso extremo
  let hash = 0;
  for (let i = 0; i < bytes.length; i++) {
    hash = (hash << 5) - hash + bytes[i];
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(40, '0');
}

/**
 * Determina o MIME type a partir da extensão do arquivo.
 */
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Grava o arquivo binário na pasta de mídia do aplicativo.
 */
async function saveMediaBytes(filename: string, bytes: Uint8Array): Promise<void> {
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const mediaDir = await getMediaDirectory();
    if (mediaDir && FileSystem?.writeAsStringAsync) {
      const targetPath = `${mediaDir}${filename}`;

      let base64: string;
      if (typeof Buffer !== 'undefined') {
        base64 = Buffer.from(bytes).toString('base64');
      } else {
        const CHUNK_SIZE = 8192;
        let binary = '';
        for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
          binary += String.fromCharCode.apply(
            null,
            Array.from(bytes.subarray(i, i + CHUNK_SIZE))
          );
        }
        base64 = btoa(binary);
      }

      await FileSystem.writeAsStringAsync(targetPath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return;
    }
  } catch {
    // Fallback para Node.js / Jest
  }

  try {
    const fsModule = await import('node:fs');
    const pathModule = await import('node:path');
    const osModule = await import('node:os');
    const tempDir = pathModule.join(osModule.tmpdir(), 'folio-media');
    if (!fsModule.existsSync(tempDir)) {
      fsModule.mkdirSync(tempDir, { recursive: true });
    }
    fsModule.writeFileSync(pathModule.join(tempDir, filename), Buffer.from(bytes));
  } catch (err) {
    logWarn('Importer', `Falha ao salvar mídia extraída: ${filename}`, String(err));
  }
}

/**
 * Abre o banco de dados SQLite extraído, suportando expo-sqlite e node:sqlite.
 */
async function resolveSqliteReader(
  pkg: ExtractedApkg,
  options?: ImportOptions
): Promise<AnkiSqliteReader> {
  if (options?.openSqliteReader) {
    return options.openSqliteReader(pkg.databaseBytes);
  }

  // Tenta expo-sqlite
  try {
    const ExpoSqlite = await import('expo-sqlite');
    if (typeof ExpoSqlite.deserializeDatabaseSync === 'function') {
      const sqliteDb = ExpoSqlite.deserializeDatabaseSync(pkg.databaseBytes);
      interface ExpoReaderTarget {
        getAllSync<T>(query: string, params?: unknown[]): T[];
        getFirstSync<T>(query: string, params?: unknown[]): T | null;
      }
      const target = sqliteDb as unknown as ExpoReaderTarget;
      return {
        all: (query, params = []) => target.getAllSync(query, params),
        get: (query, params = []) => target.getFirstSync(query, params),
      };
    }
  } catch {
    // Continua para Node.js
  }

  // Tenta node:sqlite (Node 22+)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let DatabaseSyncClass: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pathMod: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let osMod: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fsMod: any;

    if (typeof require === 'function') {
      // Ambiente Node/Jest CJS
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      DatabaseSyncClass = require('node:sqlite').DatabaseSync;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      pathMod = require('node:path');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      osMod = require('node:os');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      fsMod = require('node:fs');
    } else {
      const sqliteMod = await import('node:sqlite');
      DatabaseSyncClass = sqliteMod.DatabaseSync;
      pathMod = await import('node:path');
      osMod = await import('node:os');
      fsMod = await import('node:fs');
    }

    const tempPath = pathMod.join(osMod.tmpdir(), `temp_anki_${Date.now()}_${Math.random().toString(36).substring(2)}.db`);
    fsMod.writeFileSync(tempPath, Buffer.from(pkg.databaseBytes));
    const nodeDb = new DatabaseSyncClass(tempPath);
    return createNodeSqliteReader(nodeDb);
  } catch (error) {
    throw new Error(`Não foi possível abrir o banco SQLite do Anki: ${String(error)}`);
  }
}

/**
 * Extrai e gera a prévia de um arquivo .apkg antes da importação definitiva.
 */
export async function getApkgPreview(
  data: Uint8Array | ArrayBuffer | string,
  options?: ImportOptions
): Promise<ImportPreview> {
  const pkg = await readApkgPackage(data);
  const reader = await resolveSqliteReader(pkg, options);
  const collection = parseAnkiCollection(reader);

  // Mapeia contagem de cards e notas por deck
  const deckNotesCount = new Map<string, number>();
  const deckCardsCount = new Map<string, number>();

  for (const card of collection.cards) {
    const current = deckCardsCount.get(card.deckId) ?? 0;
    deckCardsCount.set(card.deckId, current + 1);
  }

  // Identifica deck de cada nota a partir do primeiro card correspondente
  const cardsByNote = new Map<string, string[]>();
  for (const card of collection.cards) {
    const list = cardsByNote.get(card.noteId) ?? [];
    list.push(card.deckId);
    cardsByNote.set(card.noteId, list);
  }

  for (const note of collection.notes) {
    const dids = cardsByNote.get(note.id);
    const did = dids && dids.length > 0 ? dids[0] : '1';
    const current = deckNotesCount.get(did) ?? 0;
    deckNotesCount.set(did, current + 1);
  }

  const previewDecks: ImportPreviewDeck[] = [];
  for (const [deckId, deck] of collection.decks.entries()) {
    const notesCount = deckNotesCount.get(deckId) ?? 0;
    const cardsCount = deckCardsCount.get(deckId) ?? 0;
    // Não lista decks vazios a menos que seja o único
    if (notesCount > 0 || cardsCount > 0 || collection.decks.size === 1) {
      previewDecks.push({
        sourceId: deckId,
        name: deck.name,
        notesCount,
        cardsCount,
      });
    }
  }

  const hasFsrsData = collection.cards.some((c) => parseAnkiCardFsrsData(c.data) !== null);
  const hasExistingIntervals = collection.cards.some(
    (c) => (c.ivl ?? 0) > 0 || c.queue === 2 || (c.reps ?? 0) > 0
  );

  return {
    decks: previewDecks,
    totalNotes: collection.notes.length,
    totalCards: collection.cards.length,
    totalMedia: Object.keys(pkg.mediaMap).length,
    modelsCount: collection.models.size,
    hasFsrsData,
    hasExistingIntervals,
    totalRevlogs: collection.revlogs.length,
  };
}

/**
 * Importa um pacote .apkg para o banco de dados do Folio.
 */
export async function importApkg(
  data: Uint8Array | ArrayBuffer | string,
  db: FolioDatabase,
  options?: ImportOptions
): Promise<ImportResult> {
  const notify = (stage: Parameters<NonNullable<ImportOptions['onProgress']>>[0]['stage'], current: number, total: number, message: string) => {
    options?.onProgress?.({ stage, current, total, message });
  };

  // 1. Descompacta o arquivo
  notify('unzipping', 0, 100, 'Descompactando pacote .apkg...');
  const pkg = await readApkgPackage(data);
  notify('unzipping', 100, 100, 'Arquivo descompactado com sucesso.');

  // 2. Lê a base SQLite do Anki
  notify('reading_db', 0, 100, 'Lendo base de dados do Anki...');
  const reader = await resolveSqliteReader(pkg, options);
  const collection = parseAnkiCollection(reader);
  notify('reading_db', 100, 100, 'Coleção do Anki carregada.');

  // 3. Extrai e salva arquivos de mídia no disco (assíncrono)
  const mediaEntries = Object.entries(pkg.mediaMap);
  notify('importing_media', 0, mediaEntries.length, 'Extraindo e salvando arquivos de mídia...');
  const preparedMedia: Array<{ filename: string; sha1: string; bytes: number; mime: string }> = [];
  let mediaIndex = 0;

  for (const [key, filename] of mediaEntries) {
    const fileBytes = await pkg.getMediaFile(key);
    if (fileBytes && fileBytes.length > 0) {
      const sha1 = await computeSha1(fileBytes);
      const mime = getMimeType(filename);
      await saveMediaBytes(filename, fileBytes);
      preparedMedia.push({ filename, sha1, bytes: fileBytes.length, mime });
    }
    mediaIndex++;
    if (mediaIndex % 10 === 0 || mediaIndex === mediaEntries.length) {
      notify(
        'importing_media',
        mediaIndex,
        mediaEntries.length,
        `Processando arquivos de mídia (${mediaIndex}/${mediaEntries.length})...`
      );
    }
  }

  // 4. Executa todas as inserções e atualizações do banco numa transação atômica
  const now = Date.now();
  const scheduleMode: ScheduleImportMode = options?.scheduleMode ?? 'keep_intervals';

  const result = db.transaction((tx) => {
    const mediaRepo = new MediaRepository(tx as unknown as FolioDatabase);

    // Mapeamentos de ID original do Anki (source_id) para UUID do Folio
    const ankiDeckIdToFolioDeckId = new Map<string, string>();
    const ankiModelIdToFolioModelId = new Map<string, string>();
    const ankiNoteIdToFolioNoteId = new Map<string, string>();
    const ankiCardIdToFolioCardId = new Map<string, string>();
    const cardStabilityMap = new Map<string, number>();
    const cardDifficultyMap = new Map<string, number>();

    // Mapeia timestamp da última revisão por card a partir de collection.revlogs
    const latestRevlogByCard = new Map<string, number>();
    for (const r of collection.revlogs) {
      const current = latestRevlogByCard.get(r.cardId) ?? 0;
      if (r.id > current) {
        latestRevlogByCard.set(r.cardId, r.id);
      }
    }

    const importedDeckIds: string[] = [];
    let createdNotesCount = 0;
    let updatedNotesCount = 0;
    let createdCardsCount = 0;
    let updatedCardsCount = 0;

    // Carrega registros existentes no banco com source_id para busca O(1)
    const existingDecks = tx.select().from(schema.decks).all();
    const existingDecksBySourceId = new Map<string, (typeof existingDecks)[0]>();
    const existingDecksByName = new Map<string, (typeof existingDecks)[0]>();
    for (const d of existingDecks) {
      if (d.source_id) {
        existingDecksBySourceId.set(d.source_id, d);
      }
      existingDecksByName.set(d.name, d);
    }

    const existingModels = tx.select().from(schema.noteTypes).all();
    const existingModelsBySourceId = new Map<string, (typeof existingModels)[0]>();
    for (const m of existingModels) {
      if (m.source_id) {
        existingModelsBySourceId.set(m.source_id, m);
      }
    }

    const existingNotes = tx
      .select({
        id: schema.notes.id,
        source_id: schema.notes.source_id,
        deleted_at: schema.notes.deleted_at,
      })
      .from(schema.notes)
      .where(isNotNull(schema.notes.source_id))
      .all();
    const existingNotesBySourceId = new Map<string, (typeof existingNotes)[0]>();
    for (const n of existingNotes) {
      if (n.source_id) {
        existingNotesBySourceId.set(n.source_id, n);
      }
    }

    const existingCards = tx
      .select({
        id: schema.cards.id,
        source_id: schema.cards.source_id,
        deleted_at: schema.cards.deleted_at,
        state: schema.cards.state,
        due: schema.cards.due,
        stability: schema.cards.stability,
        difficulty: schema.cards.difficulty,
        elapsed_days: schema.cards.elapsed_days,
        scheduled_days: schema.cards.scheduled_days,
        learning_steps: schema.cards.learning_steps,
        reps: schema.cards.reps,
        lapses: schema.cards.lapses,
        last_review: schema.cards.last_review,
        suspended: schema.cards.suspended,
      })
      .from(schema.cards)
      .where(isNotNull(schema.cards.source_id))
      .all();
    const existingCardsBySourceId = new Map<string, (typeof existingCards)[0]>();
    for (const c of existingCards) {
      if (c.source_id) {
        existingCardsBySourceId.set(c.source_id, c);
      }
    }

    // A. Importa Decks (idempotente)
    notify('importing_decks', 0, collection.decks.size, 'Importando decks...');
    let deckIndex = 0;
    for (const [deckId, ankiDeck] of collection.decks.entries()) {
      let folioDeckId: string;
      const existingBySource = existingDecksBySourceId.get(deckId);
      const existingByName = existingDecksByName.get(ankiDeck.name);

      if (existingBySource) {
        folioDeckId = existingBySource.id;
        tx.update(schema.decks)
          .set({
            name: ankiDeck.name,
            description: ankiDeck.desc || existingBySource.description,
            updated_at: now,
            deleted_at: null,
          })
          .where(eq(schema.decks.id, folioDeckId))
          .run();
      } else if (existingByName) {
        folioDeckId = existingByName.id;
        tx.update(schema.decks)
          .set({
            source_id: deckId,
            description: ankiDeck.desc || existingByName.description,
            updated_at: now,
            deleted_at: null,
          })
          .where(eq(schema.decks.id, folioDeckId))
          .run();
      } else {
        folioDeckId = generateId();
        tx.insert(schema.decks)
          .values({
            id: folioDeckId,
            name: ankiDeck.name,
            description: ankiDeck.desc || null,
            source_id: deckId,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          })
          .run();
        const newDeckObj = {
          id: folioDeckId,
          name: ankiDeck.name,
          description: ankiDeck.desc || null,
          source_id: deckId,
          area: null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        };
        existingDecksByName.set(ankiDeck.name, newDeckObj);
        existingDecksBySourceId.set(deckId, newDeckObj);
      }

      ankiDeckIdToFolioDeckId.set(deckId, folioDeckId);
      importedDeckIds.push(folioDeckId);
      deckIndex++;
      notify('importing_decks', deckIndex, collection.decks.size, `Deck "${ankiDeck.name}" processado.`);
    }

    // Deck de fallback se algum card não tiver deck válido mapeado
    const fallbackDeckId = importedDeckIds[0] ?? generateId();
    if (importedDeckIds.length === 0) {
      tx.insert(schema.decks)
        .values({
          id: fallbackDeckId,
          name: 'Deck Importado',
          created_at: now,
          updated_at: now,
          deleted_at: null,
        })
        .run();
      importedDeckIds.push(fallbackDeckId);
    }

    // B. Importa Note Types (idempotente)
    for (const [modelId, ankiModel] of collection.models.entries()) {
      const kind = detectModelKind(ankiModel);
      const fields = ankiModel.flds.map((f, i) => ({ name: f.name, ord: f.ord ?? i }));
      const templates = ankiModel.tmpls.map((t, i) => ({
        name: t.name,
        ord: t.ord ?? i,
        front: t.qfmt,
        back: t.afmt,
      }));
      const existingModel = existingModelsBySourceId.get(modelId);

      let folioModelId: string;
      if (existingModel) {
        folioModelId = existingModel.id;
        tx.update(schema.noteTypes)
          .set({
            name: ankiModel.name,
            kind,
            fields,
            templates,
            css: ankiModel.css || '',
            updated_at: now,
            deleted_at: null,
          })
          .where(eq(schema.noteTypes.id, folioModelId))
          .run();
      } else {
        folioModelId = generateId();
        tx.insert(schema.noteTypes)
          .values({
            id: folioModelId,
            name: ankiModel.name,
            kind,
            fields,
            templates,
            css: ankiModel.css || '',
            source_id: modelId,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          })
          .run();
        existingModelsBySourceId.set(modelId, {
          id: folioModelId,
          name: ankiModel.name,
          kind,
          fields,
          templates,
          css: ankiModel.css || '',
          source_id: modelId,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        });
      }
      ankiModelIdToFolioModelId.set(modelId, folioModelId);
    }

    // Agrupa cards por nota para saber a qual deck a nota pertence
    const noteDeckMap = new Map<string, string>();
    for (const card of collection.cards) {
      if (!noteDeckMap.has(card.noteId)) {
        const folioDeck = ankiDeckIdToFolioDeckId.get(card.deckId) ?? fallbackDeckId;
        noteDeckMap.set(card.noteId, folioDeck);
      }
    }

    // C. Importa Notas (idempotente por source_id)
    notify('importing_notes', 0, collection.notes.length, 'Importando notas...');
    let noteIndex = 0;
    for (const note of collection.notes) {
      const folioModelId = ankiModelIdToFolioModelId.get(note.modelId);
      const folioDeckId = noteDeckMap.get(note.id) ?? fallbackDeckId;

      if (!folioModelId) {
        continue;
      }

      const existing = existingNotesBySourceId.get(note.id);
      let folioNoteId: string;

      if (existing) {
        folioNoteId = existing.id;
        tx.update(schema.notes)
          .set({
            note_type_id: folioModelId,
            deck_id: folioDeckId,
            fields: note.fields,
            tags: note.tags,
            updated_at: now,
            deleted_at: null,
          })
          .where(eq(schema.notes.id, folioNoteId))
          .run();
        updatedNotesCount++;
      } else {
        folioNoteId = generateId();
        tx.insert(schema.notes)
          .values({
            id: folioNoteId,
            note_type_id: folioModelId,
            deck_id: folioDeckId,
            fields: note.fields,
            tags: note.tags,
            source_id: note.id,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          })
          .run();
        createdNotesCount++;
        existingNotesBySourceId.set(note.id, {
          id: folioNoteId,
          source_id: note.id,
          deleted_at: null,
        });
      }

      ankiNoteIdToFolioNoteId.set(note.id, folioNoteId);
      noteIndex++;
      if (noteIndex % 50 === 0 || noteIndex === collection.notes.length) {
        notify('importing_notes', noteIndex, collection.notes.length, `Importando notas (${noteIndex}/${collection.notes.length})...`);
      }
    }

    // D. Importa Cards (idempotente por source_id com preservação de progresso)
    notify('importing_cards', 0, collection.cards.length, 'Importando cards...');
    let cardIndex = 0;
    for (const card of collection.cards) {
      const folioNoteId = ankiNoteIdToFolioNoteId.get(card.noteId);
      const folioDeckId = ankiDeckIdToFolioDeckId.get(card.deckId) ?? fallbackDeckId;

      if (!folioNoteId) {
        continue;
      }

      let state = 0;
      let due = now;
      let stability = 0;
      let difficulty = 0;
      let scheduledDays = 0;
      let elapsedDays = 0;
      let reps = 0;
      let lapses = 0;
      let lastReview: number | null = null;

      if (scheduleMode === 'reset_new') {
        state = 0;
        due = now;
        stability = 0;
        difficulty = 0;
        scheduledDays = 0;
        elapsedDays = 0;
        reps = 0;
        lapses = 0;
        lastReview = null;
      } else {
        // 'keep_intervals'
        const fsrsData = parseAnkiCardFsrsData(card.data);
        if (fsrsData) {
          stability = fsrsData.stability;
          difficulty = fsrsData.difficulty;
          reps = card.reps;
          lapses = card.lapses;
          scheduledDays = card.ivl > 0 ? card.ivl : Math.max(1, Math.round(stability));
          elapsedDays = scheduledDays;
          state =
            card.queue === 0
              ? 0
              : card.type === 3
                ? 3
                : card.queue === 1
                  ? 1
                  : 2;

          if (state === 0) {
            due = now;
          } else if (card.due > 1_000_000_000) {
            due = card.due * 1000;
          } else if (collection.crt && (card.queue === 2 || card.type === 2)) {
            due = (collection.crt + card.due * 86400) * 1000;
          } else {
            due = now + scheduledDays * 86400 * 1000;
          }

          const revTime = latestRevlogByCard.get(card.id);
          lastReview =
            revTime ??
            (scheduledDays > 0 ? due - scheduledDays * 86400 * 1000 : null);
        } else {
          // SM-2 ou novo sem FSRS
          if (card.queue === 0 && card.reps === 0) {
            state = 0;
            due = now;
            stability = 0;
            difficulty = 0;
            scheduledDays = 0;
            elapsedDays = 0;
            reps = 0;
            lapses = 0;
            lastReview = null;
          } else {
            // Manter intervalos (aproximado): stability ≈ ivl
            stability = Math.max(0.1, card.ivl > 0 ? card.ivl : 1);
            difficulty = 5.0;
            reps = card.reps;
            lapses = card.lapses;
            scheduledDays = card.ivl > 0 ? card.ivl : 1;
            elapsedDays = scheduledDays;
            state =
              card.type === 3
                ? 3
                : card.queue === 1
                  ? 1
                  : 2;

            if (card.due > 1_000_000_000) {
              due = card.due * 1000;
            } else if (collection.crt && (card.queue === 2 || card.type === 2)) {
              due = (collection.crt + card.due * 86400) * 1000;
            } else {
              due = now + scheduledDays * 86400 * 1000;
            }

            const revTime = latestRevlogByCard.get(card.id);
            lastReview = revTime ?? (due - scheduledDays * 86400 * 1000);
          }
        }
      }

      cardStabilityMap.set(card.id, stability);
      cardDifficultyMap.set(card.id, difficulty);

      const existingCard = existingCardsBySourceId.get(card.id);
      let folioCardId: string;

      if (existingCard) {
        folioCardId = existingCard.id;

        // Preserva o agendamento do Folio caso o usuário já tenha estudado este card localmente,
        // a menos que o usuário tenha explicitamente escolhido 'reset_new' ou o arquivo possua revisão mais recente.
        const hasFolioProgress =
          (existingCard.reps > 0 || existingCard.last_review !== null) &&
          scheduleMode !== 'reset_new';

        const fileHasNewerReview =
          lastReview !== null &&
          (existingCard.last_review === null || lastReview > existingCard.last_review);

        const shouldPreserveFolioSchedule = hasFolioProgress && !fileHasNewerReview;

        const finalState = shouldPreserveFolioSchedule ? existingCard.state : state;
        const finalDue = shouldPreserveFolioSchedule ? existingCard.due : due;
        const finalStability = shouldPreserveFolioSchedule ? existingCard.stability : stability;
        const finalDifficulty = shouldPreserveFolioSchedule ? existingCard.difficulty : difficulty;
        const finalElapsedDays = shouldPreserveFolioSchedule ? existingCard.elapsed_days : elapsedDays;
        const finalScheduledDays = shouldPreserveFolioSchedule ? existingCard.scheduled_days : scheduledDays;
        const finalLearningSteps = shouldPreserveFolioSchedule ? existingCard.learning_steps : 0;
        const finalReps = shouldPreserveFolioSchedule ? existingCard.reps : reps;
        const finalLapses = shouldPreserveFolioSchedule ? existingCard.lapses : lapses;
        const finalLastReview = shouldPreserveFolioSchedule ? existingCard.last_review : lastReview;

        tx.update(schema.cards)
          .set({
            note_id: folioNoteId,
            deck_id: folioDeckId,
            ord: card.ord,
            due: finalDue,
            stability: finalStability,
            difficulty: finalDifficulty,
            elapsed_days: finalElapsedDays,
            scheduled_days: finalScheduledDays,
            learning_steps: finalLearningSteps,
            reps: finalReps,
            lapses: finalLapses,
            state: finalState,
            last_review: finalLastReview,
            suspended: card.suspended ? 1 : existingCard.suspended,
            updated_at: now,
            deleted_at: null,
          })
          .where(eq(schema.cards.id, folioCardId))
          .run();
        updatedCardsCount++;
      } else {
        folioCardId = generateId();
        tx.insert(schema.cards)
          .values({
            id: folioCardId,
            note_id: folioNoteId,
            deck_id: folioDeckId,
            ord: card.ord,
            due,
            stability,
            difficulty,
            elapsed_days: elapsedDays,
            scheduled_days: scheduledDays,
            learning_steps: 0,
            reps,
            lapses,
            state,
            last_review: lastReview,
            suspended: card.suspended ? 1 : 0,
            buried_until: null,
            source_id: card.id,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          })
          .run();
        createdCardsCount++;
        existingCardsBySourceId.set(card.id, {
          id: folioCardId,
          source_id: card.id,
          deleted_at: null,
          state,
          due,
          stability,
          difficulty,
          elapsed_days: elapsedDays,
          scheduled_days: scheduledDays,
          learning_steps: 0,
          reps,
          lapses,
          last_review: lastReview,
          suspended: card.suspended ? 1 : 0,
        });
      }

      ankiCardIdToFolioCardId.set(card.id, folioCardId);
      cardIndex++;
      if (cardIndex % 50 === 0 || cardIndex === collection.cards.length) {
        notify('importing_cards', cardIndex, collection.cards.length, `Importando cards (${cardIndex}/${collection.cards.length})...`);
      }
    }

    // E. Importa Revlogs (histórico de revisões idempotente)
    notify('importing_revlogs', 0, collection.revlogs.length, 'Importando histórico de revisões...');
    let importedRevlogsCount = 0;
    const revlogRows: schema.InsertReviewLog[] = [];

    // Busca logs existentes para os cards mapeados a fim de evitar duplicações
    const existingRevlogKeys = new Set<string>();
    const allImportedCardIds = Array.from(new Set(Array.from(ankiCardIdToFolioCardId.values())));
    for (let i = 0; i < allImportedCardIds.length; i += 100) {
      const chunk = allImportedCardIds.slice(i, i + 100);
      const existingLogs = tx
        .select({
          card_id: schema.reviewLogs.card_id,
          reviewed_at: schema.reviewLogs.reviewed_at,
        })
        .from(schema.reviewLogs)
        .where(inArray(schema.reviewLogs.card_id, chunk))
        .all();
      for (const log of existingLogs) {
        existingRevlogKeys.add(`${log.card_id}:${log.reviewed_at}`);
      }
    }

    for (const r of collection.revlogs) {
      const folioCardId = ankiCardIdToFolioCardId.get(r.cardId);
      if (!folioCardId) continue;

      const reviewedAt = r.id;
      const logKey = `${folioCardId}:${reviewedAt}`;
      if (existingRevlogKeys.has(logKey)) {
        continue;
      }
      existingRevlogKeys.add(logKey);

      const rating = Math.min(4, Math.max(1, r.ease));
      const logState = r.type === 0 ? 1 : r.type === 2 ? 3 : 2;
      const scheduledDays = r.ivl > 0 ? r.ivl : 0;
      const lastElapsedDays = r.lastIvl && r.lastIvl > 0 ? r.lastIvl : 0;
      const elapsedDays = lastElapsedDays > 0 ? lastElapsedDays : scheduledDays;
      const reviewMs = Math.max(0, r.time || 0);
      const logDue =
        scheduledDays > 0 ? reviewedAt + scheduledDays * 86400 * 1000 : reviewedAt;
      const cardStability = cardStabilityMap.get(r.cardId) ?? Math.max(0.1, scheduledDays);
      const cardDifficulty = cardDifficultyMap.get(r.cardId) ?? 5.0;

      revlogRows.push({
        id: generateId(),
        card_id: folioCardId,
        rating,
        state: logState,
        due: logDue,
        stability: cardStability,
        difficulty: cardDifficulty,
        elapsed_days: elapsedDays,
        last_elapsed_days: lastElapsedDays,
        scheduled_days: scheduledDays,
        review_ms: reviewMs,
        reviewed_at: reviewedAt,
        created_at: reviewedAt,
        updated_at: reviewedAt,
        deleted_at: null,
      });
    }

    // Insere em lotes de 50 registros para manter compatibilidade com limites de parâmetros SQL
    for (let i = 0; i < revlogRows.length; i += 50) {
      const chunk = revlogRows.slice(i, i + 50);
      tx.insert(schema.reviewLogs).values(chunk).run();
      importedRevlogsCount += chunk.length;
      notify(
        'importing_revlogs',
        importedRevlogsCount,
        revlogRows.length,
        `Importando histórico (${importedRevlogsCount}/${revlogRows.length})...`
      );
    }

    // F. Registra Mídia no banco de dados
    let importedMediaCount = 0;
    for (const item of preparedMedia) {
      const existingMedia = mediaRepo.getBySha1(item.sha1);
      if (!existingMedia) {
        mediaRepo.create({
          id: generateId(),
          filename: item.filename,
          sha1: item.sha1,
          bytes: item.bytes,
          mime: item.mime,
        });
      }
      importedMediaCount++;
    }

    return {
      importedDecks: collection.decks.size,
      importedNotes: noteIndex,
      importedCards: cardIndex,
      importedMedia: importedMediaCount,
      importedRevlogs: importedRevlogsCount,
      deckIds: importedDeckIds,
      createdNotes: createdNotesCount,
      updatedNotes: updatedNotesCount,
      createdCards: createdCardsCount,
      updatedCards: updatedCardsCount,
    };
  });

  try {
    const settingsRepo = new SettingsRepository(db);
    settingsRepo.increment('apkgImportCount');
  } catch (err) {
    logWarn('Importer', 'Falha ao incrementar contador apkgImportCount', String(err));
  }

  notify('completed', 100, 100, 'Importação concluída com sucesso!');
  return result;
}
