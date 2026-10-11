import { useState, useCallback, useRef } from 'react';
import { getDb, type FolioDatabase } from '@/db/client';
import {
  exportBackup,
  getBackupPreview,
  restoreBackup,
  base64ToUint8Array,
} from './backupService';
import type {
  BackupExportResult,
  BackupPreview,
  BackupProgress,
  BackupRestoreMode,
  BackupRestoreResult,
} from './types';
import { strings } from '@/ui/strings';

export interface UseBackupOptions {
  db?: FolioDatabase;
  pickDocument?: () => Promise<{ uri: string; name: string; size?: number } | null>;
  readFileAsBase64?: (uri: string) => Promise<string>;
  saveFileSafely?: (fileName: string, base64: string) => Promise<string | null>;
  onExportSuccess?: (result: BackupExportResult) => void;
  onRestoreSuccess?: (result: BackupRestoreResult) => void;
}

async function defaultPickDocument(): Promise<{
  uri: string;
  name: string;
  size?: number;
} | null> {
  const DocumentPicker = await import('expo-document-picker');
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets || res.assets.length === 0) {
    return null;
  }
  const asset = res.assets[0];
  return {
    uri: asset.uri,
    name: asset.name,
    size: asset.size ?? undefined,
  };
}

async function defaultReadFileAsBase64(uri: string): Promise<string> {
  const FileSystem = await import('expo-file-system/legacy');
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

async function defaultSaveFileSafely(fileName: string, base64: string): Promise<string | null> {
  const FileSystem = await import('expo-file-system/legacy');

  // No Android: tenta StorageAccessFramework para o usuário escolher a pasta
  if (FileSystem.StorageAccessFramework?.requestDirectoryPermissionsAsync) {
    try {
      const permissions =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'application/zip'
        );
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return fileUri;
      } else {
        throw new Error(strings.backup.folderPermissionDenied);
      }
    } catch (err: unknown) {
      if ((err as Error)?.message === strings.backup.folderPermissionDenied) {
        throw err;
      }
      // Se SAF falhar por outro motivo, continua para fallback
    }
  }

  // Fallback: salva na pasta de documentos local do app
  const targetDir = FileSystem.documentDirectory ?? '';
  const targetUri = `${targetDir}${fileName}`;
  await FileSystem.writeAsStringAsync(targetUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return targetUri;
}

export function useBackup(options?: UseBackupOptions) {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [exportProgress, setExportProgress] = useState<BackupProgress | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<BackupProgress | null>(null);

  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    size?: number;
  } | null>(null);
  const fileBase64Ref = useRef<string | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [restoreMode, setRestoreMode] = useState<BackupRestoreMode>('replace');

  const [error, setError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<BackupExportResult | null>(null);
  const [restoreResult, setRestoreResult] = useState<BackupRestoreResult | null>(null);

  const pickDoc = options?.pickDocument ?? defaultPickDocument;
  const readBase64 = options?.readFileAsBase64 ?? defaultReadFileAsBase64;
  const saveFile = options?.saveFileSafely ?? defaultSaveFileSafely;

  const exportBackupFile = useCallback(async (): Promise<BackupExportResult | null> => {
    setIsExporting(true);
    setError(null);
    setExportResult(null);
    setExportProgress({ stage: 'reading', message: strings.backup.exportingMessage });

    try {
      const db = options?.db ?? getDb();
      const { base64, result } = await exportBackup(db, {
        onProgress: (p) => setExportProgress(p),
      });

      await saveFile(result.fileName, base64);
      setExportResult(result);
      options?.onExportSuccess?.(result);
      return result;
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? 'Erro ao exportar backup.';
      setError(msg);
      return null;
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }, [options, saveFile]);

  const pickBackupFile = useCallback(async () => {
    setError(null);
    setPreview(null);
    setRestoreResult(null);

    try {
      const file = await pickDoc();
      if (!file) return;

      setSelectedFile(file);
      setIsLoadingPreview(true);

      const base64 = await readBase64(file.uri);
      fileBase64Ref.current = base64;

      const uint8 = base64ToUint8Array(base64);
      const prev = await getBackupPreview(uint8);
      setPreview(prev);
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? 'Erro ao ler arquivo de backup.';
      setError(msg);
      setSelectedFile(null);
      fileBase64Ref.current = null;
    } finally {
      setIsLoadingPreview(false);
    }
  }, [pickDoc, readBase64]);

  const executeRestore = useCallback(
    async (mode?: BackupRestoreMode): Promise<BackupRestoreResult | null> => {
      if (!fileBase64Ref.current) {
        setError('Nenhum arquivo de backup carregado.');
        return null;
      }

      setIsRestoring(true);
      setError(null);
      setRestoreResult(null);
      setRestoreProgress({ stage: 'reading', message: strings.backup.restoringMessage });

      try {
        const db = options?.db ?? getDb();
        const selectedMode = mode ?? restoreMode;
        const uint8 = base64ToUint8Array(fileBase64Ref.current);

        const result = await restoreBackup(uint8, db, {
          mode: selectedMode,
          onProgress: (p) => setRestoreProgress(p),
        });

        setRestoreResult(result);
        options?.onRestoreSuccess?.(result);
        return result;
      } catch (err: unknown) {
        const msg = (err as Error)?.message ?? 'Erro ao restaurar backup.';
        setError(msg);
        return null;
      } finally {
        setIsRestoring(false);
        setRestoreProgress(null);
      }
    },
    [options, restoreMode]
  );

  const reset = useCallback(() => {
    setSelectedFile(null);
    fileBase64Ref.current = null;
    setPreview(null);
    setError(null);
    setExportResult(null);
    setRestoreResult(null);
    setIsExporting(false);
    setIsRestoring(false);
  }, []);

  return {
    isExporting,
    isRestoring,
    isLoadingPreview,
    exportProgress,
    restoreProgress,
    selectedFile,
    preview,
    restoreMode,
    setRestoreMode,
    error,
    exportResult,
    restoreResult,
    exportBackupFile,
    pickBackupFile,
    executeRestore,
    reset,
  };
}
