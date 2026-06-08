# Migrating to Voxa from other AAC platforms

Voxa uses **Open Board Format (OBF)** as the primary interchange format. This guide covers supported import paths for commercial GA.

## Supported today

### Open Board Format (`.obf` JSON)

1. Sign in at [voxa.madfam.io](https://voxa.madfam.io) (Janua SSO).
2. Switch role to **Editor (SLP)** or **Admin**.
3. Open your board from the **Board** dropdown (or use the default `demo-core` starter).
4. Click **Import OBF** and select a `.obf` or `.json` file.
5. Click **Save** to persist to your account.

**API import** (automation):

```bash
curl -X POST "https://voxa-api.madfam.io/v1/boards/{boardId}/import/obf" \
  -H "Authorization: Bearer ${VOXA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @my-board.obf
```

**Export:**

```bash
curl "https://voxa-api.madfam.io/v1/boards/{boardId}/export/obf" \
  -H "Authorization: Bearer ${VOXA_ACCESS_TOKEN}"
```

### From Cboard / CoughDrop / OpenAAC tools

Export **OBF 3.x JSON** from the source app, then import via Voxa Editor. Voxa maps:

- Button labels and vocalization text
- Grid rows/columns
- Background colors (when present)
- Basic symbol URLs (when inline HTTP URLs)

**Not yet supported:** `.obz` zip bundles with embedded media, folder navigation (`load_board_id`), hierarchical `parent_id` trees.

## Coming soon (P2)

| Source | Format | Target |
|--------|--------|--------|
| Grid 3 | `.gridset` | AACProcessors pipeline |
| TouchChat / TD Snap | Proprietary export | AACProcessors pipeline |
| Proloquo2Go | Backup export | Partner migration service |

Track progress in [FEATURE_PARITY.md](./FEATURE_PARITY.md).

## Multi-board accounts

After sign-in, use the **Board** selector in the header to switch boards. Editors can **New board** to create an empty grid owned by their account. Board limits follow your Dhanam plan tier.

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
- Competitive benchmark: [AAC_PLATFORM_BENCHMARK.md](./AAC_PLATFORM_BENCHMARK.md)
