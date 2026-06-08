import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createDb } from '../db/client.js';
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
    throw new Error(`Media exceeds ${Math.round(maxBytes / (1024 * 1024))}MB limit`);
  }

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
    fileMedia.set(record.id, record);
    return record;
  }

  const { db } = createDb(databaseUrl);
  await db.insert(mediaAssets).values({
    id: record.id,
    boardId: record.boardId,
    ownerUserId: record.ownerUserId,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    data: record.data.toString('base64'),
    createdAt: record.createdAt,
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

  const { db } = createDb(databaseUrl);
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
