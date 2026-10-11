import React, { act, useEffect } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useApkgImport, type UseApkgImportOptions } from '../useApkgImport';
import type { ImportPreview, ImportResult } from '../types';
import type { FolioDatabase } from '@/db/client';

describe('useApkgImport', () => {
  const mockPreview: ImportPreview = {
    decks: [{ sourceId: 'd1', name: 'Cardio', notesCount: 5, cardsCount: 5 }],
    totalNotes: 5,
    totalCards: 5,
    totalMedia: 1,
    modelsCount: 1,
  };

  const mockResult: ImportResult = {
    importedDecks: 1,
    importedNotes: 5,
    importedCards: 5,
    importedMedia: 1,
    importedRevlogs: 0,
    deckIds: ['d1'],
  };

  function renderImportHook(
    options?: UseApkgImportOptions,
    callback?: (res: ReturnType<typeof useApkgImport>) => void
  ) {
    let hookResult!: ReturnType<typeof useApkgImport>;

    function HookConsumer() {
      const res = useApkgImport(options);
      hookResult = res;
      useEffect(() => {
        callback?.(res);
      }, [res]);
      return null;
    }

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<HookConsumer />);
    });

    return {
      getHookResult: () => hookResult,
      renderer,
    };
  }

  it('deve inicializar com estado limpo', () => {
    const { getHookResult } = renderImportHook();
    const res = getHookResult();

    expect(res.selectedFile).toBeNull();
    expect(res.preview).toBeNull();
    expect(res.isLoadingPreview).toBe(false);
    expect(res.isImporting).toBe(false);
    expect(res.progress).toBeNull();
    expect(res.error).toBeNull();
    expect(res.result).toBeNull();
  });

  it('deve selecionar arquivo e carregar prévia com sucesso', async () => {
    const mockPick = jest.fn().mockResolvedValue({
      uri: 'file:///cardio.apkg',
      name: 'cardio.apkg',
      size: 1024,
    });
    const mockReadBase64 = jest.fn().mockResolvedValue('base64string');
    const mockPreviewResolver = jest.fn().mockResolvedValue(mockPreview);

    const { getHookResult } = renderImportHook({
      pickDocument: mockPick,
      readFileAsBase64: mockReadBase64,
      previewResolver: mockPreviewResolver,
    });

    await act(async () => {
      await getHookResult().pickFile();
    });

    expect(mockPick).toHaveBeenCalled();
    expect(mockReadBase64).toHaveBeenCalledWith('file:///cardio.apkg');
    expect(mockPreviewResolver).toHaveBeenCalledWith('base64string');

    const updated = getHookResult();
    expect(updated.selectedFile?.name).toBe('cardio.apkg');
    expect(updated.preview).toEqual(mockPreview);
    expect(updated.error).toBeNull();
  });

  it('deve registrar erro se preview falhar', async () => {
    const mockPick = jest.fn().mockResolvedValue({
      uri: 'file:///invalid.apkg',
      name: 'invalid.apkg',
    });
    const mockReadBase64 = jest.fn().mockResolvedValue('base64');
    const mockPreviewResolver = jest
      .fn()
      .mockRejectedValue(new Error('Exporte de novo no Anki marcando *Suporte a versões antigas*'));

    const { getHookResult } = renderImportHook({
      pickDocument: mockPick,
      readFileAsBase64: mockReadBase64,
      previewResolver: mockPreviewResolver,
    });

    await act(async () => {
      await getHookResult().pickFile();
    });

    const updated = getHookResult();
    expect(updated.error).toBe('Exporte de novo no Anki marcando *Suporte a versões antigas*');
    expect(updated.preview).toBeNull();
  });

  it('deve executar importação e atualizar progresso e resultado', async () => {
    const mockPick = jest.fn().mockResolvedValue({
      uri: 'file:///cardio.apkg',
      name: 'cardio.apkg',
    });
    const mockReadBase64 = jest.fn().mockResolvedValue('base64');
    const mockPreviewResolver = jest.fn().mockResolvedValue(mockPreview);
    const mockImportExecutor = jest.fn().mockImplementation(async (_data, _db, opts) => {
      opts?.onProgress?.({
        stage: 'importing_notes',
        current: 5,
        total: 5,
        message: 'Importando notas...',
      });
      return mockResult;
    });

    const onSuccess = jest.fn();

    const { getHookResult } = renderImportHook({
      db: {} as unknown as FolioDatabase,
      pickDocument: mockPick,
      readFileAsBase64: mockReadBase64,
      previewResolver: mockPreviewResolver,
      importExecutor: mockImportExecutor,
      onSuccess,
    });

    await act(async () => {
      await getHookResult().pickFile();
    });

    await act(async () => {
      await getHookResult().startImport();
    });

    expect(mockImportExecutor).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(mockResult);

    const updated = getHookResult();
    expect(updated.result).toEqual(mockResult);
    expect(updated.isImporting).toBe(false);
  });

  it('deve permitir alterar scheduleMode e passá-lo ao importExecutor', async () => {
    const mockPick = jest.fn().mockResolvedValue({
      uri: 'file:///cardio.apkg',
      name: 'cardio.apkg',
    });
    const mockReadBase64 = jest.fn().mockResolvedValue('base64');
    const mockPreviewResolver = jest.fn().mockResolvedValue(mockPreview);
    const mockImportExecutor = jest.fn().mockResolvedValue(mockResult);

    const { getHookResult } = renderImportHook({
      db: {} as unknown as FolioDatabase,
      pickDocument: mockPick,
      readFileAsBase64: mockReadBase64,
      previewResolver: mockPreviewResolver,
      importExecutor: mockImportExecutor,
    });

    await act(async () => {
      await getHookResult().pickFile();
    });

    expect(getHookResult().scheduleMode).toBe('keep_intervals');

    act(() => {
      getHookResult().setScheduleMode('reset_new');
    });

    expect(getHookResult().scheduleMode).toBe('reset_new');

    await act(async () => {
      await getHookResult().startImport();
    });

    expect(mockImportExecutor).toHaveBeenCalledWith(
      'base64',
      expect.anything(),
      expect.objectContaining({ scheduleMode: 'reset_new' })
    );
  });

  it('deve selecionar arquivo CSV e gerar prévia com formato csv', async () => {
    const csvContent = 'Frente 1;Verso 1;tag1\nFrente 2;Verso 2;tag2';
    const mockPick = jest.fn().mockResolvedValue({
      uri: 'file:///biologia.csv',
      name: 'biologia.csv',
      size: 512,
    });
    const mockReadString = jest.fn().mockResolvedValue(csvContent);

    const { getHookResult } = renderImportHook({
      pickDocument: mockPick,
      readFileAsString: mockReadString,
    });

    await act(async () => {
      await getHookResult().pickFile();
    });

    const res = getHookResult();
    expect(res.selectedFile?.name).toBe('biologia.csv');
    expect(res.preview?.fileFormat).toBe('csv');
    expect(res.preview?.totalNotes).toBe(2);
    expect(res.preview?.totalCards).toBe(2);
    expect(res.preview?.decks[0].name).toBe('biologia');
  });

  it('deve importar arquivo CSV chamando importExecutor com nome do arquivo', async () => {
    const csvContent = 'Qual o fármaco A?;Mecanismo A;farmaco';
    const mockPick = jest.fn().mockResolvedValue({
      uri: 'file:///farmaco.csv',
      name: 'farmaco.csv',
    });
    const mockReadString = jest.fn().mockResolvedValue(csvContent);
    const mockImportExecutor = jest.fn().mockResolvedValue(mockResult);

    const { getHookResult } = renderImportHook({
      db: {} as unknown as FolioDatabase,
      pickDocument: mockPick,
      readFileAsString: mockReadString,
      importExecutor: mockImportExecutor,
    });

    await act(async () => {
      await getHookResult().pickFile();
    });

    const afterPick = getHookResult();
    expect(afterPick.error).toBeNull();
    expect(afterPick.selectedFile).not.toBeNull();
    expect(afterPick.preview).not.toBeNull();

    await act(async () => {
      await getHookResult().startImport();
    });

    expect(mockImportExecutor).toHaveBeenCalledWith(
      csvContent,
      expect.anything(),
      expect.objectContaining({ fileName: 'farmaco.csv' })
    );
  });
});
