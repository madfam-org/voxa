import { Hono } from 'hono';
import { resolveEntitlement } from '../lib/entitlement.js';

export const billingRoutes = new Hono();

/** `{ tier, features, source: 'janua' }` from the caller's verified access token. */
billingRoutes.get('/entitlement', (c) => {
  return c.json(resolveEntitlement(c.get('team')));
});
