import { buildAiConfig, type AiConfig, type AiEnv } from '@/lib/ai/config';
import type { ProviderId } from './types';

/** The router's default provider. Switching vendors is AI_PROVIDER, not a rewrite. */
export const VOICE_PROVIDER_DEFAULT: ProviderId = 'gemini';

/** Bank content (first_cards.md) covers Day 1–3; check_count >= 3 generates. */
export const BANK_CARD_DAYS = 3;

/** How many generate attempts the router tries before showing nothing. */
export const GENERATED_MAX_ATTEMPTS = 3;

export type VoiceEnv = AiEnv;
export type VoiceConfig = AiConfig;

/** Pure builder so tests can pass any env; the app uses BUNDLE_ENV below. */
export function buildVoiceConfig(env: VoiceEnv): VoiceConfig {
  return buildAiConfig(env);
}

// Static EXPO_PUBLIC_* access is required for Expo to inline .env.local
// values into the client bundle (docs: environment variables in Expo).
const BUNDLE_ENV: VoiceEnv = {
  AI_PROVIDER: process.env.EXPO_PUBLIC_AI_PROVIDER,
  MODEL_PROVIDER: process.env.EXPO_PUBLIC_MODEL_PROVIDER,
  GEMINI_MODEL: process.env.EXPO_PUBLIC_GEMINI_MODEL,
  GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
  NVIDIA_MODEL: process.env.EXPO_PUBLIC_NVIDIA_MODEL,
  NVIDIA_API_KEY: process.env.EXPO_PUBLIC_NVIDIA_API_KEY,
  PERPLEXITY_MODEL: process.env.EXPO_PUBLIC_PERPLEXITY_MODEL,
  PERPLEXITY_API_KEY: process.env.EXPO_PUBLIC_PERPLEXITY_API_KEY,
};

export const VOICE_CONFIG: VoiceConfig = buildVoiceConfig(BUNDLE_ENV);
