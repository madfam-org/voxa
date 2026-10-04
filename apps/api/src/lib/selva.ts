/**
 * Word predictions through Selva, the ecosystem model gateway, with the
 * in-process local predictor as the fallback.
 *
 * Contract:
 * - Off unless `SELVA_ENABLED=true` and `SELVA_BASE_URL`, `SELVA_CLIENT_ID`,
 *   `SELVA_CLIENT_SECRET` and `JANUA_TOKEN_URL` are all set. Off means no
 *   outbound request at all.
 * - Authentication is a Janua `client_credentials` access token for this
 *   service's own client (scope `SELVA_SCOPE`, default `selva:infer`). It is
 *   fetched at runtime and cached until 60 s before it expires; nothing is
 *   minted or stored anywhere else.
 * - Every completion request carries `X-Sensitivity: restricted`, so the
 *   gateway may only answer from a local model and never from a third-party
 *   vendor. When it has no local model it answers 503, which degrades here.
 * - Only the current partial utterance is sent (its last 200 characters): no
 *   history, no profile, no user id.
 * - Any failure (missing configuration, token error, HTTP error, timeout,
 *   malformed answer) returns the local predictor's suggestions with
 *   `source: 'local'`. A prediction request never fails because of Selva.
 * - Logs carry a reason code only, never utterance text, suggestions or
 *   tokens.
 */
import {
  buildTextPredictions,
  foldWord,
  type PredictionSource,
  type TextPrediction,
} from '@voxa/ai';

export const SELVA_SENSITIVITY = 'restricted';
export const DEFAULT_SELVA_SCOPE = 'selva:infer';
export const DEFAULT_SELVA_TIMEOUT_MS = 2000;
/** Refresh a cached token this long before it expires. */
export const TOKEN_REFRESH_MARGIN_MS = 60_000;
/** Longest tail of the utterance sent to Selva. */
export const MAX_PARTIAL_CHARS = 200;
const MAX_SUGGESTION_CHARS = 40;
const MAX_SUGGESTION_WORDS = 4;
const MAX_SUGGESTIONS = 5;

export interface SelvaConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scope: string;
  timeoutMs: number;
}

export type SelvaConfigResult =
  | { enabled: true; config: SelvaConfig }
  | { enabled: false; reason: 'disabled' }
  | { enabled: false; reason: 'incomplete'; missing: string[] };

/** Read the Selva settings. Returns `enabled: false` unless every one is present. */
export function readSelvaConfig(env: NodeJS.ProcessEnv = process.env): SelvaConfigResult {
  if ((env.SELVA_ENABLED ?? '').trim().toLowerCase() !== 'true') {
    return { enabled: false, reason: 'disabled' };
  }

  const required = {
    SELVA_BASE_URL: env.SELVA_BASE_URL?.trim() ?? '',
    SELVA_CLIENT_ID: env.SELVA_CLIENT_ID?.trim() ?? '',
    SELVA_CLIENT_SECRET: env.SELVA_CLIENT_SECRET?.trim() ?? '',
    JANUA_TOKEN_URL: env.JANUA_TOKEN_URL?.trim() ?? '',
  };
  const missing = Object.entries(required)
    .filter(([, value]) => value === '')
    .map(([name]) => name);
  if (missing.length > 0) return { enabled: false, reason: 'incomplete', missing };

  const timeout = Number(env.SELVA_TIMEOUT_MS);
  return {
    enabled: true,
    config: {
      baseUrl: required.SELVA_BASE_URL.replace(/\/+$/, ''),
      clientId: required.SELVA_CLIENT_ID,
      clientSecret: required.SELVA_CLIENT_SECRET,
      tokenUrl: required.JANUA_TOKEN_URL,
      scope: env.SELVA_SCOPE?.trim() || DEFAULT_SELVA_SCOPE,
      timeoutMs:
        Number.isFinite(timeout) && timeout > 0
          ? Math.min(Math.max(timeout, 200), 10_000)
          : DEFAULT_SELVA_TIMEOUT_MS,
    },
  };
}

/** A Selva failure, described by a reason code that never carries content. */
export class SelvaError extends Error {
  constructor(readonly code: string) {
    super(`selva: ${code}`);
    this.name = 'SelvaError';
  }
}

type FetchFn = typeof fetch;

/**
 * Caches the client_credentials token until `TOKEN_REFRESH_MARGIN_MS` before
 * it expires. Concurrent callers share one in-flight token request.
 */
export class SelvaTokenCache {
  private token: { value: string; key: string; expiresAt: number } | null = null;
  private inflight: { key: string; promise: Promise<string> } | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  clear(): void {
    this.token = null;
    this.inflight = null;
  }

  async get(config: SelvaConfig, fetchFn: FetchFn, signal?: AbortSignal): Promise<string> {
    const key = `${config.tokenUrl}\n${config.clientId}\n${config.scope}`;
    if (this.token && this.token.key === key && this.now() < this.token.expiresAt - TOKEN_REFRESH_MARGIN_MS) {
      return this.token.value;
    }
    if (this.inflight && this.inflight.key === key) return this.inflight.promise;

    const promise = this.fetchToken(config, fetchFn, key, signal).finally(() => {
      if (this.inflight?.promise === promise) this.inflight = null;
    });
    this.inflight = { key, promise };
    return promise;
  }

  private async fetchToken(
    config: SelvaConfig,
    fetchFn: FetchFn,
    key: string,
    signal?: AbortSignal,
  ): Promise<string> {
    let res: Response;
    try {
      res = await fetchFn(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          scope: config.scope,
        }).toString(),
        signal,
      });
    } catch (err) {
      throw new SelvaError(isAbort(err) ? 'timeout' : 'token_network');
    }
    if (!res.ok) {
      await discardBody(res);
      throw new SelvaError(`token_http_${res.status}`);
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch (err) {
      throw new SelvaError(isAbort(err) ? 'timeout' : 'token_invalid_response');
    }
    const record = body as { access_token?: unknown; expires_in?: unknown };
    if (typeof record.access_token !== 'string' || record.access_token === '') {
      throw new SelvaError('token_invalid_response');
    }

    const issuedAt = this.now();
    const expiresAt =
      typeof record.expires_in === 'number' && record.expires_in > 0
        ? issuedAt + record.expires_in * 1000
        : (jwtExpiryMs(record.access_token) ?? issuedAt);
    this.token = { value: record.access_token, key, expiresAt };
    return record.access_token;
  }
}

/** The `exp` claim of a JWT in milliseconds, read without verifying it (cache timing only). */
function jwtExpiryMs(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
}

async function discardBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // Nothing to release.
  }
}

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Spanish',
  en: 'English',
  fr: 'French',
};

function languageName(locale: string): string {
  const lang = locale.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  return LANGUAGE_NAMES[lang] ?? 'the same language as the message';
}

/** The system prompt. It holds no user content. */
export function selvaSystemPrompt(locale: string, maxSuggestions: number): string {
  const language = languageName(locale);
  return [
    'You suggest how a message continues for a person who communicates with an AAC board.',
    `The message is in ${language}${locale.trim() ? ` (${locale.trim()})` : ''}.`,
    `Reply with only a JSON array of up to ${maxSuggestions} short continuations, one to three words each, in ${language}, that could come next.`,
    'Plain everyday words only: no punctuation, emoji, explanations, or repetition of the message.',
  ].join(' ');
}

/** Pull plain continuation strings out of the model's answer. */
export function parseSelvaSuggestions(content: string, maxSuggestions: number): string[] {
  const unfenced = content
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let items: unknown[] = [];
  try {
    const parsed: unknown = JSON.parse(unfenced);
    if (Array.isArray(parsed)) items = parsed;
    else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { suggestions?: unknown }).suggestions)) {
      items = (parsed as { suggestions: unknown[] }).suggestions;
    }
  } catch {
    items = unfenced.split('\n').map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ''));
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== 'string') continue;
    const text = item
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^["'“”«»]+|["'“”«».,;:!?¡¿]+$/g, '')
      .trim();
    if (!text || text.length > MAX_SUGGESTION_CHARS) continue;
    if (text.split(' ').length > MAX_SUGGESTION_WORDS) continue;
    if (/[<>{}[\]\\]/.test(text)) continue;
    const key = foldWord(text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= maxSuggestions) break;
  }
  return out;
}

export interface SelvaTextRequest {
  partialText: string;
  locale: string;
  maxSuggestions: number;
}

/**
 * Ask Selva for continuations. Returns whole-utterance suggestions (the
 * communicator replaces the message with the chosen one). Throws
 * `SelvaError` on any failure.
 */
export async function selvaTextPredictions(
  config: SelvaConfig,
  req: SelvaTextRequest,
  deps: { fetch: FetchFn; tokenCache: SelvaTokenCache },
): Promise<TextPrediction[]> {
  const utterance = req.partialText.trim().replace(/\s+/g, ' ');
  const sent = utterance.slice(-MAX_PARTIAL_CHARS);
  const max = Math.min(Math.max(Math.trunc(req.maxSuggestions) || 3, 1), MAX_SUGGESTIONS);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const token = await deps.tokenCache.get(config, deps.fetch, controller.signal);

    let res: Response;
    try {
      res = await deps.fetch(`${config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Sensitivity': SELVA_SENSITIVITY,
        },
        body: JSON.stringify({
          model: 'auto',
          stream: false,
          temperature: 0.2,
          max_tokens: 64,
          messages: [
            { role: 'system', content: selvaSystemPrompt(req.locale, max) },
            { role: 'user', content: sent },
          ],
        }),
        signal: controller.signal,
      });
    } catch (err) {
      throw new SelvaError(isAbort(err) ? 'timeout' : 'network');
    }

    if (!res.ok) {
      await discardBody(res);
      // A rejected token is dropped so the next request fetches a fresh one.
      if (res.status === 401) deps.tokenCache.clear();
      throw new SelvaError(`http_${res.status}`);
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch (err) {
      throw new SelvaError(isAbort(err) ? 'timeout' : 'invalid_response');
    }
    const content = (body as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message
      ?.content;
    if (typeof content !== 'string') throw new SelvaError('invalid_response');

    const suggestions = parseSelvaSuggestions(content, max);
    if (suggestions.length === 0) throw new SelvaError('empty_response');

    const folded = foldWord(utterance);
    return suggestions.map((next, i) => ({
      text: foldWord(next).startsWith(`${folded} `) ? next : `${utterance} ${next}`,
      confidence: Math.max(0.5, 0.9 - i * 0.05),
    }));
  } finally {
    clearTimeout(timer);
  }
}

export interface TextPredictionInput {
  partialText: unknown;
  locale: unknown;
  maxSuggestions: unknown;
}

export interface TextPredictionResult {
  predictions: TextPrediction[];
  source: PredictionSource;
}

export interface PredictDeps {
  env?: NodeJS.ProcessEnv;
  fetch?: FetchFn;
  tokenCache?: SelvaTokenCache;
  log?: (message: string) => void;
}

/** Process-wide token cache for the API's Selva client. */
export const defaultSelvaTokenCache = new SelvaTokenCache();

let warnedIncomplete = false;

/**
 * Text predictions: Selva when it is enabled and answers, otherwise the
 * local predictor. Never throws because of Selva.
 */
export async function predictTextPreferSelva(
  input: TextPredictionInput,
  deps: PredictDeps = {},
): Promise<TextPredictionResult> {
  const partialText = typeof input.partialText === 'string' ? input.partialText : '';
  const locale = typeof input.locale === 'string' ? input.locale : '';
  const maxSuggestions =
    typeof input.maxSuggestions === 'number' && Number.isFinite(input.maxSuggestions) ? input.maxSuggestions : 3;
  const log = deps.log ?? ((message: string) => console.warn(message));
  const local = (): TextPredictionResult => ({
    predictions: buildTextPredictions(partialText, maxSuggestions, locale || undefined),
    source: 'local',
  });

  if (!partialText.trim()) return local();

  const settings = readSelvaConfig(deps.env ?? process.env);
  if (!settings.enabled) {
    if (settings.reason === 'incomplete' && !warnedIncomplete) {
      warnedIncomplete = true;
      log(`Selva predictions enabled but not configured (missing ${settings.missing.join(', ')}); using the local predictor`);
    }
    return local();
  }

  try {
    const predictions = await selvaTextPredictions(
      settings.config,
      { partialText, locale, maxSuggestions },
      { fetch: deps.fetch ?? globalThis.fetch, tokenCache: deps.tokenCache ?? defaultSelvaTokenCache },
    );
    return { predictions, source: 'selva' };
  } catch (err) {
    const code = err instanceof SelvaError ? err.code : 'unexpected';
    log(`Selva predictions unavailable (${code}); using the local predictor`);
    return local();
  }
}
