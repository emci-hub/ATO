/**
 * Everything ATO stores ON THE DEVICE for the signed-in account, and the one
 * call that removes all of it.
 *
 * Why this exists (2026-09-15): deleting an account cleared the Supabase auth
 * session and nothing else. The server side was never the problem — a live
 * orphan scan across every user-keyed column found zero rows, and every
 * `account_deletions` row reports `rows_remaining = 0` — but the phone kept
 * every key the deleted account had written. The next signup on that device
 * read them straight back, so a brand-new account rendered the previous
 * account's content. `ato.today-insight.v1` is the clearest case: it carries no
 * user id at all, and Home paints from it on mount before any network call, so
 * a fresh account showed the deleted account's insight and the iOS widget kept
 * showing it indefinitely.
 *
 * DENY BY DEFAULT. This wipes every `ato.*` key except an explicit keep-list of
 * genuinely device-level preferences. That direction is deliberate: a key added
 * later that turns out to hold account content is erased on delete without
 * anyone remembering to update this file, and the failure mode of erasing one
 * preference too many is a user re-picking a theme — not one account seeing
 * another's data.
 *
 * Three things here are NOT AsyncStorage and are easy to forget: the iOS widget
 * App Group (no OTA can reach a shipped widget), the OS-level push schedules
 * (the morning one repeats daily carrying the account's own insight title), and
 * the in-memory module caches. Delete and re-signup happen in
 * one app session with no relaunch, so clearing AsyncStorage alone would leave
 * the warm `Map`s in `answered-option-storage` / `category-page-position` /
 * `full-profile-unlock` answering for the previous account.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';

import { APP_GROUP, WIDGET_KIND } from '@/lib/insight/today-insight';
import { resetAnsweredOptionCache } from '@/lib/questions/answered-option-storage';
import { resetCategoryPagePositionCache } from '@/lib/questions/category-page-position';
import { resetFullProfileUnlockCache } from '@/lib/full-profile-unlock';

/** Every key this app writes is namespaced. Anything else on the device is not ours. */
export const ATO_KEY_NAMESPACE = 'ato.';

/**
 * Device-level preferences that survive an account deletion, because they
 * describe the PHONE and not the person: how the app looks, which crisis region
 * it resolved, whether the OS push prompt has been shown, and the dev-only
 * provider override. None of them is derived from account content, and none of
 * them can leak one account's data into another.
 *
 * `ato.auth.*` is absent on purpose — `clearLocalSession` owns the auth
 * artifacts and must stay the only writer, so it is matched by prefix below
 * rather than listed here.
 */
export const DEVICE_LEVEL_KEYS: readonly string[] = [
  'ato.appearance.mode',
  'ato.crisis.region.auto',
  'ato.crisis.region.override',
  'ato.push.prefs.v1',
  'ato.push.asked',
  'ato.ai.provider.override.v1',
];

/** Prefixes left alone. Only auth, which `clearLocalSession` clears itself. */
export const DEVICE_LEVEL_PREFIXES: readonly string[] = ['ato.auth.'];

/** True when this key holds account content and must not outlive the account. */
export function isAccountScopedKey(key: string): boolean {
  if (!key.startsWith(ATO_KEY_NAMESPACE)) return false;
  if (DEVICE_LEVEL_KEYS.includes(key)) return false;
  return !DEVICE_LEVEL_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Blank the App Group values the shipped iOS widget renders and force a reload.
 *
 * Mirrors `today-insight.ts`'s `writeWidget(null)` rather than importing it:
 * that function is the insight module's own write path and takes a
 * `CachedInsight`, while this is an erase that must run even when no insight
 * was ever cached in this session. The key names are the card-era ones
 * (`read`/`do`/`hasCard`) for the same reason documented there — a widget
 * binary already on a home screen cannot be updated over OTA.
 */
function clearWidget(): void {
  if (Platform.OS !== 'ios') return;
  try {
    const storage = new ExtensionStorage(APP_GROUP);
    storage.set('read', '');
    storage.set('do', '');
    storage.set('hasCard', '0');
    ExtensionStorage.reloadWidget(WIDGET_KIND);
  } catch (err) {
    console.log('[local-account-data] widget clear skipped:', err);
  }
}

/** The account-scoped keys currently on this device, for the Dev Lab dump. */
export async function listAccountScopedKeys(): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter(isAccountScopedKey).sort();
  } catch {
    return [];
  }
}

/**
 * Remove every trace of the signed-in account from this device.
 *
 * Best-effort and never throws: it runs AFTER the server has confirmed the
 * account is gone, and a storage failure at that point must not surface as
 * "we could not delete your account" when the deletion already succeeded.
 * Returns the keys it removed so the caller (and the Dev Lab panel) can show
 * what actually happened instead of assuming.
 */
export async function clearLocalAccountData(): Promise<string[]> {
  // In-memory first: these need no storage and must be cleared even if
  // AsyncStorage is unavailable in this runtime.
  resetAnsweredOptionCache();
  resetCategoryPagePositionCache();
  resetFullProfileUnlockCache();

  let removed: string[] = [];
  try {
    const keys = await AsyncStorage.getAllKeys();
    removed = keys.filter(isAccountScopedKey);
    if (removed.length > 0) await AsyncStorage.multiRemove(removed);
  } catch (err) {
    console.log('[local-account-data] storage clear failed:', err);
  }

  clearWidget();

  // OS-level schedules are not storage, so nothing above reaches them. The
  // morning push repeats DAILY carrying `insight.title` — AI-written text about
  // the account being deleted — and `PushRuntime` unmounts on sign-out, so if
  // this is skipped it keeps firing until some later account finishes
  // onboarding, or forever if nobody signs up on this device again.
  // Lazily imported: `push.ts` pulls in expo-notifications and the trait store,
  // and this module is reached from `clearLocalSession` at app start.
  try {
    const { cancelAllScheduledPush } = await import('@/lib/push');
    await cancelAllScheduledPush();
  } catch (err) {
    console.log('[local-account-data] push cancel skipped:', err);
  }

  return removed.sort();
}
