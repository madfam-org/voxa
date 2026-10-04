'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import {
  CONSENT_CHANGE_EVENT,
  readConsentCache,
  recordConsentChoices,
  type ConsentChoices,
} from '@/lib/consent';
import { neutral } from '@/lib/tokens';

/**
 * The two consent toggles (word suggestions, usage counts), each with a plain
 * statement of what it allows. Shared by the first-run banner and Settings.
 */
export function ConsentToggles({
  value,
  onChange,
  disabled = false,
}: {
  value: ConsentChoices;
  onChange: (next: ConsentChoices) => void;
  disabled?: boolean;
}): React.ReactNode {
  const t = useTranslations('consent');
  const aiId = useId();
  const usageId = useId();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ToggleRow
        id={aiId}
        label={t('aiLabel')}
        help={t('aiHelp')}
        checked={value.aiProcessing}
        disabled={disabled}
        onChange={(checked) => onChange({ ...value, aiProcessing: checked })}
      />
      <ToggleRow
        id={usageId}
        label={t('usageLabel')}
        help={t('usageHelp')}
        checked={value.usageAnalytics}
        disabled={disabled}
        onChange={(checked) => onChange({ ...value, usageAnalytics: checked })}
      />
    </div>
  );
}

function ToggleRow({
  id,
  label,
  help,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}): React.ReactNode {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-help`}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0 }}
      />
      <div>
        <label htmlFor={id} style={{ fontWeight: 600, fontSize: '0.875rem' }}>
          {label}
        </label>
        <p id={`${id}-help`} style={{ margin: '2px 0 0', fontSize: '0.8125rem', lineHeight: 1.45 }}>
          {help}
        </p>
      </div>
    </div>
  );
}

/**
 * Settings section: reads the cached decision, writes changes to the API when
 * signed in (the cache follows the API's answer), or to this device only when
 * signed out. A failed save is shown and the toggles return to the saved state.
 */
export function PrivacySettingsSection({ accessToken }: { accessToken?: string }): React.ReactNode {
  const t = useTranslations('consent');
  const [choices, setChoices] = useState<ConsentChoices>({
    aiProcessing: false,
    usageAnalytics: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const sync = () => {
      const cached = readConsentCache();
      setChoices(cached?.choices ?? { aiProcessing: false, usageAnalytics: false });
    };
    sync();
    window.addEventListener(CONSENT_CHANGE_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, sync);
  }, []);

  async function update(next: ConsentChoices) {
    const previous = choices;
    setChoices(next);
    setSaving(true);
    setError(false);
    try {
      const saved = await recordConsentChoices(accessToken, next);
      setChoices(saved.choices);
    } catch {
      setChoices(previous);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      style={{ borderTop: `1px solid ${neutral.borderSubtle}`, paddingTop: 12, marginTop: 8 }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: '0.9375rem' }}>{t('settingsTitle')}</h3>
      <ConsentToggles value={choices} onChange={(next) => void update(next)} disabled={saving} />
      {!accessToken ? (
        <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: neutral.muted }}>
          {t('signedOutNote')}
        </p>
      ) : null}
      {error ? (
        <p role="alert" style={{ margin: '10px 0 0', fontSize: '0.8125rem' }}>
          {t('saveError')}
        </p>
      ) : null}
    </section>
  );
}
