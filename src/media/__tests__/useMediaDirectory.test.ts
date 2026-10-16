import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { useMediaDirectory } from '../useMediaDirectory';
import * as mediaService from '../mediaService';

function TestHookConsumer() {
  const dir = useMediaDirectory();
  return React.createElement(Text, { testID: 'dir' }, dir);
}

describe('useMediaDirectory', () => {
  it('retorna caminho síncrono padrão e mantém o diretório de mídia', async () => {
    jest.spyOn(mediaService, 'getMediaDirectorySync').mockReturnValue('file:///mock/media/');
    jest.spyOn(mediaService, 'getMediaDirectory').mockResolvedValue('file:///mock/media/');

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(React.createElement(TestHookConsumer));
    });

    const textNode = renderer!.root.findByProps({ testID: 'dir' });
    expect(textNode.props.children).toBe('file:///mock/media/');
  });
});
