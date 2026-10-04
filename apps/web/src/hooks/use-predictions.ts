'use client';

import { useEffect, useState } from 'react';
import {
  CONSENT_CHANGE_EVENT,
  fetchAccessToken,
  getAiConsent,
  readConsentCache,
  writeConsentCache,
} from '@/lib/consent';
import type { Board, BoardButton } from '@voxa/core';
import { localAiService, type SymbolPrediction, type TextPrediction } from '@voxa/ai';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function localPredictions(
  board: Board,
  partialText: string,
  recentButtonIds: string[],
  contentLocale: string,
): Promise<[TextPrediction[], SymbolPrediction[]]> {
  return Promise.all([
    localAiService.predictText({
      profileId: board.profileId as string,
      recentUtterances: [],
      partialText,
      locale: contentLocale,
      maxSuggestions: 3,
    }),
    localAiService.predictSymbols({
      profileId: board.profileId as string,
      recentSymbolIds: recentButtonIds,
      boardButtons: board.grid.buttons,
      maxSuggestions: 3,
    }),
  ]);
}

/**
 * Suggestions for the message being built. Signed out, they are computed in
 * the browser and nothing is sent. Signed in, the API computes them under the
 * user's server-side `ai_processing` record; a 403 means the record says no,
 * so the cached choice is corrected and no suggestions are shown.
 */
async function fetchPredictions(
  board: Board,
  partialText: string,
  recentButtonIds: string[],
  contentLocale: string,
  accessToken?: string,
): Promise<{ text: TextPrediction[]; symbols: SymbolPrediction[] }> {
  if (!accessToken) {
    const [text, symbols] = await localPredictions(board, partialText, recentButtonIds, contentLocale);
    return { text, symbols };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  const [textRes, symbolRes] = await Promise.all([
    fetch(`${API_URL}/v1/ai/predict/text`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        profileId: board.profileId,
        recentUtterances: [],
        partialText,
        locale: contentLocale,
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

  if (textRes.status === 403 || symbolRes.status === 403) {
    const cached = readConsentCache();
    if (cached?.choices.aiProcessing) {
      writeConsentCache({ ...cached, choices: { ...cached.choices, aiProcessing: false } });
    }
    return { text: [], symbols: [] };
  }

  const [text, symbols] = await localPredictions(board, partialText, recentButtonIds, contentLocale);
  return { text, symbols };
}

export function usePredictions(
  board: Board,
  utterance: string[],
  recentButtonIds: string[],
  contentLocale = 'es-MX',
) {
  const [textPredictions, setTextPredictions] = useState<TextPrediction[]>([]);
  const [symbolPredictions, setSymbolPredictions] = useState<SymbolPrediction[]>([]);

  const partialText = utterance.join(' ');
  const [consentRevision, setConsentRevision] = useState(0);

  useEffect(() => {
    const bump = () => setConsentRevision((n) => n + 1);
    window.addEventListener(CONSENT_CHANGE_EVENT, bump);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, bump);
  }, []);

  useEffect(() => {
    if (!getAiConsent()) {
      setTextPredictions([]);
      setSymbolPredictions([]);
      return;
    }

    let cancelled = false;

    (async () => {
      const accessToken = await fetchAccessToken();

      const { text, symbols } = await fetchPredictions(
        board,
        partialText,
        recentButtonIds,
        contentLocale,
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
  }, [board.profileId, board.grid.buttons, partialText, recentButtonIds, contentLocale, consentRevision]);

  return { textPredictions, symbolPredictions };
}

export function findButtonById(buttons: BoardButton[], symbolId: string): BoardButton | undefined {
  return buttons.find((b) => (b.id as string) === symbolId);
}
