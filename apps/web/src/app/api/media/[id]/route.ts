import { getSession } from '@/lib/auth';
import { proxyMediaRequest } from '@/lib/media-proxy';

/**
 * Same-origin, cookie-authenticated read of uploaded board media, so `<img>`,
 * `<audio>` and `<video>` can load it. See `src/lib/media-proxy.ts`.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const session = await getSession();
  return proxyMediaRequest({
    id,
    accessToken: session?.access_token,
    apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  });
}
