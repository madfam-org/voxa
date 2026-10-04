'use client';

import { useTranslations } from 'next-intl';
import type { BoardButton } from '@voxa/core';
import type { SymbolPrediction, TextPrediction } from '@voxa/ai';
import { buttonBorderColor, buttonLabel } from '@/lib/board-utils';
import { neutral, surface } from '@/lib/tokens';

interface PredictionStripProps {
  textPredictions: TextPrediction[];
  symbolPredictions: SymbolPrediction[];
  buttons: BoardButton[];
  onApplyText: (text: string) => void;
  onSelectSymbol: (button: BoardButton) => void;
  /** How a suggestion reads once applied (Spanish agreement); defaults to the text itself. */
  formatText?: (text: string) => string;
}

export function PredictionStrip({
  textPredictions,
  symbolPredictions,
  buttons,
  onApplyText,
  onSelectSymbol,
  formatText = (text) => text,
}: PredictionStripProps): React.ReactNode {
  // Suggestions come from the local rule-based predictor, so the label says
  // "basic suggestions" rather than implying a language model.
  const t = useTranslations('communicator');
  if (textPredictions.length === 0 && symbolPredictions.length === 0) return null;

  return (
    <div
      role="region"
      aria-label={t('suggestionsAria')}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '8px 16px',
        background: surface.section,
        borderBottom: `1px solid ${neutral.borderSubtle}`,
      }}
    >
      <span style={{ color: neutral.muted, fontSize: '0.75rem', alignSelf: 'center' }}>{t('suggestionsLabel')}</span>

      {textPredictions.map((p) => (
        <button
          key={p.text}
          type="button"
          onClick={() => onApplyText(p.text)}
          style={chipStyle}
          title={t('predictionConfidence', { percent: Math.round(p.confidence * 100) })}
        >
          {formatText(p.text)}
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
            title={t('symbolConfidence', { percent: Math.round(p.confidence * 100) })}
          >
            ◻ {buttonLabel(btn)}
          </button>
        );
      })}
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  background: surface.baseHover,
  color: neutral.textSubtle,
  border: `2px solid ${neutral.border}`,
  borderRadius: 999,
  padding: '8px 14px',
  minHeight: 38,
  cursor: 'pointer',
  fontSize: '0.875rem',
};
