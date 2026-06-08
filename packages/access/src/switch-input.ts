export type SwitchKeyAction = 'select' | 'advance';

/** Keys emitted by common USB/BT AAC switches (Space/Enter = select, Tab/Arrow = advance). */
export const SWITCH_SELECT_KEY_CODES = ['Space', 'Enter', 'NumpadEnter'] as const;
export const SWITCH_ADVANCE_KEY_CODES = ['ArrowRight', 'Tab', 'ArrowDown', 'F13', 'F14'] as const;

/** React Native `TextInput` / DOM `KeyboardEvent.key` values from BT switches. */
export const SWITCH_SELECT_NATIVE_KEYS = [' ', 'Enter'] as const;
export const SWITCH_ADVANCE_NATIVE_KEYS = ['Tab', 'ArrowRight', 'ArrowDown'] as const;

const SELECT_SET = new Set<string>(SWITCH_SELECT_KEY_CODES);
const ADVANCE_SET = new Set<string>(SWITCH_ADVANCE_KEY_CODES);
const SELECT_NATIVE_SET = new Set<string>(SWITCH_SELECT_NATIVE_KEYS);
const ADVANCE_NATIVE_SET = new Set<string>(SWITCH_ADVANCE_NATIVE_KEYS);

export function classifySwitchKey(code: string): SwitchKeyAction | null {
  if (SELECT_SET.has(code)) return 'select';
  if (ADVANCE_SET.has(code)) return 'advance';
  return null;
}

/** Map native keyboard keys (mobile TextInput / some browsers) to switch actions. */
export function classifySwitchNativeKey(key: string): SwitchKeyAction | null {
  if (SELECT_NATIVE_SET.has(key)) return 'select';
  if (ADVANCE_NATIVE_SET.has(key)) return 'advance';
  return null;
}
