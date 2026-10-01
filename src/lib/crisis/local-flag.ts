/**
 * "Crisis today", noticed on the device.
 *
 * Home shows the static crisis card when the server says a crisis moment was
 * logged in the last days (`home_bootstrap` → `crisis_flags`). Nothing writes
 * that table any more (Talk, its only writer, was removed), so the card could
 * never appear. This is the missing signal, kept local on purpose:
 *
 *   - any text the user types and saves is run through the SAME keyword check
 *     (`keywordDetect` — no model, no network);
 *   - a hit stores today's date under one key on this phone;
 *   - Home ORs that with the server's answer.
 *
 * The flagged text itself is never stored or sent anywhere — only the date.
 * The key is under `ato.` so sign-out / delete-account wipe it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { keywordDetect } from '@/lib/crisis/detect';

export const CRISIS_LOCAL_KEY = 'ato.crisis.today.v1';

/** The device's own calendar date, YYYY-MM-DD. */
export function deviceYmd(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/** True when a stored value means "flagged today". */
export function crisisFlagIsToday(stored: string | null | undefined, now: Date = new Date()): boolean {
  return typeof stored === 'string' && stored === deviceYmd(now);
}

/**
 * Run typed text through the keyword check; on a hit, remember today.
 * Returns whether it flagged. Never throws — a storage failure must not block
 * the save that called it.
 */
export async function noteCrisisText(text: string, now: Date = new Date()): Promise<boolean> {
  if (!keywordDetect(text)) return false;
  try {
    await AsyncStorage.setItem(CRISIS_LOCAL_KEY, deviceYmd(now));
  } catch (err) {
    console.log('[crisis] local flag write error:', err);
  }
  return true;
}

export async function crisisNotedToday(now: Date = new Date()): Promise<boolean> {
  try {
    return crisisFlagIsToday(await AsyncStorage.getItem(CRISIS_LOCAL_KEY), now);
  } catch {
    return false;
  }
}

/** Dev tools only. */
export async function clearCrisisLocalFlag(): Promise<void> {
  await AsyncStorage.removeItem(CRISIS_LOCAL_KEY).catch(() => {});
}
