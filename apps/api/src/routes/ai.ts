import { Hono } from 'hono';
import { createAiService, PREDICTION_SOURCE } from '@voxa/ai';
import type { PredictionRequest, SymbolPredictionRequest } from '@voxa/ai';
import { hasConsent } from '../lib/consents.js';
import { hasFeature, resolveEntitlement } from '../lib/entitlement.js';
import { predictTextPreferSelva } from '../lib/selva.js';

export const aiRoutes = new Hono();

// Symbol predictions come only from the in-process local predictor. Text
// predictions go through Selva (`X-Sensitivity: restricted`, partial utterance
// only) when SELVA_ENABLED=true and it answers; otherwise they are local too.
// See src/lib/selva.ts.
const aiService = createAiService();

// Consent is the caller's server-side `ai_processing` record (PUT /v1/consents),
// never a client-supplied header.
const AI_CONSENT_REQUIRED = { error: 'AI consent required', purpose: 'ai_processing' } as const;

aiRoutes.post('/predict/text', async (c) => {
  const { userId } = c.get('team');
  if (!(await hasConsent(process.env.DATABASE_URL, userId, 'ai_processing'))) {
    return c.json(AI_CONSENT_REQUIRED, 403);
  }

  const entitlement = resolveEntitlement(c.get('team'));
  if (!hasFeature(entitlement, 'ai:basic') && !hasFeature(entitlement, 'ai:full')) {
    return c.json({ error: 'AI not included in your plan', tier: entitlement.tier }, 402);
  }

  const body = ((await c.req.json()) ?? {}) as Partial<PredictionRequest>;
  const { predictions, source } = await predictTextPreferSelva({
    partialText: body.partialText,
    locale: body.locale,
    maxSuggestions: body.maxSuggestions,
  });
  return c.json({ predictions, source });
});

aiRoutes.post('/predict/symbols', async (c) => {
  const { userId } = c.get('team');
  if (!(await hasConsent(process.env.DATABASE_URL, userId, 'ai_processing'))) {
    return c.json(AI_CONSENT_REQUIRED, 403);
  }

  const entitlement = resolveEntitlement(c.get('team'));
  if (!hasFeature(entitlement, 'ai:basic') && !hasFeature(entitlement, 'ai:full')) {
    return c.json({ error: 'AI not included in your plan', tier: entitlement.tier }, 402);
  }

  const body = (await c.req.json()) as SymbolPredictionRequest;
  const predictions = await aiService.predictSymbols(body);
  return c.json({ predictions, source: PREDICTION_SOURCE });
});
