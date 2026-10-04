'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import type { SettingsSyncControl, SettingsSyncStatus } from '@/hooks/use-settings-sync';
import { neutral } from '@/lib/tokens';

const STATUS_KEY: Record<SettingsSyncStatus, string> = {
  'signed-out': 'statusSignedOut',
  off: 'statusOff',
  syncing: 'statusSyncing',
  synced: 'statusSynced',
  pending: 'statusPending',
  error: 'statusError',
};

/**
 * Settings section: the opt-in for settings that follow the user between
 * devices (consent `settings_sync`), what it shares, and a short status.
 * Off by default; turning it off stops syncing and deletes the server copy.
 */
export function SettingsSyncSection({ control }: { control: SettingsSyncControl }): React.ReactNode {
  const t = useTranslations('settingsSync');
  const id = useId();
  const { status, enabled, signedIn, busy, consentError, setEnabled } = control;

  return (
    <section
      data-voxa-settings-sync=""
      aria-labelledby={`${id}-title`}
      style={{ borderTop: `1px solid ${neutral.borderSubtle}`, paddingTop: 12, marginTop: 8 }}
    >
      <h3 id={`${id}-title`} style={{ margin: '0 0 8px', fontSize: '0.9375rem' }}>
        {t('title')}
      </h3>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <input
          id={id}
          type="checkbox"
          checked={enabled}
          disabled={!signedIn || busy}
          aria-describedby={`${id}-help`}
          onChange={(e) => void setEnabled(e.target.checked)}
          style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0 }}
        />
        <div>
          <label htmlFor={id} style={{ fontWeight: 600, fontSize: '0.875rem' }}>
            {t('label')}
          </label>
          <p id={`${id}-help`} style={{ margin: '2px 0 0', fontSize: '0.8125rem', lineHeight: 1.45 }}>
            {t('help')}
          </p>
        </div>
      </div>
      <p
        role="status"
        data-voxa-settings-sync-status={status}
        style={{ margin: '10px 0 0', fontSize: '0.75rem', color: neutral.muted }}
      >
        {t(STATUS_KEY[status])}
      </p>
      {consentError ? (
        <p role="alert" style={{ margin: '6px 0 0', fontSize: '0.8125rem' }}>
          {t('saveError')}
        </p>
      ) : null}
    </section>
  );
}
