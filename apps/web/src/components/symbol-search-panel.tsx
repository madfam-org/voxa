'use client';

import { useCallback, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface SymbolHit {
  id: number;
  keyword: string;
  imageUrl: string;
  source: 'arasaac';
  tags: string[];
}

interface SymbolSearchPanelProps {
  accessToken?: string;
  currentUrl?: string;
  onSelect: (imageUrl: string) => void;
  onClear: () => void;
}

export function SymbolSearchPanel({
  accessToken,
  currentUrl,
  onSelect,
  onClear,
}: SymbolSearchPanelProps): React.ReactNode {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolHit[]>([]);
  const [attribution, setAttribution] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    if (query.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'X-Voxa-Role': 'editor' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch(
        `${API_URL.replace(/\/$/, '')}/v1/symbols/search?q=${encodeURIComponent(query.trim())}&locale=en`,
        { headers },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Search failed (${res.status})`);
      }
      const body = (await res.json()) as { symbols: SymbolHit[]; attribution?: string };
      setResults(body.symbols);
      setAttribution(body.attribution ?? null);
    } catch (err) {
      setResults([]);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [accessToken, query]);

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600 }}>Symbol (ARASAAC)</p>

      {currentUrl ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <img
            src={currentUrl}
            alt=""
            style={{ width: 48, height: 48, objectFit: 'contain', background: '#0a0a0a', borderRadius: 6 }}
          />
          <button type="button" onClick={onClear} style={smallBtn}>
            Remove symbol
          </button>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          style={{ ...fieldStyle, flex: 1 }}
          value={query}
          placeholder="Search symbols…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void search();
          }}
        />
        <button type="button" onClick={() => void search()} disabled={busy} style={smallBtn}>
          {busy ? '…' : 'Search'}
        </button>
      </div>

      {error ? <p style={{ color: '#f87171', fontSize: '0.8125rem' }}>{error}</p> : null}

      {results.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            maxHeight: 180,
            overflowY: 'auto',
          }}
        >
          {results.map((hit) => (
            <button
              key={hit.id}
              type="button"
              title={hit.keyword}
              onClick={() => onSelect(hit.imageUrl)}
              style={{
                border: '1px solid #404040',
                borderRadius: 6,
                background: '#0a0a0a',
                padding: 4,
                cursor: 'pointer',
              }}
            >
              <img
                src={hit.imageUrl}
                alt={hit.keyword}
                style={{ width: '100%', height: 56, objectFit: 'contain' }}
              />
            </button>
          ))}
        </div>
      ) : null}

      {attribution ? (
        <p style={{ margin: '8px 0 0', fontSize: '0.6875rem', color: '#a3a3a3', lineHeight: 1.4 }}>
          {attribution}
        </p>
      ) : null}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #404040',
  borderRadius: 6,
  color: '#f5f5f5',
  padding: '8px 10px',
};

const smallBtn: React.CSSProperties = {
  background: '#262626',
  color: '#fff',
  border: '1px solid #404040',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: '0.8125rem',
};
