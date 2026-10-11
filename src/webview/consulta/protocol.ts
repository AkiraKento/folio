/**
 * Contrato da ponte da Consulta (MODO_CONSULTA.md §8).
 *
 * Arquivo só de tipos e constantes, sem DOM e sem React Native: é importado
 * pelos dois lados (WebView e app) para que o compilador garanta que o que
 * um lado manda é o que o outro espera.
 */
import type { AnnotationColor, AnnotationData, AnnotationKind } from '../shared/anchor';
import type { BridgeRequestHandlers } from '../shared/bridge';
import type { ConsultaTheme, ConsultaUnitWeb, UnitMenuAction } from './types';

export const ANNOTATION_KINDS: readonly AnnotationKind[] = ['hl', 'ul'];
export const ANNOTATION_COLORS: readonly AnnotationColor[] = [
  'amarelo',
  'verde',
  'azul',
  'rosa',
  'laranja',
];

/** Espera do evento `position` (§8: "com espera de 1 s"). */
export const POSITION_DEBOUNCE_MS = 1000;

/** Configuração de leitura enviada no `init`. */
export interface ConsultaInitPayload {
  theme: ConsultaTheme;
  fontSize: number;
  lastColor: AnnotationColor;
  showFront: boolean;
}

/**
 * Anotação enviada pela WebView em `saveAnnotation`.
 * Sem `id` = criar (o app gera o UUID); com `id` = atualizar.
 * `note_id` e `group_key` só valem na criação (§4).
 */
export interface AnnotationInput {
  id?: string;
  note_id: string;
  group_key?: string | null;
  kind: AnnotationKind;
  color: AnnotationColor;
  quote: string;
  prefix?: string;
  suffix?: string;
  start: number;
  end: number;
  note?: string;
  label?: string;
}

/** Registro gravado, devolvido na resposta de `saveAnnotation`. */
export interface SavedAnnotation extends AnnotationData {
  note_id: string;
  group_key: string | null;
  prefix: string;
  suffix: string;
  start: number;
  end: number;
  note: string;
  label: string;
  created_at: number;
  updated_at: number;
}

/** Ações do menu ⋯ que o app trata. "Editar" vai como `openEditor`. */
export type ConsultaMenuAction = Exclude<UnitMenuAction, 'edit'>;

// ---------------------------------------------------------------------------
// RN → WebView
// ---------------------------------------------------------------------------

export type RnToWebEvents = {
  /** Configura a leitura e limpa a lista. As unidades vêm depois, em `append`. */
  init: ConsultaInitPayload;
  /** Próximo lote. */
  append: { units: ConsultaUnitWeb[]; hasMore: boolean };
  /** Unidades já exibidas com conteúdo novo (ex.: card editado). Casadas por `index`. */
  replace: { units: ConsultaUnitWeb[] };
  /** Rola até a unidade (e offset opcional) e, se houver, pisca o grifo. */
  goto: { unitIndex: number; annotationId?: string; offset?: number };
  /** Extensão: troca de tema sem recarregar a lista. */
  setTheme: { theme: ConsultaTheme };
  /** Extensão: A−/A+ da barra do app. */
  setFontSize: { fontSize: number };
  /** Restaura anotação desfeita pelo usuário no Snackbar do app. */
  restoreAnnotation: { annotation: SavedAnnotation; unitIndex: number };
  /** Força o envio imediato da posição atual para persistência ao sair da tela. */
  flushPosition: null;
};

/** Nenhum request do app para a WebView por enquanto. */
export type RnToWebRequests = Record<never, never>;

// ---------------------------------------------------------------------------
// WebView → RN
// ---------------------------------------------------------------------------

export type WebToRnEvents = {
  /** A WebView montou e está ouvindo. */
  ready: null;
  /** A rolagem chegou perto do fim: mandar o lote depois de `after`. */
  needMore: { after: number };
  /** Abrir o editor da nota. */
  openEditor: { noteId: string };
  /** Posição de leitura (com espera de 1 s). `offset` em px dentro da unidade. */
  position: { unitIndex: number; offset: number };
  /** Tamanho de fonte escolhido dentro da WebView. */
  setFont: number;
  /** Última cor de grifo usada. */
  setColor: AnnotationColor;
  /** Um lote terminou de entrar no DOM. */
  rendered: { count: number; hasMore: boolean };
  /** Revisar agora / Suspender do menu ⋯. */
  menuAction: { action: ConsultaMenuAction; noteId: string; unitIndex: number };
  /** Grifo apagado no popover (para exibir Snackbar Desfazer no app). */
  annotationDeleted: { annotation: SavedAnnotation; unitIndex: number };
  /** Erro interno da WebView (para log). */
  error: { message: string };
};

export type WebToRnRequests = {
  saveAnnotation: { request: AnnotationInput; response: SavedAnnotation };
  deleteAnnotation: { request: { id: string }; response: { ok: boolean } };
  restoreAnnotation: { request: { id: string }; response: { ok: boolean } };
};

/** Tratadores que o app precisa fornecer para os requests da WebView. */
export type ConsultaRequestHandlers = BridgeRequestHandlers<WebToRnRequests>;
