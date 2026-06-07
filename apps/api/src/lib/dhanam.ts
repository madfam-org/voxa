export type VoxaTier = 'free' | 'family' | 'clinic';

export interface VoxaEntitlement {
  tier: VoxaTier;
  features: string[];
  source: 'dhanam' | 'default';
}

const TIER_FEATURES: Record<VoxaTier, string[]> = {
  free: ['boards:1', 'sync', 'obf', 'ai:basic'],
  family: ['boards:10', 'sync', 'obf', 'ai:basic', 'team:3'],
  clinic: ['boards:unlimited', 'sync', 'obf', 'ai:full', 'team:unlimited', 'reports'],
};

const DHANAM_URL = process.env.DHANAM_API_URL?.replace(/\/$/, '');
const DHANAM_SERVICE_TOKEN = process.env.DHANAM_API_TOKEN;

export async function resolveEntitlement(userId: string): Promise<VoxaEntitlement> {
  if (!DHANAM_URL || !DHANAM_SERVICE_TOKEN) {
    return { tier: 'free', features: TIER_FEATURES.free, source: 'default' };
  }

  try {
    const res = await fetch(`${DHANAM_URL}/api/v1/entitlements/${encodeURIComponent(userId)}`, {
      headers: {
        Authorization: `Bearer ${DHANAM_SERVICE_TOKEN}`,
        'X-Service': 'voxa',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { tier: 'free', features: TIER_FEATURES.free, source: 'default' };
    }
    const body = (await res.json()) as { tier?: string; features?: string[] };
    const tier = normalizeTier(body.tier);
    return {
      tier,
      features: body.features?.length ? body.features : TIER_FEATURES[tier],
      source: 'dhanam',
    };
  } catch {
    return { tier: 'free', features: TIER_FEATURES.free, source: 'default' };
  }
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

function normalizeTier(raw: string | undefined): VoxaTier {
  if (raw === 'family' || raw === 'clinic') return raw;
  return 'free';
}
