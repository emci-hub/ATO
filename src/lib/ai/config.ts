import type { AiProviderId } from './types';

export interface AiConfig {
  provider: AiProviderId;
}

/**
 * The live vendor is Gemini, called only by the `ai-library` Edge Function (keys
 * and model names are server secrets). The phone owns no AI build setting any
 * more: roadmap A5 removed the EXPO_PUBLIC_AI_PROVIDER / EXPO_PUBLIC_MODEL_PROVIDER
 * reads and the old `ai-generate` client path. This value only labels the
 * developer AI lab; no EXPO_PUBLIC_*_API_KEY or *_MODEL may appear under src/
 * (scripts/ai-provider-check.ts fails on either).
 */
export const AI_CONFIG: AiConfig = { provider: 'gemini' };
