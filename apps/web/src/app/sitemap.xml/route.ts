import { buildSitemapXml } from '@/lib/crawling';
import { crawlContext, notFound, textResponse } from '@/lib/crawling-response';

export const dynamic = 'force-dynamic';

export function GET(request: Request): Response {
  const { indexable, origin } = crawlContext(request);
  if (!indexable) return notFound();
  return textResponse(buildSitemapXml(origin), 'application/xml; charset=utf-8');
}
