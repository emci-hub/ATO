import { isAiProviderId, type AiProviderId } from './types';

/**
 * The only two build-time settings the client still owns. Vendor keys and
 * model names left the bundle on 2026-09-02: the ai-generate Edge Function
 * picks the model (`<VENDOR>_MODEL` secret, else its own defaults) and holds
 * every key, so the client sends a provider id and nothing else.
 */
export interface AiEnv {
  AI_PROVIDER?: string;
  MODEL_PROVIDER?: string;
}

export interface AiConfig {
  provider: AiProviderId;
}

export const AI_PROVIDER_DEFAULT: AiProviderId = 'gemini';

/**
 * Reference copy of the Edge Function's per-vendor defaults
 * (supabase/functions/ai-generate/index.ts DEFAULT_MODELS). The client never
 * sends a model; this exists so docs / labs / checks can name what the server
 * runs by default. scripts/ai-provider-check asserts the two stay identical.
 */
export const DEFAULT_MODELS = {
  // gemini-2.5-flash was retired for new users (404, verified 2026-09-02).
  gemini: 'gemini-3.7-flash',
  nvidia: 'meta/llama-3.1-8b-instruct',
  perplexity: 'sonar',
  claude: 'claude-sonnet-4-5',
  grok: 'grok-3-mini',
  deepseek: 'deepseek-v4-flash',
} as const;

/**
 * AI_PROVIDER selects the live vendor. MODEL_PROVIDER=local still forces the
 * deterministic fallback so existing tests and .env.local keep working.
 */
export function buildAiConfig(env: AiEnv): AiConfig {
  const fromAi = env.AI_PROVIDER?.trim();
  const fromModel = env.MODEL_PROVIDER?.trim();
  let provider: AiProviderId = AI_PROVIDER_DEFAULT;
  if (fromAi && isAiProviderId(fromAi)) provider = fromAi;
  else if (fromModel && isAiProviderId(fromModel)) provider = fromModel;
  if (fromModel === 'local') provider = 'local';
  return { provider };
}

/**
 * Only statically referenced EXPO_PUBLIC_* vars get inlined by Expo, so the
 * two names below are the complete list of what a build can bake in. No
 * EXPO_PUBLIC_*_API_KEY and no EXPO_PUBLIC_*_MODEL may appear under src/
 * (scripts/ai-provider-check.ts fails on either).
 */
const BUNDLE_ENV: AiEnv = {
  AI_PROVIDER: process.env.EXPO_PUBLIC_AI_PROVIDER,
  MODEL_PROVIDER: process.env.EXPO_PUBLIC_MODEL_PROVIDER,
};

export const AI_CONFIG: AiConfig = buildAiConfig(BUNDLE_ENV);

/**
 * A remote provider is always "ready" from the client's point of view — the
 * key check happens in the Edge Function (503 `<provider>_key_missing`).
 */
export function isRemoteReady(_config: AiConfig, id: AiProviderId): boolean {
  return id !== 'local';
}
