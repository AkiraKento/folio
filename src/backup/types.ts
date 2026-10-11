import type {
  Deck,
  NoteType,
  Note,
  Card,
  ReviewLog,
  Annotation,
  Media,
  Setting,
  ConsultaPos,
} from '@/db/schema';

export interface BackupStats {
  decks: number;
  noteTypes: number;
  notes: number;
  cards: number;
  reviewLogs: number;
  annotations: number;
  media: number;
  settings: number;
  consultaPos: number;
}

export interface FolioBackupManifest {
  version: 1;
  app: 'folio';
  appVersion: string;
  exportedAt: number; // timestamp UTC em ms
  stats: BackupStats;
}

export interface FolioBackupPayload {
  manifest: FolioBackupManifest;
  data: {
    decks: Deck[];
    noteTypes: NoteType[];
    notes: Note[];
    cards: Card[];
    reviewLogs: ReviewLog[];
    annotations: Annotation[];
    media: Media[];
    settings: Setting[];
    consultaPos: ConsultaPos[];
  };
}

export interface BackupExportResult {
  fileName: string;
  stats: BackupStats;
  mediaCount: number;
  mediaTotalBytes: number;
  zipBytes: number;
  base64?: string;
}

export interface BackupPreview {
  valid: boolean;
  exportedAt: number;
  appVersion: string;
  stats: BackupStats;
  mediaInZip: number;
  fileSizeBytes?: number;
}

export type BackupRestoreMode = 'replace' | 'merge';

export interface BackupProgress {
  stage: 'reading' | 'extracting_media' | 'restoring_db' | 'done';
  message: string;
  current?: number;
  total?: number;
}

export interface BackupRestoreResult {
  mode: BackupRestoreMode;
  restoredStats: BackupStats;
  restoredMediaCount: number;
}
