# Accessibility Standards

Voxa targets **WCAG 2.2 Level AA** as a minimum bar. For AAC users with severe motor and visual impairments, several requirements exceed baseline web guidance.

## Touch Targets (Success Criterion 2.5.8)

All interactive communication buttons must be **at least 1 cm × 1 cm** (≈ 38 CSS px at 96 dpi, scaled by user preference). The `@voxa/ui` `AacButton` component enforces this via `min-width` / `min-height` tied to a user-configurable `targetScale`.

Spacing between adjacent targets must allow error-free selection for users with spasticity — default gutter is 4 mm minimum.

## Pointer Gestures (2.5.7)

No AAC workflow may require multi-finger gestures, path-based gestures, or drag-only actions. Every swipe/drag affordance has a **single-pointer alternative** (e.g., explicit "move" buttons, long-press menus with cancel).

## Visual Accommodations (CVI)

Built-in themes:

| Theme | Background | Use case |
|-------|------------|----------|
| `default` | System preference | General use |
| `cvi-dark` | `#0a0a0a` | Cortical visual impairment — reduced visual complexity |
| `cvi-high-contrast` | Black + saturated symbols | Maximum figure/ground separation |

Users can disable decorative imagery, reduce grid chrome, and enlarge symbol-only mode.

## Alternative Access

### Switch Scanning

- Configurable scan order: row-major, column-major, linear, custom groups
- Adjustable scan interval (300 ms – 5 s)
- Auditory scan highlight optional (screen reader live region)
- Optional spoken scan voice for each focused cell
- Scan pauses automatically while TTS or recorded speech plays (configurable)
- **Eye dwell (web):** pointer hover simulation, or **Tobii bridge** via `voxa:gaze` / `window.__voxaInjectGaze(x,y)` in settings
- **Hardware USB/BT switches (web):** keyboard keys + Gamepad API buttons 0/1 during switch scan
- **Hardware USB/BT switches (mobile):** BT switches that emulate a keyboard drive scan via hidden focus capture (`MobileSwitchKeyCapture`, `classifySwitchNativeKey`); on-screen Next/Select/Tune always available

### Eye Tracking

- Dwell time: 500 ms – 3 s (per-user profile)
- **Snap-to-item:** magnetic locking when gaze is within expanded hit box
- Cancel dwell on large saccade (vendor-specific adapters in `@voxa/access`)

## Testing

- Automated: `@axe-core/playwright` in CI on critical pages (`e2e/specs/a11y.spec.ts` — home, legal, sign-in)
- Staging: daily soak script + weekday `e2e-smoke` workflow (smoke + axe against staging)
- Manual: SLP review checklist before release ([SLP_SIGNOFF.md](./launch/SLP_SIGNOFF.md))
- Hardware: Tobii, IrisBond, and switch interfaces on reference devices
