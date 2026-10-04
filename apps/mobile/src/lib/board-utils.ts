import Constants from 'expo-constants';
import { resolveButtonSpeech, type BoardButton } from '@voxa/core';

export const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'http://localhost:4000';

/** Web host that serves the vendored symbol SVGs under `/symbols/mulberry/`. */
export const WEB_URL =
  (Constants.expoConfig?.extra as { webUrl?: string } | undefined)?.webUrl ??
  'http://localhost:3000';

export function buttonLabel(btn: BoardButton): string {
  return btn.kind === 'analytic' ? btn.label : btn.phrase;
}

export function buttonSpeech(btn: BoardButton, formIndex?: number): string {
  return resolveButtonSpeech(btn, formIndex);
}
