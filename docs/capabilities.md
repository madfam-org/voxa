# What Voxa does today

> Last checked against `main`: 2026-10-04. Rows name the pull request that
> delivered the capability (for the October 2026 wave) and the tests that hold
> it. If a row and the code disagree, the code wins: please open an issue.

Voxa is an augmentative and alternative communication (AAC) app: a
communication board that turns taps, switch presses and pointer dwell into
spoken language. It is Spanish first (es-MX), also in English and French, and
open source under Apache-2.0. The app runs in the browser on phones, tablets
and computers; the native mobile app is not in the app stores yet.

**Status key.** **Shipped**: in production on `main`, covered by tests.
**Partial**: works with a stated limit, or built but switched off. **Not yet**:
not available; listed so nobody assumes it is.

Plans and prices are on the landing page, [voxa.madfam.io](https://voxa.madfam.io).
Engineering gaps and their priority are in
[AGENTS.md, "Pending work and known gaps"](../AGENTS.md#pending-work-and-known-gaps).

## Clinical review

The Spanish core vocabulary, the core board order, the Spanish symbol keywords,
the Spanish suggestion table and the Spanish agreement rules were written by
the project from standard Mexican Spanish usage. **No credentialed
speech-language pathologist has reviewed them yet.** The app and the board
templates say "pending clinical review" where it applies. Voxa makes no claim
of clinical review until one has happened.

## Communication board

| Capability | Status | Evidence |
| --- | --- | --- |
| Board app at `/app` (sign-in) and a public demo at `/demo` (no account): symbol and text buttons, message bar, **Speak** | Shipped | `e2e/specs/smoke.spec.ts`, `e2e/specs/a11y.spec.ts` |
| Templates: Core 47 (6×8, locked core slots), Core 100 (10×10), literacy keyboard (with á é í ó ú ü ñ ¿ ¡ on Spanish boards), visual schedule | Shipped; vocabulary pending clinical review | [#17](https://github.com/madfam-org/voxa/pull/17); `packages/core/src/starter-boards.test.ts`, `packages/core/src/visual-schedule.test.ts` |
| Core boards in three sizes, **24** (4×6), **36** (6×6) and **60** (6×10), built from one ordered word list: each size is the top-left block of the next, so growing a board never moves a learned word | Shipped; order pending clinical review | [#41](https://github.com/madfam-org/voxa/pull/41); `packages/core/src/core-grid-sizes.test.ts` |
| First-run setup (once per user and device): board language, access method, grid size with a live preview, voice; then the first board opens. Every step can be skipped | Shipped | [#41](https://github.com/madfam-org/voxa/pull/41); `apps/web/src/lib/first-run.test.ts`, `e2e/specs/first-run.spec.ts` |
| Motor-plan locks: locked core slots stay put; only an organization admin can override, and the server enforces it | Shipped | [#36](https://github.com/madfam-org/voxa/pull/36), [#37](https://github.com/madfam-org/voxa/pull/37); `apps/api/src/routes/motor-planning-override.routes.test.ts` |
| Several boards per account (board picker, **New board**), hide or show single buttons, babble mode (hidden words visible for a session), hide labels or symbols, build a message without speaking (whisper mode) | Shipped | `e2e/specs/editor-workflow.spec.ts` (signed-in, runs against staging); board limits follow the plan |
| Modified Fitzgerald Key colours on button borders, never colour alone | Shipped | [linguistic-framework.md](./linguistic-framework.md#modified-fitzgerald-key) |
| Gestalt language (GLP) phrase buttons, recorded speech per button, GLP video in a visible, closable dialog | Shipped | [#32](https://github.com/madfam-org/voxa/pull/32); `e2e/specs/offline-media.spec.ts` |
| Usage report per board (counts only, with consent) and a board audit log | Shipped | `apps/api/src/routes/events.routes.test.ts`, `apps/api/src/routes/boards.routes.test.ts` |

## Offline

| Capability | Status | Evidence |
| --- | --- | --- |
| The open board keeps working when the network drops; edits made offline are queued on the device and saved when the connection returns | Shipped | [#32](https://github.com/madfam-org/voxa/pull/32), [#36](https://github.com/madfam-org/voxa/pull/36); `e2e/specs/offline-media.spec.ts`, `e2e/specs/access-methods.spec.ts` |
| After one visit with a connection, `/app` reopens offline on that device with the boards already loaded (service worker; never caches API answers or other sites) | Shipped | [#32](https://github.com/madfam-org/voxa/pull/32); `apps/web/src/service-worker.test.ts` |
| A recording that cannot load offline is spoken with the device voice instead | Shipped | [#32](https://github.com/madfam-org/voxa/pull/32) |
| Boards never opened on the device are not available offline | Not yet | — |

## Symbols

| Capability | Status | Evidence |
| --- | --- | --- |
| [Mulberry Symbols](https://mulberrysymbols.org), the full set (3,436 SVG, © Steve Lee, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)), served from Voxa's own host | Shipped | [#18](https://github.com/madfam-org/voxa/pull/18); [`NOTICE`](../NOTICE), `/legal/symbols` |
| Symbol search in Spanish, English and French that answers offline (no third-party request). Spanish keywords cover 450 symbols, pending clinical review | Shipped | [#18](https://github.com/madfam-org/voxa/pull/18); `packages/symbols/src/mulberry-search.test.ts`, `apps/api/src/routes/symbols.routes.test.ts` |
| Core words show a Mulberry symbol only where the picture matches the word in all three languages; otherwise the button shows its label | Shipped | [#17](https://github.com/madfam-org/voxa/pull/17); `packages/core/src/core-symbols.test.ts` |
| Your own photos on buttons (type-checked, per-person storage quota) | Shipped | [#37](https://github.com/madfam-org/voxa/pull/37); `apps/api/src/routes/media.routes.test.ts`, `apps/api/src/routes/media-hardening.routes.test.ts` |
| Only commercially licensed symbols: the earlier non-commercial library is gone from every surface, and old boards that used it show labels | Shipped | [#18](https://github.com/madfam-org/voxa/pull/18), [#40](https://github.com/madfam-org/voxa/pull/40) (licence guard) |
| Generated or MADFAM-made symbols | Not yet | — |

## Speech and voices

| Capability | Status | Evidence |
| --- | --- | --- |
| Speaks with the voices installed on the device; every utterance uses the board's language (es-MX first) | Shipped (web) | [#38](https://github.com/madfam-org/voxa/pull/38); `apps/web/src/lib/play-button-speech.test.ts` |
| Choose the voice per language, tune rate, pitch and volume, preview it; a "higher voice" preset labelled as an approximation | Shipped (web) | [#38](https://github.com/madfam-org/voxa/pull/38); `e2e/specs/voice-choice.spec.ts` |
| Steps to install a voice when the device has none for the language | Shipped (web) | [#38](https://github.com/madfam-org/voxa/pull/38) |
| Voice choice in the mobile app | Not yet | The mobile app speaks with the device default voice |
| Natural child voices; licensed or cloud voices; voice banking | Not yet | — |

## Spanish

| Capability | Status | Evidence |
| --- | --- | --- |
| Spanish is the default interface language; English and French are complete. No hard-coded interface text | Shipped | [#29](https://github.com/madfam-org/voxa/pull/29); `apps/web/src/hardcoded-ui-text.test.ts` |
| Spanish agreement as you build a message: "yo querer beber" reads and speaks "yo quiero beber"; reflexive verbs, *gustar*, gender and number after *ser*/*estar*. A **Base form** toggle and a setting keep the words as tapped | Shipped (present tense only); pending clinical review | [#29](https://github.com/madfam-org/voxa/pull/29); `packages/vocabulary/src/spanish-morphology.test.ts` |
| Past tense, subjunctive, object agreement | Not yet | [linguistic-framework.md](./linguistic-framework.md#spanish-morphology-es-mx) |
| Mixing two languages in one message with per-word pronunciation | Not yet | — |

## Access methods

| Capability | Status | Evidence |
| --- | --- | --- |
| Touch, selecting on press or on release; large targets (scalable); a keyguard (touch guard) that blocks touches between or around buttons | Shipped | `packages/access/src/touch-activation.test.ts`, `packages/access/src/touch-guard.test.ts` |
| Switch scanning with one switch (auto scan) or two (step scan); linear, row, column and quadrant scans; a **Back** position and automatic return so a group never traps the user; first-item hold, acceptance time, pause after selection, spoken and beep cues | Shipped | [#36](https://github.com/madfam-org/voxa/pull/36); `packages/access/src/scan-machine.test.ts` |
| Switches that act as a keyboard (USB or Bluetooth) and gamepad buttons | Shipped (web); keyboard-mode switches on mobile | `packages/access/src/hardware-switch-adapter.test.ts`; [accessibility.md](./accessibility.md#switch-scanning) |
| Pointer dwell (500 ms to 3 s): works with any device that moves the pointer, such as a head pointer or an eye tracker whose own software drives the pointer | Shipped; not tested by us on eye-tracking hardware | [#36](https://github.com/madfam-org/voxa/pull/36) |
| Gaze event bridge (`voxa:gaze`) for integrators who already have gaze coordinates | Partial (experimental) | [accessibility.md](./accessibility.md#dwell-selection-head-pointers-and-pointer-driving-eye-trackers) |
| Direct integration with eye-tracker hardware or vendor SDKs | Not yet | — |
| Moving buttons in the editor without dragging: **Move**, then tap the destination (works on touch screens), or arrow keys | Shipped | [#36](https://github.com/madfam-org/voxa/pull/36); `e2e/specs/access-methods.spec.ts` |

## Open Board Format and other files

| Capability | Status | Evidence |
| --- | --- | --- |
| [Open Board Format 0.1](https://www.openboardformat.org/docs) export and import: `.obf` boards and `.obz` packages with `manifest.json`, linked boards, embedded pictures and sounds; Voxa-only data travels as `ext_voxa_*`, so a Voxa → OBF → Voxa round trip is exact | Shipped | [#35](https://github.com/madfam-org/voxa/pull/35); `packages/obf/src/*.test.ts`, schemas in `packages/obf/schema/` |
| Imports always create new boards; the open board and the demo board are never changed. Unsafe archives are refused; pictures at other web addresses are not downloaded (the import says how many were skipped) | Shipped | [#35](https://github.com/madfam-org/voxa/pull/35); `apps/api/src/routes/import.routes.test.ts`, `e2e/specs/board-import.spec.ts` |
| Exported symbols carry their licence (OBF `license` objects) | Shipped | [#18](https://github.com/madfam-org/voxa/pull/18) |
| Imports from three other AAC apps' files (`.gridset`, `.sps`/`.spb`, `.ce`): the words of one page | Partial (beta) | [#35](https://github.com/madfam-org/voxa/pull/35); [migration guide](./launch/MIGRATION.md) |
| OBF button actions and absolute placement | Not yet | [migration guide](./launch/MIGRATION.md) |

## Accounts and sign-in

| Capability | Status | Evidence |
| --- | --- | --- |
| Sign-in with the person's MADFAM account (Janua) through Auth.js; the session is an encrypted cookie and no access token ever reaches page code (the app calls the API through its own server) | Shipped | [#39](https://github.com/madfam-org/voxa/pull/39); `apps/web/src/lib/auth-session.test.ts`, `apps/web/src/lib/api-proxy.test.ts`, `e2e/specs/session-account.spec.ts` |
| The session renews itself before the access token expires; when it cannot, the person is signed out cleanly | Shipped | [#39](https://github.com/madfam-org/voxa/pull/39); `apps/web/src/lib/auth-session.test.ts` |
| **Cambiar de cuenta** (choose another MADFAM account) and **Entrar como otra persona** (sign in again) on the sign-in page and in the app, in Spanish, English and French | Shipped | [#39](https://github.com/madfam-org/voxa/pull/39); `apps/web/src/lib/account-switch.test.ts`, `e2e/specs/session-account.spec.ts` |
| Signing out also ends the MADFAM session, so the next person on a shared tablet is not signed back in as the previous one | Shipped | [#39](https://github.com/madfam-org/voxa/pull/39); `apps/web/src/lib/sign-out.test.ts` |
| Signing out or switching clears the previous account's boards, pending changes and consent copy from the device (device settings such as the access method stay); a change queued under one account is never sent under another | Shipped | [#39](https://github.com/madfam-org/voxa/pull/39); `apps/web/src/lib/account-data.test.ts`, `apps/web/src/lib/pending-board-save.test.ts` |

## Team sync and co-editing

| Capability | Status | Evidence |
| --- | --- | --- |
| Boards saved to the cloud and opened on any signed-in device | Shipped | `apps/api/src/routes/boards.routes.test.ts`, `packages/sync/src/save-board.test.ts` |
| Two people saving the same board version: one save wins, the other is told and reloads; nothing is overwritten silently | Shipped | [#37](https://github.com/madfam-org/voxa/pull/37); `apps/api/src/store/pg-board-store.pg.test.ts` |
| Roles from the person's MADFAM account (communicator, editor, admin), limited to their own organization; owners edit their own boards | Shipped | [#16](https://github.com/madfam-org/voxa/pull/16); `apps/api/src/routes/authz.routes.test.ts` |
| Live updates between devices while a board is open: each browser opens its live connection with a single-use ticket, and an edit saved on one device reaches the others | Shipped | [#39](https://github.com/madfam-org/voxa/pull/39); `e2e/specs/live-sync.spec.ts`, `apps/api/src/routes/ws-ticket.routes.test.ts` |
| Live updates across server replicas (Redis) | Partial: built and tested, not enabled in production | [#37](https://github.com/madfam-org/voxa/pull/37); `apps/api/src/ws/sync-hub.redis.test.ts` |
| Inviting a care team from inside Voxa | Not yet | Roles are granted in the MADFAM account |

## Privacy and consent

| Capability | Status | Evidence |
| --- | --- | --- |
| Two separate choices, word suggestions and usage counts, stored on the server per person; nothing is sent while undecided | Shipped | [#24](https://github.com/madfam-org/voxa/pull/24); `apps/api/src/routes/consents.routes.test.ts` |
| Usage logging keeps counts only (board and button), never what was said | Shipped | [#24](https://github.com/madfam-org/voxa/pull/24); `apps/api/src/routes/events.routes.test.ts` |
| Spoken text is kept only for an organization with a data-processing agreement and a separate opt-in, and cleared after 90 days. No organization is enabled today | Shipped (off) | [#24](https://github.com/madfam-org/voxa/pull/24); `apps/api/src/routes/consent.pg.test.ts` |
| Text stored before these rules was cleared | Shipped | [#25](https://github.com/madfam-org/voxa/pull/25) |
| A board owner can delete the board's usage history | Shipped | [#24](https://github.com/madfam-org/voxa/pull/24) |

## Word suggestions and AI

| Capability | Status | Evidence |
| --- | --- | --- |
| Basic word suggestions from a local rule-based predictor (Spanish and English; none for French), only with the person's consent | Shipped; Spanish table pending clinical review | [#20](https://github.com/madfam-org/voxa/pull/20), [#28](https://github.com/madfam-org/voxa/pull/28); `packages/ai/src/predict.test.ts` |
| No call to any third-party AI service; a CI guard fails on one | Shipped | [#20](https://github.com/madfam-org/voxa/pull/20), [#40](https://github.com/madfam-org/voxa/pull/40) |
| Model suggestions through MADFAM's own model gateway, sending only the current partial message and only to local models | Partial: built, switched off | [#28](https://github.com/madfam-org/voxa/pull/28); `apps/api/src/lib/selva.test.ts` |
| Suggestions learned from a person's history, next-symbol models, generated symbols | Not yet | [ai-roadmap.md](./ai-roadmap.md) |

## Accessibility

| Capability | Status | Evidence |
| --- | --- | --- |
| Automated accessibility checks (axe, WCAG 2.2 AA rules) in CI on the public pages, the editor panels, `/app` in all four themes, the Spanish landing, demo, app and settings, the voice settings, every first-run step and the GLP video dialog; serious or critical findings fail the build | Shipped | [#36](https://github.com/madfam-org/voxa/pull/36), [#38](https://github.com/madfam-org/voxa/pull/38), [#40](https://github.com/madfam-org/voxa/pull/40), [#41](https://github.com/madfam-org/voxa/pull/41); `e2e/specs/a11y.spec.ts` |
| Text and scan-highlight contrast held by tests on every theme | Shipped | [#36](https://github.com/madfam-org/voxa/pull/36); `apps/web/src/lib/theme-contrast.test.ts` |
| WCAG 2.2 AA is the target. No external audit or conformance report exists | Partial | [accessibility.md](./accessibility.md) |

## Where it runs

| Capability | Status | Evidence |
| --- | --- | --- |
| Web app in current browsers on phones, tablets and computers (Android, iPad and iPhone, Windows, macOS, ChromeOS), installable to the home screen | Shipped | `apps/web` |
| Native app for iOS and Android (Expo): builds and bundles in CI, shows symbols, switch scanning | Partial: no store or test build yet | [#31](https://github.com/madfam-org/voxa/pull/31); [MOBILE_GA.md](./launch/MOBILE_GA.md) |
| Desktop apps | Not yet | — |

## Related

- [Accessibility statement and standards](./accessibility.md)
- [Linguistic framework](./linguistic-framework.md)
- [Migration guide (OBF and beta imports)](./launch/MIGRATION.md)
- [Architecture](./architecture.md)
- [CHANGELOG](../CHANGELOG.md)
