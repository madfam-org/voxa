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

/**
 * There is no self-serve checkout yet, so every paid-plan call to action goes
 * to a discovery call instead of a sign-in or upgrade link.
 */
export const DISCOVERY_CALL_URL = 'https://kalya.app/madfam';

/**
 * IVA-inclusive consumer price: ceil(net × 1.16) to the whole peso, computed
 * in integer hundredths so a float product can never tip an exact peso up.
 */
export function withMxnIva(netMxn: number): number {
  return Math.ceil((netMxn * Math.round((1 + MXN_IVA_RATE) * 100)) / 100);
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

/** Net monthly institutional price for a seat count (minimum seats enforced). */
export function clinicListMonthly(seats: number = PRICING.clinic.minSeats): number {
  if (!Number.isInteger(seats) || seats < PRICING.clinic.minSeats) {
    throw new RangeError(`seats must be an integer >= ${PRICING.clinic.minSeats}`);
  }
  return PRICING.clinic.baseMonthly + PRICING.clinic.seatMonthly * seats;
}

/**
 * IVA-inclusive monthly institutional total. IVA is applied to the whole net
 * total and then ceiled, never to the base and seat parts separately: adding
 * separately ceiled parts overstates the total by MX$1 at some seat counts.
 */
export function clinicListMonthlyGross(seats: number = PRICING.clinic.minSeats): number {
  return withMxnIva(clinicListMonthly(seats));
}
