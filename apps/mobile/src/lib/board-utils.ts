import Constants from 'expo-constants';

export const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'http://localhost:4000';

export function buttonLabel(btn: { kind: string; label?: string; phrase?: string }): string {
  return btn.kind === 'analytic' ? (btn.label ?? '') : (btn.phrase ?? '');
}

export function buttonSpeech(btn: {
  kind: string;
  speechText?: string;
  phrase?: string;
}): string {
  return btn.kind === 'analytic' ? (btn.speechText ?? '') : (btn.phrase ?? '');
}
