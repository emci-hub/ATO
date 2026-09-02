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
// values into the client bundle. Vendor keys are deliberately NOT listed:
// they live in Edge Function secrets (see src/lib/ai/config.ts).
const BUNDLE_ENV: VoiceEnv = {
  AI_PROVIDER: process.env.EXPO_PUBLIC_AI_PROVIDER,
  MODEL_PROVIDER: process.env.EXPO_PUBLIC_MODEL_PROVIDER,
  GEMINI_MODEL: process.env.EXPO_PUBLIC_GEMINI_MODEL,
  NVIDIA_MODEL: process.env.EXPO_PUBLIC_NVIDIA_MODEL,
  PERPLEXITY_MODEL: process.env.EXPO_PUBLIC_PERPLEXITY_MODEL,
};

export const VOICE_CONFIG: VoiceConfig = buildVoiceConfig(BUNDLE_ENV);
