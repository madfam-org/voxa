import { Hono } from 'hono';
import { resolveEntitlement } from '../lib/dhanam.js';

export const billingRoutes = new Hono();

billingRoutes.get('/entitlement', async (c) => {
  const { userId } = c.get('team');
  const entitlement = await resolveEntitlement(userId);
  return c.json({ entitlement });
});
