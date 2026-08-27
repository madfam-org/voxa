'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SyncEvent } from '@voxa/core';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface BoardAuditPanelProps {
  boardId: string;
  accessToken?: string;
  onClose: () => void;
}

function describeEvent(event: SyncEvent): string {
  const action = event.payload?.action;
  if (event.type === 'board.created') return 'Board created';
  if (action === 'import.obf') return 'Imported OBF vocabulary';
  if (action === 'import.obz') return 'Imported OBZ bundle';
  return `Saved vocabulary (v${event.version})`;
}

export function BoardAuditPanel({
  boardId,
  accessToken,
  onClose,
}: BoardAuditPanelProps): React.ReactNode {
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) {
      setError('Sign in to view the edit audit log.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL.replace(/\/$/, '')}/v1/boards/${encodeURIComponent(boardId)}/audit?limit=40`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Audit load failed (${res.status})`);
      }
      const body = (await res.json()) as { events: SyncEvent[] };
      setEvents(body.events);
    } catch (err) {
      setEvents([]);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [accessToken, boardId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <aside
      role="dialog"
      aria-label="Edit audit log"
      style={{
        width: 320,
        background: '#111',
        color: '#f5f5f5',
        borderLeft: '1px solid #333',
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Edit audit</h2>
        <button type="button" onClick={onClose} style={btnStyle}>
          Close
        </button>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: '#a3a3a3', lineHeight: 1.5 }}>
        Remote SLP edits are recorded when vocabulary is saved, created, or imported.
      </p>

      <button type="button" onClick={() => void load()} disabled={busy} style={{ ...btnStyle, marginBottom: 12 }}>
        {busy ? 'Loading…' : 'Refresh'}
      </button>

      {error ? <p style={{ color: '#f87171', fontSize: '0.8125rem' }}>{error}</p> : null}

      {events.length === 0 && !busy && !error ? (
        <p style={{ fontSize: '0.875rem', color: '#a3a3a3' }}>No edit events yet.</p>
      ) : null}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.map((event) => (
          <li
            key={event.id}
            style={{
              border: '1px solid #333',
              borderRadius: 8,
              padding: '8px 10px',
              background: '#0a0a0a',
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{describeEvent(event)}</div>
            <div style={{ fontSize: '0.75rem', color: '#a3a3a3', marginTop: 4 }}>
              {new Date(event.timestamp).toLocaleString()} · {event.actorUserId}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#262626',
  color: '#fff',
  border: '1px solid #404040',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: '0.8125rem',
};
