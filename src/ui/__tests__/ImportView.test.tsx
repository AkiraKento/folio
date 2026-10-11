import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { ImportView } from '../ImportView';
import type { ImportPreview, ImportProgress, ImportResult } from '@/import/types';

describe('ImportView', () => {
  const mockPreview: ImportPreview = {
    decks: [
      {
        sourceId: 'deck-1',
        name: 'Medicina::Cardiologia',
        notesCount: 15,
        cardsCount: 20,
      },
    ],
    totalNotes: 15,
    totalCards: 20,
    totalMedia: 3,
    modelsCount: 2,
  };

  function findText(root: ReactTestRenderer.ReactTestInstance, text: string): boolean {
    const textNodes = root.findAllByType(Text);
    return textNodes.some((node) => {
      const children = Array.isArray(node.props.children)
        ? node.props.children.join('')
        : String(node.props.children ?? '');
      return children.includes(text);
    });
  }

  function findButtonByLabel(
    root: ReactTestRenderer.ReactTestInstance,
    accessibilityLabel: string
  ): ReactTestRenderer.ReactTestInstance | undefined {
    return root.findAllByType(TouchableOpacity).find(
      (node) => node.props.accessibilityLabel === accessibilityLabel
    );
  }

  it('deve renderizar estado inicial de seleção de arquivo', () => {
    const handlePickFile = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ImportView
          selectedFile={null}
          preview={null}
          isLoadingPreview={false}
          isImporting={false}
          progress={null}
          error={null}
          result={null}
          onPickFile={handlePickFile}
          onStartImport={jest.fn()}
          onReset={jest.fn()}
        />
      );
    });

    expect(findText(renderer.root, 'Selecionar arquivo .apkg ou .csv')).toBe(true);

    const pickButton = findButtonByLabel(renderer.root, 'Selecionar arquivo .apkg ou .csv');
    expect(pickButton).toBeDefined();

    act(() => {
      pickButton?.props.onPress();
    });
    expect(handlePickFile).toHaveBeenCalledTimes(1);
  });

  it('deve renderizar estado de carregamento da prévia', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ImportView
          selectedFile={{ name: 'teste.apkg', size: 1024 }}
          preview={null}
          isLoadingPreview={true}
          isImporting={false}
          progress={null}
          error={null}
          result={null}
          onPickFile={jest.fn()}
          onStartImport={jest.fn()}
          onReset={jest.fn()}
        />
      );
    });

    expect(findText(renderer.root, 'Analisando arquivo...')).toBe(true);
  });

  it('deve exibir mensagem de erro se a leitura falhar', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ImportView
          selectedFile={null}
          preview={null}
          isLoadingPreview={false}
          isImporting={false}
          progress={null}
          error="Exporte de novo no Anki marcando *Suporte a versões antigas*"
          result={null}
          onPickFile={jest.fn()}
          onStartImport={jest.fn()}
          onReset={jest.fn()}
        />
      );
    });

    expect(findText(renderer.root, 'Falha na importação')).toBe(true);
    expect(
      findText(renderer.root, 'Exporte de novo no Anki marcando *Suporte a versões antigas*')
    ).toBe(true);
  });

  it('deve exibir resumo da prévia com decks, notas, cards e mídia', () => {
    const handleStartImport = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ImportView
          selectedFile={{ name: 'medicina.apkg', size: 2048 }}
          preview={mockPreview}
          isLoadingPreview={false}
          isImporting={false}
          progress={null}
          error={null}
          result={null}
          onPickFile={jest.fn()}
          onStartImport={handleStartImport}
          onReset={jest.fn()}
        />
      );
    });

    expect(findText(renderer.root, 'Resumo da importação')).toBe(true);
    expect(findText(renderer.root, 'Medicina::Cardiologia')).toBe(true);
    expect(findText(renderer.root, '15')).toBe(true);
    expect(findText(renderer.root, '20')).toBe(true);
    expect(findText(renderer.root, '3')).toBe(true);

    const startButton = findButtonByLabel(renderer.root, 'Iniciar importação');
    expect(startButton).toBeDefined();

    act(() => {
      startButton?.props.onPress();
    });
    expect(handleStartImport).toHaveBeenCalledTimes(1);
  });

  it('deve exibir barra de progresso durante importação', () => {
    const mockProgress: ImportProgress = {
      stage: 'importing_notes',
      current: 10,
      total: 20,
      message: 'Importando notas (10/20)...',
    };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ImportView
          selectedFile={{ name: 'medicina.apkg', size: 2048 }}
          preview={mockPreview}
          isLoadingPreview={false}
          isImporting={true}
          progress={mockProgress}
          error={null}
          result={null}
          onPickFile={jest.fn()}
          onStartImport={jest.fn()}
          onReset={jest.fn()}
        />
      );
    });

    expect(findText(renderer.root, 'Importando notas (10/20)...')).toBe(true);
  });

  it('deve exibir tela de sucesso após importação concluída', () => {
    const mockResult: ImportResult = {
      importedDecks: 1,
      importedNotes: 15,
      importedCards: 20,
      importedMedia: 3,
      importedRevlogs: 8,
      deckIds: ['deck-1'],
    };

    const handleViewDecks = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ImportView
          selectedFile={{ name: 'medicina.apkg', size: 2048 }}
          preview={mockPreview}
          isLoadingPreview={false}
          isImporting={false}
          progress={null}
          error={null}
          result={mockResult}
          onPickFile={jest.fn()}
          onStartImport={jest.fn()}
          onReset={jest.fn()}
          onViewDecks={handleViewDecks}
        />
      );
    });

    expect(findText(renderer.root, 'Importação concluída!')).toBe(true);
    expect(findText(renderer.root, '8 revisões no histórico')).toBe(true);

    const viewButton = findButtonByLabel(renderer.root, 'Ver Decks');
    expect(viewButton).toBeDefined();

    act(() => {
      viewButton?.props.onPress();
    });
    expect(handleViewDecks).toHaveBeenCalledTimes(1);
  });

  it('deve exibir badge FSRS e permitir alternar modo de agendamento', () => {
    const handleSelectScheduleMode = jest.fn();
    const previewWithFsrs: ImportPreview = {
      ...mockPreview,
      hasFsrsData: true,
      hasExistingIntervals: true,
      totalRevlogs: 12,
    };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ImportView
          selectedFile={{ name: 'medicina.apkg', size: 2048 }}
          preview={previewWithFsrs}
          scheduleMode="keep_intervals"
          onSelectScheduleMode={handleSelectScheduleMode}
          isLoadingPreview={false}
          isImporting={false}
          progress={null}
          error={null}
          result={null}
          onPickFile={jest.fn()}
          onStartImport={jest.fn()}
          onReset={jest.fn()}
        />
      );
    });

    expect(findText(renderer.root, 'Estado FSRS detectado nos cards')).toBe(true);
    expect(findText(renderer.root, '12')).toBe(true);
    expect(findText(renderer.root, 'histórico')).toBe(true);

    // Deve renderizar opções de agendamento
    const resetOption = findButtonByLabel(renderer.root, 'Começar como novos');
    expect(resetOption).toBeDefined();

    act(() => {
      resetOption?.props.onPress();
    });
    expect(handleSelectScheduleMode).toHaveBeenCalledWith('reset_new');
  });

  it('deve exibir resumo detalhado de reimportação com contagem de novos e atualizados', () => {
    const reimportResult: ImportResult = {
      importedDecks: 1,
      importedNotes: 10,
      importedCards: 15,
      importedMedia: 0,
      importedRevlogs: 5,
      deckIds: ['deck-1'],
      createdNotes: 3,
      updatedNotes: 7,
      createdCards: 5,
      updatedCards: 10,
    };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ImportView
          selectedFile={{ name: 'medicina.apkg', size: 2048 }}
          preview={mockPreview}
          isLoadingPreview={false}
          isImporting={false}
          progress={null}
          error={null}
          result={reimportResult}
          onPickFile={jest.fn()}
          onStartImport={jest.fn()}
          onReset={jest.fn()}
        />
      );
    });

    expect(findText(renderer.root, '3 notas novas, 7 atualizadas · 5 cards novos, 10 atualizados')).toBe(true);
  });

  it('deve exibir badge de CSV quando o arquivo for do formato CSV', () => {
    const csvPreview: ImportPreview = {
      decks: [{ sourceId: 'csv-default', name: 'Nefrologia', notesCount: 12, cardsCount: 12 }],
      totalNotes: 12,
      totalCards: 12,
      totalMedia: 0,
      modelsCount: 1,
      fileFormat: 'csv',
    };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ImportView
          selectedFile={{ name: 'nefro.csv', size: 1024 }}
          preview={csvPreview}
          isLoadingPreview={false}
          isImporting={false}
          progress={null}
          error={null}
          result={null}
          onPickFile={jest.fn()}
          onStartImport={jest.fn()}
          onReset={jest.fn()}
        />
      );
    });

    expect(findText(renderer.root, 'Arquivo CSV detectado (frente;verso;tags)')).toBe(true);
    expect(findText(renderer.root, 'Nefrologia')).toBe(true);
    expect(findText(renderer.root, '12')).toBe(true);
    // Não deve exibir caixa de mídia quando for CSV com 0 mídias
    expect(findText(renderer.root, 'arquivo de mídia')).toBe(false);
  });
});
