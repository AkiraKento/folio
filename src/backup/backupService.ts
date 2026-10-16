import JSZip from 'jszip';
import { eq } from 'drizzle-orm';
import type { FolioDatabase } from '@/db/client';
import { getDb } from '@/db/client';
import * as schema from '@/db/schema';
import { getMediaDirectory } from '@/media/mediaService';
import { logError, logWarn } from '@/logging';
import type {
  BackupExportResult,
  BackupPreview,
  BackupRestoreMode,
  BackupRestoreResult,
  BackupProgress,
  BackupStats,
  FolioBackupManifest,
  FolioBackupPayload,
} from './types';

export interface ExportBackupOptions {
  fileName?: string;
  mediaReader?: (filename: string) => Promise<Uint8Array | null>;
  onProgress?: (progress: BackupProgress) => void;
}

export interface RestoreBackupOptions {
  mode?: BackupRestoreMode;
  mediaWriter?: (filename: string, bytes: Uint8Array) => Promise<void>;
  onProgress?: (progress: BackupProgress) => void;
}

export function formatBackupFileName(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `folio-backup-${yyyy}-${mm}-${dd}-${hh}${min}.zip`;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  const CHUNK_SIZE = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK_SIZE)));
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Leitor padrão de mídia local do app.
 */
async function defaultMediaReader(filename: string): Promise<Uint8Array | null> {
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const mediaDir = await getMediaDirectory();
    const filePath = `${mediaDir}${filename}`;
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      const b64 = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64ToUint8Array(b64);
    }
  } catch {
    // Tenta fallback Node.js (testes Jest)
  }

  try {
    const fsModule = await import('node:fs');
    const pathModule = await import('node:path');
    const osModule = await import('node:os');
    const tempDir = pathModule.join(osModule.tmpdir(), 'folio-media');
    const testPath = pathModule.join(tempDir, filename);
    if (fsModule.existsSync(testPath)) {
      const buffer = fsModule.readFileSync(testPath);
      return new Uint8Array(buffer);
    }
  } catch (err) {
    logWarn('BackupService', 'Falha ao ler arquivo de mídia local', String(err));
  }

  return null;
}

/**
 * Escritor padrão de mídia local do app.
 */
async function defaultMediaWriter(filename: string, bytes: Uint8Array): Promise<void> {
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const mediaDir = await getMediaDirectory();
    if (mediaDir && FileSystem?.writeAsStringAsync) {
      const targetPath = `${mediaDir}${filename}`;
      const base64 = uint8ArrayToBase64(bytes);
      await FileSystem.writeAsStringAsync(targetPath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return;
    }
  } catch {
    // Tenta fallback Node.js (testes Jest)
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
    logWarn('BackupService', 'Falha ao gravar arquivo de mídia local', String(err));
  }
}

/**
 * Exporta o banco de dados completo do Folio e a pasta de mídia num arquivo ZIP.
 */
export async function exportBackup(
  db?: FolioDatabase,
  options?: ExportBackupOptions
): Promise<{
  zipData: Uint8Array;
  base64: string;
  result: BackupExportResult;
}> {
  const database = db ?? getDb();
  const mediaReader = options?.mediaReader ?? defaultMediaReader;
  const fileName = options?.fileName ?? formatBackupFileName();

  options?.onProgress?.({
    stage: 'reading',
    message: 'Lendo dados do banco...',
  });

  // 1. Extrai todas as tabelas (incluindo soft-deleted para preservar sincronização)
  const allDecks = database.select().from(schema.decks).all();
  const allNoteTypes = database.select().from(schema.noteTypes).all();
  const allNotes = database.select().from(schema.notes).all();
  const allCards = database.select().from(schema.cards).all();
  const allReviewLogs = database.select().from(schema.reviewLogs).all();
  const allAnnotations = database.select().from(schema.annotations).all();
  const allMedia = database.select().from(schema.media).all();
  const allSettings = database.select().from(schema.settings).all();
  const allConsultaPos = database.select().from(schema.consultaPos).all();

  const stats: BackupStats = {
    decks: allDecks.length,
    noteTypes: allNoteTypes.length,
    notes: allNotes.length,
    cards: allCards.length,
    reviewLogs: allReviewLogs.length,
    annotations: allAnnotations.length,
    media: allMedia.length,
    settings: allSettings.length,
    consultaPos: allConsultaPos.length,
  };

  const manifest: FolioBackupManifest = {
    version: 1,
    app: 'folio',
    appVersion: '0.1.0',
    exportedAt: Date.now(),
    stats,
  };

  const payload: FolioBackupPayload = {
    manifest,
    data: {
      decks: allDecks,
      noteTypes: allNoteTypes,
      notes: allNotes,
      cards: allCards,
      reviewLogs: allReviewLogs,
      annotations: allAnnotations,
      media: allMedia,
      settings: allSettings,
      consultaPos: allConsultaPos,
    },
  };

  // 2. Empacota com JSZip
  const zip = new JSZip();
  zip.file('backup.json', JSON.stringify(payload, null, 2));

  // 3. Compacta arquivos de mídia
  let packedMediaCount = 0;
  let packedMediaBytes = 0;
  const mediaFolder = zip.folder('media');

  options?.onProgress?.({
    stage: 'extracting_media',
    message: 'Compactando mídias...',
    total: allMedia.length,
    current: 0,
  });

  for (let i = 0; i < allMedia.length; i++) {
    const item = allMedia[i];
    try {
      const bytes = await mediaReader(item.filename);
      if (bytes && bytes.length > 0) {
        mediaFolder?.file(item.filename, bytes);
        packedMediaCount++;
        packedMediaBytes += bytes.length;
      }
    } catch (err) {
      logWarn('BackupService', `Mídia ausente no backup: ${item.filename}`, String(err));
    }

    options?.onProgress?.({
      stage: 'extracting_media',
      message: 'Compactando mídias...',
      total: allMedia.length,
      current: i + 1,
    });
  }

  options?.onProgress?.({
    stage: 'done',
    message: 'Gerando arquivo compactado...',
  });

  const zipData = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const base64 = uint8ArrayToBase64(zipData);

  const result: BackupExportResult = {
    fileName,
    stats,
    mediaCount: packedMediaCount,
    mediaTotalBytes: packedMediaBytes,
    zipBytes: zipData.byteLength,
    base64,
  };

  return {
    zipData,
    base64,
    result,
  };
}

/**
 * Lê um arquivo de backup (.zip) e retorna a prévia com validação.
 */
export async function getBackupPreview(
  zipData: Uint8Array | string | ArrayBuffer
): Promise<BackupPreview> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipData);
  } catch (err) {
    logError('BackupService', err, 'Arquivo de backup inválido ou corrompido');
    throw new Error('Arquivo de backup inválido ou corrompido.');
  }

  const jsonFile = zip.file('backup.json');
  if (!jsonFile) {
    throw new Error('O arquivo selecionado não contém um backup válido do Folio (backup.json ausente).');
  }

  const jsonText = await jsonFile.async('string');
  let parsed: FolioBackupPayload;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    logError('BackupService', err, 'JSON do backup corrompido');
    throw new Error('Erro ao decodificar dados do backup (JSON corrompido).');
  }

  if (
    !parsed ||
    !parsed.manifest ||
    parsed.manifest.app !== 'folio' ||
    parsed.manifest.version !== 1 ||
    !parsed.data
  ) {
    throw new Error('Formato de backup incompatível com esta versão do Folio.');
  }

  // Conta arquivos dentro da pasta media/
  let mediaCount = 0;
  zip.folder('media')?.forEach(() => {
    mediaCount++;
  });

  const fileSizeBytes =
    typeof zipData === 'string'
      ? zipData.length
      : (zipData as Uint8Array).byteLength ?? undefined;

  return {
    valid: true,
    exportedAt: parsed.manifest.exportedAt,
    appVersion: parsed.manifest.appVersion,
    stats: parsed.manifest.stats,
    mediaInZip: mediaCount,
    fileSizeBytes,
  };
}

/**
 * Restaura o backup no banco de dados e na pasta de mídia.
 */
export async function restoreBackup(
  zipData: Uint8Array | string | ArrayBuffer,
  db?: FolioDatabase,
  options?: RestoreBackupOptions
): Promise<BackupRestoreResult> {
  const database = db ?? getDb();
  const mode = options?.mode ?? 'replace';
  const mediaWriter = options?.mediaWriter ?? defaultMediaWriter;

  options?.onProgress?.({
    stage: 'reading',
    message: 'Lendo arquivo de backup...',
  });

  const zip = await JSZip.loadAsync(zipData);
  const jsonFile = zip.file('backup.json');
  if (!jsonFile) {
    throw new Error('Arquivo de backup inválido (backup.json ausente).');
  }

  const jsonText = await jsonFile.async('string');
  const payload = JSON.parse(jsonText) as FolioBackupPayload;

  if (
    !payload ||
    !payload.manifest ||
    payload.manifest.app !== 'folio' ||
    !payload.data
  ) {
    throw new Error('Formato de backup inválido.');
  }

  // 1. Extrai mídias para a pasta local
  let restoredMediaCount = 0;
  const mediaFolder = zip.folder('media');
  if (mediaFolder) {
    const mediaFiles: { filename: string; file: JSZip.JSZipObject }[] = [];
    mediaFolder.forEach((relativePath, file) => {
      if (!file.dir) {
        mediaFiles.push({ filename: relativePath, file });
      }
    });

    options?.onProgress?.({
      stage: 'extracting_media',
      message: 'Restaurando mídias...',
      total: mediaFiles.length,
      current: 0,
    });

    for (let i = 0; i < mediaFiles.length; i++) {
      const { filename, file } = mediaFiles[i];
      try {
        const bytes = await file.async('uint8array');
        await mediaWriter(filename, bytes);
        restoredMediaCount++;
      } catch (err) {
        logWarn('BackupService', `Falha ao restaurar mídia: ${filename}`, String(err));
      }

      options?.onProgress?.({
        stage: 'extracting_media',
        message: 'Restaurando mídias...',
        total: mediaFiles.length,
        current: i + 1,
      });
    }
  }

  options?.onProgress?.({
    stage: 'restoring_db',
    message: 'Restaurando dados no banco de dados...',
  });

  // 2. Restaura tabelas no banco de dados numa transação
  database.transaction((tx) => {
    if (mode === 'replace') {
      // Limpeza em ordem reversa de chaves estrangeiras
      tx.delete(schema.consultaPos).run();
      tx.delete(schema.annotations).run();
      tx.delete(schema.reviewLogs).run();
      tx.delete(schema.cards).run();
      tx.delete(schema.notes).run();
      tx.delete(schema.noteTypes).run();
      tx.delete(schema.decks).run();
      tx.delete(schema.media).run();
      tx.delete(schema.settings).run();

      // Inserção em ordem direta de integridade referencial
      for (const item of payload.data.decks) {
        tx.insert(schema.decks).values(item).run();
      }
      for (const item of payload.data.noteTypes) {
        tx.insert(schema.noteTypes).values(item).run();
      }
      for (const item of payload.data.notes) {
        tx.insert(schema.notes).values(item).run();
      }
      for (const item of payload.data.cards) {
        tx.insert(schema.cards).values(item).run();
      }
      for (const item of payload.data.reviewLogs) {
        tx.insert(schema.reviewLogs).values(item).run();
      }
      for (const item of payload.data.annotations) {
        tx.insert(schema.annotations).values(item).run();
      }
      for (const item of payload.data.media) {
        tx.insert(schema.media).values(item).run();
      }
      for (const item of payload.data.settings) {
        tx.insert(schema.settings).values(item).run();
      }
      for (const item of payload.data.consultaPos) {
        tx.insert(schema.consultaPos).values(item).run();
      }
    } else {
      // Modo 'merge': atualiza existentes por ID / chave e insere novos
      for (const item of payload.data.decks) {
        const existing = tx
          .select({ id: schema.decks.id })
          .from(schema.decks)
          .where(eq(schema.decks.id, item.id))
          .get();
        if (existing) {
          tx.update(schema.decks).set(item).where(eq(schema.decks.id, item.id)).run();
        } else {
          tx.insert(schema.decks).values(item).run();
        }
      }

      for (const item of payload.data.noteTypes) {
        const existing = tx
          .select({ id: schema.noteTypes.id })
          .from(schema.noteTypes)
          .where(eq(schema.noteTypes.id, item.id))
          .get();
        if (existing) {
          tx.update(schema.noteTypes).set(item).where(eq(schema.noteTypes.id, item.id)).run();
        } else {
          tx.insert(schema.noteTypes).values(item).run();
        }
      }

      for (const item of payload.data.notes) {
        const existing = tx
          .select({ id: schema.notes.id })
          .from(schema.notes)
          .where(eq(schema.notes.id, item.id))
          .get();
        if (existing) {
          tx.update(schema.notes).set(item).where(eq(schema.notes.id, item.id)).run();
        } else {
          tx.insert(schema.notes).values(item).run();
        }
      }

      for (const item of payload.data.cards) {
        const existing = tx
          .select({ id: schema.cards.id })
          .from(schema.cards)
          .where(eq(schema.cards.id, item.id))
          .get();
        if (existing) {
          tx.update(schema.cards).set(item).where(eq(schema.cards.id, item.id)).run();
        } else {
          tx.insert(schema.cards).values(item).run();
        }
      }

      for (const item of payload.data.reviewLogs) {
        const existing = tx
          .select({ id: schema.reviewLogs.id })
          .from(schema.reviewLogs)
          .where(eq(schema.reviewLogs.id, item.id))
          .get();
        if (existing) {
          tx.update(schema.reviewLogs).set(item).where(eq(schema.reviewLogs.id, item.id)).run();
        } else {
          tx.insert(schema.reviewLogs).values(item).run();
        }
      }

      for (const item of payload.data.annotations) {
        const existing = tx
          .select({ id: schema.annotations.id })
          .from(schema.annotations)
          .where(eq(schema.annotations.id, item.id))
          .get();
        if (existing) {
          tx.update(schema.annotations).set(item).where(eq(schema.annotations.id, item.id)).run();
        } else {
          tx.insert(schema.annotations).values(item).run();
        }
      }

      for (const item of payload.data.media) {
        const existing = tx
          .select({ id: schema.media.id })
          .from(schema.media)
          .where(eq(schema.media.id, item.id))
          .get();
        if (existing) {
          tx.update(schema.media).set(item).where(eq(schema.media.id, item.id)).run();
        } else {
          tx.insert(schema.media).values(item).run();
        }
      }

      for (const item of payload.data.settings) {
        const existing = tx
          .select({ key: schema.settings.key })
          .from(schema.settings)
          .where(eq(schema.settings.key, item.key))
          .get();
        if (existing) {
          tx.update(schema.settings).set(item).where(eq(schema.settings.key, item.key)).run();
        } else {
          tx.insert(schema.settings).values(item).run();
        }
      }

      for (const item of payload.data.consultaPos) {
        const existing = tx
          .select({ deck_query: schema.consultaPos.deck_query })
          .from(schema.consultaPos)
          .where(eq(schema.consultaPos.deck_query, item.deck_query))
          .get();
        if (existing) {
          tx.update(schema.consultaPos).set(item).where(eq(schema.consultaPos.deck_query, item.deck_query)).run();
        } else {
          tx.insert(schema.consultaPos).values(item).run();
        }
      }
    }
  });

  options?.onProgress?.({
    stage: 'done',
    message: 'Restauração concluída!',
  });

  return {
    mode,
    restoredStats: payload.manifest.stats,
    restoredMediaCount,
  };
}
