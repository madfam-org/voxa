import { SwitchAcceptanceFilter } from './scan-machine.js';
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
  /** Acceptance time: presses held for less than this many ms are ignored (0 = on press). */
  acceptanceMs?: number;
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
  const acceptanceMs = Math.max(0, options.acceptanceMs ?? 0);
  const filter = new SwitchAcceptanceFilter<SwitchKeyAction>(acceptanceMs);
  const timers = new Set<number>();
  const pressed = new Map<number, boolean>();
  let frame = 0;

  const fire = (action: SwitchKeyAction | null) => {
    if (action === 'select') options.onSelect();
    else if (action === 'advance') options.onAdvance();
  };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const switchDown = (action: SwitchKeyAction) => {
    const immediate = filter.press(action, now());
    if (immediate) {
      fire(immediate);
      return;
    }
    const id = window.setTimeout(() => {
      timers.delete(id);
      for (const due of filter.due(now())) fire(due);
    }, acceptanceMs);
    timers.add(id);
  };
  const switchUp = (action: SwitchKeyAction) => fire(filter.release(action, now()));

  const onKeyDown = (event: KeyboardEvent) => {
    const action = classifySwitchKey(event.code);
    if (!action) return;
    event.preventDefault();
    if (event.repeat) return;
    switchDown(action);
  };
  const onKeyUp = (event: KeyboardEvent) => {
    const action = classifySwitchKey(event.code);
    if (!action) return;
    event.preventDefault();
    switchUp(action);
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const pollGamepads = () => {
    if (typeof navigator.getGamepads !== 'function') return;
    const pads = Array.from(navigator.getGamepads());
    for (const [buttonIndex, action] of [
      [spec.selectIndex, 'select'],
      [spec.advanceIndex, 'advance'],
    ] as const) {
      const down = pads.some((pad) => pad?.buttons[buttonIndex]?.pressed ?? false);
      const wasDown = pressed.get(buttonIndex) ?? false;
      if (down && !wasDown) switchDown(action);
      else if (!down && wasDown) switchUp(action);
      pressed.set(buttonIndex, down);
    }
    frame = window.requestAnimationFrame(pollGamepads);
  };

  if (typeof navigator.getGamepads === 'function') {
    frame = window.requestAnimationFrame(pollGamepads);
  }

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    if (frame) window.cancelAnimationFrame(frame);
    for (const id of timers) window.clearTimeout(id);
    filter.reset();
  };
}

/** Returns true when at least one gamepad is connected (browser only). */
export function isGamepadConnected(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return false;
  }
  return Array.from(navigator.getGamepads()).some((pad) => pad !== null);
}
