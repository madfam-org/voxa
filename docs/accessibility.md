# Accessibility Standards

Voxa targets **WCAG 2.2 Level AA** as a minimum bar. For AAC users with severe motor and visual impairments, several requirements exceed baseline web guidance.

## Touch Targets (Success Criterion 2.5.8)

All interactive communication buttons must be **at least 1 cm × 1 cm** (≈ 38 CSS px at 96 dpi, scaled by user preference). The `@voxa/ui` `AacButton` component enforces this via `min-width` / `min-height` tied to a user-configurable `targetScale`.

Spacing between adjacent targets must allow error-free selection for users with spasticity — default gutter is 4 mm minimum.

## Pointer Gestures (2.5.7)

No AAC workflow may require multi-finger gestures, path-based gestures, or drag-only actions. Every swipe/drag affordance has a **single-pointer alternative**.

- **Editor, moving buttons:** HTML5 drag and drop works with a mouse, but it does not fire on touch screens. In the button editor, **Move** selects the button and a tap or click on any destination cell moves it there (a button already there swaps places); Escape or **Cancel move** ends it. The ↑ ↓ ← → commands move it one cell at a time from the keyboard. Locked (motor-plan) buttons move only for an admin, after a confirmation. Covered by `e2e/specs/access-methods.spec.ts` in a touch-only (`hasTouch`) browser.

## Visual Accommodations (CVI)

Built-in themes:

| Theme | Background | Use case |
|-------|------------|----------|
| `default` | `#f8fafc` light | General use |
| `classic-light` | Light gray + white cells | Classic AAC apps (Proloquo-style layouts) |
| `cvi-dark` | `#0a0a0a` | Cortical visual impairment — reduced visual complexity |
| `cvi-high-contrast` | Black + saturated symbols | Maximum figure/ground separation |

Users can disable decorative imagery, reduce grid chrome, and enlarge symbol-only mode.

Each theme carries its own chrome colours (`CVI_THEMES[theme].chrome` in `@voxa/ui`: message bar, sync status, footer text and links), held to 4.5:1 for text against the theme background by `apps/web/src/lib/theme-contrast.test.ts`. The scan highlight is a **dual ring** (black inside white, `SCAN_RING`): whatever the button fill or background, one ring contrasts at least 4.5:1 with it, so the cursor meets the 3:1 non-text minimum on every theme. CI scans `/app` with axe in all four themes.

## Speech output (device voices)

Voxa speaks through the browser's speech synthesis, with the voices installed on the device; it ships no voice of its own. Natural child voices are pending (licensed or neural voices are an open decision).

- **One speech path.** `apps/web/src/lib/play-button-speech.ts` builds every utterance: button speech, the message bar ("Speak"), prediction chips, the keyboard, scan cues, the spoken fallback for recorded media and the public demo. `lang` is always the board's speech locale.
- **Voice choice.** Settings › Voice lists the device's voices for the board's language (exact locale such as es-MX first, then other variants of the language, then every other voice behind "show all"). Quality labels (Premium, Enhanced, Natural, Neural, Google, Online, needs a connection) come only from the voice's name and `localService`. The choice is kept per locale in this device's settings, because each device has different voices.
- **Fallback.** Without a choice, or when the chosen voice is gone (another device, an OS update), Voxa uses the best ranked voice for the language and says so once. Voices that load late are awaited with a bounded retry, since some browsers never fire `voiceschanged`. Ranking and fallback: `apps/web/src/lib/speech-voices.ts`.
- **Tuning.** Rate, pitch and volume sliders with visible values and keyboard steps, a preview phrase, and a "higher voice (approximation)" preset that raises pitch and rate. It is labelled as an approximation and is not a child voice.
- **No matching voice.** The section shows short steps to install a voice on Android, iPhone/iPad and Windows, and Voxa keeps speaking with the best voice available.
- Tested in `apps/web/src/lib/speech-voices.test.ts`, `apps/web/src/lib/play-button-speech.test.ts` and `e2e/specs/voice-choice.spec.ts` (stubbed speech synthesis; axe on the section).

## Alternative Access

### Switch Scanning

- Configurable scan order: row-major, column-major, linear, custom groups
- **Auto scan** (one switch: the highlight moves on a timer, the switch selects) or **step scan** (two switches: switch 1 moves, switch 2 selects; nothing moves on its own)
- Two-level **group scan**: row groups or quadrant regions, then cells within the selected group. Inside a group the scan offers a **Back** position after the last cell, and after a configurable number of full rounds without a selection (default 2) it returns to the group level by itself, so a wrong group never traps the user
- Empty cells and groups without a button are skipped
- Adjustable scan interval (300 ms – 5 s), **first-item hold** (extra time on the first item of each level), **acceptance time** (presses shorter than it are ignored) and **post-selection pause**
- The state machine is pure and unit-tested: `packages/access/src/scan-machine.ts`
- Auditory scan highlight optional (screen reader live region)
- Optional spoken scan voice for each focused cell (the chosen voice and tuning, slightly quieter)
- **Scan-step beep** (880 Hz tone; 660 Hz for group scan) with optional spoken label
- Scan pauses automatically while TTS or recorded speech plays (configurable)
- **Hardware USB/BT switches (web):** `@voxa/access` `HardwareSwitchAdapter` — keyboard keys (Space/Enter/Tab/Arrow/F13) + Gamepad API buttons 0/1 during switch scan
- **Hardware USB/BT switches (mobile):** BT switches that emulate a keyboard drive scan via hidden focus capture (`MobileSwitchKeyCapture`, `classifySwitchNativeKey`); on-screen Next/Select/Tune always available

#### Supported hardware matrix (reference)

| Device class | Web | Mobile | Notes |
|--------------|-----|--------|-------|
| USB switch (keyboard emulation) | ✅ | ✅ (via BT keyboard mode) | Space/Enter = select; Tab/Arrow Right = advance |
| Bluetooth switch (keyboard mode) | ✅ | ✅ | Same key map; pair before opening Voxa |
| Gamepad / switch box (HID gamepad) | ✅ | — | Buttons 0/1 via Gamepad API |
| Eye tracker that moves the pointer (vendor software in mouse mode) | 🟡 | — | Pointer dwell; not tested on hardware by us |
| Eye tracker SDK (Tobii, IrisBond …) | 🔴 | 🔴 | No direct integration; integrators can feed coordinates through the gaze event bridge |
| iOS External Accessory switch | — | 🔴 | Planned native module (TestFlight) |

### Dwell selection (eye gaze, head pointers)

Voxa does **not** integrate eye-tracker hardware or vendor SDKs. Dwell works in two ways:

- **Pointer dwell (default):** hold the pointer over a button for the dwell time (500 ms – 3 s) to select it. Any device that moves the pointer works this way: a mouse, a head pointer, or an eye tracker whose own software drives the pointer.
- **Gaze event bridge (integrators):** a page or helper that knows gaze coordinates dispatches a `voxa:gaze` `CustomEvent` with `{ x, y }` in viewport pixels (or calls `window.__voxaInjectGaze(x, y)`), and Voxa resolves the button under that point and applies the same dwell. Select **Gaze event bridge** as the dwell input in Settings. The event name and payload are a stable API (`VOXA_GAZE_EVENT` in `@voxa/access`). No driver or helper app ships with Voxa.

`snapHitBox` in `@voxa/access` is a helper for a future snap-to-item mode; the app does not use it yet.

## Testing

- Automated: `@axe-core/playwright` in CI on critical pages (`e2e/specs/a11y.spec.ts` — home, demo, legal, sign-in, the editor, and `/app` in each of the four board themes; serious and critical violations fail the job)
- Access methods: `e2e/specs/access-methods.spec.ts` (touch-only button moves, admin motor-plan override, rejected saves leave the queue) against a real local API
- Daily `e2e-smoke` workflow ("Daily smoke"): Playwright smoke and axe against the production public pages; staging specs return when staging is rebuilt
- Manual: SLP review checklist before release ([SLP_SIGNOFF.md](./launch/SLP_SIGNOFF.md))
- Hardware: keyboard-emulating switches. Eye-tracker hardware has not been tested yet.
