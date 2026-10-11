import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { consultaHtml } from '@/webview/generated/consulta';
import type { ConsultaUnit } from '@/consulta/units';
import {
  createConsultaRnBridge,
  toConsultaUnitWeb,
  type ConsultaRnBridge,
} from '@/consulta/bridge';
import type {
  ConsultaTheme,
  ConsultaInitialData,
  ConsultaUnitWeb,
  UnitMenuAction,
} from '@/webview/consulta/types';
import type { AnnotationColor } from '@/webview/shared/anchor';
import type { AnnotationInput, SavedAnnotation } from '@/webview/consulta/protocol';
import { AnnotationsRepository } from '@/db/repositories/annotations';
import { ConsultaPosRepository } from '@/db/repositories/consulta-pos';
import { SettingsRepository } from '@/db/repositories/settings';
import { useTheme } from '@/ui/theme';

export interface ConsultaViewHandle {
  /** Rola até o índice da unidade e pisca a anotação opcional */
  sendGoto: (unitIndex: number, annotationId?: string, offset?: number) => void;
  /** Atualiza unidades já exibidas no DOM */
  sendReplace: (units: (ConsultaUnit | ConsultaUnitWeb)[]) => void;
  /** Envia alteração de tema para a WebView */
  sendTheme: (theme: ConsultaTheme) => void;
  /** Envia alteração de tamanho da fonte para a WebView */
  sendFontSize: (fontSize: number) => void;
  /** Restaura anotação desfeita na WebView */
  sendRestoreAnnotation: (annotation: SavedAnnotation, unitIndex: number) => void;
  /** Força envio imediato da posição de leitura na WebView para persistência */
  sendFlushPosition: () => void;
}

export interface ConsultaViewProps {
  /**
   * Coleção de unidades carregadas para exibição no Modo Consulta.
   */
  units: ConsultaUnit[];

  /**
   * Indicador se existem mais unidades no deck para carregamento em lotes.
   */
  hasMore?: boolean;

  /**
   * Posição inicial de leitura (para "Continuar lendo").
   */
  initialPosition?: { unitIndex: number; offset?: number };

  /**
   * Chave de redefinição da lista (ex: parâmetros de busca). Quando muda, a WebView
   * é reiniciada com init + append em vez de append incremental.
   */
  resetKey?: string;

  /**
   * Tamanho base da fonte do texto em px (14 a 26 px, padrão 17 px).
   */
  fontSize?: number;

  /**
   * Tema visual ('light' ou 'dark'). Se omitido, segue useTheme().
   */
  theme?: ConsultaTheme;

  /**
   * Última cor de grifo utilizada. Padrão: 'amarelo'.
   */
  lastColor?: AnnotationColor;

  /**
   * Indica se a frente do card deve ser exibida. Padrão: true.
   */
  showFront?: boolean;

  /**
   * Identificador do deck ou consulta para salvar posição em consulta_pos.
   */
  deckQuery?: string;

  /**
   * Instância opcional de AnnotationsRepository para injeção / testes.
   */
  annotationsRepo?: AnnotationsRepository;

  /**
   * Instância opcional de ConsultaPosRepository para injeção / testes.
   */
  consultaPosRepo?: ConsultaPosRepository;

  /**
   * Instância opcional de SettingsRepository para injeção / testes.
   */
  settingsRepo?: SettingsRepository;

  /**
   * Callback invocado quando o scroll da WebView se aproxima do final e precisa do próximo lote.
   */
  onNeedMore?: (afterIndex: number) => void;

  /**
   * Callback invocado quando uma ação do menu contextual (⋯) é acionada.
   */
  onMenuAction?: (action: UnitMenuAction, noteId: string, unitIndex: number) => void;

  /**
   * Callback invocado quando o editor da nota for solicitado.
   */
  onOpenEditor?: (noteId: string) => void;

  /**
   * Callback invocado quando a posição de leitura for reportada.
   */
  onPosition?: (pos: { unitIndex: number; offset: number }) => void;

  /**
   * Callback invocado quando a fonte for alterada na WebView.
   */
  onSetFont?: (fontSize: number) => void;

  /**
   * Callback invocado quando a cor de grifo for alterada na WebView.
   */
  onSetColor?: (color: AnnotationColor) => void;

  /**
   * Tratador customizado opcional de saveAnnotation.
   */
  onSaveAnnotation?: (input: AnnotationInput) => Promise<SavedAnnotation> | SavedAnnotation;

  /**
   * Tratador customizado opcional de deleteAnnotation.
   */
  onDeleteAnnotation?: (id: string) => Promise<boolean> | boolean;

  /**
   * Tratador customizado opcional de restoreAnnotation.
   */
  onRestoreAnnotation?: (id: string) => Promise<boolean> | boolean;

  /**
   * Callback quando uma anotação é apagada na WebView (para exibir Snackbar Desfazer).
   */
  onAnnotationDeleted?: (annotation: SavedAnnotation, unitIndex: number) => void;

  /**
   * Callback invocado quando a WebView conclui a renderização de um lote.
   */
  onRendered?: (count: number) => void;

  /**
   * Callback invocado em caso de erro interno da WebView.
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
}

/**
 * Componente React Native do Modo Consulta.
 * Hospeda a WebView contínua com a lista de unidades em lotes de 30,
 * cabeçalhos de seção de deck, frente esmaecida, verso em serifa e menus de unidade.
 * Conectado via ponte tipada RN ↔ WebView (MODO_CONSULTA.md §8).
 */
export const ConsultaView = forwardRef<ConsultaViewHandle, ConsultaViewProps>(
  function ConsultaView(
    {
      units,
      hasMore = false,
      initialPosition,
      fontSize = 17,
      theme: themeProp,
      lastColor = 'amarelo',
      showFront = true,
      deckQuery,
      annotationsRepo,
      consultaPosRepo,
      settingsRepo,
      onNeedMore,
      onMenuAction,
      onOpenEditor,
      onPosition,
      onSetFont,
      onSetColor,
      onSaveAnnotation,
      onDeleteAnnotation,
      onRestoreAnnotation,
      onAnnotationDeleted,
      onRendered,
      onError,
      style,
      resetKey,
      testID = 'consulta-view',
    },
    ref
  ) {
    const { isDark, theme: appTheme } = useTheme();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webViewRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);
    const lastRenderedUnitsRef = useRef<ConsultaUnitWeb[]>([]);
    const lastResetKeyRef = useRef<string | undefined>(resetKey);

    const resolvedTheme: ConsultaTheme = themeProp ?? (isDark ? 'dark' : 'light');

    // Converte ConsultaUnit para o formato esperado pela WebView
    const webUnits = useMemo(
      () => units.map(toConsultaUnitWeb),
      [units]
    );

    // Instanciação da ponte RN tipada
    const bridge: ConsultaRnBridge = useMemo(
      () =>
        createConsultaRnBridge({
          post: (raw: string) => {
            webViewRef.current?.postMessage(raw);
          },
          annotationsRepo,
          consultaPosRepo,
          settingsRepo,
          deckQuery,
          onSaveAnnotation,
          onDeleteAnnotation,
          onRestoreAnnotation,
          onAnnotationDeleted,
        }),
      [
        annotationsRepo,
        consultaPosRepo,
        settingsRepo,
        deckQuery,
        onSaveAnnotation,
        onDeleteAnnotation,
        onRestoreAnnotation,
        onAnnotationDeleted,
      ]
    );

    // Sincroniza deckQuery se mudar dinamicamente
    useEffect(() => {
      bridge.setDeckQuery(deckQuery);
    }, [bridge, deckQuery]);

    // Limpeza ao desmontar: faz flush da posição e descarta
    useEffect(() => {
      return () => {
        try {
          bridge.sendFlushPosition();
        } catch {
          // Ignora
        }
        bridge.dispose();
      };
    }, [bridge]);

    // Registra ouvintes dos eventos da WebView na ponte
    useEffect(() => {
      const cleanups = [
        bridge.onReady(() => {
          setIsReady(true);
          lastRenderedUnitsRef.current = webUnits;
        }),
        bridge.onRendered((payload) => {
          setIsReady(true);
          onRendered?.(payload.count);
        }),
        bridge.onNeedMore((after) => {
          onNeedMore?.(after);
        }),
        bridge.onOpenEditor((noteId) => {
          onOpenEditor?.(noteId);
          onMenuAction?.('edit', noteId, -1);
        }),
        bridge.onMenuAction((payload) => {
          onMenuAction?.(payload.action, payload.noteId, payload.unitIndex);
        }),
        bridge.onAnnotationDeleted((payload) => {
          onAnnotationDeleted?.(payload.annotation, payload.unitIndex);
        }),
        bridge.onPosition((pos) => {
          onPosition?.(pos);
        }),
        bridge.onSetFont((size) => {
          onSetFont?.(size);
        }),
        bridge.onSetColor((color) => {
          onSetColor?.(color);
        }),
        bridge.onError((message) => {
          onError?.(message);
        }),
      ];

      return () => {
        for (const cleanup of cleanups) cleanup();
      };
    }, [
      bridge,
      webUnits.length,
      onRendered,
      onNeedMore,
      onOpenEditor,
      onMenuAction,
      onAnnotationDeleted,
      onPosition,
      onSetFont,
      onSetColor,
      onError,
    ]);

    // Expõe métodos imperativos para o componente pai
    useImperativeHandle(
      ref,
      () => ({
        sendGoto: (unitIndex, annotationId, offset) =>
          bridge.sendGoto(unitIndex, annotationId, offset),
        sendReplace: (nextUnits) => bridge.sendReplace(nextUnits),
        sendTheme: (t) => bridge.sendTheme(t),
        sendFontSize: (s) => bridge.sendFontSize(s),
        sendRestoreAnnotation: (annotation, unitIndex) =>
          bridge.sendRestoreAnnotation(annotation, unitIndex),
        sendFlushPosition: () => bridge.sendFlushPosition(),
      }),
      [bridge]
    );

    // Script de hidratação instantânea pré-carregamento do DOM
    const initialDataScript = useMemo(() => {
      const initialPayload: ConsultaInitialData = {
        theme: resolvedTheme,
        fontSize,
        lastColor,
        showFront,
        units: webUnits,
        hasMore,
        initialPosition,
      };
      const serialized = JSON.stringify(initialPayload);
      return `window.__INITIAL_CONSULTA_DATA__ = ${serialized}; true;`;
    }, []); // Executado uma única vez na inicialização da WebView

    // Sincroniza mudanças de tema
    useEffect(() => {
      if (!isReady) return;
      bridge.sendTheme(resolvedTheme);
    }, [bridge, isReady, resolvedTheme]);

    // Sincroniza mudanças de tamanho da fonte
    useEffect(() => {
      if (!isReady) return;
      bridge.sendFontSize(fontSize);
    }, [bridge, isReady, fontSize]);

    // Sincroniza unidades com a WebView (append para paginação contínua, init+append para nova busca / reset)
    useEffect(() => {
      if (!isReady) return;

      const prevUnits = lastRenderedUnitsRef.current;
      const resetKeyChanged = resetKey !== lastResetKeyRef.current;
      lastResetKeyRef.current = resetKey;

      // Verifica se é uma continuação pura da lista existente (mesmo início e prefixo idêntico)
      const isPureAppend =
        !resetKeyChanged &&
        prevUnits.length > 0 &&
        webUnits.length > prevUnits.length &&
        webUnits[0]?.noteId === prevUnits[0]?.noteId &&
        webUnits[prevUnits.length - 1]?.noteId === prevUnits[prevUnits.length - 1]?.noteId;

      if (isPureAppend) {
        const newBatch = webUnits.slice(prevUnits.length);
        lastRenderedUnitsRef.current = webUnits;
        bridge.sendAppend(newBatch, hasMore);
      } else if (
        resetKeyChanged ||
        webUnits.length !== prevUnits.length ||
        webUnits[0]?.noteId !== prevUnits[0]?.noteId
      ) {
        // Lista foi reiniciada (ex: nova busca, filtro de anotações ou troca de deck)
        lastRenderedUnitsRef.current = webUnits;
        bridge.sendInit({
          theme: resolvedTheme,
          fontSize,
          lastColor,
          showFront,
        });
        if (webUnits.length > 0) {
          bridge.sendAppend(webUnits, hasMore);
        }
      }
    }, [
      bridge,
      isReady,
      webUnits,
      hasMore,
      resetKey,
      resolvedTheme,
      fontSize,
      lastColor,
      showFront,
    ]);

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        bridge.receive(event.nativeEvent.data);
      } catch {
        // Ignora mensagens malformadas
      }
    };

    return (
      <View
        testID={testID}
        style={[
          styles.container,
          { backgroundColor: appTheme.canvas },
          style,
        ]}
      >
        <WebView
          ref={webViewRef}
          testID={`${testID}-webview`}
          source={{ html: consultaHtml }}
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
);

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
