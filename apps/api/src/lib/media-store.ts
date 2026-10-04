import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getSharedDb } from '../db/client.js';
import { mediaAssets } from '../db/schema.js';
import { getStoreDriver } from '../store/index.js';

export interface MediaAssetRecord {
  id: string;
  boardId: string;
  ownerUserId: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
  createdAt: string;
}

const fileMedia = new Map<string, MediaAssetRecord>();

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Largest single upload of any type (video). */
export const MAX_MEDIA_BYTES = MAX_VIDEO_BYTES;

/** Default per-user media quota: total bytes of every asset a user uploaded. */
export const DEFAULT_MEDIA_QUOTA_BYTES = 500 * 1024 * 1024;

/** `MEDIA_QUOTA_BYTES_PER_USER` (bytes), else 500 MB. */
export function mediaQuotaBytes(raw: string | undefined = process.env.MEDIA_QUOTA_BYTES_PER_USER): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_MEDIA_QUOTA_BYTES;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MEDIA_QUOTA_BYTES;
}

/** Thrown when an upload would take its owner past the media quota (413). */
export class MediaQuotaExceededError extends Error {
  readonly status = 413;
  readonly code = 'MEDIA_QUOTA_EXCEEDED';
  constructor(
    readonly usedBytes: number,
    readonly quotaBytes: number,
  ) {
    super('Media storage quota exceeded');
  }
}

/** Thrown when one upload is larger than its type allows (413). */
export class MediaTooLargeError extends Error {
  readonly status = 413;
  readonly code = 'MEDIA_TOO_LARGE';
  constructor(readonly maxBytes: number) {
    super(`Media exceeds ${Math.round(maxBytes / (1024 * 1024))}MB limit`);
  }
}

const ALLOWED_MIME = new Set([
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'video/webm',
  'video/mp4',
  'video/quicktime',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function maxBytesForMime(mimeType: string): number {
  if (mimeType.startsWith('video/')) return MAX_VIDEO_BYTES;
  if (mimeType.startsWith('image/')) return MAX_IMAGE_BYTES;
  return MAX_AUDIO_BYTES;
}

export function isAllowedMediaMime(mimeType: string): boolean {
  return ALLOWED_MIME.has(mimeType);
}

export function allowedMediaTypes(): string[] {
  return [...ALLOWED_MIME];
}

/**
 * Bytes stored for `ownerUserId`, summed from `size_bytes` (the asset bytes are
 * never loaded).
 */
export async function mediaBytesUsedBy(
  databaseUrl: string | undefined,
  ownerUserId: string,
): Promise<number> {
  if (!databaseUrl || getStoreDriver() !== 'postgres') {
    let total = 0;
    for (const asset of fileMedia.values()) {
      if (asset.ownerUserId === ownerUserId) total += asset.sizeBytes;
    }
    return total;
  }
  const { db } = getSharedDb(databaseUrl);
  const rows = await db
    .select({ total: sql<string>`coalesce(sum(${mediaAssets.sizeBytes}), 0)` })
    .from(mediaAssets)
    .where(eq(mediaAssets.ownerUserId, ownerUserId));
  return Number(rows[0]?.total ?? 0);
}

export async function saveMediaAsset(
  databaseUrl: string | undefined,
  input: {
    boardId: string;
    ownerUserId: string;
    mimeType: string;
    data: Buffer;
  },
): Promise<MediaAssetRecord> {
  if (!isAllowedMediaMime(input.mimeType)) {
    throw new Error(`Unsupported media type: ${input.mimeType}`);
  }

  const maxBytes = maxBytesForMime(input.mimeType);
  if (input.data.byteLength > maxBytes) {
    throw new MediaTooLargeError(maxBytes);
  }
  const quota = mediaQuotaBytes();

  const record: MediaAssetRecord = {
    id: randomUUID(),
    boardId: input.boardId,
    ownerUserId: input.ownerUserId,
    mimeType: input.mimeType,
    sizeBytes: input.data.byteLength,
    data: input.data,
    createdAt: new Date().toISOString(),
  };

  if (!databaseUrl || getStoreDriver() !== 'postgres') {
    const used = await mediaBytesUsedBy(undefined, record.ownerUserId);
    if (used + record.sizeBytes > quota) throw new MediaQuotaExceededError(used, quota);
    fileMedia.set(record.id, record);
    return record;
  }

  const { db } = getSharedDb(databaseUrl);
  await db.transaction(async (tx) => {
    // One upload per owner at a time, so two parallel uploads cannot both fit
    // under the quota. The lock is released when the transaction ends.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`voxa:media-quota:${record.ownerUserId}`}))`);
    const rows = await tx
      .select({ total: sql<string>`coalesce(sum(${mediaAssets.sizeBytes}), 0)` })
      .from(mediaAssets)
      .where(eq(mediaAssets.ownerUserId, record.ownerUserId));
    const used = Number(rows[0]?.total ?? 0);
    if (used + record.sizeBytes > quota) throw new MediaQuotaExceededError(used, quota);
    await tx.insert(mediaAssets).values({
      id: record.id,
      boardId: record.boardId,
      ownerUserId: record.ownerUserId,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      data: record.data.toString('base64'),
      createdAt: record.createdAt,
    });
  });

  return record;
}

export async function getMediaAsset(
  databaseUrl: string | undefined,
  id: string,
): Promise<MediaAssetRecord | null> {
  if (!databaseUrl || getStoreDriver() !== 'postgres') {
    return fileMedia.get(id) ?? null;
  }

  const { db } = getSharedDb(databaseUrl);
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    boardId: row.boardId,
    ownerUserId: row.ownerUserId,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    data: Buffer.from(row.data, 'base64'),
    createdAt: row.createdAt,
  };
}

/** Test helper */
export function resetFileMediaForTests(): void {
  fileMedia.clear();
}
