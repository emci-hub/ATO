import { AI_CONFIG, isRemoteReady } from './config';
import { isAiProviderId, type AiProviderId } from './types';

export const AI_PROVIDER_OVERRIDE_KEY = 'ato.ai.provider.override.v1';

let cached: AiProviderId | null | undefined;

async function storage(): Promise<{
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
} | null> {
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    return mod.default;
  } catch {
    return null;
  }
}

export async function readProviderOverride(): Promise<AiProviderId | null> {
  if (cached !== undefined) return cached;
  try {
    const store = await storage();
    const raw = store ? await store.getItem(AI_PROVIDER_OVERRIDE_KEY) : null;
    cached = raw && isAiProviderId(raw) ? raw : null;
  } catch {
    cached = null;
  }
  return cached;
}

export async function setProviderOverride(id: AiProviderId | null): Promise<void> {
  cached = id;
  try {
    const store = await storage();
    if (!store) return;
    if (id) await store.setItem(AI_PROVIDER_OVERRIDE_KEY, id);
    else await store.removeItem(AI_PROVIDER_OVERRIDE_KEY);
  } catch {
    // Device-only; a failed persist still applies for this session.
  }
}

/** Override (this device) wins; otherwise the bundled AI_PROVIDER. */
export async function resolveActiveProvider(): Promise<AiProviderId> {
  const override = await readProviderOverride();
  return override ?? AI_CONFIG.provider;
}

export async function shouldUseLocalAi(): Promise<boolean> {
  const id = await resolveActiveProvider();
  if (id === 'local') return true;
  return !isRemoteReady(AI_CONFIG, id);
}

export function configuredProvider(): AiProviderId {
  return AI_CONFIG.provider;
}
