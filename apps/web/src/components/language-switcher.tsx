'use client';

import { useLocale, useTranslations } from 'next-intl';
import { UI_LOCALES, type UiLocale } from '@voxa/i18n';
import { usePathname, useRouter } from '@/i18n/navigation';
import { neutral, surface } from '@/lib/tokens';

const selectStyle: React.CSSProperties = {
  background: surface.raised,
  color: neutral.text,
  border: `1px solid ${neutral.border}`,
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
};

export function LanguageSwitcher({ compact = false }: { compact?: boolean }): React.ReactNode {
  const locale = useLocale() as UiLocale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('language');

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 6 : 8,
        color: neutral.textSecondary,
        fontSize: '0.8125rem',
      }}
    >
      {!compact ? <span>{t('label')}</span> : null}
      <select
        aria-label={t('label')}
        value={locale}
        onChange={(event) => {
          router.replace(pathname, { locale: event.target.value as UiLocale });
        }}
        style={selectStyle}
      >
        {UI_LOCALES.map((code) => (
          <option key={code} value={code}>
            {t(code)}
          </option>
        ))}
      </select>
    </label>
  );
}
