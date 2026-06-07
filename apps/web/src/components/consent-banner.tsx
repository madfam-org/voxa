'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const CONSENT_KEY = 'voxa-ai-consent';

export function getAiConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(CONSENT_KEY) === 'granted';
}

export function ConsentBanner(): React.ReactNode {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(CONSENT_KEY)) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'granted');
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, 'denied');
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Privacy choices"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 520,
        margin: '0 auto',
        padding: 16,
        borderRadius: 12,
        background: '#171717',
        color: '#fafafa',
        border: '1px solid #404040',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        zIndex: 1000,
      }}
    >
      <p style={{ margin: '0 0 12px', fontSize: '0.875rem', lineHeight: 1.5 }}>
        Voxa can use recent utterances to improve AI predictions. This is optional and stays on
        MADFAM infrastructure. See our{' '}
        <Link href="/legal/privacy" style={{ color: '#93c5fd' }}>
          Privacy Policy
        </Link>
        .
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={accept} style={primaryBtn}>
          Allow predictions
        </button>
        <button type="button" onClick={decline} style={secondaryBtn}>
          Essential only
        </button>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 14px',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  background: '#262626',
  color: '#fafafa',
  border: '1px solid #404040',
  borderRadius: 8,
  padding: '8px 14px',
  cursor: 'pointer',
};
