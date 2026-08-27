'use client';

import { useCallback, useRef, useState } from 'react';
import type { ArasaacSkinTone, SymbolRef } from '@voxa/core';
import { ARASAAC_SKIN_TONE_OPTIONS, isPersonPictogram } from '@voxa/symbols';
import { uploadBoardMedia } from '@/lib/upload-media';
import { brand, neutral, status, surface } from '@/lib/tokens';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface SymbolHit {
  id: number;
  keyword: string;
  imageUrl: string;
  source: 'arasaac';
  tags: string[];
}

export interface SymbolSelection {
  imageUrl: string;
  symbolRef?: SymbolRef;
}

interface SymbolSearchPanelProps {
  boardId: string;
  accessToken?: string;
  contentLocale?: string;
  currentUrl?: string;
  defaultSkinTone?: ArasaacSkinTone;
  disabled?: boolean;
  onSelect: (selection: SymbolSelection) => void;
  onClear: () => void;
}

export function SymbolSearchPanel({
  boardId,
  accessToken,
  contentLocale = 'es-MX',
  currentUrl,
  defaultSkinTone = 'white',
  disabled,
  onSelect,
  onClear,
}: SymbolSearchPanelProps): React.ReactNode {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolHit[]>([]);
  const [attribution, setAttribution] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingHit, setPendingHit] = useState<SymbolHit | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const applyHit = useCallback(
    (hit: SymbolHit, skinTone?: ArasaacSkinTone) => {
      const symbolRef: SymbolRef = {
        provider: 'arasaac',
        pictogramId: hit.id,
        ...(skinTone ? { skinTone } : {}),
      };
      onSelect({ imageUrl: hit.imageUrl, symbolRef });
      setPendingHit(null);
      setResults([]);
    },
    [onSelect],
  );

  const search = useCallback(async () => {
    if (query.trim().length < 2) return;
    setBusy(true);
    setError(null);
    setPendingHit(null);
    try {
      const headers: Record<string, string> = { 'X-Voxa-Role': 'editor' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch(
        `${API_URL.replace(/\/$/, '')}/v1/symbols/search?q=${encodeURIComponent(query.trim())}&locale=${encodeURIComponent(contentLocale.split('-')[0] ?? 'es')}`,
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
  }, [accessToken, contentLocale, query]);

  const uploadPhoto = useCallback(
    async (file: File) => {
      if (!accessToken) {
        setError('Sign in to upload a custom photo.');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const uploaded = await uploadBoardMedia(accessToken, boardId, file, file.name);
        onSelect({ imageUrl: uploaded.url });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accessToken, boardId, onSelect],
  );

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600 }}>Symbol</p>

      {currentUrl ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <img
            src={currentUrl}
            alt=""
            style={{ width: 48, height: 48, objectFit: 'contain', background: surface.base, borderRadius: 6 }}
          />
          <button type="button" onClick={onClear} disabled={disabled} style={smallBtn}>
            Remove symbol
          </button>
        </div>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        <p style={{ margin: '0 0 6px', fontSize: '0.8125rem', color: neutral.muted }}>Custom photo</p>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: 'none' }}
          disabled={disabled || busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await uploadPhoto(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={disabled || busy}
          style={{ ...smallBtn, width: '100%' }}
          onClick={() => photoInputRef.current?.click()}
        >
          {busy ? 'Uploading…' : 'Upload photo (JPEG, PNG, WebP)'}
        </button>
      </div>

      <p style={{ margin: '0 0 6px', fontSize: '0.8125rem', color: neutral.muted }}>ARASAAC library</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          style={{ ...fieldStyle, flex: 1 }}
          value={query}
          placeholder="Search symbols…"
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void search();
          }}
        />
        <button type="button" onClick={() => void search()} disabled={busy || disabled} style={smallBtn}>
          {busy ? '…' : 'Search'}
        </button>
      </div>

      {error ? <p style={{ color: status.danger, fontSize: '0.8125rem' }}>{error}</p> : null}

      {pendingHit ? (
        <div style={{ marginBottom: 12, padding: 10, border: `1px solid ${neutral.border}`, borderRadius: 8 }}>
          <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', color: neutral.textSecondary }}>
            Choose skin tone for <strong>{pendingHit.keyword}</strong>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ARASAAC_SKIN_TONE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                onClick={() => applyHit(pendingHit, option.value)}
                style={smallBtn}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              disabled={disabled}
              onClick={() => applyHit(pendingHit, defaultSkinTone)}
              style={{ ...smallBtn, borderColor: brand.primary }}
            >
              Profile default
            </button>
            <button type="button" disabled={disabled} onClick={() => setPendingHit(null)} style={smallBtn}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

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
              disabled={disabled}
              onClick={() => {
                if (isPersonPictogram(hit.tags)) {
                  setPendingHit(hit);
                  return;
                }
                applyHit(hit);
              }}
              style={{
                border: `1px solid ${neutral.border}`,
                borderRadius: 6,
                background: surface.base,
                padding: 4,
                cursor: disabled ? 'not-allowed' : 'pointer',
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
        <p style={{ margin: '8px 0 0', fontSize: '0.6875rem', color: neutral.muted, lineHeight: 1.4 }}>
          {attribution}
        </p>
      ) : null}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  background: surface.base,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  color: neutral.textSubtle,
  padding: '8px 10px',
};

const smallBtn: React.CSSProperties = {
  background: surface.overlay,
  color: surface.white,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: '0.8125rem',
};
