import { AI_CONFIG, isRemoteReady } from './config';
import { completeGemini } from './gemini';
import { completeNvidia, completePerplexity } from './openai-compat';
import { completeViaEdge, isEdgeProvider } from './edge';
import { resolveActiveProvider } from './override';
import type { AiCallMetadata, AiProviderId, GenerateRequest, RemoteAiProviderId } from './types';

async function logQuiet(provider: AiProviderId): Promise<void> {
  try {
    const { logAiProviderCall } = await import('./usage');
    await logAiProviderCall(provider);
  } catch {
    // Checks / unsigned-in: skip.
  }
}

async function completeFor(
  provider: Exclude<AiProviderId, 'local'>,
  request: GenerateRequest,
  meta: AiCallMetadata,
  options: { ping?: boolean } = {},
): Promise<string> {
  // meta is threaded through so every call site's declaration follows the
  // request into future per-call logging / batching layers.
  void meta;
  if (provider === 'gemini') {
    return completeGemini(request, {
      model: AI_CONFIG.geminiModel,
      apiKey: AI_CONFIG.geminiApiKey ?? '',
    });
  }
  if (provider === 'nvidia') {
    return completeNvidia(request, {
      model: AI_CONFIG.nvidiaModel,
      apiKey: AI_CONFIG.nvidiaApiKey ?? '',
    });
  }
  if (provider === 'perplexity') {
    return completePerplexity(request, {
      model: AI_CONFIG.perplexityModel,
      apiKey: AI_CONFIG.perplexityApiKey ?? '',
    });
  }
  if (isEdgeProvider(provider)) {
    return completeViaEdge(provider, request, options);
  }
  throw new Error(`Unknown AI provider: ${provider}`);
}

/**
 * Classifies a Gemini failure as quota / token-limit (e.g. 429
 * RESOURCE_EXHAUSTED) vs anything else. Used for the log line only — since
 * 2026-09-02 EVERY Gemini failure falls back to DeepSeek (see generateText),
 * because there is no reason to show an empty card while a live second
 * provider is available.
 */
export function isQuotaLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  if (/\b429\b/.test(msg)) return true;
  if (/resource_exhausted|rate_limit|quota/i.test(msg)) return true;
  if (/token/i.test(msg) && /limit|exceed|max|too long|length/i.test(msg)) return true;
  return false;
}

/**
 * One-shot, non-streaming. Returns the raw model text (JSON string or prose)
 * so existing parse* functions stay unchanged. Null when local / unconfigured
 * / the vendor call failed.
 *
 * `meta` is required — every call site must declare how its output may be
 * shared or batched (see src/lib/ai/call-sites.ts). scripts/ai-provider-check.ts
 * fails on any call site that omits it.
 */
export async function generateText(
  request: GenerateRequest,
  meta: AiCallMetadata,
): Promise<string | null> {
  const provider = await resolveActiveProvider();
  if (provider === 'local' || !isRemoteReady(AI_CONFIG, provider)) return null;

  try {
    const text = await completeFor(provider, request, meta);
    void logQuiet(provider);
    return text;
  } catch (err) {
    // Gemini is the bundled primary. On ANY Gemini failure (quota, 404 model
    // retired, 5xx, network, empty response) retry the same request once on
    // DeepSeek; only if that also fails fall through to the normal error state.
    if (provider === 'gemini') {
      const why = isQuotaLimitError(err) ? 'quota' : 'error';
      console.log(`[ai] Gemini ${why} -> DeepSeek fallback:`, err);
      try {
        const text = await completeFor('deepseek', request, meta);
        void logQuiet('deepseek');
        return text;
      } catch (fallbackErr) {
        console.log('[ai] Gemini -> DeepSeek fallback failed:', fallbackErr);
      }
    }
    void logQuiet(provider);
    console.log('[ai] generate error:', err);
    return null;
  }
}

/** Connectivity probes are not content — never quota-fallback, never user-visible. */
const PING_META: AiCallMetadata = {
  personalized: false,
  cohortShareable: false,
  bucketShareable: false,
  latencySensitive: false,
};

/**
 * Minimal real call through the same dispatch as generateText, for
 * connectivity checks. Unlike generateText, errors propagate (not swallowed)
 * and no usage is logged, so a ping never pollutes the self-tracked counts.
 */
export async function pingProvider(provider: RemoteAiProviderId): Promise<void> {
  await completeFor(provider, {
    prompt: 'Reply with the word ready.',
    temperature: 0,
    // Reasoning models (Gemini thinkingConfig, grok-3-mini) can spend part of
    // this budget on hidden thinking tokens before any output text — too low
    // a budget makes a reachable provider look down with an empty response.
    maxOutputTokens: 64,
    responseFormat: 'text',
  }, PING_META, { ping: true }); // edge providers: server probe, no quota claim
}
