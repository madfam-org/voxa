# Migrating to Voxa from other AAC platforms

Voxa uses **Open Board Format (OBF)** as the primary interchange format. This guide covers the import and export paths on `main` today; the capability table is [capabilities.md](../capabilities.md#open-board-format-and-other-files).

## Supported today

Every import creates **new boards** owned by you (in your organization) and opens them; the board you are viewing, and the shared `demo-core` demo board, are never changed. Imports count against your plan's board limit: when it is reached the API answers `402` with `{ code: "BOARD_LIMIT", tier, limit }` and the editor explains the limit and offers to export the board on screen (OBF/OBZ) or delete a board you no longer need.

### Open Board Format (`.obf` JSON, `.obz` packages)

Voxa reads and writes [Open Board Format 0.1](https://www.openboardformat.org/docs) (`format: "open-board-0.1"`), the open format that many AAC tools exchange.

1. Sign in at [voxa.madfam.io](https://voxa.madfam.io).
2. Switch role to **Editor (SLP)** or **Admin**.
3. Click **Import OBF** or **Import OBZ**, select the file and confirm. The imported board opens.

What Voxa imports:

- buttons at the cells of `grid.order` (2-D array of button ids, `null` for empty cells), labels and `vocalization`;
- pictures referenced by `image_id` through `images[]`: embedded `data` and, in `.obz` packages, `path` entries (PNG, JPEG, GIF, WebP) are stored as media of the new board; Mulberry symbols of Voxa's vendored set are kept; **pictures at other web addresses are not downloaded** — the button imports without them and Voxa tells you how many were skipped;
- recordings referenced by `sound_id` through `sounds[]` (embedded or in-package MP3, WAV, Ogg, WebM, MP4);
- every board listed in an `.obz` `manifest.json`, with `load_board` links between them remapped to the new boards (a link to a board outside the file is kept only when it names one of your boards);
- part of speech from `border_color` (`rgb()` or hex, Modified Fitzgerald Key), `hidden`, and the board `locale`.

Files exported by earlier Voxa versions (`format: "open-board-format"`, `.obz` with a single `board.json`) still import.

**API import** (automation): `POST /v1/boards/import/{obf|obz|gridset|snap|touchchat}`, optional `?locale=es-MX|en-US|fr-FR` for files without a locale. The answer (`201`) lists the new `boards`, the `rootBoardId`, `warnings` and `skipped` counts.

```bash
curl -X POST "https://voxa-api.madfam.io/v1/boards/import/obz" \
  -H "Authorization: Bearer ${VOXA_ACCESS_TOKEN}" \
  -H "Content-Type: application/zip" \
  --data-binary @my-boards.obz
```

The former `POST /v1/boards/{boardId}/import/*` endpoints, which replaced a board in place, answer `410 Gone`.

**Export:** `GET /v1/boards/{boardId}/export/obf` (spec OBF 0.1) and `GET /v1/boards/{boardId}/export/obz` (`manifest.json`, `boards/<id>.obf`, `images/`, `sounds/`). Mulberry pictures carry their CC BY-SA 4.0 licence object; Voxa-only data (motor-plan locks, part of speech, Gestalt phrases, word forms) travels as `ext_voxa_*` properties, so a Voxa → OBF → Voxa round trip is exact. JSON Schemas of what Voxa writes: `packages/obf/schema/`.

```bash
curl "https://voxa-api.madfam.io/v1/boards/{boardId}/export/obz" \
  -H "Authorization: Bearer ${VOXA_ACCESS_TOKEN}" -o my-board.obz
```

**Not supported:** `button.action` / `actions` (spelling and clear actions), absolute button placement (`top`/`left`), board `url`/`data_url` downloads.

### Other AAC apps' files — beta, imports the words of one page

These adapters were built from the documented file structures and are tested on synthetic archives only.

| Format | What is imported |
|--------|------------------|
| Grid 3 `.gridset` | The **home grid** (the `<StartGrid>` of `Settings0/settings.xml`): captions at their X/Y cells. Locale from the gridset settings when present. |
| TD Snap `.spb` / `.sps` | Button labels and messages of the primary page at their grid positions. |
| TouchChat `.ce` | The Home page's button labels and messages. |

No pictures, no recordings and no links to other pages are imported (links are removed and counted); boards without a locale in the file take your interface language (`es-MX` by default).

### Starter templates

Create boards from the editor template picker, from the first-run setup, or through the API. Templates: **core 24** (4×6), **core 36** (6×6) and **core 60** (6×10), which share one motor plan (a word keeps its row and column as the board grows); **Core 47** (6×8, motor-plan locked core); **Core 100** (10×10); **Literacy Keyboard**; **Visual Schedule**. Each is built in es-MX, en-US or fr-FR, and the vocabulary is pending clinical review. An unknown `templateId` answers `400`.

```bash
curl -X POST "https://voxa-api.madfam.io/v1/boards" \
  -H "Authorization: Bearer ${VOXA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"id":"board-my-core","name":"Therapy core","templateId":"core-100","profileId":"default","version":1,"grid":{"rows":4,"columns":4,"buttons":[]}}'
```

List templates: `GET /v1/boards/templates/list`.

### Literacy keyboard

Create a **Literacy Keyboard** board from the editor template picker for literate users who type messages character-by-character (the es-MX keyboard adds á é í ó ú ü ñ ¿ ¡). The message bar shows basic word suggestions when the person has turned them on.

## Multi-board accounts

After sign-in, use the **Board** selector in the header to switch boards. **New board** creates a board owned by your account. Board limits follow your plan tier (the free plan allows one board).

## Staging validation

Before production migration, validate on staging:

```bash
VOXA_STAGING_API_URL=https://voxa-api-staging.madfam.io \
VOXA_TEST_ACCESS_TOKEN='…' \
  ./scripts/launch/soak-scenarios.sh --with-auth
```

## Support

- Architecture: [../architecture.md](../architecture.md)
- Auth setup: [../auth/JANUA.md](../auth/JANUA.md)
