import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { targetSizePx } from './index.js';

export type AacButtonPresentation = 'default' | 'symbol-forward';

export interface AacButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  symbolUrl?: string;
  borderColor?: string;
  fillColor?: string;
  targetScale?: number;
  presentation?: AacButtonPresentation;
  dwellProgress?: number;
  scanHighlighted?: boolean;
  scanGroupHighlighted?: boolean;
  hideSymbol?: boolean;
  hideLabel?: boolean;
  children?: ReactNode;
}

/**
 * WCAG 2.2 compliant AAC grid button — minimum 1 cm touch target.
 */
export function AacButton({
  label,
  symbolUrl,
  borderColor = '#cbd5e1',
  fillColor,
  targetScale = 1,
  presentation = 'default',
  dwellProgress,
  scanHighlighted = false,
  scanGroupHighlighted = false,
  hideSymbol = false,
  hideLabel = false,
  className,
  style,
  children,
  ...rest
}: AacButtonProps) {
  const size = targetSizePx(targetScale);
  const symbolForward = presentation === 'symbol-forward';
  const dwellFill =
    dwellProgress && dwellProgress > 0
      ? `linear-gradient(to top, rgba(37,99,235,0.45) ${Math.round(dwellProgress * 100)}%, transparent ${Math.round(dwellProgress * 100)}%)`
      : undefined;
  const baseFill = fillColor ?? (symbolForward ? '#ffffff' : undefined);

  const buttonStyle: CSSProperties = {
    minWidth: size,
    minHeight: size,
    width: '100%',
    height: '100%',
    border: scanHighlighted
      ? `4px solid #facc15`
      : scanGroupHighlighted
        ? `3px solid rgba(250, 204, 21, 0.75)`
        : `${symbolForward ? 4 : 3}px solid ${borderColor}`,
    borderRadius: symbolForward ? 6 : 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: symbolForward ? 'flex-end' : 'center',
    gap: symbolForward ? 2 : 4,
    padding: symbolForward ? '6px 4px 4px' : 8,
    cursor: 'pointer',
    position: 'relative',
    boxShadow: scanHighlighted
      ? '0 0 0 3px rgba(250,204,21,0.35)'
      : scanGroupHighlighted
        ? '0 0 0 2px rgba(250,204,21,0.2)'
        : undefined,
    outline: scanHighlighted ? '2px solid #ffffff' : undefined,
    outlineOffset: scanHighlighted ? 2 : undefined,
    background: dwellFill ?? baseFill,
    color: symbolForward ? '#111827' : undefined,
    ...style,
  };

  const symbolStyle: CSSProperties = symbolForward
    ? { width: '72%', height: '58%', objectFit: 'contain', flex: '1 1 auto', minHeight: 0 }
    : { maxWidth: '60%', maxHeight: '50%' };

  const labelStyle: CSSProperties = symbolForward
    ? {
        fontSize: 'clamp(0.6875rem, 1.6vw, 0.875rem)',
        fontWeight: 700,
        lineHeight: 1.1,
        textAlign: 'center',
      }
    : { fontSize: 'clamp(0.75rem, 2vw, 1rem)', fontWeight: 600 };

  return (
    <button
      type="button"
      aria-label={label}
      className={className}
      style={buttonStyle}
      {...rest}
    >
      {symbolUrl && !hideSymbol ? (
        <img src={symbolUrl} alt="" aria-hidden style={symbolStyle} />
      ) : null}
      {!hideLabel ? <span style={labelStyle}>{label}</span> : null}
      {children}
    </button>
  );
}
