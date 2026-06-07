import { Hono } from 'hono';
import { stubAiService } from '@voxa/ai';
import type { PredictionRequest, SymbolPredictionRequest } from '@voxa/ai';

export const aiRoutes = new Hono();

aiRoutes.post('/predict/text', async (c) => {
  const body = (await c.req.json()) as PredictionRequest;
  const predictions = await stubAiService.predictText(body);
  return c.json({ predictions });
});

aiRoutes.post('/predict/symbols', async (c) => {
  const body = (await c.req.json()) as SymbolPredictionRequest;
  const predictions = await stubAiService.predictSymbols(body);
  return c.json({ predictions });
});
