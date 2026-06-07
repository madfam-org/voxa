'use client';

import type { BoardButton } from '@voxa/core';
import type { SymbolPrediction, TextPrediction } from '@voxa/ai';
import { buttonBorderColor, buttonLabel } from '@/lib/board-utils';

interface PredictionStripProps {
  textPredictions: TextPrediction[];
  symbolPredictions: SymbolPrediction[];
  buttons: BoardButton[];
  onApplyText: (text: string) => void;
  onSelectSymbol: (button: BoardButton) => void;
}

export function PredictionStrip({
  textPredictions,
  symbolPredictions,
  buttons,
  onApplyText,
  onSelectSymbol,
}: PredictionStripProps): React.ReactNode {
  if (textPredictions.length === 0 && symbolPredictions.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="AI predictions"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '8px 16px',
        background: '#111',
        borderBottom: '1px solid #333',
      }}
    >
      <span style={{ color: '#a3a3a3', fontSize: '0.75rem', alignSelf: 'center' }}>Suggest:</span>

      {textPredictions.map((p) => (
        <button
          key={p.text}
          type="button"
          onClick={() => onApplyText(p.text)}
          style={chipStyle}
          title={`Confidence ${Math.round(p.confidence * 100)}%`}
        >
          {p.text}
        </button>
      ))}

      {symbolPredictions.map((p) => {
        const btn = buttons.find((b) => (b.id as string) === p.symbolId);
        if (!btn) return null;
        return (
          <button
            key={p.symbolId}
            type="button"
            onClick={() => onSelectSymbol(btn)}
            style={{ ...chipStyle, borderColor: buttonBorderColor(btn) }}
            title={`Symbol · ${Math.round(p.confidence * 100)}%`}
          >
            ◻ {buttonLabel(btn)}
          </button>
        );
      })}
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  background: '#1a1a1a',
  color: '#f5f5f5',
  border: '2px solid #404040',
  borderRadius: 999,
  padding: '8px 14px',
  minHeight: 38,
  cursor: 'pointer',
  fontSize: '0.875rem',
};
