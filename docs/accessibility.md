# Accessibility Standards

Voxa targets **WCAG 2.2 Level AA** as a minimum bar. For AAC users with severe motor and visual impairments, several requirements exceed baseline web guidance.

**Where this stands (2026-10-04).** Automated axe checks with the WCAG 2.2 AA rules run in CI on every pull request (see [Testing](#testing)); serious or critical findings fail the build. No external audit or conformance report exists yet, and the vocabulary and Spanish language features are pending review by a credentialed speech-language pathologist (see [launch/SLP_SIGNOFF.md](./launch/SLP_SIGNOFF.md)). The public statement shown in the app is `/legal/accessibility`; the capability list with status is [capabilities.md](./capabilities.md).

## Touch Targets (Success Criterion 2.5.8)

All interactive communication buttons must be **at least 1 cm × 1 cm** (≈ 38 CSS px at 96 dpi, scaled by user preference). The `@voxa/ui` `AacButton` component enforces this via `min-width` / `min-height` tied to a user-configurable `targetScale`.

Spacing between adjacent targets must allow error-free selection for users with spasticity — default gutter is 4 mm minimum. Settings › Touch size scales every target from 1× to 2×.

## Pointer Gestures (2.5.7)

No AAC workflow may require multi-finger gestures, path-based gestures, or drag-only actions. Every swipe/drag affordance has a **single-pointer alternative**.

- **Editor, moving buttons:** HTML5 drag and drop works with a mouse, but it does not fire on touch screens. In the button editor, **Move** selects the button and a tap or click on any destination cell moves it there (a button already there swaps places); Escape or **Cancel move** ends it. The ↑ ↓ ← → commands move it one cell at a time from the keyboard. Locked (motor-plan) buttons move only for an admin, after a confirmation. Covered by `e2e/specs/access-methods.spec.ts` in a touch-only (`hasTouch`) browser.

## Visual Accommodations (CVI)

Built-in themes:

| Theme | Background | Use case |
|-------|------------|----------|
| `default` | `#f8fafc` light | General use |
| `classic-light` | Light gray + white cells | Familiar light layout with white cells |
| `cvi-dark` | `#0a0a0a` | Cortical visual impairment — reduced visual complexity |
| `cvi-high-contrast` | Black + saturated symbols | Maximum figure/ground separation |

Users can hide labels or hide symbols per board, and enlarge targets (see Touch Targets).

Each theme carries its own chrome colours (`CVI_THEMES[theme].chrome` in `@voxa/ui`: message bar, sync status, footer text and links), held to 4.5:1 for text against the theme background by `apps/web/src/lib/theme-contrast.test.ts`. The scan highlight is a **dual ring** (black inside white, `SCAN_RING`): whatever the button fill or background, one ring contrasts at least 4.5:1 with it, so the cursor meets the 3:1 non-text minimum on every theme. CI scans `/app` with axe in all four themes.

## Speech output (device voices)

Voxa speaks through the browser's speech synthesis, with the voices installed on the device; it ships no voice of its own. Natural child voices are pending (licensed or neural voices are an open decision).

- **One speech path.** `apps/web/src/lib/play-button-speech.ts` builds every utterance: button speech, the message bar ("Speak"), prediction chips, the keyboard, scan cues, the spoken fallback for recorded media and the public demo. `lang` is always the board's speech locale.
- **Voice choice.** Settings › Voice lists the device's voices for the board's language (exact locale such as es-MX first, then other variants of the language, then every other voice behind "show all"). Quality labels (Premium, Enhanced, Natural, Neural, Google, Online, needs a connection) come only from the voice's name and `localService`. The choice is kept per locale in this device's settings, because each device has different voices.
- **Fallback.** Without a choice, or when the chosen voice is gone (another device, an OS update), Voxa uses the best ranked voice for the language and says so once. Voices that load late are awaited with a bounded retry, since some browsers never fire `voiceschanged`. Ranking and fallback: `apps/web/src/lib/speech-voices.ts`.
- **Tuning.** Rate, pitch and volume sliders with visible values and keyboard steps, a preview phrase, and a "higher voice (approximation)" preset that raises pitch and rate. It is labelled as an approximation and is not a child voice.
- **No matching voice.** The section shows short steps to install a voice on Android, iPhone/iPad and Windows, and Voxa keeps speaking with the best voice available.
- Tested in `apps/web/src/lib/speech-voices.test.ts`, `apps/web/src/lib/play-button-speech.test.ts` and `e2e/specs/voice-choice.spec.ts` (stubbed speech synthesis; axe on the section).
- **Mobile app:** speaks with the device's default voice; voice choice and tuning are web only for now.

## Language

The interface is Spanish by default (unprefixed URLs), with complete English (`/en`) and French (`/fr`) catalogs; the page `lang` matches the interface language, and speech uses the board's language. A guard test (`apps/web/src/hardcoded-ui-text.test.ts`) fails on hard-coded interface text, and a parity test keeps the three catalogs aligned (WCAG 3.1.1 and 3.1.2).

## First-run setup

A signed-in person with no board of their own sees a short setup once per device on `/app` (never on `/demo` or in the editor): board language, access method (touch, switch scanning, pointer dwell, keyguard), grid size (24, 36 or 60 cells, with a live preview and a "pending clinical review" note) and voice, then the first board opens. It is a native modal `<dialog>`: focus moves to each step's heading, every control is a native button or form field (Tab, Space and Enter, so key-emulating switches work), every step can be skipped and Escape skips the setup. It can be reopened from Settings. Tested in `apps/web/src/lib/first-run.test.ts` and `e2e/specs/first-run.spec.ts` (axe on every step in a light and a dark theme).

## Recorded media and GLP video

A Gestalt (GLP) video plays in a visible dialog (`role="dialog"`, `aria-modal`, the phrase as accessible name and caption) with a large Close button that takes focus. Any key (including key-emulating switches), a tap on the backdrop or Close, or the next button activation dismisses it, and focus returns where it was. When a recording cannot be loaded (for example offline), the button's text is spoken with the device voice instead. Tested in `e2e/specs/offline-media.spec.ts` (axe on the dialog).

## Alternative Access

### Touch

- Select on **press** (default) or on **release** (Settings › Touch activation).
- **Keyguard (touch guard):** semi-transparent overlays block touches in the gutters between buttons, around the grid, or both.
- **Whisper mode:** build a message without speaking each word.

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
- Scan pauses automatically while TTS or recorded speech plays (configurable). The pause always ends: on the engine's `end` or `error`, when the engine reports it is idle, or after a bound estimated from the message length and speech rate (2 s to 15 s), so a voice that never reports the end of speech cannot leave scanning stuck (`apps/web/src/lib/play-button-speech.ts`, `e2e/specs/scan-pause.spec.ts`)
- **Hardware USB/BT switches (web):** `@voxa/access` `HardwareSwitchAdapter` — keyboard keys (Space/Enter/Tab/Arrow/F13) + Gamepad API buttons 0/1 during switch scan
- **Hardware USB/BT switches (mobile):** BT switches that emulate a keyboard drive scan via hidden focus capture (`MobileSwitchKeyCapture`, `classifySwitchNativeKey`); on-screen Next/Select/Tune always available

#### Supported hardware matrix (reference)

| Device class | Web | Mobile | Notes |
|--------------|-----|--------|-------|
| USB switch (keyboard emulation) | ✅ | ✅ (via BT keyboard mode) | Space/Enter = select; Tab/Arrow Right = advance |
| Bluetooth switch (keyboard mode) | ✅ | ✅ | Same key map; pair before opening Voxa |
| Gamepad / switch box (HID gamepad) | ✅ | — | Buttons 0/1 via Gamepad API |
| Eye tracker that moves the pointer (vendor software in mouse mode) | 🟡 | — | Pointer dwell; not tested on hardware by us |
| Eye-tracker vendor SDK | 🔴 | 🔴 | No direct integration; integrators can feed coordinates through the gaze event bridge |
| iOS External Accessory switch | — | 🔴 | Not built |

### Dwell selection (head pointers and pointer-driving eye trackers)

Voxa does **not** integrate eye-tracker hardware or vendor SDKs. Dwell works in two ways:

- **Pointer dwell (default):** hold the pointer over a button for the dwell time (500 ms – 3 s) to select it. Any device that moves the pointer works this way: a mouse, a head pointer, or an eye tracker whose own software drives the pointer.
- **Gaze event bridge (integrators):** a page or helper that knows gaze coordinates dispatches a `voxa:gaze` `CustomEvent` with `{ x, y }` in viewport pixels (or calls `window.__voxaInjectGaze(x, y)`), and Voxa resolves the button under that point and applies the same dwell. Select **Gaze event bridge** as the dwell input in Settings. The event name and payload are a stable API (`VOXA_GAZE_EVENT` in `@voxa/access`). No driver or helper app ships with Voxa.

`snapHitBox` in `@voxa/access` is a helper for a future snap-to-item mode; the app does not use it yet.

## Testing

- **Automated (every pull request, CI `a11y` job):** `@axe-core/playwright` with the WCAG 2.2 AA rule tags; serious and critical violations fail the job.
  - `e2e/specs/a11y.spec.ts`: the landing, demo, legal and sign-in pages, the editor panels, `/app` in each of the four board themes, and, in Spanish (the default, unprefixed locale), the landing, `/demo`, `/app` and its settings panel. Each Spanish scan first asserts the page stayed on its unprefixed route with `lang="es"`.
  - `e2e/specs/voice-choice.spec.ts`: the Voice settings and the install guidance, light and dark themes.
  - `e2e/specs/first-run.spec.ts`: every first-run step, light and dark themes.
  - `e2e/specs/offline-media.spec.ts`: the GLP video dialog.
- **Contrast:** `apps/web/src/lib/theme-contrast.test.ts` (4.5:1 text, 3:1 scan ring, all four themes).
- **Access methods:** `e2e/specs/access-methods.spec.ts` (touch-only button moves, keyboard moves, admin motor-plan override, rejected saves leave the queue) against a real local API; `packages/access/src/scan-machine.test.ts` for the scan.
- **Daily smoke** (`e2e-smoke.yml`): Playwright smoke and axe against the production public pages, and the signed-in specs against staging.
- **Clinical review:** pending; no credentialed speech-language pathologist has reviewed Voxa yet ([SLP_SIGNOFF.md](./launch/SLP_SIGNOFF.md)).
- **Hardware:** keyboard-emulating switches. Eye-tracker hardware has not been tested yet.
