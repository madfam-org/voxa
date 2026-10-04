import { Hono } from 'hono';
import { MULBERRY_ATTRIBUTION, MULBERRY_LICENSE_URL, MULBERRY_SITE_URL } from '@voxa/symbols';
import { searchLanguage, searchMulberryIndex } from '@voxa/symbols/search';

export const symbolRoutes = new Hono();

/**
 * Symbol search over the vendored Mulberry Symbols set (CC BY-SA 4.0).
 * Offline: the index ships with `@voxa/symbols`, so this route makes no
 * outbound request. `imageUrl` is a path on the web origin.
 *
 * Any signed-in caller may search: board owners edit their own boards whatever
 * their role, and teamAuth() has already rejected unauthenticated requests.
 */
symbolRoutes.get('/search', (c) => {
  const query = c.req.query('q') ?? '';
  const locale = searchLanguage(c.req.query('locale'));
  const limit = Number(c.req.query('limit') ?? '12');

  const symbols = searchMulberryIndex(query, {
    locale,
    limit: Number.isFinite(limit) ? limit : 12,
  });

  return c.json({
    symbols,
    locale,
    attribution: MULBERRY_ATTRIBUTION,
    license: { name: 'CC BY-SA 4.0', url: MULBERRY_LICENSE_URL, source: MULBERRY_SITE_URL },
  });
});
