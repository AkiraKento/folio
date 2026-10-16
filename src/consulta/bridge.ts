/**
 * Implementação da ponte do lado React Native para o Modo Consulta (MODO_CONSULTA.md §8).
 *
 * Gerencia a comunicação tipada com a WebView, responde aos requests de anotações
 * persistindo no banco de dados SQLite local (AnnotationsRepository) e despacha
 * eventos de navegação, lotes e leitura.
 */
import {
  createBridgeEndpoint,
  type BridgeEndpoint,
} from '../webview/shared/bridge';
import type { AnnotationColor } from '../webview/shared/anchor';
import type {
  AnnotationInput,
  ConsultaInitPayload,
  ConsultaMenuAction,
  RnToWebEvents,
  RnToWebRequests,
  SavedAnnotation,
  WebToRnEvents,
  WebToRnRequests,
} from '../webview/consulta/protocol';
import type {
  ConsultaTheme,
  ConsultaUnitWeb,
} from '../webview/consulta/types';
import type { ConsultaUnit } from './units';
import { AnnotationsRepository } from '../db/repositories/annotations';
import { ConsultaPosRepository } from '../db/repositories/consulta-pos';
import { SettingsRepository } from '../db/repositories/settings';
import type { Annotation } from '../db/schema';
import { logWarn } from '@/logging';

/**
 * Converte um registro de anotação do banco para o formato SavedAnnotation retornado à WebView.
 */
export function toSavedAnnotation(record: Annotation): SavedAnnotation {
  return {
    id: record.id,
    note_id: record.note_id,
    group_key: record.group_key ?? null,
    kind: record.kind,
    color: record.color,
    quote: record.quote,
    prefix: record.prefix,
    suffix: record.suffix,
    start: record.start,
    end: record.end,
    note: record.note,
    label: record.label,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/**
 * Converte ConsultaUnit do RN (com Annotation do banco) para ConsultaUnitWeb esperado no DOM.
 */
export function toConsultaUnitWeb(unit: ConsultaUnit): ConsultaUnitWeb {
  return {
    index: unit.index,
    noteId: unit.noteId,
    groupKey: unit.groupKey ?? null,
    deckPath: unit.deckPath,
    frontHtml: unit.frontHtml,
    backHtml: unit.backHtml,
    tags: unit.tags,
    suspended: unit.suspended,
    annotations: unit.annotations.map((a) => ({
      id: a.id,
      note_id: a.note_id,
      group_key: a.group_key ?? null,
      kind: a.kind as 'hl' | 'ul',
      color: a.color as AnnotationColor,
      quote: a.quote,
      prefix: a.prefix,
      suffix: a.suffix,
      start: a.start,
      end: a.end,
      note: a.note,
      label: a.label,
    })),
  };
}

export interface ConsultaRnBridgeOptions {
  /** Envia a string serializada para a WebView (ex: webViewRef.current?.postMessage) */
  post: (raw: string) => void;
  /** Repositório de anotações (instancia padrão se omitido) */
  annotationsRepo?: AnnotationsRepository;
  /** Repositório opcional para salvar a posição da leitura no evento 'position' */
  consultaPosRepo?: ConsultaPosRepository;
  /** Repositório opcional para salvar preferências de fonte/cor */
  settingsRepo?: SettingsRepository;
  /** Identificador ou query do deck atual para gravação em consulta_pos */
  deckQuery?: string;
  /** Tratador customizado opcional para o request saveAnnotation */
  onSaveAnnotation?: (input: AnnotationInput) => Promise<SavedAnnotation> | SavedAnnotation;
  /** Tratador customizado opcional para o request deleteAnnotation */
  onDeleteAnnotation?: (id: string) => Promise<boolean> | boolean;
  /** Tratador customizado opcional para o request restoreAnnotation */
  onRestoreAnnotation?: (id: string) => Promise<boolean> | boolean;
  /** Callback quando uma anotação é apagada pelo popover na WebView */
  onAnnotationDeleted?: (annotation: SavedAnnotation, unitIndex: number) => void;
  /** Timeout em ms para requisições */
  timeoutMs?: number;
}

export interface ConsultaRnBridge {
  readonly endpoint: BridgeEndpoint<
    RnToWebEvents,
    RnToWebRequests,
    WebToRnEvents,
    WebToRnRequests
  >;

  /** Entrega uma mensagem recebida da WebView (ex: evento onMessage) */
  receive: (raw: unknown) => boolean;

  /** Envia configuração de leitura (init) */
  sendInit: (payload: ConsultaInitPayload) => void;

  /** Envia novo lote de unidades (append) */
  sendAppend: (units: (ConsultaUnit | ConsultaUnitWeb)[], hasMore: boolean) => void;

  /** Envia substituição de unidades atualizadas (replace) */
  sendReplace: (units: (ConsultaUnit | ConsultaUnitWeb)[]) => void;

  /** Envia rolagem até unidade e piscar de anotação (goto) */
  sendGoto: (unitIndex: number, annotationId?: string, offset?: number) => void;

  /** Envia solicitação de flush imediato da posição de leitura na WebView */
  sendFlushPosition: () => void;

  /** Envia restauração de anotação desfeita pelo usuário */
  sendRestoreAnnotation: (annotation: SavedAnnotation, unitIndex: number) => void;

  /** Envia alteração de tema (setTheme) */
  sendTheme: (theme: ConsultaTheme) => void;

  /** Envia alteração do tamanho da fonte (setFontSize) */
  sendFontSize: (fontSize: number) => void;

  /** Ouvinte para quando a WebView estiver pronta */
  onReady: (listener: () => void) => () => void;

  /** Ouvinte para quando a rolagem precisar de mais unidades */
  onNeedMore: (listener: (after: number) => void) => () => void;

  /** Ouvinte para abrir o editor de notas */
  onOpenEditor: (listener: (noteId: string) => void) => () => void;

  /** Ouvinte para atualização da posição de leitura */
  onPosition: (listener: (pos: { unitIndex: number; offset: number }) => void) => () => void;

  /** Ouvinte para alteração do tamanho da fonte feita na WebView */
  onSetFont: (listener: (fontSize: number) => void) => () => void;

  /** Ouvinte para alteração de cor de grifo feita na WebView */
  onSetColor: (listener: (color: AnnotationColor) => void) => () => void;

  /** Ouvinte para quando um lote for renderizado no DOM */
  onRendered: (listener: (payload: { count: number; hasMore: boolean }) => void) => () => void;

  /** Ouvinte para ações do menu contextual da unidade (⋯) */
  onMenuAction: (
    listener: (payload: { action: ConsultaMenuAction; noteId: string; unitIndex: number }) => void
  ) => () => void;

  /** Ouvinte para quando um grifo for apagado na WebView */
  onAnnotationDeleted: (
    listener: (payload: { annotation: SavedAnnotation; unitIndex: number }) => void
  ) => () => void;

  /** Ouvinte para erros da WebView */
  onError: (listener: (error: string) => void) => () => void;

  /** Atualiza o deckQuery ativo para gravação em consulta_pos */
  setDeckQuery: (deckQuery?: string) => void;

  /** Encerra o endpoint e cancela requisições pendentes */
  dispose: () => void;
}

export function createConsultaRnBridge(options: ConsultaRnBridgeOptions): ConsultaRnBridge {
  let cachedAnnotationsRepo: AnnotationsRepository | null = options.annotationsRepo ?? null;
  function getAnnotationsRepo(): AnnotationsRepository {
    if (!cachedAnnotationsRepo) {
      cachedAnnotationsRepo = new AnnotationsRepository();
    }
    return cachedAnnotationsRepo;
  }

  let cachedConsultaPosRepo: ConsultaPosRepository | null = options.consultaPosRepo ?? null;
  function getConsultaPosRepo(): ConsultaPosRepository | null {
    if (!cachedConsultaPosRepo) {
      try {
        cachedConsultaPosRepo = new ConsultaPosRepository();
      } catch {
        // Ignora em contextos sem SQLite aberto
      }
    }
    return cachedConsultaPosRepo;
  }

  let cachedSettingsRepo: SettingsRepository | null = options.settingsRepo ?? null;
  function getSettingsRepo(): SettingsRepository | null {
    if (!cachedSettingsRepo) {
      try {
        cachedSettingsRepo = new SettingsRepository();
      } catch {
        // Ignora em contextos sem SQLite aberto
      }
    }
    return cachedSettingsRepo;
  }

  let activeDeckQuery = options.deckQuery;
  let lastReportedPosition: { unitIndex: number; offset: number } | null = null;

  const endpoint = createBridgeEndpoint<
    RnToWebEvents,
    RnToWebRequests,
    WebToRnEvents,
    WebToRnRequests
  >({
    side: 'rn',
    post: options.post,
    timeoutMs: options.timeoutMs,
  });

  // ---------------------------------------------------------------------------
  // Tratadores de Requests (Web → RN) com resposta id-matched (§8)
  // ---------------------------------------------------------------------------

  endpoint.handle('saveAnnotation', async (input: AnnotationInput) => {
    if (options.onSaveAnnotation) {
      return await options.onSaveAnnotation(input);
    }

    const saved = getAnnotationsRepo().save({
      id: input.id,
      note_id: input.note_id,
      group_key: input.group_key ?? null,
      kind: input.kind,
      color: input.color,
      quote: input.quote,
      prefix: input.prefix ?? '',
      suffix: input.suffix ?? '',
      start: input.start,
      end: input.end,
      note: input.note ?? '',
      label: input.label ?? '',
    });

    return toSavedAnnotation(saved);
  });

  endpoint.handle('deleteAnnotation', async ({ id }: { id: string }) => {
    if (options.onDeleteAnnotation) {
      const ok = await options.onDeleteAnnotation(id);
      return { ok };
    }

    const ok = getAnnotationsRepo().softDelete(id);
    return { ok };
  });

  endpoint.handle('restoreAnnotation', async ({ id }: { id: string }) => {
    if (options.onRestoreAnnotation) {
      const ok = await options.onRestoreAnnotation(id);
      return { ok };
    }

    const ok = getAnnotationsRepo().restore(id);
    return { ok };
  });

  // ---------------------------------------------------------------------------
  // Efeitos automáticos dos eventos recebidos da Web
  // ---------------------------------------------------------------------------

  endpoint.on('position', (payload) => {
    lastReportedPosition = payload;
    if (activeDeckQuery) {
      const repo = getConsultaPosRepo();
      if (repo) {
        try {
          repo.save(activeDeckQuery, payload.unitIndex, payload.offset);
        } catch (err) {
          logWarn('ConsultaBridge', 'Falha ao salvar posição de leitura', String(err));
        }
      }
    }
  });

  endpoint.on('setFont', (fontSize) => {
    const repo = getSettingsRepo();
    if (repo) {
      try {
        repo.set('fontSize', fontSize);
      } catch (err) {
        logWarn('ConsultaBridge', 'Falha ao salvar tamanho de fonte', String(err));
      }
    }
  });

  endpoint.on('setColor', (color) => {
    const repo = getSettingsRepo();
    if (repo) {
      try {
        repo.set('lastHighlightColor', color);
      } catch (err) {
        logWarn('ConsultaBridge', 'Falha ao salvar última cor de grifo', String(err));
      }
    }
  });

  endpoint.on('annotationDeleted', (payload) => {
    options.onAnnotationDeleted?.(payload.annotation, payload.unitIndex);
  });

  // Helper para normalizar unidades (garantindo que se já forem ConsultaUnitWeb não reconvertam)
  function normalizeUnits(
    units: (ConsultaUnit | ConsultaUnitWeb)[]
  ): ConsultaUnitWeb[] {
    return units.map((u) => ('frontHtml' in u && Array.isArray(u.annotations) && u.annotations.length > 0 && 'created_at' in u.annotations[0]
      ? toConsultaUnitWeb(u as ConsultaUnit)
      : u as ConsultaUnitWeb));
  }

  return {
    endpoint,

    receive(raw: unknown) {
      return endpoint.receive(raw);
    },

    sendInit(payload: ConsultaInitPayload) {
      endpoint.emit('init', payload);
    },

    sendAppend(units, hasMore) {
      endpoint.emit('append', {
        units: normalizeUnits(units),
        hasMore,
      });
    },

    sendReplace(units) {
      endpoint.emit('replace', {
        units: normalizeUnits(units),
      });
    },

    sendGoto(unitIndex, annotationId, offset) {
      endpoint.emit('goto', { unitIndex, annotationId, offset });
    },

    sendFlushPosition() {
      endpoint.emit('flushPosition', null);
    },

    sendRestoreAnnotation(annotation, unitIndex) {
      endpoint.emit('restoreAnnotation', { annotation, unitIndex });
    },

    sendTheme(theme) {
      endpoint.emit('setTheme', { theme });
    },

    sendFontSize(fontSize) {
      endpoint.emit('setFontSize', { fontSize });
    },

    onReady(listener) {
      return endpoint.on('ready', listener);
    },

    onNeedMore(listener) {
      return endpoint.on('needMore', (payload) => listener(payload.after));
    },

    onOpenEditor(listener) {
      return endpoint.on('openEditor', (payload) => listener(payload.noteId));
    },

    onPosition(listener) {
      return endpoint.on('position', listener);
    },

    onSetFont(listener) {
      return endpoint.on('setFont', listener);
    },

    onSetColor(listener) {
      return endpoint.on('setColor', listener);
    },

    onRendered(listener) {
      return endpoint.on('rendered', listener);
    },

    onMenuAction(listener) {
      return endpoint.on('menuAction', listener);
    },

    onAnnotationDeleted(listener) {
      return endpoint.on('annotationDeleted', listener);
    },

    onError(listener) {
      return endpoint.on('error', (payload) => listener(payload.message));
    },

    setDeckQuery(deckQuery) {
      activeDeckQuery = deckQuery;
    },

    dispose() {
      if (activeDeckQuery && lastReportedPosition) {
        const repo = getConsultaPosRepo();
        if (repo) {
          try {
            repo.save(activeDeckQuery, lastReportedPosition.unitIndex, lastReportedPosition.offset);
          } catch (err) {
            logWarn('ConsultaBridge', 'Falha ao salvar posição no fechamento', String(err));
          }
        }
      }
      endpoint.dispose();
    },
  };
}
