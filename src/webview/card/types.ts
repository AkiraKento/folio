import type { AnnotationData } from '../shared/anchor';

export type CardSide = 'front' | 'back';
export type ThemeMode = 'light' | 'dark';

export interface CardRenderPayload {
  html: string;
  side: CardSide;
  theme?: ThemeMode;
  css?: string;
  isBuiltinModel?: boolean;
  executeModelScripts?: boolean;
  cardId?: string;
  noteId?: string;
  fields?: Record<string, string>;
  mediaBasePath?: string;
  cardOrd?: number;
  tags?: string[];
  annotations?: AnnotationData[];
  showHighlights?: boolean;
}

export type CardInboundMessage =
  | { type: 'renderCard'; payload: CardRenderPayload }
  | { type: 'setTheme'; payload: { theme: ThemeMode } };

export type CardOutboundMessage =
  | { type: 'ready' }
  | { type: 'rendered'; payload: { side: CardSide; height: number } }
  | { type: 'error'; payload: { message: string } }
  | { type: 'scriptError'; payload: { message: string } }
  | { type: 'linkClick'; payload: { url: string } }
  | { type: 'updateNoteFields'; payload: { noteId: string; fields: Record<string, string> } }
  | { type: 'pycmd'; payload: { cmd: string } }
  | { type: 'ankiToast'; payload: { message: string } };

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (data: string) => void;
    };
    __INITIAL_CARD_DATA__?: CardRenderPayload;
    onUpdateHook?: Array<() => void>;
    onShownHook?: Array<() => void>;
    pycmd?: (cmd: string) => void;
    bridgeCommand?: (cmd: string) => void;
    __weissLogScriptError?: (err: unknown) => void;
  }
}
