import { classifySwitchKey, type SwitchKeyAction } from './switch-input.js';

export interface HardwareSwitchHandlers {
  onAdvance: () => void;
  onSelect: () => void;
}

export interface GamepadButtonSpec {
  selectIndex: number;
  advanceIndex: number;
}

export const DEFAULT_GAMEPAD_BUTTONS: GamepadButtonSpec = {
  selectIndex: 0,
  advanceIndex: 1,
};

export interface BrowserHardwareSwitchOptions extends HardwareSwitchHandlers {
  enabled: boolean;
  gamepadButtons?: GamepadButtonSpec;
}

export interface GamepadLike {
  buttons: ReadonlyArray<{ pressed?: boolean }>;
}

/** Edge-detect gamepad button presses (select vs advance). */
export function detectGamepadSwitchAction(
  pads: Array<GamepadLike | null>,
  previousPressed: Map<number, boolean>,
  spec: GamepadButtonSpec = DEFAULT_GAMEPAD_BUTTONS,
): { action: SwitchKeyAction | null; nextPressed: Map<number, boolean> } {
  const nextPressed = new Map(previousPressed);
  let action: SwitchKeyAction | null = null;

  for (const pad of pads) {
    if (!pad) continue;
    for (const buttonIndex of [spec.selectIndex, spec.advanceIndex]) {
      const down = pad.buttons[buttonIndex]?.pressed ?? false;
      const wasDown = previousPressed.get(buttonIndex) ?? false;
      if (down && !wasDown && action === null) {
        action = buttonIndex === spec.selectIndex ? 'select' : 'advance';
      }
      nextPressed.set(buttonIndex, down);
    }
  }

  return { action, nextPressed };
}

export function handleHardwareSwitchKey(
  code: string,
  handlers: HardwareSwitchHandlers,
): SwitchKeyAction | null {
  const action = classifySwitchKey(code);
  if (action === 'select') {
    handlers.onSelect();
    return action;
  }
  if (action === 'advance') {
    handlers.onAdvance();
    return action;
  }
  return null;
}

/**
 * Attach USB/BT keyboard keys and Gamepad API buttons for switch scanning (browser only).
 * Returns a detach function; safe to call when `window` is undefined (no-op detach).
 */
export function attachBrowserHardwareSwitch(options: BrowserHardwareSwitchOptions): () => void {
  if (typeof window === 'undefined' || !options.enabled) {
    return () => undefined;
  }

  const spec = options.gamepadButtons ?? DEFAULT_GAMEPAD_BUTTONS;
  const pressed = new Map<number, boolean>();
  let frame = 0;

  const onKeyDown = (event: KeyboardEvent) => {
    const action = handleHardwareSwitchKey(event.code, options);
    if (action) event.preventDefault();
  };

  window.addEventListener('keydown', onKeyDown);

  const pollGamepads = () => {
    if (typeof navigator.getGamepads !== 'function') return;
    const pads = Array.from(navigator.getGamepads());
    const { action, nextPressed } = detectGamepadSwitchAction(pads, pressed, spec);
    for (const [index, down] of nextPressed) pressed.set(index, down);
    if (action === 'select') options.onSelect();
    else if (action === 'advance') options.onAdvance();
    frame = window.requestAnimationFrame(pollGamepads);
  };

  if (typeof navigator.getGamepads === 'function') {
    frame = window.requestAnimationFrame(pollGamepads);
  }

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    if (frame) window.cancelAnimationFrame(frame);
  };
}

/** Returns true when at least one gamepad is connected (browser only). */
export function isGamepadConnected(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return false;
  }
  return Array.from(navigator.getGamepads()).some((pad) => pad !== null);
}
