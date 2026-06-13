// Pricing anchored on Tulana competitive intel (v0.1, 2026-06-12):
// - AAC subscription median ~221 MXN/mo (Proloquo/TD Snap ~$9.99 USD).
// - Tulana mechanical ceiling ~177 MXN/mo; operator anchored Family at 199
//   MXN net (MADFAM consumer SaaS peer: Tezca Essentials, Dhanam Copilot).
// - Institutional: 1,499 MXN/mo base + 349/seat (min 3), Dhanam Teams peer.
// - Catalog/Dhanam amounts are net of IVA; public MXN display adds 16% IVA
//   per MADFAM convention (see docs/launch/PRICING_STRATEGY.md).
export const MXN_IVA_RATE = 0.16;

/** Net-of-IVA list prices synced to Dhanam catalog (centavos / 100). */
export const PRICING = {
  family: { monthly: 199, annual: 1899, currency: 'MXN' },
  clinic: { baseMonthly: 1499, seatMonthly: 349, minSeats: 3, currency: 'MXN' },
} as const;

export const DHANAM_CHECKOUT_BASE =
  process.env.NEXT_PUBLIC_DHANAM_API_URL?.replace(/\/$/, '') ?? 'https://api.dhan.am';

/** Public checkout plan IDs match Dhanam catalog: `{product}_{tier}`. */
export const CHECKOUT_PLANS = {
  family: 'voxa_family',
  familyAnnual: 'voxa_family_yearly',
} as const;

export function withMxnIva(netMxn: number): number {
  return Math.round(netMxn * (1 + MXN_IVA_RATE));
}

export function formatMxn(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format a net catalog price for consumer-facing MXN copy (IVA included). */
export function formatMxnGross(netMxn: number): string {
  return formatMxn(withMxnIva(netMxn));
}

export function clinicListMonthly(minSeats = PRICING.clinic.minSeats): number {
  return PRICING.clinic.baseMonthly + PRICING.clinic.seatMonthly * minSeats;
}

export function clinicListMonthlyGross(minSeats = PRICING.clinic.minSeats): number {
  return withMxnIva(clinicListMonthly(minSeats));
}

export function buildCheckoutUrl(opts: {
  plan: string;
  userId: string;
  returnUrl: string;
}): string {
  const params = new URLSearchParams({
    plan: opts.plan,
    user_id: opts.userId,
    return_url: opts.returnUrl,
    product: 'voxa',
  });
  return `${DHANAM_CHECKOUT_BASE}/billing/checkout?${params.toString()}`;
}
