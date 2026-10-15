/**
 * The pet that knows you — the adapter (hideout roadmap step 3). Reads what the app already knows
 * (trait tracks via `fetchTraitTracks`, the check-in streak from the daily-insights store) and keeps a
 * small cache on the phone. Edits no app file; only READS app code.
 *
 * Fallbacks, all of them end in a hedge line, never a crash and never silence:
 *   - Preview as new user (`isPreviewing`): thin profile, the cache is neither read nor written, so the
 *     real profile can never show through a preview.
 *   - Signed out: thin profile.
 *   - Offline / slow / read error: the cached profile (any age) for this account, else thin.
 * The cache holds only each trait's end ("high" / "low"), no values and no answers, and it belongs to
 * one account (a payload for another account is ignored). The `ato.*` key is wiped on sign-out and
 * Reset account (`clearLocalAccountData` is deny-by-default for `ato.*`).
 *
 * Nothing here goes into the Divecore cloud save, Circle, or any shared surface.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DAILY_INSIGHTS_STATE_KEY } from '@/lib/daily-insights/store';
import { currentStreak, isDoneToday, parseStore } from '@/lib/daily-insights/streak';
import { localYmd } from '@/lib/local-date';
import { isPreviewing } from '@/lib/preview-mode';
import { supabase } from '@/lib/supabase';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import {
  buildEnds,
  parseState,
  THIN_PROFILE,
  type PetKnowsProfile,
  type PetKnowsState,
} from '@/play/pet-knows-you';

export const PET_KNOWS_YOU_KEY = 'ato.play.petKnowsYou.v1';
/** A cached profile younger than this is used without asking the server. */
export const PKY_CACHE_FRESH_MS = 6 * 60 * 60 * 1000;
export const PKY_FETCH_TIMEOUT_MS = 4000;

/**
 * `requireExisting`: only overwrite a key that is still there. After a sign-out or Reset the `ato.*`
 * keys are wiped; a late write from a screen that was open must not bring the old account's data back.
 */
export async function savePetKnowsState(state: PetKnowsState, requireExisting = false): Promise<void> {
  try {
    if (requireExisting && (await AsyncStorage.getItem(PET_KNOWS_YOU_KEY)) == null) return;
    await AsyncStorage.setItem(PET_KNOWS_YOU_KEY, JSON.stringify({ v: 1, ...state }));
  } catch {
    // The pet just forgets what it said. Never blocks play.
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve('timeout'), ms);
    work.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** The check-in streak, read from the daily-insights store (local to the phone). */
async function readStreak(userId: string): Promise<{ streak: number; doneToday: boolean }> {
  try {
    const store = parseStore(await AsyncStorage.getItem(DAILY_INSIGHTS_STATE_KEY), userId);
    const today = localYmd(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
    return { streak: currentStreak(store.streak, today), doneToday: isDoneToday(store.streak, today) };
  } catch {
    return { streak: 0, doneToday: false };
  }
}

export interface PetKnowsLoaded {
  profile: PetKnowsProfile;
  /** The account the profile and state belong to; null = nothing to remember (signed out / preview). */
  userId: string | null;
  state: PetKnowsState | null;
}

/** Never throws. */
export async function loadPetKnows(now: number = Date.now()): Promise<PetKnowsLoaded> {
  const thin: PetKnowsLoaded = { profile: THIN_PROFILE, userId: null, state: null };
  try {
    if (isPreviewing()) return thin;
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id ?? null;
    if (!userId) return thin;

    let state = parseState(await AsyncStorage.getItem(PET_KNOWS_YOU_KEY), userId);
    let ends = state.cache?.ends ?? {};
    const fresh = state.cache != null && now - state.cache.at < PKY_CACHE_FRESH_MS;
    if (!fresh) {
      try {
        const tracks = await withTimeout(fetchTraitTracks(userId), PKY_FETCH_TIMEOUT_MS);
        if (tracks !== 'timeout') {
          ends = buildEnds(tracks);
          state = { ...state, cache: { at: now, ends } };
          await savePetKnowsState(state);
        }
      } catch {
        // Offline or a read error: keep whatever the cache had (maybe nothing → a hedge line).
      }
    }
    const { streak, doneToday } = await readStreak(userId);
    return { profile: { ends, streak, doneToday }, userId, state };
  } catch {
    return thin;
  }
}
