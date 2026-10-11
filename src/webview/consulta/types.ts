import type { AnnotationData } from '../shared/anchor';
import type { ConsultaInitPayload } from './protocol';

export type ConsultaTheme = 'light' | 'dark';

export interface ConsultaUnitWeb {
  index: number;
  noteId: string;
  groupKey?: string | null;
  deckPath: string;
  frontHtml: string;
  backHtml: string;
  tags: string[];
  suspended: boolean;
  annotations: AnnotationData[];
}

export type UnitMenuAction = 'edit' | 'review' | 'toggleSuspend';

/**
 * Dados injetados antes do carregamento do DOM (primeira pintura sem esperar
 * a ponte): o mesmo `init` do §8 mais o primeiro lote.
 */
export interface ConsultaInitialData extends ConsultaInitPayload {
  units: ConsultaUnitWeb[];
  hasMore: boolean;
  initialPosition?: { unitIndex: number; offset?: number };
}

// As mensagens trocadas com o React Native estão tipadas em ./protocol.ts.

declare global {
  interface Window {
    __INITIAL_CONSULTA_DATA__?: ConsultaInitialData;
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}
