import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { cardHtml } from '@/webview/generated/card';
import type {
  CardInboundMessage,
  CardOutboundMessage,
  CardRenderPayload,
  CardSide,
  ThemeMode,
} from '@/webview/card/types';
import { useTheme } from '@/ui/theme';

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
   * CSS opcional do note type (será isolado com escopo em .card-root).
   */
  css?: string;

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
   * Callback invocado quando a WebView conclui a renderização do DOM.
   */
  onRendered?: (payload: { side: CardSide; height: number }) => void;

  /**
   * Callback invocado quando um link <a> é clicado no card.
   */
  onLinkPress?: (url: string) => void;

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
 * Hospeda a WebView estática empacotada por esbuild (com DOMPurify,
 * escopo de CSS e resolução segura de mídia).
 */
export function CardView({
  html,
  side,
  css,
  mediaBasePath,
  cardOrd,
  tags,
  theme: themeProp,
  annotations,
  showHighlights,
  onRendered,
  onLinkPress,
  onError,
  style,
  testID = 'card-view',
}: CardViewProps) {
  const { isDark, theme: appTheme } = useTheme();
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
      mediaBasePath,
      cardOrd,
      tags,
      annotations,
      showHighlights,
    }),
    [html, side, resolvedTheme, css, mediaBasePath, cardOrd, tags, annotations, showHighlights]
  );

  // Injeta os dados iniciais antes do primeiro carregamento do DOM para evitar tela em branco
  const initialDataScript = useMemo(() => {
    const serialized = JSON.stringify(currentPayload);
    return `window.__INITIAL_CARD_DATA__ = ${serialized}; true;`;
  }, []); // Avaliado apenas na montagem da WebView

  // Atualiza a WebView via postMessage sempre que os dados mudarem após a inicialização
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
          // Caso os dados tenham mudado antes do handshake ready ser recebido
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

        case 'error':
          onError?.(message.payload.message);
          break;
      }
    } catch {
      // Ignora mensagens com formato inválido
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
        source={{ html: cardHtml }}
        injectedJavaScriptBeforeContentLoaded={initialDataScript}
        onMessage={handleMessage}
        originWhitelist={['*']}
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
