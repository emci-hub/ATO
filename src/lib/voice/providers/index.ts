import type { VoiceConfig } from '../config';
import type { ProviderId } from '../types';
import { createGeminiProvider } from './gemini';
import { localProvider } from './local';
import type { VoiceProvider } from './types';

/**
 * Registry of all voice providers. Adding a future provider = implement it,
 * register it here, and the MODEL_PROVIDER config value selects it.
 */
export function buildProviders(config: VoiceConfig): Record<ProviderId, VoiceProvider> {
  return {
    gemini: createGeminiProvider({ model: config.geminiModel, apiKey: config.geminiApiKey ?? '' }),
    local: localProvider,
  };
}
