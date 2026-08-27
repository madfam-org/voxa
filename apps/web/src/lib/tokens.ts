/**
 * Voxa web design tokens — the single source of truth for app-chrome color.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every color in this app is an inline-style hex on a React element. Before
 * this module, raising one muted gray for WCAG contrast (PR #4) meant editing
 * the same literal at six call sites across four components, with nothing to
 * stop the seventh from being missed. Colors now have one definition each.
 *
 * SCOPE
 * -----
 * App chrome only: the marketing site, the communicator/editor shell, panels
 * and dialogs. The user-selectable AAC board themes live in `CVI_THEMES`
 * (@voxa/ui) and are a deliberately separate concern — those are a clinical
 * display setting the communicator chooses, not app chrome.
 *
 * CONVENTION
 * ----------
 * Plain `as const` typed constants, matching `CVI_THEMES` in @voxa/ui. No new
 * dependencies, no Tailwind, no CSS custom properties: inline styles are this
 * app's existing idiom, and a constants module drops into them with a
 * mechanical hex -> token substitution and zero rendering change.
 *
 * ============================================================================
 * CONTRAST FLOORS — READ BEFORE CHANGING ANY VALUE BELOW
 * ============================================================================
 * WCAG 2.2 AA requires 4.5:1 for normal-size text (< 18.66px regular).
 * Voxa is an AAC product whose users include people with CVI and motor
 * impairments, so bare-minimum compliance is the wrong target; the values
 * below hold margin over the floor rather than sitting on it.
 *
 * `neutral.muted` (#a3a3a3) is the constrained token. It is the app's muted
 * text register and lands on four different dark grounds. Measured ratios
 * (PR #4, verified with axe against the built server):
 *
 *   ground                          token           ratio     verdict
 *   surface.raised   #171717        muted #a3a3a3   7.11:1    AA + AAA
 *   surface.base     #0a0a0a        muted #a3a3a3   7.85:1    AA + AAA
 *   surface.section  #111111        muted #a3a3a3   7.49:1    AA + AAA
 *   surface.overlay  #262626        muted #a3a3a3   6.00:1    AA
 *
 * #262626 is the WORST GROUND at 6.00:1. Any future change to `neutral.muted`
 * must clear 4.5:1 against #262626 — that is the binding constraint, not the
 * homepage. The previous value #737373 (neutral-500) measured 3.19:1 there and
 * shipped failing on board-audit-panel and word-forms-panel for months,
 * unnoticed because the a11y suite could not reach authenticated surfaces.
 *
 * If you darken `neutral.muted`, re-run `pnpm test:e2e:a11y` — the authed lane
 * added in this change now scans those two panels, so the suite will catch it.
 * ============================================================================
 */

/**
 * Neutral ramp. Names describe ROLE, not lightness, so a value can be retuned
 * without renaming every call site.
 */
export const neutral = {
  /** Primary body/heading text on dark surfaces. */
  text: '#fafafa',
  /** Slightly recessed body copy; also button labels on dark chrome. */
  textSubtle: '#f5f5f5',
  /** Secondary prose — list items, descriptions. Lighter than `muted`. */
  textSecondary: '#d4d4d4',
  /**
   * Muted/fine-print text. CONTRAST-CONSTRAINED — see the floors table above.
   * Must hold >= 4.5:1 on #262626 (currently 6.00:1).
   */
  muted: '#a3a3a3',
  /** Disabled affordances and de-emphasized iconography. */
  disabled: '#525252',
  /** Default 1px borders and dashed drop targets on dark chrome. */
  border: '#404040',
  /** Low-emphasis dividers between sections of a panel. */
  borderSubtle: '#333333',
  /** Divider hairline on the darkest surfaces. */
  borderFaint: '#262626',
  /** Light-ground border used where dark chrome meets a light scene. */
  borderLight: '#e5e5e5',
} as const;

/**
 * Elevation ramp for dark chrome, darkest -> lightest.
 * `overlay` (#262626) is the worst contrast ground in the app.
 */
export const surface = {
  /** Page background — the app's darkest ground. */
  base: '#0a0a0a',
  /** Alternating marketing sections (why-aac, pricing). Was the `#111` literal. */
  section: '#111111',
  /** Cards, panels, raised regions. */
  raised: '#171717',
  /** Inputs, secondary buttons, dialogs. WORST CONTRAST GROUND — 6.00:1 muted. */
  overlay: '#262626',
  /** Slightly lifted variant of `base` for nested wells. */
  sunken: '#0f0f0f',
  /** Hover/active state one step above `base`. */
  baseHover: '#1a1a1a',
  /** Pure white — button faces, high-contrast text on colored fills. */
  white: '#ffffff',
} as const;

/** Brand blue — primary actions, links, focus affordances. */
export const brand = {
  /** Primary button fill and active borders. */
  primary: '#2563eb',
  /** Pressed/darker primary; banner bottom borders. */
  primaryStrong: '#1d4ed8',
  /** Link text and inline anchors on dark grounds. */
  link: '#93c5fd',
  /** Tinted informational banner background. */
  surfaceTint: '#172554',
  /** Text/icon on `surfaceTint`. */
  onSurfaceTint: '#dbeafe',
  /** Subtle accent on tinted banners. */
  accentSoft: '#bfdbfe',
  /** Gradient partner for hero treatments. */
  gradientDeep: '#1e3a5f',
  /** Mid-strength blue for non-primary emphasis. */
  mid: '#3b82f6',
} as const;

/** Status/semantic colors. Each is text-on-dark unless noted. */
export const status = {
  /** Error text and destructive affordances. */
  danger: '#f87171',
  /** Strong error fill (rare — badge backgrounds). */
  dangerStrong: '#991b1b',
  /** Success text — sync "live" state. */
  success: '#4ade80',
  /** Success outline/border — completed schedule steps. */
  successBorder: '#22c55e',
  /** Success fill for completed-state chips. */
  successFill: '#166534',
  /** Success tint text. */
  successSoft: '#bbf7d0',
  /** Warning text — degraded sync, pending states. */
  warning: '#fbbf24',
  /** Warning outline — current schedule step, babble mode border. */
  warningBorder: '#f59e0b',
  /** Warning highlight outline. */
  warningAccent: '#facc15',
  /** Warning text on dark amber fills. */
  warningText: '#fcd34d',
  /** Institution/premium tier accent text. */
  premium: '#fde68a',
  /** Institution/premium tier border. */
  premiumBorder: '#ca8a04',
  /** Dark amber fill — active babble, current step background. */
  warningFill: '#422006',
  /** Deep amber fill variant. */
  warningFillDeep: '#78350f',
  /** Amber tint background. */
  warningTint: '#fef3c7',
  /** Amber-on-light text. */
  warningOnLight: '#b45309',
} as const;

/**
 * "Classic light" board scene — the light-mode counterpart used when the
 * communicator selects the classic-light AAC theme. Distinct from app chrome:
 * these are light-ground values and must not be mixed with `neutral`/`surface`.
 */
export const classic = {
  /** Darkest text on light scenes. */
  text: '#111827',
  /** Secondary text on light scenes. */
  textSecondary: '#374151',
  /** Muted text on light scenes. */
  textMuted: '#6b7280',
  /** Slightly stronger muted on light scenes. */
  textMutedStrong: '#4b5563',
  /** Panel/card background on light scenes. */
  surface: '#f9fafb',
  /** Alternate light surface. */
  surfaceAlt: '#f3f4f6',
  /** Light scene borders. */
  border: '#e5e7eb',
  /** Stronger light-scene border. */
  borderStrong: '#d1d5db',
  /** Slate accents used in light scenes. */
  slate: '#1e293b',
  /** Mid slate. */
  slateMid: '#334155',
} as const;

/**
 * Warm stone ramp — used by the visual-schedule surface, which deliberately
 * runs warmer than the neutral chrome to distinguish routine content.
 */
export const stone = {
  text: '#a8a29e',
  surface: '#1c1917',
  surfaceRaised: '#292524',
  border: '#44403c',
} as const;

/** Flat convenience view for the most-used tokens. */
export const tokens = {
  neutral,
  surface,
  brand,
  status,
  classic,
  stone,
} as const;

export type Tokens = typeof tokens;
