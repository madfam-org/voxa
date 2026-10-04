# Voxa data model

Voxa stores communication boards and sync events. PostgreSQL is the production store. When `DATABASE_URL` is unset (local development, tests) the API falls back to a JSON file, `boards.json` under `VOXA_DATA_DIR` (default `./data` in the API's working directory), which it replaces atomically (temp file, `fsync`, `rename`). Media and activation events are kept in memory in that mode, and consents in `consents.json` beside `boards.json`. With `NODE_ENV=production` the API refuses to start without `DATABASE_URL`.

## Tables

### `boards`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text` PK | Board identifier (e.g. `demo-core`) |
| `name` | `text` | Display name |
| `profile_id` | `text` | Communicator profile reference |
| `owner_user_id` | `text` | Janua user id that owns the board (null for shared demo) |
| `org_id` | `text` | Organization tenant (optional) |
| `grid` | `jsonb` | Full `@voxa/core` grid document (buttons, rows, columns) |
| `layout` | `text` | Optional board kind (`grid`, `literacy-keyboard`, `visual-schedule`); migration 0007 |
| `display` | `jsonb` | Optional per-board display preferences (hide labels or symbols …); migration 0007 |
| `version` | `integer` | Compare-and-set counter: an update applies only `WHERE id = $1 AND version = $2` |
| `updated_at` | `timestamptz` | Last mutation time (ISO string in API) |

The `grid` JSON matches the `Board` type in `@voxa/core`, including motor-planning `locked` slots and GLP phrase buttons. Indexes on `owner_user_id` and `org_id` (migration 0006) serve the scoped board list and the plan's board count.

### `sync_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text` PK | Event UUID |
| `type` | `text` | `board.created`, `board.updated`, etc. |
| `board_id` | `text` FK | Parent board |
| `version` | `integer` | Board version after event |
| `actor_user_id` | `text` | Janua user id (dev: `X-Voxa-User-Id` header) |
| `timestamp` | `timestamptz` | Event time |
| `payload` | `jsonb` | Optional metadata |

Index: `(board_id, version)` for incremental sync queries.

### `board_members`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text` PK | Membership row id |
| `board_id` | `text` FK | Board |
| `user_id` | `text` | Janua user id |
| `role` | `text` | `communicator`, `editor`, or `admin` |
| `created_at` | `timestamptz` | When access was granted |

Unique index on `(board_id, user_id)`. Route ACLs currently enforce ownership; membership rows support future sharing.

## Access control

- `demo-core` is readable by all callers and editable by nobody.
- Other boards: the `owner_user_id` reads and edits; `editor`/`admin` (Janua
  `voxa:*` app roles) read and edit boards whose `org_id` equals their token's
  `org_id`. There is no cross-tenant role. See [auth/JANUA.md](./auth/JANUA.md#board-access).
- `owner_user_id` and `org_id` come from the token at creation and never change
  through updates or imports.
- Any signed-in user may create boards; creation respects the plan's
  `boards:N` limit, resolved from the `voxa_tier` claim of the Janua access
  token (`apps/api/src/lib/entitlement.ts`).
- `sync_events` keeps the newest 5,000 events per board.

## Migrations

Schema lives in `apps/api/src/db/schema.ts`. SQL migrations are in `apps/api/drizzle/migrations/`.

```bash
# Generate a new migration after schema changes
pnpm --filter @voxa/api db:generate

# Apply migrations (CI, deploy, or local)
DATABASE_URL='postgresql://…' pnpm --filter @voxa/api db:migrate
```

The API container runs migrations automatically on startup when `DATABASE_URL` is set, on a dedicated single connection that is closed before the server listens. The run holds a PostgreSQL session advisory lock, so processes that start at the same time apply migrations one after the other. A transient connection refusal at startup is retried for `DATABASE_STARTUP_RETRY_MS` (default 30 s); SQL and migration errors are never retried. Pool sizing and the connection budget: [deploy/ENCLII.md](./deploy/ENCLII.md#connection-budget-contract).

The migrator only applies files listed in `drizzle/migrations/meta/_journal.json`, and `db:generate` diffs against the newest `meta/NNNN_snapshot.json`. Migration `0003_media_assets` is idempotent (`IF NOT EXISTS`, guarded FK), so databases that already had the table apply it cleanly. Always add migrations with `db:generate` (or, for a hand-written file, add its journal entry with a `when` greater than the previous entry, plus a matching snapshot). `src/db/migrations-journal.test.ts` and the CI drift step (`drizzle-kit generate` must produce no changes) enforce this.

### `activation_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text` PK | Event UUID |
| `board_id` | `text` FK | Board where button was activated |
| `button_id` | `text` | Button identifier |
| `user_id` | `text` | Janua user id |
| `speech_text` | `text` | Spoken text. `NULL` by default; see below |
| `speech_text_consented` | `boolean` | `true` only when `speech_text` was written under an `utterance_text` consent from an allow-listed organization |
| `recorded_at` | `timestamptz` | Activation time |

Activations are **counts only** by default. `POST /v1/events/activations` needs the caller's `usage_analytics` consent record (403 otherwise; nothing is stored) and answers 403 for the shared `demo-core` board. `speech_text` is written only when the caller granted `utterance_text` **and** their organization is listed in `VOXA_UTTERANCE_TEXT_DPA_ORG_IDS` (organizations with a data-processing agreement; empty by default, so no text is stored). A timer in each API process clears opted-in text older than 90 days (`speech_text_consented = true` rows only; one replica at a time via a PostgreSQL advisory lock; interval `VOXA_UTTERANCE_PURGE_INTERVAL_MS`, default 6 h). Rows written before server-side consent existed keep `speech_text_consented = false` and are not touched by that purge. Migration `0005_purge_legacy_utterance_text` (irreversible) clears the text of those earlier rows; `apps/api/scripts/legacy-utterance-text-dry-run.sql` counts them (counts and a date range only, never text) and reads 0 afterwards.

Summary endpoint: `GET /v1/events/activations/summary?boardId=&days=7` (people who may edit the board). The board owner can erase a board's whole history with `DELETE /v1/events/activations?boardId=`.

### `consents` and `consent_events`

One row per user and purpose in `consents` (`user_id`, `purpose`, `granted`, `policy_version`, `granted_at`, `revoked_at`, `updated_at`; primary key `user_id, purpose`); every change is also appended to `consent_events` with the server time. Purposes:

| Purpose | Allows |
|---------|--------|
| `ai_processing` | `POST /v1/ai/predict/*` (403 without it) |
| `usage_analytics` | `POST /v1/events/activations` (counts, no text) |
| `utterance_text` | keeping `speech_text`, honoured only for organizations in `VOXA_UTTERANCE_TEXT_DPA_ORG_IDS` |

`GET /v1/consents` and `PUT /v1/consents` (`{ "consents": { "ai_processing": true, "usage_analytics": false } }`) act on the signed-in user only. No record means not granted. No request header grants consent. Without `DATABASE_URL` the API keeps these records in `consents.json` under `VOXA_DATA_DIR`, replaced atomically like `boards.json`. The web app keeps a copy in `localStorage` (`voxa-consent`) as an offline cache only; a signed-out visitor's choice stays on the device.

**Board files (OBF 0.1):** `POST /v1/boards/import/:format` (`obf`, `obz`, beta `gridset`/`snap`/`touchchat`) always creates NEW boards owned by the caller (embedded media becomes `media_assets` rows of the new boards; remote picture URLs are never fetched); `GET /v1/boards/:id/export/obf` and `/export/obz` write spec OBF 0.1 (`.obz`: `manifest.json`, `boards/*.obf`, `images/*`, `sounds/*`) per `@voxa/obf`. See [MIGRATION.md](./launch/MIGRATION.md).

### `media_assets`

Uploaded photos, button recordings and GLP video clips (base64 in PostgreSQL; moving the bytes to object storage is an open decision, see AGENTS.md). Uploads must match their declared type by magic bytes and count against a per-user quota (`MEDIA_QUOTA_BYTES_PER_USER`, default 500 MB). Index on `owner_user_id` (migration 0006).

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text` PK | Media UUID |
| `board_id` | `text` FK | Owning board |
| `owner_user_id` | `text` | Uploader (editor) |
| `mime_type` | `text` | e.g. `audio/webm`, `video/mp4` |
| `size_bytes` | `integer` | Payload size |
| `data` | `text` | Base64-encoded bytes |
| `created_at` | `timestamptz` | Upload time |

Upload: `POST /v1/media` (multipart `boardId` + `file`; the board's owner, or an editor or admin of its organization; never `demo-core`). Serve: `GET /v1/media/:id` (board access). Button JSON stores the returned URL in `RecordedSpeech.url` or `GlpButton.video.url`. Media elements cannot send a bearer token, so the web app loads these URLs through its same-origin proxy `GET /api/media/:id` (`apps/web/src/app/api/media/[id]/route.ts`), which forwards the signed-in session's token from the server and passes the API's 401/403/404 through; the read rule stays in the API. Board JSON keeps the API URL.

## Future tables

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant boundary for teams (today the organization comes from the Janua token's `org_id`) |
| `user_profiles` | Communicator settings (CVI theme, dwell, locales, voice); today they live on each device |

See [architecture.md](./architecture.md) and [capabilities.md](./capabilities.md).
