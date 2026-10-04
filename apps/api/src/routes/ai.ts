import { Hono } from 'hono';
import { createAiService, PREDICTION_SOURCE } from '@voxa/ai';
import type { PredictionRequest, SymbolPredictionRequest } from '@voxa/ai';
import { hasConsent } from '../lib/consents.js';
import { hasFeature, resolveEntitlement } from '../lib/dhanam.js';

export const aiRoutes = new Hono();

// Predictions come only from the in-process local predictor; this route makes
// no outbound request.
const aiService = createAiService();

// Consent is the caller's server-side `ai_processing` record (PUT /v1/consents),
// never a client-supplied header.
const AI_CONSENT_REQUIRED = { error: 'AI consent required', purpose: 'ai_processing' } as const;

aiRoutes.post('/predict/text', async (c) => {
  const { userId } = c.get('team');
  if (!(await hasConsent(process.env.DATABASE_URL, userId, 'ai_processing'))) {
    return c.json(AI_CONSENT_REQUIRED, 403);
  }

  const entitlement = await resolveEntitlement(userId);
  if (!hasFeature(entitlement, 'ai:basic') && !hasFeature(entitlement, 'ai:full')) {
    return c.json({ error: 'AI not included in your plan', tier: entitlement.tier }, 402);
  }

  const body = (await c.req.json()) as PredictionRequest;
  const predictions = await aiService.predictText(body);
  return c.json({ predictions, source: PREDICTION_SOURCE });
});

aiRoutes.post('/predict/symbols', async (c) => {
  const { userId } = c.get('team');
  if (!(await hasConsent(process.env.DATABASE_URL, userId, 'ai_processing'))) {
    return c.json(AI_CONSENT_REQUIRED, 403);
  }

  const entitlement = await resolveEntitlement(userId);
  if (!hasFeature(entitlement, 'ai:basic') && !hasFeature(entitlement, 'ai:full')) {
    return c.json({ error: 'AI not included in your plan', tier: entitlement.tier }, 402);
  }

  const body = (await c.req.json()) as SymbolPredictionRequest;
  const predictions = await aiService.predictSymbols(body);
  return c.json({ predictions, source: PREDICTION_SOURCE });
});
