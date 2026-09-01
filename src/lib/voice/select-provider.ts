import { isRemoteReady } from '@/lib/ai/config';
import { resolveActiveProvider } from '@/lib/ai/override';
import type { VoiceConfig } from './config';
import type { VoiceProvider } from './providers/types';
import type { ProviderId } from './types';

export async function pickVoiceProvider(
  config: VoiceConfig,
  providers: Record<ProviderId, VoiceProvider>,
  honorOverride: boolean,
): Promise<{ provider: VoiceProvider; label: string }> {
  const requested = honorOverride ? await resolveActiveProvider() : config.provider;
  if (requested === 'local' || !isRemoteReady(config, requested)) {
    const local = providers.local;
    const label =
      requested === 'local'
        ? local.label
        : `local (no ${requested} key configured)`;
    return { provider: local, label };
  }
  const provider = providers[requested] ?? providers.local;
  return { provider, label: provider.label };
}
