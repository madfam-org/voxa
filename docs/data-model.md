# Voxa data model

Voxa stores communication boards and sync events. PostgreSQL is the production store. When `DATABASE_URL` is unset (local development, tests) the API falls back to a JSON file, `boards.json` under `VOXA_DATA_DIR` (default `./data` in the API's working directory), which it replaces atomically (temp file, `fsync`, `rename`). Media and activation events are kept in memory in that mode.

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
| `version` | `integer` | Optimistic concurrency counter |
| `updated_at` | `timestamptz` | Last mutation time (ISO string in API) |

The `grid` JSON matches the `Board` type in `@voxa/core`, including motor-planning `locked` slots and GLP phrase buttons.

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

- `demo-core` is readable by all authenticated/dev users; edits require `editor` or `admin`.
- Other boards require matching `owner_user_id` or `admin` team role.
- Board creation respects Dhanam entitlements (`boards:N` feature limits).

## Migrations

Schema lives in `apps/api/src/db/schema.ts`. SQL migrations are in `apps/api/drizzle/migrations/`.

```bash
# Generate a new migration after schema changes
pnpm --filter @voxa/api db:generate

# Apply migrations (CI, deploy, or local)
DATABASE_URL='postgresql://…' pnpm --filter @voxa/api db:migrate
```

The API container runs migrations automatically on startup when `DATABASE_URL` is set, on a dedicated single connection that is closed before the server listens. A transient connection refusal at startup is retried for `DATABASE_STARTUP_RETRY_MS` (default 30 s); SQL and migration errors are never retried. Pool sizing and the connection budget: [deploy/ENCLII.md](./deploy/ENCLII.md#connection-budget-contract).

The migrator only applies files listed in `drizzle/migrations/meta/_journal.json`, and `db:generate` diffs against the newest `meta/NNNN_snapshot.json`. Migration `0003_media_assets` is idempotent (`IF NOT EXISTS`, guarded FK), so databases that already had the table apply it cleanly. Always add migrations with `db:generate` (or, for a hand-written file, add its journal entry with a `when` greater than the previous entry, plus a matching snapshot). `src/db/migrations-journal.test.ts` and the CI drift step (`drizzle-kit generate` must produce no changes) enforce this.

### `activation_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text` PK | Event UUID |
| `board_id` | `text` FK | Board where button was activated |
| `button_id` | `text` | Button identifier |
| `user_id` | `text` | Janua user id |
| `speech_text` | `text` | Spoken text (optional) |
| `recorded_at` | `timestamptz` | Activation time |

Requires `X-Voxa-AI-Consent: true` (same opt-in as AI predictions). Summary endpoint: `GET /v1/events/activations/summary?boardId=&days=7` (editor role).

**OBZ bundles:** `POST /v1/boards/:id/import/obz` (zip), `GET /v1/boards/:id/export/obz` — embeds `board.json` plus `images/*` per `@voxa/obf`.

### `media_assets`

Button recordings and GLP video clips (base64 in Postgres for MVP).

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text` PK | Media UUID |
| `board_id` | `text` FK | Owning board |
| `owner_user_id` | `text` | Uploader (editor) |
| `mime_type` | `text` | e.g. `audio/webm`, `video/mp4` |
| `size_bytes` | `integer` | Payload size |
| `data` | `text` | Base64-encoded bytes |
| `created_at` | `timestamptz` | Upload time |

Upload: `POST /v1/media` (multipart `boardId` + `file`, editor role). Serve: `GET /v1/media/:id` (board access). Button JSON stores the returned URL in `RecordedSpeech.url` or `GlpButton.video.url`.

## Future tables

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant boundary for teams |
| `user_profiles` | Communicator settings (CVI theme, dwell, locales) |

See [architecture.md](./architecture.md) and [GA_CHECKLIST.md](./launch/GA_CHECKLIST.md).
