# Backup and restore — Voxa PostgreSQL

Voxa board data lives in PostgreSQL when `DATABASE_URL` is bound via Enclii CloudNativePG addon.

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

From a bastion with cluster access:

```bash
kubectl exec -it voxa-postgres-1 -n data -- \
  pg_dump -U voxa -d voxa --format=custom -f /tmp/voxa.dump

kubectl cp data/voxa-postgres-1:/tmp/voxa.dump ./voxa-$(date +%F).dump
```

Store dumps encrypted at rest; never commit dumps to git.

## Restore procedure

1. **Announce maintenance** — sync will be read-only or unavailable.
2. Scale API to zero: `kubectl scale deployment/voxa-api -n voxa --replicas=0`.
3. Restore into a fresh database or drop/recreate schema in maintenance window:

```bash
pg_restore -U voxa -d voxa --clean --if-exists voxa-YYYY-MM-DD.dump
```

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
