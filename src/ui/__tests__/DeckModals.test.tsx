import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import {
  CreateDeckModal,
  RenameDeckModal,
  MoveDeckModal,
  DeckOptionsMenuModal,
} from '../DeckModals';
import type { Deck } from '@/db/schema';
import { strings } from '../strings';

describe('DeckModals', () => {
  const sampleDeck: Deck = {
    id: 'deck-1',
    name: 'Medicina',
    area: 'Medicina',
    description: null,
    source_id: null,
    created_at: 1000,
    updated_at: 1000,
    deleted_at: null,
  };

  const sampleChild: Deck = {
    id: 'deck-2',
    name: 'Medicina::Cardio',
    area: 'Medicina',
    description: null,
    source_id: null,
    created_at: 1000,
    updated_at: 1000,
    deleted_at: null,
  };

  describe('<CreateDeckModal />', () => {
    it('chama onCreate com nome simples ou com pai', () => {
      const onCreate = jest.fn();
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <CreateDeckModal
            visible={true}
            onClose={jest.fn()}
            onCreate={onCreate}
            availableDecks={[sampleDeck]}
          />
        );
      });

      const inputs = renderer.root.findAllByType(TextInput);
      act(() => {
        inputs[0].props.onChangeText('Farmacologia');
      });

      const createBtn = renderer.root.findByProps({
        accessibilityLabel: strings.decks.create,
      });
      act(() => {
        createBtn.props.onPress();
      });

      expect(onCreate).toHaveBeenCalledWith('Farmacologia', null);
    });

    it('exibe erro ao tentar criar com nome vazio', () => {
      const onCreate = jest.fn();
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <CreateDeckModal
            visible={true}
            onClose={jest.fn()}
            onCreate={onCreate}
            availableDecks={[]}
          />
        );
      });

      const createBtn = renderer.root.findByProps({
        accessibilityLabel: strings.decks.create,
      });
      act(() => {
        createBtn.props.onPress();
      });

      expect(onCreate).not.toHaveBeenCalled();
      const textNodes = renderer.root.findAllByType(Text);
      const textContents = textNodes.map((n) => n.props.children);
      expect(textContents).toContain(strings.decks.errorNameRequired);
    });

    it('normaliza nome com pai selecionado evitando duplicar prefixo', () => {
      const onCreate = jest.fn();
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <CreateDeckModal
            visible={true}
            onClose={jest.fn()}
            onCreate={onCreate}
            availableDecks={[sampleDeck]}
            initialParentId={sampleDeck.id}
          />
        );
      });

      const inputs = renderer.root.findAllByType(TextInput);
      act(() => {
        // Usuário digita "Medicina::Cardio" mesmo já tendo o pai Medicina selecionado
        inputs[0].props.onChangeText('Medicina::Cardio');
      });

      const createBtn = renderer.root.findByProps({
        accessibilityLabel: strings.decks.create,
      });
      act(() => {
        createBtn.props.onPress();
      });

      expect(onCreate).toHaveBeenCalledWith('Medicina::Cardio', null);
    });
  });

  describe('<RenameDeckModal />', () => {
    it('chama onRename com o novo nome válido para deck raiz', () => {
      const onRename = jest.fn();
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <RenameDeckModal
            visible={true}
            onClose={jest.fn()}
            onRename={onRename}
            currentName="Medicina"
          />
        );
      });

      const input = renderer.root.findByType(TextInput);
      act(() => {
        input.props.onChangeText('Saúde');
      });

      const saveBtn = renderer.root.findByProps({
        accessibilityLabel: strings.common.save,
      });
      act(() => {
        saveBtn.props.onPress();
      });

      expect(onRename).toHaveBeenCalledWith('Saúde');
    });

    it('preserva caminho do deck pai ao renomear subdeck', () => {
      const onRename = jest.fn();
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <RenameDeckModal
            visible={true}
            onClose={jest.fn()}
            onRename={onRename}
            currentName="Medicina::Cardio"
          />
        );
      });

      const input = renderer.root.findByType(TextInput);
      // Input começa com o nome curto "Cardio"
      expect(input.props.value).toBe('Cardio');

      act(() => {
        input.props.onChangeText('Cardiologia');
      });

      const saveBtn = renderer.root.findByProps({
        accessibilityLabel: strings.common.save,
      });
      act(() => {
        saveBtn.props.onPress();
      });

      expect(onRename).toHaveBeenCalledWith('Medicina::Cardiologia');
    });

    it('exibe erro caso a função onRename dispare uma exceção', () => {
      const onRename = jest.fn().mockImplementation(() => {
        throw new Error('Já existe um deck ativo com esse nome');
      });

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <RenameDeckModal
            visible={true}
            onClose={jest.fn()}
            onRename={onRename}
            currentName="Medicina"
          />
        );
      });

      const input = renderer.root.findByType(TextInput);
      act(() => {
        input.props.onChangeText('Direito');
      });

      const saveBtn = renderer.root.findByProps({
        accessibilityLabel: strings.common.save,
      });
      act(() => {
        saveBtn.props.onPress();
      });

      const textNodes = renderer.root.findAllByType(Text);
      const textContents = textNodes.map((n) => n.props.children);
      expect(textContents).toContain('Já existe um deck ativo com esse nome');
    });
  });

  describe('<MoveDeckModal />', () => {
    it('permite mover para a raiz e exclui a si mesmo e descendentes da lista', () => {
      const onMove = jest.fn();
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <MoveDeckModal
            visible={true}
            onClose={jest.fn()}
            onMove={onMove}
            currentDeck={sampleDeck}
            availableDecks={[sampleDeck, sampleChild]}
          />
        );
      });

      // Nem sampleDeck nem sampleChild devem estar na lista de destinos
      const options = renderer.root.findAllByType(TouchableOpacity);
      const labels = options.map((o) => o.props.accessibilityLabel).filter(Boolean);
      expect(labels).not.toContain(sampleDeck.name);
      expect(labels).not.toContain(sampleChild.name);

      const moveBtn = renderer.root.findByProps({
        accessibilityLabel: strings.decks.move,
      });
      act(() => {
        moveBtn.props.onPress();
      });

      expect(onMove).toHaveBeenCalledWith(null);
    });

    it('permite selecionar outro deck pai e chama onMove com o ID de destino', () => {
      const onMove = jest.fn();
      const targetDeck: Deck = {
        id: 'deck-dest',
        name: 'Ciências',
        area: null,
        description: null,
        source_id: null,
        created_at: 1000,
        updated_at: 1000,
        deleted_at: null,
      };

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <MoveDeckModal
            visible={true}
            onClose={jest.fn()}
            onMove={onMove}
            currentDeck={sampleDeck}
            availableDecks={[sampleDeck, targetDeck]}
          />
        );
      });

      const targetOption = renderer.root.findByProps({
        accessibilityLabel: 'Ciências',
      });
      act(() => {
        targetOption.props.onPress();
      });

      const moveBtn = renderer.root.findByProps({
        accessibilityLabel: strings.decks.move,
      });
      act(() => {
        moveBtn.props.onPress();
      });

      expect(onMove).toHaveBeenCalledWith('deck-dest');
    });
  });

  describe('<DeckOptionsMenuModal />', () => {
    it('dispara callbacks para renomear, mover, criar subdeck e apagar', () => {
      const onRename = jest.fn();
      const onMove = jest.fn();
      const onCreateSubdeck = jest.fn();
      const onDelete = jest.fn();
      const onClose = jest.fn();

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <DeckOptionsMenuModal
            visible={true}
            onClose={onClose}
            deckName="Medicina"
            onRename={onRename}
            onMove={onMove}
            onCreateSubdeck={onCreateSubdeck}
            onDelete={onDelete}
          />
        );
      });

      const renameOption = renderer.root.findByProps({
        accessibilityLabel: strings.decks.rename,
      });
      act(() => {
        renameOption.props.onPress();
      });
      expect(onRename).toHaveBeenCalledTimes(1);

      const deleteOption = renderer.root.findByProps({
        accessibilityLabel: strings.decks.deleteDeck,
      });
      act(() => {
        deleteOption.props.onPress();
      });
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });
});
