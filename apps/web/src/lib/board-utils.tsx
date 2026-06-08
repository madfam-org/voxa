'use client';

import { useRef } from 'react';
import type { BoardButton, PartOfSpeechTag } from '@voxa/core';
import { resolveButtonSpeech } from '@voxa/core';
import { fitzgeraldColor, resolvePartOfSpeech, type PartOfSpeech } from '@voxa/vocabulary';

export function buttonLabel(btn: BoardButton): string {
  return btn.kind === 'analytic' ? btn.label : btn.phrase;
}

export function buttonSpeech(btn: BoardButton, formIndex?: number): string {
  return resolveButtonSpeech(btn, formIndex);
}

export function buttonSymbolUrl(btn: BoardButton): string | undefined {
  return btn.symbolUrl;
}

export function buttonBorderColor(btn: BoardButton): string {
  const pos = resolvePartOfSpeech(btn);
  return fitzgeraldColor(pos as PartOfSpeech);
}

export function useBoardFileInput(
  onImport: (file: File) => Promise<void>,
  accept: string,
): { open: () => void; input: React.ReactNode } {
  const inputRef = useRef<HTMLInputElement>(null);

  const open = () => inputRef.current?.click();

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      style={{ display: 'none' }}
      onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await onImport(file);
        e.target.value = '';
      }}
    />
  );

  return { open, input };
}

export function useObfFileInput(
  onImport: (raw: string) => Promise<void>,
): { open: () => void; input: React.ReactNode } {
  return useBoardFileInput(async (file) => {
    await onImport(await file.text());
  }, '.obf,.json,application/json');
}

export function useObzFileInput(
  onImport: (archive: ArrayBuffer) => Promise<void>,
): { open: () => void; input: React.ReactNode } {
  return useBoardFileInput(async (file) => {
    await onImport(await file.arrayBuffer());
  }, '.obz,application/zip');
}

export function useGridsetFileInput(
  onImport: (archive: ArrayBuffer) => Promise<void>,
): { open: () => void; input: React.ReactNode } {
  return useBoardFileInput(async (file) => {
    await onImport(await file.arrayBuffer());
  }, '.gridset,application/octet-stream,application/zip');
}

export function downloadTextFile(filename: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  downloadBlobFile(filename, blob);
}

export function downloadBinaryFile(filename: string, content: ArrayBuffer | Uint8Array, mime: string) {
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
  downloadBlobFile(filename, new Blob([bytes.slice()], { type: mime }));
}

function downloadBlobFile(filename: string, blob: Blob) {
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
