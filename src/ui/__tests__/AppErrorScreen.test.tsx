import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TouchableOpacity, Share } from 'react-native';
import { AppErrorScreen } from '../AppErrorScreen';

describe('AppErrorScreen', () => {
  it('renderiza título, mensagem e botão de tentar novamente quando fornecido', () => {
    const onRetry = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <AppErrorScreen
          title="Erro no Banco"
          message="Falha crítica na migração"
          onRetry={onRetry}
        />
      );
    });

    const texts = renderer!.root.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toContain('Erro no Banco');
    expect(texts).toContain('Falha crítica na migração');

    const buttons = renderer!.root.findAllByType(TouchableOpacity);
    const retryButton = buttons.find((b) => b.props.accessibilityLabel === 'Tentar novamente');
    expect(retryButton).toBeDefined();

    act(() => {
      retryButton!.props.onPress();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('permite alternar exibição dos detalhes técnicos do erro', () => {
    const error = new Error('Falha de sintaxe SQL');
    let renderer: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(<AppErrorScreen error={error} />);
    });

    let texts = renderer!.root.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toContain('▶ Ver detalhes técnicos');
    expect(texts).not.toContain('Falha de sintaxe SQL');

    const toggleButton = renderer!.root
      .findAllByType(TouchableOpacity)
      .find((b) => b.props.children?.props?.children === '▶ Ver detalhes técnicos');

    act(() => {
      toggleButton!.props.onPress();
    });

    texts = renderer!.root.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toContain('▼ Ocultar detalhes técnicos');
    expect(texts).toContain('Falha de sintaxe SQL');
  });

  it('aciona compartilhamento de diagnóstico ao tocar no botão correspondente', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({
      action: Share.sharedAction,
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AppErrorScreen />);
    });

    const shareButton = renderer!.root
      .findAllByType(TouchableOpacity)
      .find((b) => b.props.accessibilityLabel === 'Copiar diagnóstico');

    expect(shareButton).toBeDefined();

    await act(async () => {
      await shareButton!.props.onPress();
    });

    expect(shareSpy).toHaveBeenCalled();
  });
});
