import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TextInput, Switch } from 'react-native';
import { ConsultaSearchBar } from '../ConsultaSearchBar';

describe('Componente <ConsultaSearchBar /> (MODO_CONSULTA.md §3)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('não renderiza nada quando visible é falso', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ConsultaSearchBar
          visible={false}
          query=""
          onlyWithNotes={false}
          matchingCount={0}
          onQueryChange={jest.fn()}
          onToggleOnlyWithNotes={jest.fn()}
          onReviewFiltered={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    expect(renderer.toJSON()).toBeNull();
  });

  test('renderiza campo de busca, switch e botão revisar estes', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ConsultaSearchBar
          visible={true}
          query=""
          onlyWithNotes={false}
          matchingCount={5}
          onQueryChange={jest.fn()}
          onToggleOnlyWithNotes={jest.fn()}
          onReviewFiltered={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    const input = renderer.root.findByType(TextInput);
    expect(input).toBeDefined();

    const switchEl = renderer.root.findByType(Switch);
    expect(switchEl.props.value).toBe(false);

    const reviewBtn = renderer.root.findByProps({
      testID: 'consulta-search-bar-review',
    });
    expect(reviewBtn).toBeDefined();
  });

  test('aguarda 250 ms de debounce antes de chamar onQueryChange', () => {
    const onQueryChange = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ConsultaSearchBar
          visible={true}
          query=""
          onlyWithNotes={false}
          matchingCount={5}
          onQueryChange={onQueryChange}
          onToggleOnlyWithNotes={jest.fn()}
          onReviewFiltered={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    const input = renderer.root.findByType(TextInput);

    // Digita primeiro caractere
    act(() => {
      input.props.onChangeText('c');
    });
    expect(onQueryChange).not.toHaveBeenCalled();

    // Avança 150 ms (menos que 250 ms)
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(onQueryChange).not.toHaveBeenCalled();

    // Digita mais caracteres
    act(() => {
      input.props.onChangeText('cardio');
    });

    // Avança 100 ms (total desde o segundo caractere ainda é 100 ms)
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(onQueryChange).not.toHaveBeenCalled();

    // Avança mais 150 ms (completando 250 ms desde a última digitação)
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenCalledWith('cardio');
  });

  test('botão limpar apaga o texto imediatamente e chama onQueryChange com vazio', () => {
    const onQueryChange = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ConsultaSearchBar
          visible={true}
          query="insuficiência"
          onlyWithNotes={false}
          matchingCount={3}
          onQueryChange={onQueryChange}
          onToggleOnlyWithNotes={jest.fn()}
          onReviewFiltered={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    const clearBtn = renderer.root.findByProps({
      testID: 'consulta-search-bar-clear',
    });

    act(() => {
      clearBtn.props.onPress();
    });

    expect(onQueryChange).toHaveBeenCalledWith('');
  });

  test('alterna o switch de "Apenas com anotações"', () => {
    const onToggleOnlyWithNotes = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ConsultaSearchBar
          visible={true}
          query=""
          onlyWithNotes={false}
          matchingCount={2}
          onQueryChange={jest.fn()}
          onToggleOnlyWithNotes={onToggleOnlyWithNotes}
          onReviewFiltered={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    const switchEl = renderer.root.findByType(Switch);

    act(() => {
      switchEl.props.onValueChange(true);
    });

    expect(onToggleOnlyWithNotes).toHaveBeenCalledWith(true);
  });

  test('botão de fechar chama onClose', () => {
    const onClose = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ConsultaSearchBar
          visible={true}
          query=""
          onlyWithNotes={false}
          matchingCount={2}
          onQueryChange={jest.fn()}
          onToggleOnlyWithNotes={jest.fn()}
          onReviewFiltered={jest.fn()}
          onClose={onClose}
        />
      );
    });

    const closeBtn = renderer.root.findByProps({
      testID: 'consulta-search-bar-close',
    });

    act(() => {
      closeBtn.props.onPress();
    });

    expect(onClose).toHaveBeenCalled();
  });

  test('botão "Revisar estes" chama onReviewFiltered quando há resultados', () => {
    const onReviewFiltered = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ConsultaSearchBar
          visible={true}
          query="cardio"
          onlyWithNotes={false}
          matchingCount={3}
          onQueryChange={jest.fn()}
          onToggleOnlyWithNotes={jest.fn()}
          onReviewFiltered={onReviewFiltered}
          onClose={jest.fn()}
        />
      );
    });

    const reviewBtn = renderer.root.findByProps({
      testID: 'consulta-search-bar-review',
    });

    act(() => {
      reviewBtn.props.onPress();
    });

    expect(onReviewFiltered).toHaveBeenCalled();
  });
});
