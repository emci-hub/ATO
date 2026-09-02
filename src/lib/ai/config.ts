import { isAiProviderId, type AiProviderId } from './types';

export interface AiEnv {
  AI_PROVIDER?: string;
  MODEL_PROVIDER?: string;
  GEMINI_MODEL?: string;
  GEMINI_API_KEY?: string;
  NVIDIA_MODEL?: string;
  NVIDIA_API_KEY?: string;
  PERPLEXITY_MODEL?: string;
  PERPLEXITY_API_KEY?: string;
}

export interface AiConfig {
  provider: AiProviderId;
  geminiModel: string;
  geminiApiKey?: string;
  nvidiaModel: string;
  nvidiaApiKey?: string;
  perplexityModel: string;
  perplexityApiKey?: string;
}

export const AI_PROVIDER_DEFAULT: AiProviderId = 'gemini';

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

  return {
    provider,
    geminiModel: env.GEMINI_MODEL || DEFAULT_MODELS.gemini,
    geminiApiKey: env.GEMINI_API_KEY || undefined,
    nvidiaModel: env.NVIDIA_MODEL || DEFAULT_MODELS.nvidia,
    nvidiaApiKey: env.NVIDIA_API_KEY || undefined,
    perplexityModel: env.PERPLEXITY_MODEL || DEFAULT_MODELS.perplexity,
    perplexityApiKey: env.PERPLEXITY_API_KEY || undefined,
  };
}

/**
 * Since 2026-09-02 NO vendor key is read here. Every remote call goes through
 * the ai-generate Edge Function, whose secrets (GEMINI_API_KEY, NVIDIA_API_KEY,
 * PERPLEXITY_API_KEY, ANTHROPIC_API_KEY, XAI_API_KEY, DEEPSEEK_API_KEY) never
 * reach the bundle. The *_API_KEY fields on AiEnv/AiConfig remain only so the
 * live Node check scripts (card-live / talk-live / style-live) can pass a key
 * explicitly to the script-only Gemini adapter.
 *
 * Only statically referenced EXPO_PUBLIC_* vars get inlined by Expo, so
 * omitting them here is what actually removes them from the app.
 */
const BUNDLE_ENV: AiEnv = {
  AI_PROVIDER: process.env.EXPO_PUBLIC_AI_PROVIDER,
  MODEL_PROVIDER: process.env.EXPO_PUBLIC_MODEL_PROVIDER,
  GEMINI_MODEL: process.env.EXPO_PUBLIC_GEMINI_MODEL,
  NVIDIA_MODEL: process.env.EXPO_PUBLIC_NVIDIA_MODEL,
  PERPLEXITY_MODEL: process.env.EXPO_PUBLIC_PERPLEXITY_MODEL,
};

export const AI_CONFIG: AiConfig = buildAiConfig(BUNDLE_ENV);

/**
 * A remote provider is always "ready" from the client's point of view — the
 * key check happens in the Edge Function (503 `<provider>_key_missing`).
 */
export function isRemoteReady(_config: AiConfig, id: AiProviderId): boolean {
  return id !== 'local';
}
