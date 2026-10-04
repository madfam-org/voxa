import { buildRobotsTxt } from '@/lib/crawling';
import { crawlContext, textResponse } from '@/lib/crawling-response';

export const dynamic = 'force-dynamic';

export function GET(request: Request): Response {
  const { indexable, origin } = crawlContext(request);
  return textResponse(buildRobotsTxt(origin, indexable), 'text/plain; charset=utf-8');
}
