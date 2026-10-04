// No direct LLM egress (ruling R88): every model call goes through Selva's
// gateway (apps/api/src/lib/selva.ts). Fails on model-vendor API hosts and SDK
// imports anywhere in apps/ or packages/, and on vendor API-key variables in
// code or deploy manifests anywhere in the repo.
import { findRuleHits, matchesAny } from './lib.mjs';

const VENDOR_HOSTS = [
  'api\\.openai\\.com',
  '[a-z0-9-]+\\.openai\\.azure\\.com',
  'api\\.anthropic\\.com',
  'generativelanguage\\.googleapis\\.com',
  '[a-z0-9-]*aiplatform\\.googleapis\\.com',
  'bedrock(?:-runtime)?\\.[a-z0-9-]+\\.amazonaws\\.com',
  'api\\.mistral\\.ai',
  'api\\.cohere\\.(?:ai|com)',
  'api\\.groq\\.com',
  'api\\.together\\.(?:xyz|ai)',
  'api\\.fireworks\\.ai',
  'api\\.deepseek\\.com',
  'api\\.perplexity\\.ai',
  'openrouter\\.ai',
  'api\\.x\\.ai',
  'api\\.replicate\\.com',
  'api-inference\\.huggingface\\.co',
  'router\\.huggingface\\.co',
];

const SDK_PACKAGES = [
  'openai',
  '@anthropic-ai/[a-z0-9-]+',
  '@google/generative-ai',
  '@google/genai',
  '@google-cloud/vertexai',
  '@mistralai/[a-z0-9-]+',
  'cohere-ai',
  'groq-sdk',
  'together-ai',
  '@ai-sdk/[a-z0-9-]+',
  '@langchain/[a-z0-9-]+',
  'langchain',
  'llamaindex',
  '@huggingface/inference',
  'replicate',
  '@aws-sdk/client-bedrock-runtime',
];

const SDK = `(?:${SDK_PACKAGES.join('|')})(?:/[a-z0-9./-]*)?`;

export const LLM_RULES = {
  host: { id: 'llm-vendor-host', pattern: new RegExp(`\\b(?:${VENDOR_HOSTS.join('|')})\\b`, 'gi') },
  sdkImport: {
    id: 'llm-sdk-import',
    // import … from 'x' | import 'x' | require('x') | import('x') | export … from 'x'
    pattern: new RegExp(
      `(?:\\bfrom\\s*|\\bimport\\s*\\(?\\s*|\\brequire\\s*\\(\\s*)['"\`]${SDK}['"\`]`,
      'g',
    ),
  },
  sdkDependency: {
    id: 'llm-sdk-dependency',
    // a dependency entry in a package.json: "openai": "^4"
    pattern: new RegExp(`"${SDK}"\\s*:\\s*"`, 'g'),
  },
  keyVariable: {
    id: 'llm-api-key-variable',
    pattern:
      /\b(?:AZURE_OPENAI|OPENAI|ANTHROPIC|CLAUDE|GEMINI|GOOGLE_GENERATIVE_AI|GOOGLE_AI|VERTEX_AI|MISTRAL|COHERE|CO|GROQ|TOGETHER|FIREWORKS|DEEPSEEK|PERPLEXITY|OPENROUTER|XAI|REPLICATE|HF|HUGGINGFACE|HUGGING_FACE)_(?:API_KEY|API_TOKEN|KEY|TOKEN)\b/g,
  },
};

/** Selva client path: the one place allowed an OpenAI-compatible SDK import (pointed at Selva). */
export const SELVA_CLIENT = ['apps/api/src/lib/selva.ts', 'apps/api/src/lib/selva.test.ts'];

/** The guard itself and its tests carry the patterns. */
export const LLM_ALLOWLIST = ['scripts/guards/**'];

/** Code and manifests scanned for key variables (everywhere that configures or runs something). */
const KEY_SCOPE = /\.(?:[cm]?[jt]sx?|json|ya?ml|sh|toml|env\.example|example|dockerfile)$|(?:^|\/)Dockerfile[^/]*$|(?:^|\/)\.env\.[a-z]+\.example$/i;

const SOURCE = /\.(?:[cm]?[jt]sx?)$/i;

/** Hits for one file. */
export function llmEgressHits(rel, text) {
  if (text == null || matchesAny(rel, LLM_ALLOWLIST)) return [];
  const inProduct = /^(?:apps|packages)\//.test(rel);
  const rules = [];
  if (inProduct) {
    rules.push(LLM_RULES.host);
    if (SOURCE.test(rel) && !SELVA_CLIENT.includes(rel)) rules.push(LLM_RULES.sdkImport);
    if (/(?:^|\/)package\.json$/.test(rel)) rules.push(LLM_RULES.sdkDependency);
  }
  if (KEY_SCOPE.test(rel)) rules.push(LLM_RULES.keyVariable);
  return findRuleHits(text, rules);
}
