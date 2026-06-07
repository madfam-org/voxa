'use client';

import { useEffect, useState } from 'react';
import type { Board, BoardButton } from '@voxa/core';
import { stubAiService, type SymbolPrediction, type TextPrediction } from '@voxa/ai';

export function usePredictions(
  board: Board,
  utterance: string[],
  recentButtonIds: string[],
) {
  const [textPredictions, setTextPredictions] = useState<TextPrediction[]>([]);
  const [symbolPredictions, setSymbolPredictions] = useState<SymbolPrediction[]>([]);

  const partialText = utterance.join(' ');

  useEffect(() => {
    let cancelled = false;

    (async () => {
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
