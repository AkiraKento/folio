import React, { act } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ConsultaView, type ConsultaViewHandle } from '../ConsultaView';
import { consultaHtml } from '@/webview/generated/consulta.html';
import type { ConsultaUnit } from '@/consulta/units';

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

describe('Componente <ConsultaView />', () => {
  beforeEach(() => {
    mockPostMessage.mockClear();
  });

  const sampleUnits: ConsultaUnit[] = [
    {
      index: 0,
      noteId: 'note-1',
      deckPath: 'Medicina::Cardiologia',
      frontHtml: '<p>Qual o primeiro pilar da IC?</p>',
      backHtml: '<p>IECA/BRA ou <span class="cloze">INRA</span>.</p>',
      tags: ['cardio'],
      suspended: false,
      annotations: [],
    },
    {
      index: 1,
      noteId: 'note-2',
      deckPath: 'Medicina::Cardiologia',
      frontHtml: '<p>Qual o segundo pilar da IC?</p>',
      backHtml: '<p>Betabloqueadores cardioseletivos.</p>',
      tags: ['cardio', 'bb'],
      suspended: true,
      annotations: [],
    },
  ];

  it('monta com consultaHtml estático e dados iniciais injetados', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ConsultaView units={sampleUnits} hasMore={true} fontSize={18} />
      );
    });

    const webViewInstance = renderer!.root.findByProps({
      testID: 'consulta-view-webview',
    });
    expect(webViewInstance).toBeDefined();
    expect(webViewInstance.props.source).toEqual({ html: consultaHtml });

    const injectedScript: string =
      webViewInstance.props.injectedJavaScriptBeforeContentLoaded;
    expect(injectedScript).toContain('window.__INITIAL_CONSULTA_DATA__');
    expect(injectedScript).toContain('Qual o primeiro pilar da IC?');
    expect(injectedScript).toContain('Betabloqueadores cardioseletivos');
    expect(injectedScript).toContain('"hasMore":true');
    expect(injectedScript).toContain('"fontSize":18');
  });

  it('dispara onNeedMore quando a WebView solicita o próximo lote', () => {
    const handleNeedMore = jest.fn();

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ConsultaView units={sampleUnits} hasMore={true} onNeedMore={handleNeedMore} />
      );
    });

    const webViewInstance = renderer!.root.findByProps({
      testID: 'consulta-view-webview',
    });

    act(() => {
      webViewInstance.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'needMore',
            payload: { after: 1 },
          }),
        },
      });
    });

    expect(handleNeedMore).toHaveBeenCalledWith(1);
  });

  it('dispara onMenuAction quando uma ação do menu contextual é clicada', () => {
    const handleMenuAction = jest.fn();

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ConsultaView
          units={sampleUnits}
          onMenuAction={handleMenuAction}
        />
      );
    });

    const webViewInstance = renderer!.root.findByProps({
      testID: 'consulta-view-webview',
    });

    act(() => {
      webViewInstance.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'menuAction',
            payload: { action: 'edit', noteId: 'note-1', unitIndex: 0 },
          }),
        },
      });
    });

    expect(handleMenuAction).toHaveBeenCalledWith('edit', 'note-1', 0);
  });

  it('envia mensagem append via postMessage quando novas unidades são adicionadas', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ConsultaView units={sampleUnits} hasMore={true} />
      );
    });

    const webViewInstance = renderer!.root.findByProps({
      testID: 'consulta-view-webview',
    });

    // Simula WebView pronta
    act(() => {
      webViewInstance.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: 'ready' }) },
      });
    });

    mockPostMessage.mockClear();

    const newUnits: ConsultaUnit[] = [
      ...sampleUnits,
      {
        index: 2,
        noteId: 'note-3',
        deckPath: 'Medicina::Cardiologia',
        frontHtml: '<p>Terceiro pilar?</p>',
        backHtml: '<p>Espironolactona.</p>',
        tags: ['cardio'],
        suspended: false,
        annotations: [],
      },
    ];

    act(() => {
      renderer.update(<ConsultaView units={newUnits} hasMore={false} />);
    });

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    const sentData = JSON.parse(mockPostMessage.mock.calls[0][0]);
    expect(sentData.type).toBe('append');
    expect(sentData.payload.units.length).toBe(1);
    expect(sentData.payload.units[0].noteId).toBe('note-3');
    expect(sentData.payload.hasMore).toBe(false);
  });

  it('responde request saveAnnotation da WebView via ponte com mesmo id e dados gravados', async () => {
    const handleSaveAnnotation = jest.fn().mockResolvedValue({
      id: 'ann-saved-1',
      note_id: 'note-1',
      group_key: null,
      kind: 'hl',
      color: 'verde',
      quote: 'IECA',
      prefix: '',
      suffix: '',
      start: 0,
      end: 4,
      note: '',
      label: '',
      created_at: 1000,
      updated_at: 1000,
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ConsultaView
          units={sampleUnits}
          onSaveAnnotation={handleSaveAnnotation}
        />
      );
    });

    const webViewInstance = renderer!.root.findByProps({
      testID: 'consulta-view-webview',
    });

    mockPostMessage.mockClear();

    await act(async () => {
      webViewInstance.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'saveAnnotation',
            id: 'web-msg-1',
            payload: {
              note_id: 'note-1',
              kind: 'hl',
              color: 'verde',
              quote: 'IECA',
              start: 0,
              end: 4,
            },
          }),
        },
      });
      // Aguarda microtasks da resposta
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(handleSaveAnnotation).toHaveBeenCalled();
    expect(mockPostMessage).toHaveBeenCalled();
    const responseMsg = JSON.parse(mockPostMessage.mock.calls[0][0]);
    expect(responseMsg.type).toBe('saveAnnotation');
    expect(responseMsg.id).toBe('web-msg-1');
    expect(responseMsg.payload.id).toBe('ann-saved-1');
  });

  it('responde request deleteAnnotation da WebView com { ok: true }', async () => {
    const handleDeleteAnnotation = jest.fn().mockResolvedValue(true);

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ConsultaView
          units={sampleUnits}
          onDeleteAnnotation={handleDeleteAnnotation}
        />
      );
    });

    const webViewInstance = renderer!.root.findByProps({
      testID: 'consulta-view-webview',
    });

    mockPostMessage.mockClear();

    await act(async () => {
      webViewInstance.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'deleteAnnotation',
            id: 'web-msg-2',
            payload: { id: 'ann-1' },
          }),
        },
      });
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(handleDeleteAnnotation).toHaveBeenCalledWith('ann-1');
    expect(mockPostMessage).toHaveBeenCalled();
    const responseMsg = JSON.parse(mockPostMessage.mock.calls[0][0]);
    expect(responseMsg.type).toBe('deleteAnnotation');
    expect(responseMsg.id).toBe('web-msg-2');
    expect(responseMsg.payload).toEqual({ ok: true });
  });

  it('permite acionar sendGoto via ref imperativo com offset', () => {
    const ref = React.createRef<ConsultaViewHandle>();

    act(() => {
      ReactTestRenderer.create(
        <ConsultaView ref={ref} units={sampleUnits} />
      );
    });

    mockPostMessage.mockClear();
    act(() => {
      ref.current?.sendGoto(5, 'ann-42', 150);
    });

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    const sentData = JSON.parse(mockPostMessage.mock.calls[0][0]);
    expect(sentData.type).toBe('goto');
    expect(sentData.payload).toEqual({ unitIndex: 5, annotationId: 'ann-42', offset: 150 });
  });

  it('permite acionar sendFlushPosition via ref imperativo', () => {
    const ref = React.createRef<ConsultaViewHandle>();

    act(() => {
      ReactTestRenderer.create(
        <ConsultaView ref={ref} units={sampleUnits} />
      );
    });

    mockPostMessage.mockClear();
    act(() => {
      ref.current?.sendFlushPosition();
    });

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    const sentData = JSON.parse(mockPostMessage.mock.calls[0][0]);
    expect(sentData.type).toBe('flushPosition');
  });

  it('injeta initialPosition no script inicial da WebView quando fornecido', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ConsultaView
          units={sampleUnits}
          initialPosition={{ unitIndex: 8, offset: 220 }}
        />
      );
    });

    const webViewInstance = renderer!.root.findByProps({
      testID: 'consulta-view-webview',
    });

    const injectedScript: string = webViewInstance.props.injectedJavaScriptBeforeContentLoaded;
    expect(injectedScript).toContain('"initialPosition":{"unitIndex":8,"offset":220}');
  });
});
