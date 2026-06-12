# Voxa COGS assumptions (Tulana floor input)

**Status:** Draft for Tulana admin entry  
**Last updated:** 2026-06-12  
**FX:** 17.0 MXN/USD (Tulana v0.1 default)  
**Methodology:** Floor = `1.1 × monthly_cost_mxn` per [launch-sku-methodology](../../../../tulana/docs/launch-sku-methodology.md)

Enter these values in Tulana admin **Cost of delivery** for each paid SKU before running `tulana_recommend`.

---

## Shared infrastructure (allocated per paying account)

| Line item | USD/mo | MXN/mo | Notes |
|-----------|--------|--------|-------|
| K8s + ingress (Enclii) | 0.80 | 14 | Shared cluster; amortized per 500 MAU |
| Postgres (Neon/RDS) | 0.45 | 8 | Storage + IOPS per active user |
| Cloudflare + R2 | 0.15 | 3 | Static + symbol cache |
| Janua auth session | 0.05 | 1 | Cross-product SSO |
| Observability | 0.10 | 2 | Logs/metrics slice |
| **Subtotal infra** | **1.55** | **28** | |

---

## Tier-specific variable cost

### `voxa__family` (Family)

| Line item | USD/mo | MXN/mo | Notes |
|-----------|--------|--------|-------|
| Infra allocation | 1.55 | 28 | Above |
| LLM (basic tier cap) | 1.50 | 26 | ~50 consent-gated calls/mo |
| Email/support | 0.40 | 7 | Async support, no SLA |
| **Total COGS** | **3.45** | **61** | |
| **Tulana floor (×1.1)** | **3.80** | **67** | |

### `voxa__clinic` (Institutional / per org seat)

| Line item | USD/mo | MXN/mo | Notes |
|-----------|--------|--------|-------|
| Infra allocation | 1.55 | 28 | Per seat |
| LLM (full tier) | 4.00 | 68 | Reports + higher caps |
| Compliance / audit log | 0.50 | 9 | Retention 90d |
| Priority support slice | 1.00 | 17 | SLP onboarding |
| **Total COGS per seat** | **7.05** | **122** | |
| **Tulana floor per seat (×1.1)** | **7.76** | **134** | |

Org base (SSO, billing, admin console): add **MXN 45/mo** fixed COGS → floor **MXN 50/mo** for `voxa__clinic` base SKU if modeled separately.

---

## Free tier (`voxa__free`)

| Line item | USD/mo | MXN/mo | Notes |
|-----------|--------|--------|-------|
| Infra + minimal AI | 1.80 | 31 | Acquisition; capped at 1 board |
| **Floor** | — | — | Not monetized; monitor abuse |

---

## Confidence

**Low** until production usage data (LLM token meters, storage per board) replaces estimates. Revisit after 30 days post-paid GA with actual `@voxa/api` billing hooks.
