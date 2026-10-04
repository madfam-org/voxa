import { apiFetch } from '@/lib/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface UploadedMedia {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

export async function uploadBoardMedia(
  boardId: string,
  file: Blob,
  filename: string,
): Promise<UploadedMedia> {
  const form = new FormData();
  form.set('boardId', boardId);
  form.set('file', file, filename);

  // Through the same-origin proxy, which adds the session's bearer on the server.
  const res = await apiFetch('/v1/media', { method: 'POST', body: form });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Upload failed (${res.status})`);
  }

  return (await res.json()) as UploadedMedia;
}

export function mediaUrlForApi(id: string): string {
  return `${API_URL.replace(/\/$/, '')}/v1/media/${id}`;
}
