import { useCallback, useEffect, useState } from 'react';

import { DEV_TOOLS_AVAILABLE } from '@/lib/dev-mode';

/**
 * Quests switches (ATO-BUILD PHASE-17). Read from `app_config` (wave116):
 * `quests_enabled`, `quests_apply_enabled`, `quests_disabled_campaigns`.
 * Fail closed: a server error (or wave116 not applied yet) means everything
 * off. Offline (no answer) uses the last flags the server gave, if any.
 * The server checks the same switches on every call; this only decides what
 * the screens show.
 *
 * Dev override (`ato.quests.devflags.v1`: 'on' | 'off'): honoured only while
 * dev tools are available (DEV_TOOLS_AVAILABLE), ignored in release. It changes
 * what the phone shows, never what the server accepts (root passes the server
 * switches on its own).
 */
export interface QuestFlags {
  enabled: boolean;
  applyEnabled: boolean;
  disabledCampaigns: readonly string[];
}

export type DevFlagOverride = 'on' | 'off' | null;

export const FLAGS_OFF: QuestFlags = { enabled: false, applyEnabled: false, disabledCampaigns: [] };
const FLAGS_ON: QuestFlags = { enabled: true, applyEnabled: true, disabledCampaigns: [] };

export const QUEST_DEV_FLAGS_KEY = 'ato.quests.devflags.v1';

/** One app_config row as PostgREST returns it, to flags. Anything unexpected reads as off. */
export function parseFlags(row: unknown): QuestFlags {
  if (typeof row !== 'object' || row === null) return FLAGS_OFF;
  const r = row as Record<string, unknown>;
  return {
    enabled: r.quests_enabled === true,
    applyEnabled: r.quests_enabled === true && r.quests_apply_enabled === true,
    disabledCampaigns: Array.isArray(r.quests_disabled_campaigns)
      ? r.quests_disabled_campaigns.filter((x): x is string => typeof x === 'string')
      : [],
  };
}

/** The server's flags, unless a dev override is set and dev tools are available. */
export function resolveFlags(server: QuestFlags, override: DevFlagOverride, devAllowed: boolean = DEV_TOOLS_AVAILABLE): QuestFlags {
  if (!devAllowed || override === null) return server;
  return override === 'on' ? FLAGS_ON : FLAGS_OFF;
}

/** The entry and the campaign list: Quests on and this campaign not switched off. */
export function questsVisible(flags: QuestFlags, campaignId?: string): boolean {
  return flags.enabled && (campaignId === undefined || !flags.disabledCampaigns.includes(campaignId));
}

/** Apply on the Said screen. */
export function applyAllowed(flags: QuestFlags, campaignId: string): boolean {
  return questsVisible(flags, campaignId) && flags.applyEnabled;
}

export const nextOverride = (o: DevFlagOverride): DevFlagOverride => (o === null ? 'on' : o === 'on' ? 'off' : null);

async function storage() {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  return AsyncStorage;
}

export async function loadDevOverride(): Promise<DevFlagOverride> {
  if (!DEV_TOOLS_AVAILABLE) return null;
  try {
    const v = await (await storage()).getItem(QUEST_DEV_FLAGS_KEY);
    return v === 'on' || v === 'off' ? v : null;
  } catch {
    return null;
  }
}

export async function saveDevOverride(o: DevFlagOverride): Promise<void> {
  if (!DEV_TOOLS_AVAILABLE) return;
  try {
    const s = await storage();
    if (o === null) await s.removeItem(QUEST_DEV_FLAGS_KEY);
    else await s.setItem(QUEST_DEV_FLAGS_KEY, o);
  } catch (err) {
    console.log('[quests] dev flags not saved:', err instanceof Error ? err.message : err);
  }
}

/** The last flags the server gave, so an offline phone keeps them (and can queue a Save). */
export const QUEST_FLAGS_CACHE_KEY = 'ato.quests.flags.v1';

/**
 * A server answer is used (and cached). No answer at all (offline) falls back
 * to the cached flags; anything else, or no cache, is off.
 */
export function flagsFromFetch(
  result: { data: unknown; error: { code?: string } | null } | 'threw',
  cached: QuestFlags | null,
): QuestFlags {
  if (result === 'threw') return cached ?? FLAGS_OFF;
  if (result.error) return !result.error.code ? (cached ?? FLAGS_OFF) : FLAGS_OFF;
  return parseFlags(result.data);
}

export async function fetchQuestFlags(): Promise<QuestFlags> {
  let cached: QuestFlags | null = null;
  try {
    const raw = await (await storage()).getItem(QUEST_FLAGS_CACHE_KEY);
    cached = raw ? parseFlags(JSON.parse(raw)) : null;
  } catch {
    cached = null;
  }
  try {
    const { supabase } = await import('@/lib/supabase');
    const result = await supabase
      .from('app_config')
      .select('quests_enabled, quests_apply_enabled, quests_disabled_campaigns')
      .eq('id', 1)
      .maybeSingle();
    const flags = flagsFromFetch(result, cached);
    if (!result.error) {
      try {
        await (await storage()).setItem(QUEST_FLAGS_CACHE_KEY, JSON.stringify(result.data ?? {}));
      } catch {
        // a missing cache only means off while offline
      }
    }
    return flags;
  } catch {
    return flagsFromFetch('threw', cached);
  }
}

/** Flags for a screen: null while loading. `cycleOverride` steps server → on → off (dev only). */
export function useQuestFlags() {
  const [server, setServer] = useState<QuestFlags | null>(null);
  const [override, setOverride] = useState<DevFlagOverride>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchQuestFlags(), loadDevOverride()]).then(([f, o]) => {
      if (!alive) return;
      setServer(f);
      setOverride(o);
    });
    return () => {
      alive = false;
    };
  }, []);

  const cycleOverride = useCallback(() => {
    setOverride((o) => {
      const next = nextOverride(o);
      void saveDevOverride(next);
      return next;
    });
  }, []);

  return { flags: server ? resolveFlags(server, override) : null, override, cycleOverride };
}
