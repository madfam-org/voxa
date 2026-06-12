import { getRequestConfig } from 'next-intl/server';
import en from '@voxa/i18n/messages/en';
import es from '@voxa/i18n/messages/es';
import fr from '@voxa/i18n/messages/fr';
import { isUiLocale } from '@voxa/i18n';
import { routing } from './routing';

const messagesByLocale = { es, en, fr } as const;

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  const resolved = isUiLocale(locale) ? locale : routing.defaultLocale;

  return {
    locale: resolved,
    messages: messagesByLocale[resolved],
  };
});
