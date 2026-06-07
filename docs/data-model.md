# Voxa data model

Voxa stores communication boards and sync events. PostgreSQL is the production store; local development falls back to `data/boards.json` when `DATABASE_URL` is unset.

## Tables

### `boards`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text` PK | Board identifier (e.g. `demo-core`) |
| `name` | `text` | Display name |
| `profile_id` | `text` | Communicator profile reference |
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

## Migrations

Schema lives in `apps/api/src/db/schema.ts`. SQL migrations are in `apps/api/drizzle/migrations/`.

```bash
# Generate a new migration after schema changes
pnpm --filter @voxa/api db:generate

# Apply migrations (CI, deploy, or local)
DATABASE_URL='postgresql://…' pnpm --filter @voxa/api db:migrate
```

The API container runs migrations automatically on startup when `DATABASE_URL` is set.

## Future tables (GA roadmap)

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant boundary for teams |
| `board_members` | Enforce `BoardAccess` / `TeamRole` |
| `user_profiles` | Communicator settings (CVI theme, dwell, locales) |
| `utterance_logs` | Consent-gated activation analytics for SLP reporting |

See [architecture.md](./architecture.md) and the GA remediation plan in repo discussions.
