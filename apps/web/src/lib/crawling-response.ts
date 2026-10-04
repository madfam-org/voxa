import { isIndexableHost, normalizeHost, parseIndexableHosts } from './crawling';

export interface CrawlContext {
  indexable: boolean;
  /** `https://<host>` of the request; only meaningful when indexable. */
  origin: string;
}

/**
 * Reads the request host (the public hostname: the tunnel preserves Host) and
 * `VOXA_INDEXABLE_HOSTS` at request time, so one image serves every host.
 */
export function crawlContext(request: Request): CrawlContext {
  const host = request.headers.get('host');
  const indexable = isIndexableHost(host, parseIndexableHosts(process.env.VOXA_INDEXABLE_HOSTS));
  return { indexable, origin: indexable ? `https://${normalizeHost(host)}` : '' };
}

export function textResponse(body: string, contentType: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      Vary: 'Host',
    },
  });
}

export function notFound(): Response {
  return new Response('Not found\n', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600', Vary: 'Host' },
  });
}
