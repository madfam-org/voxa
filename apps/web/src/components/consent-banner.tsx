'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ConsentToggles } from '@/components/consent-choices';
import {
  decisionFromServer,
  fetchAccessToken,
  fetchServerConsents,
  readConsentCache,
  recordConsentChoices,
  writeConsentCache,
  type ConsentChoices,
} from '@/lib/consent';
import { brand, neutral, surface } from '@/lib/tokens';

/**
 * First-run privacy choices. Shown only while nothing is decided: for a
 * signed-in user that means the API holds no record for the two purposes; for
 * a signed-out visitor, that this device holds no choice. Until a choice is
 * made, nothing is sent (no suggestions requested, no usage recorded).
 */
export function ConsentBanner(): React.ReactNode {
  const t = useTranslations('consent');
  const [visible, setVisible] = useState(false);
  const [accessToken, setAccessToken] = useState<string | undefined>();
  const [draft, setDraft] = useState<ConsentChoices>({
    aiProcessing: false,
    usageAnalytics: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = readConsentCache();
      const token = await fetchAccessToken();
      if (cancelled) return;
      if (token) {
        const view = await fetchServerConsents(token);
        if (cancelled) return;
        if (view) {
          const decision = decisionFromServer(view);
          if (decision.decided) {
            writeConsentCache({
              choices: decision.choices,
              utteranceText: decision.utteranceText,
              source: 'server',
              decidedAt: new Date().toISOString(),
            });
            return;
          }
          // Signed in but undecided on the server: ask, starting from any
          // choice made on this device.
          setAccessToken(token);
          setDraft(cached?.choices ?? { aiProcessing: false, usageAnalytics: false });
          setVisible(true);
          return;
        }
        // The API cannot be reached: the offline cache decides.
        if (cached) return;
        setAccessToken(token);
        setVisible(true);
        return;
      }
      if (cached) return;
      setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  async function save(choices: ConsentChoices) {
    setSaving(true);
    setError(false);
    try {
      await recordConsentChoices(accessToken, choices);
      setVisible(false);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label={t('ariaLabel')}
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 560,
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto',
        margin: '0 auto',
        padding: 16,
        borderRadius: 12,
        background: surface.raised,
        color: neutral.text,
        border: `1px solid ${neutral.border}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        zIndex: 1000,
      }}
    >
      <h2 style={{ margin: '0 0 6px', fontSize: '1rem' }}>{t('title')}</h2>
      <p style={{ margin: '0 0 12px', fontSize: '0.875rem', lineHeight: 1.5 }}>
        {t('intro')}{' '}
        <Link href="/legal/privacy" style={{ color: brand.link }}>
          {t('privacyLink')}
        </Link>
        .
      </p>
      <ConsentToggles value={draft} onChange={setDraft} disabled={saving} />
      {error ? (
        <p role="alert" style={{ margin: '12px 0 0', fontSize: '0.8125rem' }}>
          {t('saveError')}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <button type="button" onClick={() => void save(draft)} disabled={saving} style={primaryBtn}>
          {t('save')}
        </button>
        <button
          type="button"
          onClick={() => void save({ aiProcessing: false, usageAnalytics: false })}
          disabled={saving}
          style={secondaryBtn}
        >
          {t('essential')}
        </button>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  background: brand.primary,
  color: surface.white,
  border: 'none',
  borderRadius: 8,
  padding: '8px 14px',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  background: surface.overlay,
  color: neutral.text,
  border: `1px solid ${neutral.border}`,
  borderRadius: 8,
  padding: '8px 14px',
  cursor: 'pointer',
};
