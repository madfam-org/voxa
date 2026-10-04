import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { llmEgressHits } from './llm-egress.mjs';

const rules = (rel, text) => llmEgressHits(rel, text).map((h) => h.rule);

describe('LLM egress guard (R88)', () => {
  it('fails on model-vendor API hosts in apps/ and packages/', () => {
    for (const host of [
      'api.openai.com',
      'api.anthropic.com',
      'generativelanguage.googleapis.com',
      'api.mistral.ai',
      'api.cohere.com',
      'api.groq.com',
      'api.together.xyz',
      'myres.openai.azure.com',
    ]) {
      assert.deepEqual(rules('apps/api/src/routes/ai.ts', `fetch('https://${host}/v1/chat')`), ['llm-vendor-host'], host);
    }
  });

  it('fails on SDK imports in product code', () => {
    for (const line of [
      "import OpenAI from 'openai';",
      "import { Anthropic } from '@anthropic-ai/sdk';",
      "const { GoogleGenerativeAI } = require('@google/generative-ai');",
      "const m = await import('@mistralai/mistralai');",
      "export { createOpenAI } from '@ai-sdk/openai';",
      "import Groq from 'groq-sdk';",
    ]) {
      assert.deepEqual(rules('packages/ai/src/predict.ts', line), ['llm-sdk-import'], line);
    }
  });

  it('fails on an SDK dependency in a package.json', () => {
    assert.deepEqual(rules('apps/api/package.json', '"dependencies": { "openai": "^4.0.0" }'), ['llm-sdk-dependency']);
  });

  it('fails on vendor API-key variables in code and manifests anywhere', () => {
    assert.deepEqual(rules('apps/api/src/config.ts', 'process.env.OPENAI_API_KEY'), ['llm-api-key-variable']);
    assert.deepEqual(rules('k8s/production/api-deployment.yaml', '- name: ANTHROPIC_API_KEY'), ['llm-api-key-variable']);
    assert.deepEqual(rules('.github/workflows/ci.yml', 'GEMINI_API_KEY: ${{ secrets.X }}'), ['llm-api-key-variable']);
  });

  it('passes on the Selva client path (an OpenAI-compatible SDK pointed at Selva)', () => {
    assert.deepEqual(rules('apps/api/src/lib/selva.ts', "import OpenAI from 'openai';"), []);
  });

  it('passes on crawler names, Selva and unrelated keys', () => {
    assert.deepEqual(rules('apps/web/src/lib/crawling.ts', "'anthropic-ai', 'GPTBot', 'PerplexityBot'"), []);
    assert.deepEqual(rules('apps/api/src/lib/selva.ts', "fetch(`${SELVA_BASE_URL}/v1/chat/completions`)"), []);
    assert.deepEqual(rules('.github/workflows/mobile-eas.yml', 'ASC_API_KEY_ID: x'), []);
    assert.deepEqual(rules('apps/web/src/x.ts', "import { openaiCompatible } from './selva-client';"), []);
  });

  it('does not scan hosts outside apps/ and packages/, and skips the guard itself', () => {
    assert.deepEqual(rules('docs/architecture.md', 'Selva fronts api.openai.com for us'), []);
    assert.deepEqual(rules('scripts/guards/llm-egress.mjs', "'api.openai.com' OPENAI_API_KEY"), []);
  });
});
