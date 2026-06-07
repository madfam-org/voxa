'use client';

import { useCallback, useState } from 'react';
import {
  createBoardId,
  createButtonId,
  createProfileId,
  type Board,
  type BoardButton,
} from '@voxa/core';
import { fitzgeraldColor } from '@voxa/vocabulary';
import { AacButton, BoardGrid } from '@voxa/ui';

const DEMO_BOARD: Board = {
  id: createBoardId('demo-core'),
  name: 'Core 47 Starter',
  profileId: createProfileId('demo-user'),
  version: 1,
  updatedAt: new Date().toISOString(),
  grid: {
    rows: 3,
    columns: 4,
    buttons: demoButtons(),
  },
};

function demoButtons(): BoardButton[] {
  const core: Array<{
    id: string;
    label: string;
    speech: string;
    pos: 'pronoun' | 'verb' | 'noun' | 'preposition';
    row: number;
    col: number;
    locked: boolean;
  }> = [
    { id: 'i', label: 'I', speech: 'I', pos: 'pronoun', row: 0, col: 0, locked: true },
    { id: 'want', label: 'want', speech: 'want', pos: 'verb', row: 0, col: 1, locked: true },
    { id: 'go', label: 'go', speech: 'go', pos: 'verb', row: 0, col: 2, locked: true },
    { id: 'more', label: 'more', speech: 'more', pos: 'preposition', row: 0, col: 3, locked: true },
    { id: 'help', label: 'help', speech: 'help me', pos: 'verb', row: 1, col: 0, locked: true },
    { id: 'stop', label: 'stop', speech: 'stop', pos: 'verb', row: 1, col: 1, locked: true },
    { id: 'eat', label: 'eat', speech: 'eat', pos: 'verb', row: 1, col: 2, locked: false },
    { id: 'drink', label: 'drink', speech: 'drink', pos: 'verb', row: 1, col: 3, locked: false },
    {
      id: 'glp-yay',
      label: 'Yay!',
      speech: 'Yay!',
      pos: 'preposition',
      row: 2,
      col: 0,
      locked: false,
    },
    { id: 'home', label: 'home', speech: 'home', pos: 'noun', row: 2, col: 1, locked: false },
    { id: 'school', label: 'school', speech: 'school', pos: 'noun', row: 2, col: 2, locked: false },
    { id: 'friend', label: 'friend', speech: 'friend', pos: 'noun', row: 2, col: 3, locked: false },
  ];

  return core.map((item) => ({
    kind: item.id === 'glp-yay' ? ('glp' as const) : ('analytic' as const),
    id: createButtonId(item.id),
    ...(item.id === 'glp-yay'
      ? { phrase: item.speech, intonationNotes: 'High pitch, elongated vowel' }
      : { label: item.label, speechText: item.speech }),
    locale: 'en-US',
    position: { row: item.row, column: item.col },
    locked: item.locked,
    borderColor: fitzgeraldColor(item.pos),
  })) as BoardButton[];
}

function buttonLabel(btn: BoardButton): string {
  return btn.kind === 'analytic' ? btn.label : btn.phrase;
}

function buttonSpeech(btn: BoardButton): string {
  return btn.kind === 'analytic' ? btn.speechText : btn.phrase;
}

export function BoardScreen() {
  const [utterance, setUtterance] = useState<string[]>([]);
  const board = DEMO_BOARD;

  const activate = useCallback((btn: BoardButton) => {
    const text = buttonSpeech(btn);
    setUtterance((prev) => [...prev, text]);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = btn.locale;
      window.speechSynthesis.speak(u);
    }
  }, []);

  const speakAll = useCallback(() => {
    const text = utterance.join(' ');
    if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(u);
  }, [utterance]);

  const clear = () => setUtterance([]);

  const sorted = [...board.grid.buttons].sort(
    (a, b) => a.position.row - b.position.row || a.position.column - b.position.column,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <header
        style={{
          padding: '12px 16px',
          background: '#0a0a0a',
          color: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ fontSize: '1.125rem' }}>Voxa</strong>
        <span style={{ opacity: 0.7, fontSize: '0.875rem' }}>{board.name}</span>
        <div style={{ flex: 1, minHeight: 40, background: '#171717', borderRadius: 8, padding: '8px 12px' }}>
          {utterance.length ? utterance.join(' ') : 'Tap buttons to build a message…'}
        </div>
        <button type="button" onClick={speakAll} style={headerBtn}>
          Speak
        </button>
        <button type="button" onClick={clear} style={headerBtn}>
          Clear
        </button>
      </header>

      <main style={{ flex: 1, minHeight: 0 }}>
        <BoardGrid rows={board.grid.rows} columns={board.grid.columns} theme="cvi-dark" targetScale={1.2}>
          {sorted.map((btn) => (
            <AacButton
              key={btn.id as string}
              label={buttonLabel(btn)}
              borderColor={(btn as BoardButton & { borderColor?: string }).borderColor}
              targetScale={1.2}
              onClick={() => activate(btn)}
            />
          ))}
        </BoardGrid>
      </main>
    </div>
  );
}

const headerBtn: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 16px',
  minWidth: 38,
  minHeight: 38,
  cursor: 'pointer',
  fontWeight: 600,
};
