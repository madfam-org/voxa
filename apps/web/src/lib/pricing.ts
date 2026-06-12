// Pricing anchored on Tulana competitive intel (v0.1, 2026-06-12):
// - AAC subscription median ~221 MXN/mo (Proloquo/TD Snap ~$9.99 USD).
// - Tulana mechanical ceiling ~177 MXN/mo; operator anchored Family at 199
//   MXN (MADFAM consumer SaaS peer: Tezca Essentials, Dhanam Copilot).
// - Institutional: 1,499 MXN/mo base + 349/seat (min 3), Dhanam Teams peer.
// - Confidence: low until Phynd Van Westendorp (see docs/launch/PRICING_STRATEGY.md).
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

export function formatMxn(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function clinicListMonthly(minSeats = PRICING.clinic.minSeats): number {
  return PRICING.clinic.baseMonthly + PRICING.clinic.seatMonthly * minSeats;
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
