# Phynd WTP launch — Voxa (Van Westendorp)

**Template:** [`tulana/wtp-campaign-template.json`](./tulana/wtp-campaign-template.json)  
**Gate:** ≥10 responses per paid SKU before enabling checkout ([PRICING_STRATEGY.md](./PRICING_STRATEGY.md))

**Phynd import payloads:** [`phynd/VOXA_WTP_PHYND_IMPORT_RUNBOOK.md`](./phynd/VOXA_WTP_PHYND_IMPORT_RUNBOOK.md)

## Display prices (IVA inclusive — use in survey framing)

| SKU | Consumer display | Net catalog (Dhanam) |
|-----|------------------|----------------------|
| `voxa__family` | **$231 MXN/mo**, **$2,203/año** | 199 / 1,899 |
| `voxa__clinic` (3 seats) | **Desde $2,953/mo** | 1,499 + 3×349 |

Survey questions should describe the **product bundle**, not repeat list price — respondents set their own price points.

## Family (`voxa__family`)

**Audience:** Parents / caregivers (Voxa waitlist, demo exit)  
**Product copy:** Up to 10 boards, 3 team editors, cloud sync, OBF import/export, basic AI (consent-gated).

| Question | ES prompt |
|----------|-----------|
| Too expensive | ¿A qué precio mensual en MXN (IVA incluido) Voxa Familia te parecería **demasiado caro** para comprarlo? |
| Too cheap | ¿A qué precio mensual en MXN (IVA incluido) Voxa Familia te parecería **tan barato** que dudarías de la calidad? |
| Expensive but consider | ¿A qué precio mensual en MXN (IVA incluido) Voxa Familia empieza a sentirse caro pero **aún lo considerarías**? |
| Bargain | ¿A qué precio mensual en MXN (IVA incluido) Voxa Familia sería una **excelente oferta**? |

## Institutional (`voxa__clinic`)

**Audience:** SLPs, clinic admins (Phynd healthcare tags)  
**Product copy:** Unlimited boards, full AI, usage reports, SSO, priority onboarding.

| Question | ES prompt |
|----------|-----------|
| Too expensive | ¿A qué precio mensual total en MXN (IVA incluido, org + asientos mín.) Voxa Institucional sería **demasiado caro**? |
| Too cheap | ¿A qué precio mensual total en MXN (IVA incluido) sería **demasiado barato** para confiar en uso clínico? |
| Expensive but consider | ¿A qué precio mensual total en MXN (IVA incluido) empieza a sentirse caro pero **aún viable**? |
| Bargain | ¿A qué precio mensual total en MXN (IVA incluido) sería un **valor fuerte** para tu organización? |

## After collection

```bash
cd tulana/apps/api
python manage.py tulana_import_wtp_signals --file phynd-export.json --aggregate --min-responses 10
bash ../../scripts/voxa-pricing-bootstrap.sh --persist
```

Review Tulana optimal band vs display anchor (±15%). Selva approve → export proposal → enable checkout.
