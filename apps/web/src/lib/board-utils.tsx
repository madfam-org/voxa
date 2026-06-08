'use client';

import { useRef } from 'react';
import type { BoardButton, PartOfSpeechTag } from '@voxa/core';
import { fitzgeraldColor, type PartOfSpeech } from '@voxa/vocabulary';

export function buttonLabel(btn: BoardButton): string {
  return btn.kind === 'analytic' ? btn.label : btn.phrase;
}

export function buttonSpeech(btn: BoardButton): string {
  return btn.kind === 'analytic' ? btn.speechText : btn.phrase;
}

export function buttonSymbolUrl(btn: BoardButton): string | undefined {
  return btn.symbolUrl;
}

export function buttonBorderColor(btn: BoardButton): string {
  if (!btn.partOfSpeech) return '#cbd5e1';
  return fitzgeraldColor(btn.partOfSpeech as PartOfSpeech);
}

export function useObfFileInput(
  onImport: (raw: string) => Promise<void>,
): { open: () => void; input: React.ReactNode } {
  const inputRef = useRef<HTMLInputElement>(null);

  const open = () => inputRef.current?.click();

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".obf,.json,application/json"
      style={{ display: 'none' }}
      onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const raw = await file.text();
        await onImport(raw);
        e.target.value = '';
      }}
    />
  );

  return { open, input };
}

export function downloadTextFile(filename: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function posOptions(): PartOfSpeechTag[] {
  return ['pronoun', 'verb', 'noun', 'adjective', 'preposition', 'conjunction'];
}
