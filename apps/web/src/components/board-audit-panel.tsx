'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { SyncEvent } from '@voxa/core';
import { neutral, status, surface } from '@/lib/tokens';
import { apiFetch } from '@/lib/api-client';

interface BoardAuditPanelProps {
  boardId: string;
  signedIn: boolean;
  onClose: () => void;
}

type AuditMessageKey = 'eventCreated' | 'eventImportObf' | 'eventImportObz' | 'eventSaved';

function describeEvent(event: SyncEvent): { key: AuditMessageKey; version: number } {
  const action = event.payload?.action;
  if (event.type === 'board.created') return { key: 'eventCreated', version: event.version };
  if (action === 'import.obf') return { key: 'eventImportObf', version: event.version };
  if (action === 'import.obz') return { key: 'eventImportObz', version: event.version };
  return { key: 'eventSaved', version: event.version };
}

export function BoardAuditPanel({
  boardId,
  signedIn,
  onClose,
}: BoardAuditPanelProps): React.ReactNode {
  const t = useTranslations('auditLog');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [events, setEvents] = useState<SyncEvent[]>([]);
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
      const res = await apiFetch(`/v1/boards/${encodeURIComponent(boardId)}/audit?limit=40`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? String(res.status));
      }
      const body = (await res.json()) as { events: SyncEvent[] };
      setEvents(body.events);
    } catch (err) {
      setEvents([]);
      setError(t('loadFailed', { detail: (err as Error).message }));
    } finally {
      setBusy(false);
    }
  }, [signedIn, boardId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <aside
      role="dialog"
      aria-label={t('ariaLabel')}
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
        <button type="button" onClick={onClose} style={btnStyle}>
          {tc('close')}
        </button>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: neutral.muted, lineHeight: 1.5 }}>
        {t('description')}
      </p>

      <button type="button" onClick={() => void load()} disabled={busy} style={{ ...btnStyle, marginBottom: 12 }}>
        {busy ? tc('loading') : t('refresh')}
      </button>

      {error ? <p style={{ color: status.danger, fontSize: '0.8125rem' }}>{error}</p> : null}

      {events.length === 0 && !busy && !error ? (
        <p style={{ fontSize: '0.875rem', color: neutral.muted }}>{t('empty')}</p>
      ) : null}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.map((event) => (
          <li
            key={event.id}
            style={{
              border: `1px solid ${neutral.borderSubtle}`,
              borderRadius: 8,
              padding: '8px 10px',
              background: surface.base,
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{(({ key, version }) => t(key, { version }))(describeEvent(event))}</div>
            <div style={{ fontSize: '0.75rem', color: neutral.muted, marginTop: 4 }}>
              {new Date(event.timestamp).toLocaleString(locale)} · {event.actorUserId}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

const btnStyle: React.CSSProperties = {
  background: surface.overlay,
  color: surface.white,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: '0.8125rem',
};
