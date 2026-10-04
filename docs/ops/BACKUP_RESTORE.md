# Backup and restore — Voxa PostgreSQL

> Public-safe summary. Concrete hosts, database roles and the operator's backup and restore commands live in MADFAM's private operations repository, not here.

Voxa board data lives in PostgreSQL when `DATABASE_URL` is set (the platform's shared PostgreSQL server or an Enclii-managed addon).

## What is backed up

| Data | Table | Notes |
|------|-------|-------|
| Boards | `boards` | Includes grid JSON, owner, org |
| Sync history | `sync_events` | Trimmed to 5000 rows per store logic |
| Membership | `board_members` | Future sharing; schema ready |

File-store fallback (`emptyDir` at `/app/data`) is **not** durable across pod restarts. Production must use Postgres.

## Platform backups

CloudNativePG on Enclii typically provides scheduled backups to object storage. Confirm with platform ops:

1. Backup schedule (daily minimum for GA).
2. Retention window (30 days recommended).
3. Restore drill cadence (quarterly).

## Manual logical backup

A platform operator takes an on-demand logical backup (`pg_dump --format=custom` of the Voxa database) through the platform's documented procedure. Store dumps encrypted at rest; never commit dumps to git.

## Restore procedure

1. **Announce maintenance** — sync will be read-only or unavailable.
2. Scale `voxa-api` to zero replicas through Enclii.
3. Restore into a fresh database, or drop and recreate the schema in the maintenance window, with `pg_restore --clean --if-exists` against the dump (operator procedure).

4. Run migrations if restoring to empty DB without dump schema:

```bash
pnpm --filter @voxa/api db:migrate
```

5. Scale API back up and verify:

```bash
curl -sS https://voxa-api.madfam.io/health/ready
curl -sS -H 'X-Voxa-User-Id: smoke' https://voxa-api.madfam.io/v1/boards
```

6. Spot-check boards in web UI and run e2e smoke against staging before prod.

## Disaster recovery RPO/RTO targets (GA)

| Metric | Target |
|--------|--------|
| RPO | ≤ 24 hours (daily backup) |
| RTO | ≤ 4 hours for full restore |

Tighten with continuous WAL archiving when platform supports it.

## File-store development

Local `apps/api/data/boards.json` can be copied for dev recovery only. Do not use for production DR.
