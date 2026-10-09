/**
 * Category deep dive — where the cards live.
 *
 * Server (wave90): `category_deep_dives` (own rows only), written through
 * `save_category_deep_dive`; the daily claim `claim_category_deep_dive`
 * (cap 1/day, `app_config.category_deep_dive_daily_cap`). Copies the tested
 * wave89 Legends museum path.
 *
 * Phone (`ato.categoryDeepDive.v1`, account-scoped: wiped on sign-out by the
 * deny-by-default keep list): the newest card per category, so a saved card
 * opens free and offline. With no server claim there is NO AI call (the server
 * decides whether a paid call happens, never the phone).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

import {
  DEEP_DIVE_KEY,
  emptyDiveState,
  parseDiveEntry,
  parseDiveState,
  type DiveEntry,
  type DiveLocalState,
} from './state';

export { DEEP_DIVE_KEY, madeToday, mergeDives, type DiveEntry, type DiveLocalState } from './state';

export async function loadDiveState(userId: string): Promise<DiveLocalState> {
  try {
    return parseDiveState(await AsyncStorage.getItem(DEEP_DIVE_KEY), userId);
  } catch {
    return emptyDiveState(userId);
  }
}

export async function saveDiveState(state: DiveLocalState): Promise<void> {
  try {
    await AsyncStorage.setItem(DEEP_DIVE_KEY, JSON.stringify(state));
  } catch {
    // Best effort; the server copy (when applied) is the durable one.
  }
}

/** The server cards, newest first, or null when the table isn't there yet / offline. */
export async function fetchServerDives(): Promise<DiveEntry[] | null> {
  try {
    const { data, error } = await supabase
      .from('category_deep_dives')
      .select('category_id, story, made_on')
      .order('created_at', { ascending: false })
      .limit(60);
    if (error || !Array.isArray(data)) return null;
    return data
      .map((row) =>
        parseDiveEntry({
          dive: (row as { story?: unknown }).story,
          madeOn: (row as { made_on?: unknown }).made_on,
        }),
      )
      .filter((row): row is DiveEntry => row != null);
  } catch {
    return null;
  }
}

/** Claim today's deep dive (server cap). Anything but 'ok' = no AI call;
 * 'missing' = wave90 isn't applied yet (PostgREST PGRST202). */
export async function claimCategoryDeepDive(): Promise<'ok' | 'used' | 'tokens' | 'missing' | 'failed'> {
  try {
    const { data, error } = await supabase.rpc('claim_category_deep_dive');
    if (error) {
      return /PGRST202|Could not find the function/i.test(`${error.code ?? ''} ${error.message ?? ''}`) ? 'missing' : 'failed';
    }
    if (!data || typeof data !== 'object') return 'failed';
    const row = data as { ok?: unknown; reason?: unknown };
    if (row.ok === true) return 'ok';
    // wave92: not enough ATO tokens for one AI view.
    return row.reason === 'tokens' ? 'tokens' : 'used';
  } catch {
    return 'failed';
  }
}

/** The day the server counts the daily limit on (UTC), so the phone's
 * "you've had today's" matches the server exactly. */
export function diveDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function saveServerDive(entry: DiveEntry): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('save_category_deep_dive', {
      p_category_id: entry.dive.categoryId,
      p_leans_key: entry.dive.leansKey,
      p_story: entry.dive,
      p_made_on: entry.madeOn,
    });
    return !error;
  } catch {
    return false;
  }
}
