import { useState, useCallback, useRef } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { getDb, type FolioDatabase } from '@/db/client';
import { getApkgPreview, importApkg } from './importer';
import { getCsvPreview, importCsv } from './csvParser';
import type { ImportPreview, ImportProgress, ImportResult, ScheduleImportMode } from './types';

export interface UseApkgImportOptions {
  db?: FolioDatabase;
  pickDocument?: () => Promise<{ uri: string; name: string; size?: number } | null>;
  readFileAsBase64?: (uri: string) => Promise<string>;
  readFileAsString?: (uri: string) => Promise<string>;
  previewResolver?: (data: string, fileName?: string) => Promise<ImportPreview>;
  importExecutor?: (
    data: string,
    db: FolioDatabase,
    options?: {
      scheduleMode?: ScheduleImportMode;
      fileName?: string;
      onProgress?: (p: ImportProgress) => void;
    }
  ) => Promise<ImportResult>;
  onSuccess?: (result: ImportResult) => void;
}

export function isCsvFileName(fileName: string): boolean {
  return /\.(csv|tsv|txt)$/i.test(fileName);
}

function decodeBase64ToUtf8(base64: string): string {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64, 'base64').toString('utf-8');
    }
  } catch {
    // fallback
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

export function useApkgImport(options?: UseApkgImportOptions) {
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    size?: number;
  } | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const fileDataRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [scheduleMode, setScheduleMode] = useState<ScheduleImportMode>('keep_intervals');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const defaultPick = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        'application/octet-stream',
        'application/zip',
        'text/csv',
        'text/comma-separated-values',
        'text/tab-separated-values',
        'text/plain',
        '*/*',
      ],
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
  }, []);

  const defaultReadBase64 = useCallback(async (uri: string) => {
    return FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }, []);

  const defaultReadString = useCallback(async (uri: string) => {
    return FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }, []);

  const pickFile = useCallback(async () => {
    setError(null);
    setResult(null);

    try {
      const pickerFn = options?.pickDocument ?? defaultPick;
      const file = await pickerFn();

      if (!file) {
        return;
      }

      setSelectedFile(file);
      setIsLoadingPreview(true);

      const isCsv = isCsvFileName(file.name);
      let fileData: string;

      if (isCsv) {
        if (options?.readFileAsString) {
          fileData = await options.readFileAsString(file.uri);
        } else if (options?.readFileAsBase64) {
          const b64 = await options.readFileAsBase64(file.uri);
          fileData = decodeBase64ToUtf8(b64);
        } else {
          fileData = await defaultReadString(file.uri);
        }
      } else {
        const readFn = options?.readFileAsBase64 ?? defaultReadBase64;
        fileData = await readFn(file.uri);
      }

      fileDataRef.current = fileData;
      setFileBase64(fileData);

      let previewData: ImportPreview;
      if (options?.previewResolver) {
        previewData = await (isCsv
          ? options.previewResolver(fileData, file.name)
          : options.previewResolver(fileData));
      } else if (isCsv) {
        previewData = getCsvPreview(fileData, file.name);
        previewData.fileFormat = 'csv';
      } else {
        previewData = await getApkgPreview(fileData);
        previewData.fileFormat = 'apkg';
      }

      setPreview(previewData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [
    options?.pickDocument,
    options?.readFileAsString,
    options?.readFileAsBase64,
    options?.previewResolver,
    defaultPick,
    defaultReadString,
    defaultReadBase64,
  ]);

  const startImport = useCallback(async () => {
    const data = fileDataRef.current ?? fileBase64;
    if (!data || isImporting) return;

    setError(null);
    setIsImporting(true);
    setProgress({
      stage: 'importing_decks',
      current: 0,
      total: 100,
      message: 'Iniciando importação...',
    });

    try {
      const targetDb = options?.db ?? getDb();
      const isCsv = preview?.fileFormat === 'csv' || (selectedFile && isCsvFileName(selectedFile.name));

      let res: ImportResult;
      if (options?.importExecutor) {
        res = await options.importExecutor(data, targetDb, {
          scheduleMode,
          fileName: selectedFile?.name,
          onProgress: (p) => setProgress(p),
        });
      } else if (isCsv) {
        res = await importCsv(data, targetDb, {
          fileName: selectedFile?.name,
          onProgress: (p) => setProgress(p),
        });
      } else {
        res = await importApkg(data, targetDb, {
          scheduleMode,
          onProgress: (p) => setProgress(p),
        });
      }

      setResult(res);
      options?.onSuccess?.(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsImporting(false);
    }
  }, [fileBase64, isImporting, options, preview, scheduleMode, selectedFile]);

  const reset = useCallback(() => {
    fileDataRef.current = null;
    setSelectedFile(null);
    setFileBase64(null);
    setPreview(null);
    setScheduleMode('keep_intervals');
    setProgress(null);
    setError(null);
    setResult(null);
    setIsLoadingPreview(false);
    setIsImporting(false);
  }, []);

  return {
    selectedFile,
    preview,
    scheduleMode,
    setScheduleMode,
    isLoadingPreview,
    isImporting,
    progress,
    error,
    result,
    pickFile,
    startImport,
    reset,
  };
}

export const useFileImport = useApkgImport;
