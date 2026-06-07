import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { targetSizePx } from './index.js';

export interface AacButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  symbolUrl?: string;
  borderColor?: string;
  targetScale?: number;
  dwellProgress?: number;
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
  className,
  style,
  children,
  ...rest
}: AacButtonProps) {
  const size = targetSizePx(targetScale);
  const buttonStyle: CSSProperties = {
    minWidth: size,
    minHeight: size,
    width: '100%',
    height: '100%',
    border: `3px solid ${borderColor}`,
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 8,
    cursor: 'pointer',
    position: 'relative',
    background: dwellProgress ? `linear-gradient(to top, rgba(37,99,235,${dwellProgress}) 0%, transparent 0%)` : undefined,
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
      {symbolUrl ? (
        <img src={symbolUrl} alt="" aria-hidden style={{ maxWidth: '60%', maxHeight: '50%' }} />
      ) : null}
      <span style={{ fontSize: 'clamp(0.75rem, 2vw, 1rem)', fontWeight: 600 }}>{label}</span>
      {children}
    </button>
  );
}
