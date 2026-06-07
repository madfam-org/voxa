import type {
  AiService,
  GeneratedSymbol,
  PredictionRequest,
  SpeakRequest,
  SymbolGenerationRequest,
  SymbolPredictionRequest,
  TextPrediction,
} from './index.js';
import { buildSymbolPredictions, buildTextPredictions } from './predict.js';

const OPENAI_URL = process.env.OPENAI_API_URL?.replace(/\/$/, '') ?? 'https://api.openai.com/v1';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

async function llmComplete(prompt: string, maxTokens = 120): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return '';

  const res = await fetch(`${OPENAI_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: maxTokens,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'You assist AAC users with short phrase completions. Reply with up to three comma-separated suggestions only.',
        },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return '';
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return body.choices?.[0]?.message?.content?.trim() ?? '';
}

function parseSuggestions(raw: string, max: number): TextPrediction[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((text, index) => ({
      text,
      confidence: Math.max(0.5, 0.95 - index * 0.1),
    }));
}

function createLlmAiService(): AiService {
  return {
    async predictText(req) {
      const max = req.maxSuggestions ?? 3;
      const prompt = `Complete this AAC phrase for locale ${req.locale}: "${req.partialText}"`;
      const raw = await llmComplete(prompt);
      const llm = parseSuggestions(raw, max);
      if (llm.length > 0) return llm;
      return buildTextPredictions(req.partialText, max);
    },
    async predictSymbols(req) {
      return buildSymbolPredictions(
        req.recentSymbolIds,
        req.boardButtons ?? [],
        req.maxSuggestions ?? 3,
      );
    },
    async generateSymbols(req: SymbolGenerationRequest): Promise<GeneratedSymbol[]> {
      const count = Math.min(req.count ?? 4, 4);
      return Array.from({ length: count }, (_, i) => ({
        id: `stub-${i}`,
        imageUrl: '',
        promptUsed: req.prompt,
      }));
    },
    async synthesizeSpeech(_req: SpeakRequest): Promise<ArrayBuffer> {
      return new ArrayBuffer(0);
    },
  };
}

function createStubAiService(): AiService {
  return {
    async predictText(req) {
      return buildTextPredictions(req.partialText, req.maxSuggestions ?? 3);
    },
    async predictSymbols(req) {
      return buildSymbolPredictions(
        req.recentSymbolIds,
        req.boardButtons ?? [],
        req.maxSuggestions ?? 3,
      );
    },
    async generateSymbols(req: SymbolGenerationRequest): Promise<GeneratedSymbol[]> {
      const count = Math.min(req.count ?? 4, 4);
      return Array.from({ length: count }, (_, i) => ({
        id: `stub-${i}`,
        imageUrl: '',
        promptUsed: req.prompt,
      }));
    },
    async synthesizeSpeech(_req: SpeakRequest): Promise<ArrayBuffer> {
      return new ArrayBuffer(0);
    },
  };
}

export function createAiService(): AiService {
  if (process.env.OPENAI_API_KEY) {
    return createLlmAiService();
  }
  return createStubAiService();
}
