'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SymbolRef } from '@voxa/core';
import { MULBERRY_LICENSE_URL, MULBERRY_SITE_URL } from '@voxa/symbols';
import { Link } from '@/i18n/navigation';
import { uploadBoardMedia } from '@/lib/upload-media';
import { brand, neutral, status, surface } from '@/lib/tokens';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** One hit from `GET /v1/symbols/search` (vendored Mulberry Symbols, CC BY-SA 4.0). */
export interface SymbolHit {
  id: string;
  keyword: string;
  imageUrl: string;
  source: 'mulberry';
  file: string;
  category: string;
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
  /** The button had a symbol Voxa no longer shows; ask for a replacement. */
  symbolUnavailable?: boolean;
  disabled?: boolean;
  onSelect: (selection: SymbolSelection) => void;
  onClear: () => void;
}

export function SymbolSearchPanel({
  boardId,
  accessToken,
  contentLocale = 'es-MX',
  currentUrl,
  symbolUnavailable = false,
  disabled,
  onSelect,
  onClear,
}: SymbolSearchPanelProps): React.ReactNode {
  const t = useTranslations('symbols');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const applyHit = useCallback(
    (hit: SymbolHit) => {
      const symbolRef: SymbolRef = { provider: 'mulberry', slug: hit.id, file: hit.file };
      onSelect({ imageUrl: hit.imageUrl, symbolRef });
      setResults([]);
      setSearched(false);
    },
    [onSelect],
  );

  const search = useCallback(async () => {
    if (query.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      // Signed in: the bearer token alone. Development identity headers are
      // only for local API runs (VOXA_DEV_AUTH) and are not CORS-allowed in production.
      const headers: Record<string, string> = accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : { 'X-Voxa-Role': 'editor' };
      const language = contentLocale.split('-')[0] ?? 'es';
      const res = await fetch(
        `${API_URL.replace(/\/$/, '')}/v1/symbols/search?q=${encodeURIComponent(query.trim())}&locale=${encodeURIComponent(language)}&limit=18`,
        { headers },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? t('searchFailed', { status: res.status }));
      }
      const body = (await res.json()) as { symbols: SymbolHit[] };
      setResults(body.symbols);
      setSearched(true);
    } catch (err) {
      setResults([]);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [accessToken, contentLocale, query, t]);

  const uploadPhoto = useCallback(
    async (file: File) => {
      if (!accessToken) {
        setError(t('signInToUpload'));
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
    [accessToken, boardId, onSelect, t],
  );

  const creditLink = { color: 'inherit', textDecoration: 'underline' } as const;

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600 }}>{t('heading')}</p>

      {symbolUnavailable && !currentUrl ? (
        <p
          role="status"
          data-voxa-symbol-unavailable
          style={{
            margin: '0 0 8px',
            padding: '6px 8px',
            border: `1px solid ${status.danger}`,
            borderRadius: 6,
            fontSize: '0.8125rem',
          }}
        >
          {t('unavailable')}
        </p>
      ) : null}

      {currentUrl ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <img
            src={currentUrl}
            alt=""
            style={{ width: 48, height: 48, objectFit: 'contain', background: surface.base, borderRadius: 6 }}
          />
          <button type="button" onClick={onClear} disabled={disabled} style={smallBtn}>
            {t('remove')}
          </button>
        </div>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        <p style={{ margin: '0 0 6px', fontSize: '0.8125rem', color: neutral.muted }}>{t('customPhoto')}</p>
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
          {busy ? t('uploading') : t('upload')}
        </button>
      </div>

      <p style={{ margin: '0 0 6px', fontSize: '0.8125rem', color: neutral.muted }}>{t('library')}</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          style={{ ...fieldStyle, flex: 1, minWidth: 0 }}
          value={query}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void search();
          }}
        />
        <button type="button" onClick={() => void search()} disabled={busy || disabled} style={smallBtn}>
          {busy ? '…' : t('search')}
        </button>
      </div>

      {error ? <p style={{ color: status.danger, fontSize: '0.8125rem' }}>{error}</p> : null}

      {searched && results.length === 0 && !error ? (
        <p style={{ fontSize: '0.8125rem', color: neutral.muted }}>{t('noResults')}</p>
      ) : null}

      {results.length > 0 ? (
        <div
          data-voxa-symbol-results
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {results.map((hit) => (
            <button
              key={hit.id}
              type="button"
              title={hit.keyword}
              disabled={disabled}
              onClick={() => applyHit(hit)}
              style={{
                border: `1px solid ${neutral.border}`,
                borderRadius: 6,
                background: surface.white,
                padding: 4,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <img src={hit.imageUrl} alt={hit.keyword} style={{ width: '100%', height: 56, objectFit: 'contain' }} />
              <span style={{ display: 'block', fontSize: '0.6875rem', color: neutral.textSecondary }}>{hit.keyword}</span>
            </button>
          ))}
        </div>
      ) : null}

      <p
        data-voxa-symbol-credit="mulberry"
        style={{ margin: '8px 0 0', fontSize: '0.6875rem', color: neutral.muted, lineHeight: 1.4 }}
      >
        {t.rich('credit', {
          symbols: (chunks) => (
            <a href={MULBERRY_SITE_URL} target="_blank" rel="noopener noreferrer" style={creditLink}>
              {chunks}
            </a>
          ),
          license: (chunks) => (
            <a href={MULBERRY_LICENSE_URL} target="_blank" rel="noopener noreferrer license" style={creditLink}>
              {chunks}
            </a>
          ),
          credits: (chunks) => (
            <Link href="/legal/symbols" style={{ ...creditLink, color: brand.link }}>
              {chunks}
            </Link>
          ),
        })}
      </p>
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
