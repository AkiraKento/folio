import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { DeckCountsBadge } from '../DeckCountsBadge';
import { DeckTreeItem } from '../DeckTreeItem';
import { DeckActionButtons } from '../DeckActionButtons';
import { DecksScreen } from '../DecksScreen';
import { DeckDetailView } from '../DeckDetailView';
import type { DeckTreeNodeWithCounts } from '@/db/repositories/decks';
import type { Deck } from '@/db/schema';
import { strings } from '../strings';

describe('Componentes da Tela de Decks e Detalhe do Deck', () => {
  const sampleCounts = {
    new: 10,
    learning: 5,
    review: 15,
    total: 30,
  };

  const sampleDeck: Deck = {
    id: 'deck-1',
    name: 'Medicina::Cardiologia',
    area: 'Medicina',
    description: 'Flashcards de cardiologia para residência',
    source_id: null,
    created_at: 1000,
    updated_at: 1000,
    deleted_at: null,
  };

  const sampleChildDeck: Deck = {
    id: 'deck-child',
    name: 'Medicina::Cardiologia::Arritmias',
    area: 'Medicina',
    description: null,
    source_id: null,
    created_at: 1000,
    updated_at: 1000,
    deleted_at: null,
  };

  const sampleNode: DeckTreeNodeWithCounts = {
    id: sampleDeck.id,
    name: sampleDeck.name,
    shortName: 'Cardiologia',
    deck: sampleDeck,
    directCounts: { new: 5, learning: 2, review: 8, total: 15 },
    totalCounts: sampleCounts,
    children: [
      {
        id: sampleChildDeck.id,
        name: sampleChildDeck.name,
        shortName: 'Arritmias',
        deck: sampleChildDeck,
        directCounts: { new: 5, learning: 3, review: 7, total: 15 },
        totalCounts: { new: 5, learning: 3, review: 7, total: 15 },
        children: [],
      },
    ],
  };

  describe('<DeckCountsBadge />', () => {
    it('renderiza contadores compactos corretamente', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(<DeckCountsBadge counts={sampleCounts} />);
      });

      const textNodes = renderer.root.findAllByType(Text);
      const textContents = textNodes.map((n) => n.props.children);
      expect(textContents).toContain(10);
      expect(textContents).toContain(5);
      expect(textContents).toContain(15);
    });

    it('renderiza modo expandido com rótulos', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(<DeckCountsBadge counts={sampleCounts} showLabels />);
      });

      const textNodes = renderer.root.findAllByType(Text);
      const textContents = textNodes.map((n) => n.props.children);
      expect(textContents).toContain('Novos');
      expect(textContents).toContain('Aprendendo');
      expect(textContents).toContain('A revisar');
    });
  });

  describe('<DeckTreeItem />', () => {
    it('renderiza nome curto do nó e aciona onSelectDeck ao tocar', () => {
      const onSelectMock = jest.fn();
      const onToggleMock = jest.fn();

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DeckTreeItem
            node={sampleNode}
            depth={0}
            isExpanded={false}
            onToggleExpand={onToggleMock}
            onSelectDeck={onSelectMock}
          />
        );
      });

      const deckContentBtn = renderer.root.findByProps({
        accessibilityLabel: strings.decks.deckWithCountsLabel(
          sampleNode.name,
          sampleCounts.new,
          sampleCounts.learning,
          sampleCounts.review
        ),
      });
      act(() => {
        deckContentBtn.props.onPress();
      });
      expect(onSelectMock).toHaveBeenCalledWith('deck-1');
    });

    it('aciona onToggleExpand ao tocar no chevron do nó com filhos', () => {
      const onSelectMock = jest.fn();
      const onToggleMock = jest.fn();

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DeckTreeItem
            node={sampleNode}
            depth={0}
            isExpanded={false}
            onToggleExpand={onToggleMock}
            onSelectDeck={onSelectMock}
          />
        );
      });

      const expandBtn = renderer.root.findByProps({
        accessibilityLabel: 'Expandir subdecks',
      });
      act(() => {
        expandBtn.props.onPress();
      });
      expect(onToggleMock).toHaveBeenCalledWith('deck-1');
    });
  });

  describe('<DeckActionButtons />', () => {
    it('renderiza as três ações de mesmo tamanho e dispara callbacks', () => {
      const onStudy = jest.fn();
      const onConsult = jest.fn();
      const onAddCard = jest.fn();

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DeckActionButtons
            onStudy={onStudy}
            onConsult={onConsult}
            onAddCard={onAddCard}
          />
        );
      });

      const studyBtn = renderer.root.findByProps({
        accessibilityLabel: strings.deckDetail.studyAction,
      });
      const consultBtn = renderer.root.findByProps({
        accessibilityLabel: strings.deckDetail.consultAction,
      });
      const addBtn = renderer.root.findByProps({
        accessibilityLabel: strings.deckDetail.addCardAction,
      });

      expect(studyBtn).toBeDefined();
      expect(consultBtn).toBeDefined();
      expect(addBtn).toBeDefined();

      act(() => {
        studyBtn.props.onPress();
      });
      expect(onStudy).toHaveBeenCalledTimes(1);

      act(() => {
        consultBtn.props.onPress();
      });
      expect(onConsult).toHaveBeenCalledTimes(1);

      act(() => {
        addBtn.props.onPress();
      });
      expect(onAddCard).toHaveBeenCalledTimes(1);
    });
  });

  describe('<DecksScreen />', () => {
    it('renderiza a árvore de decks e permite selecionar um deck', () => {
      const onSelectDeck = jest.fn();
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DecksScreen
            tree={[sampleNode]}
            onSelectDeck={onSelectDeck}
          />
        );
      });

      const titleNode = renderer.root.findAllByType(Text).find(
        (n) => n.props.children === strings.decks.title
      );
      expect(titleNode).toBeDefined();

      const deckButton = renderer.root.findByProps({
        accessibilityLabel: strings.decks.deckWithCountsLabel(
          sampleNode.name,
          sampleNode.directCounts.new,
          sampleNode.directCounts.learning,
          sampleNode.directCounts.review
        ),
      });
      act(() => {
        deckButton.props.onPress();
      });
      expect(onSelectDeck).toHaveBeenCalledWith('deck-1');
    });

    it('exibe estado vazio quando não há decks', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DecksScreen
            tree={[]}
            onSelectDeck={jest.fn()}
          />
        );
      });

      const emptyTitle = renderer.root.findAllByType(Text).find(
        (n) => n.props.children === strings.decks.emptyTitle
      );
      expect(emptyTitle).toBeDefined();
    });
  });

  describe('<DeckDetailView />', () => {
    it('renderiza detalhes do deck, contadores e subdecks', () => {
      const onBack = jest.fn();
      const onSelectSubdeck = jest.fn();

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DeckDetailView
            deck={sampleDeck}
            counts={sampleCounts}
            subdecks={[sampleChildDeck]}
            onBack={onBack}
            onSelectSubdeck={onSelectSubdeck}
          />
        );
      });

      const backBtn = renderer.root.findByProps({
        accessibilityLabel: strings.deckDetail.backButton,
      });
      act(() => {
        backBtn.props.onPress();
      });
      expect(onBack).toHaveBeenCalledTimes(1);

      const subdeckBtn = renderer.root.findByProps({
        accessibilityLabel: `Subdeck ${sampleChildDeck.name}`,
      });
      act(() => {
        subdeckBtn.props.onPress();
      });
      expect(onSelectSubdeck).toHaveBeenCalledWith('deck-child');
    });

    it('permite abrir menu de opções e disparar ações no DeckDetailView', () => {
      const onDeleteDeck = jest.fn();
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DeckDetailView
            deck={sampleDeck}
            counts={sampleCounts}
            subdecks={[]}
            onBack={jest.fn()}
            onDeleteDeck={onDeleteDeck}
          />
        );
      });

      const optionsBtn = renderer.root.findByProps({
        accessibilityLabel: strings.decks.moreOptions,
      });
      expect(optionsBtn).toBeDefined();

      act(() => {
        optionsBtn.props.onPress();
      });

      const deleteOption = renderer.root.findByProps({
        accessibilityLabel: strings.decks.deleteDeck,
      });
      act(() => {
        deleteOption.props.onPress();
      });
      expect(onDeleteDeck).toHaveBeenCalledTimes(1);
    });
  });

  describe('Operações de Deck em <DecksScreen />', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      act(() => {
        jest.runOnlyPendingTimers();
      });
      jest.useRealTimers();
    });

    it('aciona exclusão e restauração com Desfazer no Snackbar', () => {
      const onDeleteDeck = jest.fn();
      const onRestoreDeck = jest.fn();

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DecksScreen
            tree={[sampleNode]}
            onSelectDeck={jest.fn()}
            onDeleteDeck={onDeleteDeck}
            onRestoreDeck={onRestoreDeck}
          />
        );
      });

      // Toca nas opções do nó da árvore
      const itemOptionsBtn = renderer.root.findByProps({
        accessibilityLabel: `${strings.decks.moreOptions}: ${sampleNode.name}`,
      });
      act(() => {
        itemOptionsBtn.props.onPress();
      });

      // Clica em Apagar deck no menu
      const deleteOption = renderer.root.findByProps({
        accessibilityLabel: strings.decks.deleteDeck,
      });
      act(() => {
        deleteOption.props.onPress();
      });

      expect(onDeleteDeck).toHaveBeenCalledWith('deck-1');

      // Verifica que o Snackbar apareceu com o botão Desfazer
      const undoBtn = renderer.root.findByProps({
        accessibilityLabel: strings.common.undo,
      });
      expect(undoBtn).toBeDefined();

      // Clica em Desfazer
      act(() => {
        undoBtn.props.onPress();
      });
      expect(onRestoreDeck).toHaveBeenCalledWith('deck-1');

      act(() => {
        renderer.unmount();
      });
    });

    it('abre modal de criação ao tocar no botão "+ Novo deck"', () => {
      const onCreateDeck = jest.fn();

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DecksScreen
            tree={[sampleNode]}
            onSelectDeck={jest.fn()}
            onCreateDeck={onCreateDeck}
          />
        );
      });

      const newDeckBtn = renderer.root.findByProps({
        accessibilityLabel: strings.decks.newDeck,
      });
      act(() => {
        newDeckBtn.props.onPress();
      });

      // Modal de criação aberto
      const createModalTitle = renderer.root.findAllByType(Text).find(
        (n) => n.props.children === strings.decks.createDeckModalTitle
      );
      expect(createModalTitle).toBeDefined();
    });

    it('abre modal de renomear a partir do menu do deck e aciona onRenameDeck', () => {
      const onRenameDeck = jest.fn();

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DecksScreen
            tree={[sampleNode]}
            onSelectDeck={jest.fn()}
            onRenameDeck={onRenameDeck}
          />
        );
      });

      // Abre menu de opções do nó
      const itemOptionsBtn = renderer.root.findByProps({
        accessibilityLabel: `${strings.decks.moreOptions}: ${sampleNode.name}`,
      });
      act(() => {
        itemOptionsBtn.props.onPress();
      });

      // Toca em Renomear
      const renameOption = renderer.root.findByProps({
        accessibilityLabel: strings.decks.rename,
      });
      act(() => {
        renameOption.props.onPress();
      });

      // Salva renomeação no modal
      const saveBtn = renderer.root.findByProps({
        accessibilityLabel: strings.common.save,
      });
      act(() => {
        saveBtn.props.onPress();
      });

      expect(onRenameDeck).toHaveBeenCalledWith('deck-1', 'Medicina::Cardiologia');
    });

    it('abre modal de mover a partir do menu do deck e aciona onMoveDeck', () => {
      const onMoveDeck = jest.fn();

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DecksScreen
            tree={[sampleNode]}
            allDecks={[sampleDeck]}
            onSelectDeck={jest.fn()}
            onMoveDeck={onMoveDeck}
          />
        );
      });

      // Abre menu de opções do nó
      const itemOptionsBtn = renderer.root.findByProps({
        accessibilityLabel: `${strings.decks.moreOptions}: ${sampleNode.name}`,
      });
      act(() => {
        itemOptionsBtn.props.onPress();
      });

      // Toca em Mover
      const moveOption = renderer.root.findByProps({
        accessibilityLabel: strings.decks.move,
      });
      act(() => {
        moveOption.props.onPress();
      });

      // Confirma mover para a raiz
      const moveBtn = renderer.root.findByProps({
        accessibilityLabel: strings.decks.move,
      });
      act(() => {
        moveBtn.props.onPress();
      });

      expect(onMoveDeck).toHaveBeenCalledWith('deck-1', null);
    });

    it('abre modal de subdeck a partir do menu e aciona onCreateDeck com o prefixo', () => {
      const onCreateDeck = jest.fn();

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DecksScreen
            tree={[sampleNode]}
            allDecks={[sampleDeck]}
            onSelectDeck={jest.fn()}
            onCreateDeck={onCreateDeck}
          />
        );
      });

      // Abre menu de opções do nó
      const itemOptionsBtn = renderer.root.findByProps({
        accessibilityLabel: `${strings.decks.moreOptions}: ${sampleNode.name}`,
      });
      act(() => {
        itemOptionsBtn.props.onPress();
      });

      // Toca em Criar subdeck
      const subdeckOption = renderer.root.findByProps({
        accessibilityLabel: strings.decks.createSubdeck,
      });
      act(() => {
        subdeckOption.props.onPress();
      });

      // Modal de criação aberto com o pai selecionado
      const modalTitle = renderer.root.findAllByType(Text).find(
        (n) => n.props.children === strings.decks.createDeckModalTitle
      );
      expect(modalTitle).toBeDefined();
    });

    it('renderiza card Continuar lendo quando há progresso de leitura e aciona onContinueReading', () => {
      const onContinueReading = jest.fn();

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DecksScreen
            tree={[sampleNode]}
            allDecks={[sampleDeck]}
            continueReading={{
              deckId: 'deck-1',
              deckName: 'Cardiologia',
              unitIndex: 4,
            }}
            onSelectDeck={jest.fn()}
            onContinueReading={onContinueReading}
          />
        );
      });

      const continueBtn = renderer.root.findByProps({
        accessibilityLabel: `${strings.consulta.continueReading}: Cardiologia`,
      });
      expect(continueBtn).toBeDefined();

      act(() => {
        continueBtn.props.onPress();
      });

      expect(onContinueReading).toHaveBeenCalledWith('deck-1');
    });
  });
});
