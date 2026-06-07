import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { targetSizePx } from './index.js';

export interface AacButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  symbolUrl?: string;
  borderColor?: string;
  targetScale?: number;
  dwellProgress?: number;
  scanHighlighted?: boolean;
  hideSymbol?: boolean;
  children?: ReactNode;
}

/**
 * WCAG 2.2 compliant AAC grid button — minimum 1 cm touch target.
 */
export function AacButton({
  label,
  symbolUrl,
  borderColor = '#cbd5e1',
  targetScale = 1,
  dwellProgress,
  scanHighlighted = false,
  hideSymbol = false,
  className,
  style,
  children,
  ...rest
}: AacButtonProps) {
  const size = targetSizePx(targetScale);
  const dwellFill =
    dwellProgress && dwellProgress > 0
      ? `linear-gradient(to top, rgba(37,99,235,0.45) ${Math.round(dwellProgress * 100)}%, transparent ${Math.round(dwellProgress * 100)}%)`
      : undefined;

  const buttonStyle: CSSProperties = {
    minWidth: size,
    minHeight: size,
    width: '100%',
    height: '100%',
    border: scanHighlighted ? `4px solid #facc15` : `3px solid ${borderColor}`,
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 8,
    cursor: 'pointer',
    position: 'relative',
    boxShadow: scanHighlighted ? '0 0 0 3px rgba(250,204,21,0.35)' : undefined,
    outline: scanHighlighted ? '2px solid #ffffff' : undefined,
    outlineOffset: scanHighlighted ? 2 : undefined,
    background: dwellFill,
    ...style,
  };

  return (
    <button
      type="button"
      aria-label={label}
      className={className}
      style={buttonStyle}
      {...rest}
    >
      {symbolUrl && !hideSymbol ? (
        <img src={symbolUrl} alt="" aria-hidden style={{ maxWidth: '60%', maxHeight: '50%' }} />
      ) : null}
      <span style={{ fontSize: 'clamp(0.75rem, 2vw, 1rem)', fontWeight: 600 }}>{label}</span>
      {children}
    </button>
  );
}
