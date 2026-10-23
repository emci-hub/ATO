/**
 * Starts and stops "Preview as new user" (rules: lib/preview-mode.ts).
 *
 * START: copies this account's saved phone data to a device-level key FIRST,
 * then clears it (and the in-memory caches), so everything stored on the
 * phone also reads as new. Divecore's save (`ato.play.*`) is never touched:
 * it is phone-only game progress and not part of the "new account" view.
 * Pushes and the widget are left alone and are not updated while previewing.
 * STOP: puts the copy back, THEN turns preview off, so no real write can go
 * out while screens still hold preview data. Both bump the account-data epoch
 * so every mounted screen reloads.
 *
 * The flag itself is memory only: an app restart ends the preview. The copy is
 * not: if the app is killed mid-preview (iOS, a crash, an OTA reload), the next
 * launch restores it for the same account (`recoverPreviewSnapshot`, called by
 * MeProvider), and drops it for any other account.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { bumpAccountDataEpoch } from '@/lib/account-data-epoch';
import { DEV_TOOLS_AVAILABLE, PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { clearAccountMemoryCaches, listAccountScopedKeys } from '@/lib/local-account-data';
import { isPreviewing, previewOwner, setPreviewState, subscribePreview } from '@/lib/preview-mode';

/** Device-level (not account-scoped), so a wipe or a preview never removes it. */
export const PREVIEW_SNAPSHOT_KEY = 'ato.preview.snapshot.v1';
/** Phone-only data a preview never copies, clears or restores. */
export const PREVIEW_UNTOUCHED_PREFIXES: readonly string[] = ['ato.play.'];

interface SavedSnapshot {
  owner: string;
  pairs: [string, string][];
}

let busy = false;

async function previewKeys(): Promise<string[]> {
  const keys = await listAccountScopedKeys();
  return keys.filter((key) => !PREVIEW_UNTOUCHED_PREFIXES.some((prefix) => key.startsWith(prefix)));
}

async function readSaved(): Promise<SavedSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(PREVIEW_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSnapshot;
    if (!parsed || typeof parsed.owner !== 'string' || !Array.isArray(parsed.pairs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Removes whatever the preview wrote, then writes the copy back. */
async function restore(saved: SavedSnapshot | null): Promise<void> {
  clearAccountMemoryCaches();
  const written = await previewKeys();
  if (written.length > 0) await AsyncStorage.multiRemove(written);
  if (saved && saved.pairs.length > 0) await AsyncStorage.multiSet(saved.pairs);
  await AsyncStorage.removeItem(PREVIEW_SNAPSHOT_KEY);
}

/** Root only, pre-launch dev tools only. Throws otherwise. */
export async function startPreview(input: { userId: string; isRoot: boolean }): Promise<void> {
  if (!PRE_LAUNCH_DEV || !DEV_TOOLS_AVAILABLE) throw new Error('Preview is a pre-launch dev tool.');
  if (!input.isRoot) throw new Error('Preview as new user is root only.');
  if (isPreviewing() || busy) return;
  // An older copy still waiting to be restored must never be overwritten.
  if (await readSaved()) throw new Error('A previous preview is still being undone. Reopen the app, then try again.');
  busy = true;
  try {
    const keys = await previewKeys();
    const pairs = (keys.length > 0 ? await AsyncStorage.multiGet(keys) : []).filter(
      (pair): pair is [string, string] => typeof pair[1] === 'string',
    );
    // Saved to the phone BEFORE anything is removed, so a kill cannot lose it.
    await AsyncStorage.setItem(PREVIEW_SNAPSHOT_KEY, JSON.stringify({ owner: input.userId, pairs } satisfies SavedSnapshot));
    clearAccountMemoryCaches();
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
    setPreviewState(true, input.userId);
  } finally {
    busy = false;
  }
  bumpAccountDataEpoch();
}

export async function stopPreview(): Promise<void> {
  if (!isPreviewing() || busy) return;
  busy = true;
  try {
    await restore(await readSaved());
  } catch (err) {
    console.log('[preview] restore failed:', err);
  } finally {
    // Off only after the real data is back.
    setPreviewState(false, null);
    busy = false;
  }
  bumpAccountDataEpoch();
}

/**
 * Ends the preview the moment the signed-in account is not the one it started
 * on (sign-out, account switch) or stops being root. Called by MeProvider.
 */
export function endPreviewIfAccountChanged(userId: string | null | undefined, isRoot: boolean): void {
  const owner = previewOwner();
  if (!owner) return;
  if (owner !== userId) {
    // A different account (or none): the saved copy belongs to the previous
    // account and must never be written back onto this one. Drop it.
    setPreviewState(false, null);
    void AsyncStorage.removeItem(PREVIEW_SNAPSHOT_KEY).catch(() => {});
    bumpAccountDataEpoch();
    return;
  }
  if (!isRoot) void stopPreview();
}

/**
 * On launch: a copy left by a preview the app never got to stop (killed,
 * crashed, reloaded). Same account: put it back. Another account: drop it.
 */
export async function recoverPreviewSnapshot(userId: string): Promise<void> {
  if (isPreviewing() || busy) return;
  const saved = await readSaved();
  if (!saved) return;
  if (saved.owner !== userId) {
    await AsyncStorage.removeItem(PREVIEW_SNAPSHOT_KEY);
    return;
  }
  busy = true;
  try {
    await restore(saved);
  } finally {
    busy = false;
  }
  bumpAccountDataEpoch();
}

export function usePreviewing(): boolean {
  return useSyncExternalStore(subscribePreview, isPreviewing, isPreviewing);
}
