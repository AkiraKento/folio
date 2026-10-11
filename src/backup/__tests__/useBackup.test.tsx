import React, { act, useEffect } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useBackup, type UseBackupOptions } from '../useBackup';
import type { BackupRestoreResult, BackupExportResult } from '../types';
import { createTestDatabase } from '@/db/__tests__/test-utils';
import { DecksRepository } from '@/db/repositories/decks';
import { NoteTypesRepository } from '@/db/repositories/note-types';
import { exportBackup } from '../backupService';

describe('useBackup hook', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let decksRepo: DecksRepository;
  let noteTypesRepo: NoteTypesRepository;

  beforeEach(() => {
    const context = createTestDatabase();
    db = context.db;
    decksRepo = new DecksRepository(db);
    noteTypesRepo = new NoteTypesRepository(db);
    noteTypesRepo.seedBuiltins();
    decksRepo.create({ id: 'd-hook', name: 'Deck Hook' });
  });

  function renderHookHelper(options: UseBackupOptions, callback: (res: ReturnType<typeof useBackup>) => void) {
    function HookConsumer() {
      const res = useBackup(options);
      useEffect(() => {
        callback(res);
      }, [res]);
      return null;
    }

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<HookConsumer />);
    });
    return renderer;
  }

  test('exportBackupFile executa exportação e salva o arquivo', async () => {
    let savedFileName = '';
    let savedBase64 = '';
    const mockSave = jest.fn(async (fileName: string, base64: string) => {
      savedFileName = fileName;
      savedBase64 = base64;
      return `content://test/${fileName}`;
    });
    const mockSuccess = jest.fn();

    let hookResult!: ReturnType<typeof useBackup>;
    renderHookHelper(
      {
        db,
        saveFileSafely: mockSave,
        onExportSuccess: mockSuccess,
      },
      (res) => {
        hookResult = res;
      }
    );

    let exportRes: BackupExportResult | null = null;
    await act(async () => {
      exportRes = await hookResult.exportBackupFile();
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(savedFileName).toMatch(/^folio-backup-/);
    expect(savedBase64.length).toBeGreaterThan(0);
    expect(exportRes).not.toBeNull();
    expect(hookResult.exportResult).not.toBeNull();
    expect(mockSuccess).toHaveBeenCalledWith(hookResult.exportResult);
    expect(hookResult.error).toBeNull();
  });

  test('pickBackupFile carrega arquivo e gera prévia de restauração', async () => {
    const { base64 } = await exportBackup(db);

    const mockPick = jest.fn(async () => ({
      uri: 'file:///cache/backup.zip',
      name: 'folio-backup.zip',
      size: 1024,
    }));
    const mockRead = jest.fn(async () => base64);

    let hookResult!: ReturnType<typeof useBackup>;
    renderHookHelper(
      {
        db,
        pickDocument: mockPick,
        readFileAsBase64: mockRead,
      },
      (res) => {
        hookResult = res;
      }
    );

    await act(async () => {
      await hookResult.pickBackupFile();
    });

    expect(mockPick).toHaveBeenCalledTimes(1);
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(hookResult.selectedFile?.name).toBe('folio-backup.zip');
    expect(hookResult.preview?.valid).toBe(true);
    expect(hookResult.preview?.stats.decks).toBeGreaterThanOrEqual(1);
  });

  test('executeRestore restaura dados e dispara callback de sucesso', async () => {
    const { base64 } = await exportBackup(db);

    const mockPick = jest.fn(async () => ({
      uri: 'file:///cache/backup.zip',
      name: 'folio-backup.zip',
    }));
    const mockRead = jest.fn(async () => base64);
    const mockRestoreSuccess = jest.fn();

    const destContext = createTestDatabase();
    const destDb = destContext.db;

    let hookResult!: ReturnType<typeof useBackup>;
    renderHookHelper(
      {
        db: destDb,
        pickDocument: mockPick,
        readFileAsBase64: mockRead,
        onRestoreSuccess: mockRestoreSuccess,
      },
      (res) => {
        hookResult = res;
      }
    );

    await act(async () => {
      await hookResult.pickBackupFile();
    });

    let restoreRes: BackupRestoreResult | null = null;
    await act(async () => {
      restoreRes = await hookResult.executeRestore('replace');
    });

    const res = restoreRes as BackupRestoreResult | null;
    expect(res?.mode).toBe('replace');
    expect(hookResult.restoreResult?.mode).toBe('replace');
    expect(mockRestoreSuccess).toHaveBeenCalledTimes(1);
    expect(hookResult.error).toBeNull();

    const destDecks = new DecksRepository(destDb);
    expect(destDecks.getById('d-hook')).not.toBeNull();
  });

  test('trata erro se usuário selecionar arquivo inválido', async () => {
    const mockPick = jest.fn(async () => ({
      uri: 'file:///cache/corrompido.zip',
      name: 'corrompido.zip',
    }));
    const mockRead = jest.fn(async () => 'not-a-zip-content');

    let hookResult!: ReturnType<typeof useBackup>;
    renderHookHelper(
      {
        db,
        pickDocument: mockPick,
        readFileAsBase64: mockRead,
      },
      (res) => {
        hookResult = res;
      }
    );

    await act(async () => {
      await hookResult.pickBackupFile();
    });

    expect(hookResult.error).not.toBeNull();
    expect(hookResult.preview).toBeNull();
  });
});
