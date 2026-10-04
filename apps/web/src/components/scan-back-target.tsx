'use client';

import { useTranslations } from 'next-intl';
import { SCAN_RING } from '@voxa/ui';
import { neutral, surface } from '@/lib/tokens';

/**
 * The "back" position of a group scan, shown above the board. When the scan
 * reaches it, a switch press returns to the group level (rows or quadrants).
 * The live region already announces it, so this box is visual only.
 */
export function ScanBackTarget({ active }: { active: boolean }): React.ReactNode {
  const t = useTranslations('scan');
  return (
    <div
      aria-hidden
      data-voxa-scan={active ? 'back' : undefined}
      style={{
        margin: '8px 16px 0',
        padding: '8px 16px',
        borderRadius: 8,
        fontWeight: 700,
        background: surface.raised,
        color: neutral.text,
        border: `3px solid ${active ? SCAN_RING.accent : neutral.border}`,
        boxShadow: active ? `0 0 0 3px ${SCAN_RING.dark}, 0 0 0 7px ${SCAN_RING.light}` : undefined,
        alignSelf: 'flex-start',
      }}
    >
      {t('backToGroups')}
    </div>
  );
}
