/** UI locales — Spanish first (default). */
export const UI_LOCALES = ['es', 'en', 'fr'] as const;
export type UiLocale = (typeof UI_LOCALES)[number];
export const DEFAULT_UI_LOCALE: UiLocale = 'es';

/** BCP-47 content locales for AAC buttons, TTS, and symbol search. */
export type ContentLocale = 'es-MX' | 'en-US' | 'fr-FR';

export const CONTENT_LOCALE_BY_UI: Record<UiLocale, ContentLocale> = {
  es: 'es-MX',
  en: 'en-US',
  fr: 'fr-FR',
};

export const UI_LOCALE_LABELS: Record<UiLocale, Record<UiLocale, string>> = {
  es: { es: 'Español', en: 'Inglés', fr: 'Francés' },
  en: { es: 'Spanish', en: 'English', fr: 'French' },
  fr: { es: 'Espagnol', en: 'Anglais', fr: 'Français' },
};

export function isUiLocale(value: string): value is UiLocale {
  return (UI_LOCALES as readonly string[]).includes(value);
}

export function contentLocaleForUi(uiLocale: UiLocale): ContentLocale {
  return CONTENT_LOCALE_BY_UI[uiLocale];
}
