/**
 * Plan entitlements, read from the verified Janua access token (ADR-006).
 *
 * Janua is the entitlement authority: Dhanam (billing) writes the subscription
 * state to Janua, and every access token Janua mints carries the product tier
 * in one claim, here `voxa_tier`. Voxa never calls the billing system; it only
 * reads that claim from a token `teamAuth()` has already verified.
 *
 * Fails safe: a missing, unknown or malformed claim resolves to `free` and logs
 * one line naming the reason (never the token or the claim value). Until the
 * subscription push path is live, no token carries a paid tier, so everyone is
 * on `free`, exactly as before.
 */

/** The access-token claim that carries the Voxa tier. */
export const VOXA_TIER_CLAIM = 'voxa_tier';

/** Audience-named tiers (ADR-006 Decision 4), in ascending order. */
export const VOXA_TIERS = ['free', 'family', 'clinic'] as const;
export type VoxaTier = (typeof VOXA_TIERS)[number];

export interface VoxaEntitlement {
  tier: VoxaTier;
  features: string[];
  source: 'janua';
}

/**
 * Tier → features: the single mapping table, matching the `voxa` tiers in the
 * billing catalog (free: 1 board, basic AI; family: 10 boards, 3 team editors,
 * basic AI; clinic: unlimited boards and team roles, full AI, usage reports).
 * `boards:N` is read by `maxBoardCount`; a `<prefix>:unlimited` entry satisfies
 * every `<prefix>:*` check in `hasFeature`.
 */
export const TIER_FEATURES: Readonly<Record<VoxaTier, readonly string[]>> = {
  free: ['boards:1', 'sync', 'obf', 'ai:basic'],
  family: ['boards:10', 'sync', 'obf', 'ai:basic', 'team:3'],
  clinic: ['boards:unlimited', 'sync', 'obf', 'ai:full', 'team:unlimited', 'reports'],
};

export type TierFallbackReason = 'absent' | 'malformed' | 'unknown' | 'plan-id';

export interface TierResolution {
  tier: VoxaTier;
  /** Set when the claim could not be used and the tier fell back to `free`. */
  fallback?: TierFallbackReason;
}

function isVoxaTier(value: string): value is VoxaTier {
  return (VOXA_TIERS as readonly string[]).includes(value);
}

/**
 * Resolves the tier from the raw claim value. Exact values only: no trimming,
 * case folding or prefix stripping, because the claim must carry the tier name
 * and never a plan or SKU id (ADR-006 Decision 5).
 */
export function resolveTierClaim(claim: unknown): TierResolution {
  if (claim === undefined || claim === null) return { tier: 'free', fallback: 'absent' };
  if (typeof claim !== 'string') return { tier: 'free', fallback: 'malformed' };
  if (isVoxaTier(claim)) return { tier: claim };
  // `voxa__family`, `voxa_family`, `plan=voxa_clinic`…: a plan id was written
  // where the tier name belongs. Still free, but say so.
  if (/voxa_/i.test(claim)) return { tier: 'free', fallback: 'plan-id' };
  return { tier: 'free', fallback: 'unknown' };
}

const FALLBACK_MESSAGES: Record<TierFallbackReason, string> = {
  absent: `no ${VOXA_TIER_CLAIM} claim on the request`,
  malformed: `the ${VOXA_TIER_CLAIM} claim is not a string`,
  unknown: `the ${VOXA_TIER_CLAIM} claim is not one of ${VOXA_TIERS.join(', ')}`,
  'plan-id': `the ${VOXA_TIER_CLAIM} claim looks like a plan id; it must carry the tier name`,
};

/** Where `resolveEntitlement` writes its one fallback line (replaceable in tests). */
export type EntitlementLog = (message: string) => void;

const defaultLog: EntitlementLog = (message) => console.warn(message);

/**
 * The caller's entitlement from the `voxa_tier` claim of their verified token
 * (`TeamContext.tierClaim`; `undefined` when the claim is absent or the request
 * used the local-development identity headers).
 */
export function resolveEntitlement(
  team: { tierClaim?: unknown },
  log: EntitlementLog = defaultLog,
): VoxaEntitlement {
  const { tier, fallback } = resolveTierClaim(team.tierClaim);
  if (fallback) {
    log(`voxa entitlement: ${FALLBACK_MESSAGES[fallback]}; resolved to free`);
  }
  return { tier, features: [...TIER_FEATURES[tier]], source: 'janua' };
}

export function hasFeature(entitlement: VoxaEntitlement, feature: string): boolean {
  if (entitlement.features.includes(feature)) return true;
  const prefix = feature.split(':')[0];
  return entitlement.features.some((f) => f.startsWith(`${prefix}:`) && f.endsWith('unlimited'));
}

export function maxBoardCount(entitlement: VoxaEntitlement): number {
  if (entitlement.features.includes('boards:unlimited')) return Number.POSITIVE_INFINITY;
  const limit = entitlement.features.find((f) => f.startsWith('boards:'));
  if (!limit) return 1;
  const count = Number(limit.split(':')[1]);
  return Number.isFinite(count) ? count : 1;
}
