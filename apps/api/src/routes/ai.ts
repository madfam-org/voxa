import { Hono } from 'hono';
import { createAiService } from '@voxa/ai';
import type { PredictionRequest, SymbolPredictionRequest } from '@voxa/ai';
import { hasFeature, resolveEntitlement } from '../lib/dhanam.js';

export const aiRoutes = new Hono();

const aiService = createAiService();

function hasAiConsent(c: { req: { header: (name: string) => string | undefined } }): boolean {
  return c.req.header('X-Voxa-AI-Consent') === 'true';
}

aiRoutes.post('/predict/text', async (c) => {
  if (!hasAiConsent(c)) {
    return c.json({ error: 'AI consent required' }, 403);
  }

  const { userId } = c.get('team');
  const entitlement = await resolveEntitlement(userId);
  if (!hasFeature(entitlement, 'ai:basic') && !hasFeature(entitlement, 'ai:full')) {
    return c.json({ error: 'AI not included in your plan', tier: entitlement.tier }, 402);
  }

  const body = (await c.req.json()) as PredictionRequest;
  const predictions = await aiService.predictText(body);
  return c.json({ predictions, source: process.env.OPENAI_API_KEY ? 'llm' : 'stub' });
});

aiRoutes.post('/predict/symbols', async (c) => {
  if (!hasAiConsent(c)) {
    return c.json({ error: 'AI consent required' }, 403);
  }

  const { userId } = c.get('team');
  const entitlement = await resolveEntitlement(userId);
  if (!hasFeature(entitlement, 'ai:basic') && !hasFeature(entitlement, 'ai:full')) {
    return c.json({ error: 'AI not included in your plan', tier: entitlement.tier }, 402);
  }

  const body = (await c.req.json()) as SymbolPredictionRequest;
  const predictions = await aiService.predictSymbols(body);
  return c.json({ predictions, source: process.env.OPENAI_API_KEY ? 'llm' : 'stub' });
});
