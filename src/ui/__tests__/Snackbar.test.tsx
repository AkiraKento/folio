import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { Snackbar } from '../Snackbar';
import { strings } from '../strings';

describe('<Snackbar />', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('não renderiza quando visible é false', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <Snackbar visible={false} message="Teste" />
      );
    });

    expect(renderer.toJSON()).toBeNull();
  });

  it('renderiza mensagem e botão de ação quando visible é true', () => {
    const onAction = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <Snackbar
          visible={true}
          message="Item apagado"
          actionText={strings.common.undo}
          onAction={onAction}
        />
      );
    });

    const textNodes = renderer.root.findAllByType(Text);
    const textContents = textNodes.map((n) => n.props.children);
    expect(textContents).toContain('Item apagado');
    expect(textContents).toContain(strings.common.undo);

    const button = renderer.root.findByType(TouchableOpacity);
    act(() => {
      button.props.onPress();
    });
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('aciona onDismiss automaticamente após o tempo limite', () => {
    const onDismiss = jest.fn();
    act(() => {
      ReactTestRenderer.create(
        <Snackbar
          visible={true}
          message="Auto dismiss"
          durationMs={3000}
          onDismiss={onDismiss}
        />
      );
    });

    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
