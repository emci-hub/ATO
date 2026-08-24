import type { ProviderId } from './types';

/** The router's default provider. Switching providers is a config change
 *  (EXPO_PUBLIC_MODEL_PROVIDER=local), not a rewrite. */
export const VOICE_PROVIDER_DEFAULT: ProviderId = 'gemini';

/** Bank content (first_cards.md) covers Day 1–3; check_count >= 3 generates. */
export const BANK_CARD_DAYS = 3;

/** How many generate attempts the router tries before showing nothing. */
export const GENERATED_MAX_ATTEMPTS = 3;

export interface VoiceEnv {
  MODEL_PROVIDER?: string;
  GEMINI_MODEL?: string;
  GEMINI_API_KEY?: string;
}

export interface VoiceConfig {
  provider: ProviderId;
  geminiModel: string;
  geminiApiKey?: string;
}

/** Pure builder so tests can pass any env; the app uses BUNDLE_ENV below. */
export function buildVoiceConfig(env: VoiceEnv): VoiceConfig {
  const raw = env.MODEL_PROVIDER ?? VOICE_PROVIDER_DEFAULT;
  const provider: ProviderId = raw === 'local' ? 'local' : 'gemini';
  return {
    provider,
    geminiModel: env.GEMINI_MODEL || 'gemini-3.6-flash',
    geminiApiKey: env.GEMINI_API_KEY || undefined,
  };
}

// Static EXPO_PUBLIC_* access is required for Expo to inline .env.local
// values into the client bundle (docs: environment variables in Expo).
const BUNDLE_ENV: VoiceEnv = {
  MODEL_PROVIDER: process.env.EXPO_PUBLIC_MODEL_PROVIDER,
  GEMINI_MODEL: process.env.EXPO_PUBLIC_GEMINI_MODEL,
  GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
};

export const VOICE_CONFIG: VoiceConfig = buildVoiceConfig(BUNDLE_ENV);
