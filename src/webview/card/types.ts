import type { AnnotationData } from '../shared/anchor';

export type CardSide = 'front' | 'back';
export type ThemeMode = 'light' | 'dark';

export interface CardRenderPayload {
  html: string;
  side: CardSide;
  theme?: ThemeMode;
  css?: string;
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
  | { type: 'linkClick'; payload: { url: string } };

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (data: string) => void;
    };
    __INITIAL_CARD_DATA__?: CardRenderPayload;
  }
}
