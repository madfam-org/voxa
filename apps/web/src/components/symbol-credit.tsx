'use client';

import type { BoardButton } from '@voxa/core';
import { useTranslations } from 'next-intl';
import { showsMulberrySymbols } from '@/lib/symbol-credit';

const MULBERRY_URL = 'https://mulberrysymbols.org';
const CC_BY_SA_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

/**
 * Attribution required by CC BY-SA 4.0 for the vendored Mulberry Symbols.
 * Renders only when the given buttons actually show a Mulberry symbol.
 */
export function SymbolCredit({
  buttons,
  hidden = false,
  block = false,
  style,
}: {
  buttons: readonly BoardButton[];
  hidden?: boolean;
  /** Render as a paragraph (own line) instead of an inline span. */
  block?: boolean;
  style?: React.CSSProperties;
}): React.ReactNode {
  const t = useTranslations('common');
  if (hidden || !showsMulberrySymbols(buttons)) return null;
  const linkStyle = { color: 'inherit', textDecoration: 'underline' } as const;
  const Tag = block ? 'p' : 'span';
  return (
    <Tag data-voxa-symbol-credit="mulberry" style={style}>
      {t.rich('symbolCredit', {
        symbols: (chunks) => (
          <a href={MULBERRY_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            {chunks}
          </a>
        ),
        license: (chunks) => (
          <a href={CC_BY_SA_URL} target="_blank" rel="noopener noreferrer license" style={linkStyle}>
            {chunks}
          </a>
        ),
      })}
    </Tag>
  );
}
