export type SwitchKeyAction = 'select' | 'advance';

/** Keys emitted by common USB/BT AAC switches (Space/Enter = select, Tab/Arrow = advance). */
export const SWITCH_SELECT_KEY_CODES = ['Space', 'Enter', 'NumpadEnter'] as const;
export const SWITCH_ADVANCE_KEY_CODES = ['ArrowRight', 'Tab', 'ArrowDown', 'F13', 'F14'] as const;

const SELECT_SET = new Set<string>(SWITCH_SELECT_KEY_CODES);
const ADVANCE_SET = new Set<string>(SWITCH_ADVANCE_KEY_CODES);

export function classifySwitchKey(code: string): SwitchKeyAction | null {
  if (SELECT_SET.has(code)) return 'select';
  if (ADVANCE_SET.has(code)) return 'advance';
  return null;
}
