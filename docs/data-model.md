# Voxa data model

Voxa stores communication boards and sync events. PostgreSQL is the production store; local development falls back to `data/boards.json` when `DATABASE_URL` is unset.

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

The API container runs migrations automatically on startup when `DATABASE_URL` is set.

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

## Future tables

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant boundary for teams |
| `user_profiles` | Communicator settings (CVI theme, dwell, locales) |

See [architecture.md](./architecture.md) and [GA_CHECKLIST.md](./launch/GA_CHECKLIST.md).
