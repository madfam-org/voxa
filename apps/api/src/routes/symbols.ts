import { Hono } from 'hono';
import { searchArasaac } from '@voxa/symbols';

export const symbolRoutes = new Hono();

// Any signed-in caller may search: board owners edit their own boards whatever
// their role, and teamAuth() has already rejected unauthenticated requests.
symbolRoutes.get('/search', async (c) => {
  const query = c.req.query('q') ?? '';
  const locale = c.req.query('locale') ?? 'en';
  const limit = Number(c.req.query('limit') ?? '12');

  if (query.trim().length < 2) {
    return c.json({ symbols: [], attribution: ARASAAC_ATTRIBUTION });
  }

  try {
    const symbols = await searchArasaac(query, { locale, limit });
    return c.json({ symbols, attribution: ARASAAC_ATTRIBUTION });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 502);
  }
});

const ARASAAC_ATTRIBUTION =
  'Pictograms by Sergio Palao / ARASAAC (CC BY-NC-SA). https://arasaac.org';
