'use client';

import { useEffect, useState } from 'react';
import { getAiConsent } from '@/components/consent-banner';
import type { Board, BoardButton } from '@voxa/core';
import { stubAiService, type SymbolPrediction, type TextPrediction } from '@voxa/ai';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function fetchPredictions(
  board: Board,
  partialText: string,
  recentButtonIds: string[],
  accessToken?: string,
): Promise<{ text: TextPrediction[]; symbols: SymbolPrediction[] }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Voxa-AI-Consent': 'true',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else {
    headers['X-Voxa-User-Id'] = 'web-user';
    headers['X-Voxa-Role'] = 'communicator';
  }

  const [textRes, symbolRes] = await Promise.all([
    fetch(`${API_URL}/v1/ai/predict/text`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        profileId: board.profileId,
        recentUtterances: [],
        partialText,
        locale: 'en-US',
        maxSuggestions: 3,
      }),
    }),
    fetch(`${API_URL}/v1/ai/predict/symbols`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        profileId: board.profileId,
        recentSymbolIds: recentButtonIds,
        boardButtons: board.grid.buttons,
        maxSuggestions: 3,
      }),
    }),
  ]);

  if (textRes.ok && symbolRes.ok) {
    const textBody = (await textRes.json()) as { predictions: TextPrediction[] };
    const symbolBody = (await symbolRes.json()) as { predictions: SymbolPrediction[] };
    return { text: textBody.predictions, symbols: symbolBody.predictions };
  }

  const [text, symbols] = await Promise.all([
    stubAiService.predictText({
      profileId: board.profileId as string,
      recentUtterances: [],
      partialText,
      locale: 'en-US',
      maxSuggestions: 3,
    }),
    stubAiService.predictSymbols({
      profileId: board.profileId as string,
      recentSymbolIds: recentButtonIds,
      boardButtons: board.grid.buttons,
      maxSuggestions: 3,
    }),
  ]);
  return { text, symbols };
}

export function usePredictions(
  board: Board,
  utterance: string[],
  recentButtonIds: string[],
) {
  const [textPredictions, setTextPredictions] = useState<TextPrediction[]>([]);
  const [symbolPredictions, setSymbolPredictions] = useState<SymbolPrediction[]>([]);

  const partialText = utterance.join(' ');

  useEffect(() => {
    if (!getAiConsent()) {
      setTextPredictions([]);
      setSymbolPredictions([]);
      return;
    }

    let cancelled = false;

    (async () => {
      let accessToken: string | undefined;
      try {
        const sessionRes = await fetch('/api/auth/session');
        if (sessionRes.ok) {
          const session = (await sessionRes.json()) as { accessToken?: string };
          accessToken = session.accessToken;
        }
      } catch {
        /* offline or unauthenticated */
      }

      const { text, symbols } = await fetchPredictions(
        board,
        partialText,
        recentButtonIds,
        accessToken,
      );

      if (!cancelled) {
        setTextPredictions(text);
        setSymbolPredictions(symbols);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [board.profileId, board.grid.buttons, partialText, recentButtonIds]);

  return { textPredictions, symbolPredictions };
}

export function findButtonById(buttons: BoardButton[], symbolId: string): BoardButton | undefined {
  return buttons.find((b) => (b.id as string) === symbolId);
}
