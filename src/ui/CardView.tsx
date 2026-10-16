import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { cardRuntimeJs } from '@/webview/generated/card';
import { buildAnkiDocument } from '@/webview/card/ankiDocument';
import type {
  CardInboundMessage,
  CardOutboundMessage,
  CardRenderPayload,
  CardSide,
  ThemeMode,
} from '@/webview/card/types';
import { useTheme } from '@/ui/theme';
import { useMediaDirectory } from '@/media';
import { logError, logWarn } from '@/logging';

export interface CardViewProps {
  /**
   * Conteúdo HTML pré-renderizado do card (frente ou verso).
   */
  html: string;

  /**
   * Lado atual do card ('front' ou 'back').
   */
  side: CardSide;

  /**
   * CSS do note type (inserido cru em #note-css, sem escopo .card-root).
   */
  css?: string;

  /**
   * Indica se o modelo é um dos embutidos do Weiss (recebe BASE_CARD_STYLES).
   */
  isBuiltinModel?: boolean;

  /**
   * Liga/desliga a execução de <script> dos templates do modelo (padrão true).
   */
  executeModelScripts?: boolean;

  /**
   * ID do card atual (para shims AnkiDroidJS / AnkiConnect).
   */
  cardId?: string;

  /**
   * ID da nota atual (para shims AnkiDroidJS / AnkiConnect).
   */
  noteId?: string;

  /**
   * Campos da nota atual (para shims AnkiConnect local).
   */
  fields?: Record<string, string>;

  /**
   * Caminho base local da pasta de mídia do app (para imagens relativas).
   */
  mediaBasePath?: string;

  /**
   * Índice ordinal do card dentro da nota.
   */
  cardOrd?: number;

  /**
   * Tags associadas à nota.
   */
  tags?: string[];

  /**
   * Tema visual ('light' ou 'dark'). Se omitido, segue useTheme().
   */
  theme?: ThemeMode;

  /**
   * Callback invocado quando a WebView conclui a renderização do DOM (inclui cor de fundo efetiva do Passo 5).
   */
  onRendered?: (payload: { side: CardSide; height: number; backgroundColor?: string }) => void;

  /**
   * Callback invocado quando um link <a> é clicado no card.
   */
  onLinkPress?: (url: string) => void;

  /**
   * Callback invocado quando um script do card atualiza campos da nota atual (ex.: Bloco de Notas do AnKing).
   */
  onUpdateNoteFields?: (noteId: string, fields: Record<string, string>) => void;

  /**
   * Callback invocado caso ocorra erro interno de sanitização ou DOM.
   */
  onError?: (message: string) => void;

  /**
   * Estilo customizado para o container externo.
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Identificador para testes automatizados.
   */
  testID?: string;

  /**
   * Anotações a serem aplicadas no verso do card (MODO_CONSULTA.md §6).
   */
  annotations?: CardRenderPayload['annotations'];

  /**
   * Liga/desliga a exibição de grifos na revisão (padrão true).
   */
  showHighlights?: boolean;
}

/**
 * Componente React Native de exibição de card único.
 * Carrega um documento HTML completo no formato do AnkiDroid por lado do card (M10 Passo 2 e Passo 4).
 */
export function CardView({
  html,
  side,
  css,
  isBuiltinModel,
  executeModelScripts = true,
  cardId,
  noteId,
  fields,
  mediaBasePath,
  cardOrd,
  tags,
  theme: themeProp,
  annotations,
  showHighlights,
  onRendered,
  onLinkPress,
  onUpdateNoteFields,
  onError,
  style,
  testID = 'card-view',
}: CardViewProps) {
  const { isDark, theme: appTheme } = useTheme();
  const defaultMediaDir = useMediaDirectory();
  const effectiveMediaDir = mediaBasePath ?? defaultMediaDir;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webViewRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  const resolvedTheme: ThemeMode = themeProp ?? (isDark ? 'dark' : 'light');

  const currentPayload: CardRenderPayload = useMemo(
    () => ({
      html,
      side,
      theme: resolvedTheme,
      css,
      isBuiltinModel,
      executeModelScripts,
      cardId,
      noteId,
      fields,
      mediaBasePath: effectiveMediaDir,
      cardOrd,
      tags,
      annotations,
      showHighlights,
    }),
    [
      html,
      side,
      resolvedTheme,
      css,
      isBuiltinModel,
      executeModelScripts,
      cardId,
      noteId,
      fields,
      effectiveMediaDir,
      cardOrd,
      tags,
      annotations,
      showHighlights,
    ]
  );

  // Gera o documento HTML completo no formato AnkiDroid para o lado atual
  const ankiDocHtml = useMemo(
    () =>
      buildAnkiDocument(currentPayload, {
        runtimeScript: cardRuntimeJs,
      }),
    [currentPayload]
  );

  // Mantém injectedJavaScriptBeforeContentLoaded para compatibilidade e inicialização imediata
  const initialDataScript = useMemo(() => {
    const serialized = JSON.stringify(currentPayload);
    return `window.__INITIAL_CARD_DATA__ = ${serialized}; true;`;
  }, [currentPayload]);

  // Atualiza a WebView via postMessage caso já esteja pronta
  useEffect(() => {
    if (!isReady) return;

    const message: CardInboundMessage = {
      type: 'renderCard',
      payload: currentPayload,
    };

    webViewRef.current?.postMessage(JSON.stringify(message));
  }, [isReady, currentPayload]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message: CardOutboundMessage = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case 'ready':
          setIsReady(true);
          webViewRef.current?.postMessage(
            JSON.stringify({
              type: 'renderCard',
              payload: currentPayload,
            } satisfies CardInboundMessage)
          );
          break;

        case 'rendered':
          setIsReady(true);
          onRendered?.(message.payload);
          break;

        case 'linkClick':
          onLinkPress?.(message.payload.url);
          break;

        case 'scriptError':
          logError('CardScript', message.payload.message);
          break;

        case 'updateNoteFields':
          if (!noteId || message.payload.noteId === noteId) {
            onUpdateNoteFields?.(message.payload.noteId, message.payload.fields);
          } else {
            logWarn(
              'CardScript',
              `Ignorada tentativa de updateNoteFields para outra nota (${message.payload.noteId})`
            );
          }
          break;

        case 'error':
          onError?.(message.payload.message);
          break;
      }
    } catch (err) {
      logWarn('CardView', 'Mensagem malformada recebida da WebView do Card', String(err));
    }
  };

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        { backgroundColor: appTheme.elevated },
        style,
      ]}
    >
      <WebView
        ref={webViewRef}
        testID={`${testID}-webview`}
        source={{ html: ankiDocHtml, baseUrl: effectiveMediaDir }}
        allowFileAccess
        originWhitelist={['about:*', 'file://*']}
        injectedJavaScriptBeforeContentLoaded={initialDataScript}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={styles.webView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
