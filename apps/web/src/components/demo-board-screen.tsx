'use client';

import { useCallback, useMemo, useState } from 'react';
import { createDemoBoard, type BoardButton } from '@voxa/core';
import { AacButton, BoardGrid, CVI_THEMES } from '@voxa/ui';
import { buttonBorderColor, buttonLabel, buttonSpeech } from '@/lib/board-utils';
import { ConversionGate, type ConversionGateVariant } from '@/components/conversion-gate';
import { SiteFooter, SiteNav } from '@/components/site-chrome';
import Link from 'next/link';

const DEMO_AI_SUGGESTIONS = ['I want more', 'I want go home', 'I need help'];

interface GateConfig {
  variant: ConversionGateVariant;
  title: string;
  body: string;
  id: string;
}

const GATES: Record<string, GateConfig> = {
  firstMessage: {
    id: 'firstMessage',
    variant: 'parent',
    title: 'You just spoke with Voxa',
    body:
      'AAC gives non-speaking and minimally speaking people a voice for everyday needs, relationships, and learning. Create a free parent account to save this board, sync across devices, and personalize vocabulary for your child.',
  },
  aiPredict: {
    id: 'aiPredict',
    variant: 'feature',
    title: 'Finish sentences in one tap',
    body:
      'Signed-in users get AI-assisted word and symbol predictions that learn from recent selections — faster communication with less motor effort. Always free for individual parents.',
  },
  personalize: {
    id: 'personalize',
    variant: 'parent',
    title: 'Personalize for your communicator',
    body:
      'CVI themes, switch scanning, eye-dwell timing, and Fitzgerald color coding — tune the board to how your child actually accesses language. Free accounts include cloud sync and OBF import/export.',
  },
  institution: {
    id: 'institution',
    variant: 'institution',
    title: 'Usage insight for every communicator',
    body:
      'Institutional plans add team roles, unlimited boards, full AI, and high-level usage reports — see engagement by student or patient while protecting individual privacy. Built for schools, clinics, and districts.',
  },
};

export function DemoBoardScreen(): React.ReactNode {
  const board = useMemo(() => createDemoBoard(), []);
  const [utterance, setUtterance] = useState<string[]>([]);
  const [tapCount, setTapCount] = useState(0);
  const [shownGates, setShownGates] = useState<Set<string>>(() => new Set());
  const [activeGate, setActiveGate] = useState<GateConfig | null>(null);

  const sorted = [...board.grid.buttons].sort(
    (a, b) => a.position.row - b.position.row || a.position.column - b.position.column,
  );

  const openGate = useCallback((key: keyof typeof GATES) => {
    const gate = GATES[key];
    if (!gate || shownGates.has(gate.id)) return;
    setShownGates((prev) => new Set(prev).add(gate.id));
    setActiveGate(gate);
  }, [shownGates]);

  const activate = useCallback(
    (btn: BoardButton) => {
      const text = buttonSpeech(btn);
      const nextUtterance = [...utterance, text];
      setUtterance(nextUtterance);
      setTapCount((c) => c + 1);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = btn.locale;
        window.speechSynthesis.speak(u);
      }
      const taps = tapCount + 1;
      if (taps === 2) openGate('firstMessage');
      if (taps === 5) openGate('aiPredict');
    },
    [utterance, tapCount, openGate],
  );

  const speakAll = () => {
    const text = utterance.join(' ');
    if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  const theme = CVI_THEMES['cvi-dark'];

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#fafafa' }}>
      <SiteNav active="demo" />
      <div
        style={{
          padding: '12px 24px',
          background: '#111827',
          borderBottom: '1px solid #1e3a5f',
          fontSize: '0.875rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>
          <strong>Visitor demo</strong> — tap the board below. No account required to try AAC.
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => openGate('personalize')}
            style={chipBtn}
          >
            Personalize (sign in)
          </button>
          <button type="button" onClick={() => openGate('institution')} style={{ ...chipBtn, borderColor: '#ca8a04', color: '#fde68a' }}>
            Institutional plans
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            borderBottom: `1px solid ${theme.buttonBorder}`,
            background: theme.background,
          }}
        >
          <strong>{board.name}</strong>
          <div
            style={{
              flex: 1,
              minWidth: 180,
              minHeight: 44,
              background: '#171717',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: '1.0625rem',
            }}
            aria-live="polite"
          >
            {utterance.length ? utterance.join(' ') : 'Tap buttons to build a message…'}
          </div>
          <button type="button" onClick={speakAll} style={actionBtn}>
            Speak
          </button>
          <button type="button" onClick={() => setUtterance([])} style={actionBtn}>
            Clear
          </button>
        </div>

        <div
          style={{
            padding: '8px 16px',
            background: '#1c1917',
            borderBottom: '1px solid #44403c',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#a8a29e', marginRight: 4 }}>AI predictions (preview)</span>
          {DEMO_AI_SUGGESTIONS.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => openGate('aiPredict')}
              style={{
                ...chipBtn,
                background: '#292524',
                cursor: 'pointer',
              }}
            >
              {text}
            </button>
          ))}
        </div>

        <main style={{ flex: 1, minHeight: 280, display: 'flex' }}>
          <BoardGrid rows={board.grid.rows} columns={board.grid.columns} theme="cvi-dark" targetScale={1}>
            {sorted.map((btn) => (
              <AacButton
                key={btn.id as string}
                label={buttonLabel(btn)}
                borderColor={buttonBorderColor(btn)}
                targetScale={1}
                onClick={() => activate(btn)}
              />
            ))}
          </BoardGrid>
        </main>
      </div>

      <section
        style={{
          padding: '24px',
          background: '#171717',
          borderTop: '1px solid #262626',
          textAlign: 'center',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>Ready to give this voice a home?</h2>
        <p style={{ margin: '0 0 16px', color: '#a3a3a3', maxWidth: 520, marginInline: 'auto' }}>
          Free forever for individual parents. Institutional teams get usage analytics and unlimited boards.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/auth/signin?redirect_to=%2Fapp"
            style={{
              padding: '12px 22px',
              borderRadius: 10,
              background: '#2563eb',
              color: '#fff',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Start free — parents
          </Link>
          <Link href="/#institutions" style={{ padding: '12px 22px', borderRadius: 10, border: '1px solid #525252', color: '#e5e5e5', textDecoration: 'none' }}>
            Schools & clinics
          </Link>
        </div>
      </section>

      <SiteFooter />

      <ConversionGate
        open={activeGate !== null}
        variant={activeGate?.variant ?? 'parent'}
        title={activeGate?.title ?? ''}
        body={activeGate?.body ?? ''}
        onClose={() => setActiveGate(null)}
      />
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 16px',
  fontWeight: 600,
  cursor: 'pointer',
  minHeight: 44,
};

const chipBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #404040',
  borderRadius: 999,
  padding: '6px 14px',
  color: '#e5e5e5',
  fontSize: '0.8125rem',
  cursor: 'pointer',
};
