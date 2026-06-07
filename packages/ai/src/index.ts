import type { BoardButton, LocaleCode, Utterance } from '@voxa/core';
import { buildSymbolPredictions, buildTextPredictions } from './predict.js';

export interface PredictionRequest {
  profileId: string;
  recentUtterances: Utterance[];
  partialText: string;
  locale: LocaleCode;
  maxSuggestions?: number;
}

export interface TextPrediction {
  text: string;
  confidence: number;
}

export interface SymbolPredictionRequest {
  profileId: string;
  recentSymbolIds: string[];
  boardButtons?: BoardButton[];
  contextTags?: string[];
  maxSuggestions?: number;
}

export interface SymbolPrediction {
  symbolId: string;
  label: string;
  confidence: number;
}

export interface SymbolGenerationRequest {
  prompt: string;
  referenceImageUrl?: string;
  stylePreset?: 'flat' | 'outline' | 'high-contrast';
  count?: number;
}

export interface GeneratedSymbol {
  id: string;
  imageUrl: string;
  promptUsed: string;
}

export interface SpeakRequest {
  text: string;
  locale: LocaleCode;
  voiceId?: string;
}

export interface BilingualSegment {
  text: string;
  locale: LocaleCode;
}

/** Split mixed-language utterance for per-locale TTS routing */
export function segmentBilingualUtterance(
  text: string,
  primary: LocaleCode,
  secondary: LocaleCode,
): BilingualSegment[] {
  // Placeholder — production uses language ID per token
  return [{ text, locale: primary }];
}

export interface AiService {
  predictText(req: PredictionRequest): Promise<TextPrediction[]>;
  predictSymbols(req: SymbolPredictionRequest): Promise<SymbolPrediction[]>;
  generateSymbols(req: SymbolGenerationRequest): Promise<GeneratedSymbol[]>;
  synthesizeSpeech(req: SpeakRequest): Promise<ArrayBuffer>;
}

/** Context-aware stub until cloud LLM / PictoBERT backends are wired */
export const stubAiService: AiService = {
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
  async generateSymbols(req) {
    const count = Math.min(req.count ?? 4, 4);
    return Array.from({ length: count }, (_, i) => ({
      id: `stub-${i}`,
      imageUrl: '',
      promptUsed: req.prompt,
    }));
  },
  async synthesizeSpeech() {
    return new ArrayBuffer(0);
  },
};

export { buildSymbolPredictions, buildTextPredictions } from './predict.js';
export { createAiService } from './llm.js';
