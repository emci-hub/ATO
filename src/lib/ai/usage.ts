import { supabase } from '@/lib/supabase';

import type { AiProviderId, RemoteAiProviderId } from './types';
import { REMOTE_AI_PROVIDER_IDS } from './types';

export type ProviderCounts = Record<RemoteAiProviderId, { minute: number; day: number }>;

function emptyCounts(): ProviderCounts {
  return {
    gemini: { minute: 0, day: 0 },
    nvidia: { minute: 0, day: 0 },
    perplexity: { minute: 0, day: 0 },
    claude: { minute: 0, day: 0 },
    grok: { minute: 0, day: 0 },
    deepseek: { minute: 0, day: 0 },
  };
}

function asCountMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(value);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

/**
 * Fire-and-forget. Never throws into the generate path. Local is not logged.
 */
export async function logAiProviderCall(provider: AiProviderId): Promise<void> {
  if (provider === 'local') return;
  try {
    const { error } = await supabase.from('ai_provider_log').insert({ provider });
    if (error) console.log('[ai-log] insert error:', error.message);
  } catch (err) {
    console.log('[ai-log] insert error:', err);
  }
}

export async function fetchProviderCounts(): Promise<ProviderCounts> {
  const { data, error } = await supabase.rpc('ai_provider_counts');
  if (error) throw error;
  const row = (data ?? {}) as { minute?: unknown; day?: unknown };
  const minute = asCountMap(row.minute);
  const day = asCountMap(row.day);
  const out = emptyCounts();
  for (const id of REMOTE_AI_PROVIDER_IDS) {
    out[id] = { minute: minute[id] ?? 0, day: day[id] ?? 0 };
  }
  return out;
}
