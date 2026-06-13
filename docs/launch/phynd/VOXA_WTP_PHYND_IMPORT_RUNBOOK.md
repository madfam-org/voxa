# Voxa WTP — Phynd campaign import

Import Van Westendorp survey campaigns into Phynd CRM for `voxa__family` and `voxa__clinic`.

**Prerequisites:** `PHYND_CAMPAIGN_IMPORT_SECRET` (production — from secret store, not git).

## Payloads

| SKU | File |
|-----|------|
| `voxa__family` | [`VOXA_WTP_FAMILY_CAMPAIGN_IMPORT_PAYLOAD_2026-06.json`](./VOXA_WTP_FAMILY_CAMPAIGN_IMPORT_PAYLOAD_2026-06.json) |
| `voxa__clinic` | [`VOXA_WTP_CLINIC_CAMPAIGN_IMPORT_PAYLOAD_2026-06.json`](./VOXA_WTP_CLINIC_CAMPAIGN_IMPORT_PAYLOAD_2026-06.json) |

## Import (production)

```bash
cd phynd-crm
export PHYND_CAMPAIGN_IMPORT_URL=https://crm.madfam.io/api/v1/campaigns/import
export PHYND_WEBHOOK_HOST=crm.madfam.io
# PHYND_CAMPAIGN_IMPORT_SECRET from Lockbox — do not echo

node scripts/run-karafiel-contador-g4-campaign.mjs \
  ../voxa/docs/launch/phynd/VOXA_WTP_FAMILY_CAMPAIGN_IMPORT_PAYLOAD_2026-06.json \
  <consented_contact_id>
```

Repeat for clinic payload. Review in Phynd UI before send (`POST /api/v1/campaigns/review`).

## After ≥10 responses per SKU

```bash
cd tulana/apps/api
python manage.py tulana_import_wtp_signals --file phynd-export.json --aggregate --min-responses 10
bash ../../scripts/voxa-pricing-bootstrap.sh --persist
```

See [`../PHYND_WTP_LAUNCH.md`](../PHYND_WTP_LAUNCH.md) for survey copy and gates.
