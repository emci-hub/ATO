import {
  isAiProviderId,
  type AiProviderId,
  type RemoteAiProviderId,
} from './types';

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
  gemini: 'gemini-2.5-flash',
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

const BUNDLE_ENV: AiEnv = {
  AI_PROVIDER: process.env.EXPO_PUBLIC_AI_PROVIDER,
  MODEL_PROVIDER: process.env.EXPO_PUBLIC_MODEL_PROVIDER,
  GEMINI_MODEL: process.env.EXPO_PUBLIC_GEMINI_MODEL,
  GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
  NVIDIA_MODEL: process.env.EXPO_PUBLIC_NVIDIA_MODEL,
  NVIDIA_API_KEY: process.env.EXPO_PUBLIC_NVIDIA_API_KEY,
  PERPLEXITY_MODEL: process.env.EXPO_PUBLIC_PERPLEXITY_MODEL,
  PERPLEXITY_API_KEY: process.env.EXPO_PUBLIC_PERPLEXITY_API_KEY,
};

export const AI_CONFIG: AiConfig = buildAiConfig(BUNDLE_ENV);

/** Client-held keys only. Claude/Grok keys live in Edge Function secrets. */
export function hasClientKey(config: AiConfig, id: RemoteAiProviderId): boolean {
  if (id === 'gemini') return Boolean(config.geminiApiKey);
  if (id === 'nvidia') return Boolean(config.nvidiaApiKey);
  if (id === 'perplexity') return Boolean(config.perplexityApiKey);
  return true;
}

export function isRemoteReady(config: AiConfig, id: AiProviderId): boolean {
  if (id === 'local') return false;
  return hasClientKey(config, id);
}
