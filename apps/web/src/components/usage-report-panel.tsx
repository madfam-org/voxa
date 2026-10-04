'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { BoardButton } from '@voxa/core';
import { buttonLabel } from '@/lib/board-utils';
import { neutral, status, surface } from '@/lib/tokens';
import { apiFetch } from '@/lib/api-client';

export interface ActivationSummary {
  boardId: string;
  days: number;
  totalActivations: number;
  byButton: Array<{ buttonId: string; count: number }>;
}

interface UsageReportPanelProps {
  boardId: string;
  signedIn: boolean;
  buttons: BoardButton[];
  onClose: () => void;
}

function labelForButton(buttons: BoardButton[], buttonId: string): string {
  const match = buttons.find((btn) => (btn.id as string) === buttonId);
  return match ? buttonLabel(match) : buttonId;
}

export function UsageReportPanel({
  boardId,
  signedIn,
  buttons,
  onClose,
}: UsageReportPanelProps): React.ReactNode {
  const t = useTranslations('usageReport');
  const tc = useTranslations('common');
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<ActivationSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!signedIn) {
      setError(t('signIn'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/v1/events/activations/summary?boardId=${encodeURIComponent(boardId)}&days=${days}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? String(res.status));
      }
      const body = (await res.json()) as { summary: ActivationSummary };
      setSummary(body.summary);
    } catch (err) {
      setSummary(null);
      setError(t('loadFailed', { detail: (err as Error).message }));
    } finally {
      setBusy(false);
    }
  }, [signedIn, boardId, days, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = [...(summary?.byButton ?? [])].sort((a, b) => b.count - a.count);

  return (
    <aside
      role="dialog"
      aria-label={t('title')}
      style={{
        width: 320,
        background: surface.section,
        color: neutral.textSubtle,
        borderLeft: `1px solid ${neutral.borderSubtle}`,
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>{t('title')}</h2>
        <button type="button" onClick={onClose} style={closeBtn}>
          {tc('close')}
        </button>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: neutral.muted, lineHeight: 1.5 }}>
        {t('description')}
      </p>

      <label style={labelStyle}>
        {t('period')}
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={fieldStyle}
        >
          <option value={7}>{t('lastDays', { days: 7 })}</option>
          <option value={14}>{t('lastDays', { days: 14 })}</option>
          <option value={30}>{t('lastDays', { days: 30 })}</option>
        </select>
      </label>

      <button type="button" onClick={() => void load()} disabled={busy} style={{ ...closeBtn, width: '100%', marginBottom: 12 }}>
        {busy ? tc('loading') : t('refresh')}
      </button>

      {error ? <p style={{ color: status.danger, fontSize: '0.875rem' }}>{error}</p> : null}

      {summary ? (
        <>
          <p style={{ margin: '0 0 12px', fontSize: '1.125rem', fontWeight: 700 }}>
            {t('total', { count: summary.totalActivations })}
          </p>
          {rows.length === 0 ? (
            <p style={{ color: neutral.muted, fontSize: '0.875rem' }}>{t('empty')}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th style={thStyle}>{t('button')}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{t('count')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.buttonId}>
                    <td style={tdStyle}>{labelForButton(buttons, row.buttonId)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}
    </aside>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: '0.875rem',
  marginBottom: 12,
};

const fieldStyle: React.CSSProperties = {
  background: surface.base,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  color: neutral.textSubtle,
  padding: '8px 10px',
};

const closeBtn: React.CSSProperties = {
  background: surface.overlay,
  color: surface.white,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  padding: '8px 12px',
  minWidth: 38,
  minHeight: 38,
  cursor: 'pointer',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  borderBottom: `1px solid ${neutral.border}`,
  padding: '6px 4px',
  color: neutral.muted,
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  borderBottom: `1px solid ${surface.overlay}`,
  padding: '8px 4px',
};
