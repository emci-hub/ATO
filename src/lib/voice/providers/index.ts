import type { VoiceConfig } from '../config';
import type { ProviderId } from '../types';
import { REMOTE_AI_PROVIDER_IDS } from '@/lib/ai/types';
import { localProvider } from './local';
import { createRemoteProvider } from './remote';
import type { VoiceProvider } from './types';

/**
 * Registry of all voice providers. The live vendor is AI_PROVIDER (plus the
 * on-device override). local stays the deterministic fallback.
 */
export function buildProviders(_config: VoiceConfig): Record<ProviderId, VoiceProvider> {
  const remotes = Object.fromEntries(
    REMOTE_AI_PROVIDER_IDS.map((id) => [id, createRemoteProvider(id)]),
  ) as Record<Exclude<ProviderId, 'local'>, VoiceProvider>;
  return {
    ...remotes,
    local: localProvider,
  };
}
