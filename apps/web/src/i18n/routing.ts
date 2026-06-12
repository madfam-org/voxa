import { defineRouting } from 'next-intl/routing';
import { DEFAULT_UI_LOCALE, UI_LOCALES } from '@voxa/i18n';

export const routing = defineRouting({
  locales: [...UI_LOCALES],
  defaultLocale: DEFAULT_UI_LOCALE,
  localePrefix: 'as-needed',
});
