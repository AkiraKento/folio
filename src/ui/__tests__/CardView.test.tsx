import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { CardView } from '../CardView';
import { cardHtml } from '@/webview/generated/card.html';
import { renderCardSide } from '@/render';
import { BUILTIN_NOTE_TYPES } from '@/db/builtin-note-types';
import { SAMPLE_DECK_DEFINITION } from '@/db/sample-deck';

// Mock simples para o WebView do react-native-webview
const mockPostMessage = jest.fn();

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockWebView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      postMessage: mockPostMessage,
    }));

    return React.createElement(View, {
      ...props,
      testID: props.testID || 'mock-webview',
    });
  });

  MockWebView.displayName = 'MockWebView';

  return {
    WebView: MockWebView,
  };
});
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

describe('Componente <CardView />', () => {
  beforeEach(() => {
    mockPostMessage.mockClear();
  });

  it('monta corretamente com cardHtml estático e dados iniciais injetados', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CardView
          html="<p>Qual o sintoma principal?</p>"
          side="front"
          cardOrd={0}
          tags={['cardiologia', 'semiologia']}
        />
      );
    });

    const webViewInstance = renderer!.root.findByProps({ testID: 'card-view-webview' });
    expect(webViewInstance).toBeDefined();
    expect(webViewInstance.props.source).toEqual({ html: cardHtml, baseUrl: 'media/' });
    expect(webViewInstance.props.allowFileAccess).toBe(true);
    expect(webViewInstance.props.originWhitelist).toEqual(['about:*', 'file://*']);

    const injectedScript: string = webViewInstance.props.injectedJavaScriptBeforeContentLoaded;
    expect(injectedScript).toContain('window.__INITIAL_CARD_DATA__');
    expect(injectedScript).toContain('Qual o sintoma principal?');
    expect(injectedScript).toContain('"side":"front"');
  });

  it('envia mensagem renderCard via postMessage ao alterar lado ou html após estar pronto', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CardView
          html="<p>Frente do card</p>"
          side="front"
        />
      );
    });

    const webViewInstance = renderer!.root.findByProps({ testID: 'card-view-webview' });

    // Simula sinal 'ready' da WebView para o React Native
    act(() => {
      webViewInstance.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({ type: 'ready' }),
        },
      });
    });

    expect(mockPostMessage).toHaveBeenCalled();

    mockPostMessage.mockClear();

    // Atualiza o componente virando para o verso
    act(() => {
      renderer.update(
        <CardView
          html="<p>Verso com resposta detalhada</p>"
          side="back"
        />
      );
    });

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    const sentData = JSON.parse(mockPostMessage.mock.calls[0][0]);
    expect(sentData.type).toBe('renderCard');
    expect(sentData.payload.side).toBe('back');
    expect(sentData.payload.html).toBe('<p>Verso com resposta detalhada</p>');
  });

  it('chama onRendered quando a WebView conclui a renderização do DOM', () => {
    const handleRendered = jest.fn();

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CardView
          html="<p>Conteúdo</p>"
          side="front"
          onRendered={handleRendered}
        />
      );
    });

    const webViewInstance = renderer!.root.findByProps({ testID: 'card-view-webview' });

    act(() => {
      webViewInstance.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'rendered',
            payload: { side: 'front', height: 240 },
          }),
        },
      });
    });

    expect(handleRendered).toHaveBeenCalledWith({ side: 'front', height: 240 });
  });

  it('chama onLinkPress e onError com eventos da WebView', () => {
    const handleLinkPress = jest.fn();
    const handleError = jest.fn();

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CardView
          html="<p><a href='https://diretriz.org'>Diretriz</a></p>"
          side="front"
          onLinkPress={handleLinkPress}
          onError={handleError}
        />
      );
    });

    const webViewInstance = renderer!.root.findByProps({ testID: 'card-view-webview' });

    act(() => {
      webViewInstance.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'linkClick',
            payload: { url: 'https://diretriz.org' },
          }),
        },
      });
    });

    expect(handleLinkPress).toHaveBeenCalledWith('https://diretriz.org');

    act(() => {
      webViewInstance.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'error',
            payload: { message: 'Erro de formatação' },
          }),
        },
      });
    });

    expect(handleError).toHaveBeenCalledWith('Erro de formatação');
  });

  it('renderiza perfeitamente com todas as notas do deck de exemplo autoral (Básico e Cloze)', () => {
    const notes = SAMPLE_DECK_DEFINITION.notes;
    expect(notes.length).toBe(20);

    for (const note of notes) {
      const isCloze = note.note_type_id === BUILTIN_NOTE_TYPES.CLOZE.id;
      const noteType = isCloze ? BUILTIN_NOTE_TYPES.CLOZE : BUILTIN_NOTE_TYPES.BASIC;

      const frontHtml = renderCardSide({
        noteType,
        fields: note.fields,
        side: 'front',
        cardOrd: 0,
        tags: note.tags,
        deckName: SAMPLE_DECK_DEFINITION.deck.name,
      });

      const backHtml = renderCardSide({
        noteType,
        fields: note.fields,
        side: 'back',
        cardOrd: 0,
        tags: note.tags,
        deckName: SAMPLE_DECK_DEFINITION.deck.name,
      });

      expect(frontHtml.length).toBeGreaterThan(0);
      expect(backHtml.length).toBeGreaterThan(0);

      // Testa montagem com a frente
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <CardView
            html={frontHtml}
            side="front"
            css={noteType.css}
            cardOrd={0}
            tags={note.tags}
          />
        );
      });

      const webViewFront = renderer!.root.findByProps({ testID: 'card-view-webview' });
      expect(webViewFront.props.injectedJavaScriptBeforeContentLoaded).toContain(
        JSON.stringify(frontHtml).slice(1, -1)
      );

      // Testa atualização para o verso
      act(() => {
        webViewFront.props.onMessage({
          nativeEvent: { data: JSON.stringify({ type: 'ready' }) },
        });
      });

      act(() => {
        renderer.update(
          <CardView
            html={backHtml}
            side="back"
            css={noteType.css}
            cardOrd={0}
            tags={note.tags}
          />
        );
      });

      expect(mockPostMessage).toHaveBeenCalled();
      const lastCallArg = JSON.parse(mockPostMessage.mock.calls.at(-1)[0]);
      expect(lastCallArg.payload.side).toBe('back');
      expect(lastCallArg.payload.html).toBe(backHtml);

      mockPostMessage.mockClear();
    }
  });
});
