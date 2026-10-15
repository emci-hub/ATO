/**
 * Divecore cloud save — the I/O (2026-10-15). Rules in `cloud-save-model.ts`; server in wave96.
 *
 * Restore (`restoreFromCloud`, before the first local load): asks the server once per account.
 * Only a definite answer (a save came back, or there is none) marks this phone as checked for that
 * account. Offline, slow (4 s), a read error, or a save from a newer app version leaves it
 * unchecked: the fresh pet is marked provisional and the server is asked again on the next open.
 *
 * Push (`queueCloudSave`): the newest doc goes up CLOUD_PUSH_DELAY_MS after a change, or when the
 * app goes to the background, ONLY when this phone is checked for the signed-in account and the doc
 * was queued under that same account. So a failed restore can never let a fresh pet replace the
 * real save, and one account's pet never lands in another account's row.
 * Never throws and never blocks play.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import {
  CLOUD_PUSH_DELAY_MS,
  CLOUD_RESTORE_TIMEOUT_MS,
  cloudPushAllowed,
  cloudRestoreStep,
  cloudSavePayload,
} from '@/play/cloud-save-model';
import { PLAY_STORE_KEY, parsePlayStore, type PlayStoreDoc } from '@/play/playStore';

/** The account this phone has asked the server about (uid). */
const CHECKED_KEY = 'ato.play.cloudChecked.v1';
/** '1' while the local save is a fresh pet made because the restore could not get an answer. */
const PROVISIONAL_KEY = 'ato.play.cloudProvisional.v1';

let checkedUid: string | null = null;
let pending: { doc: PlayStoreDoc; at: number; owner: string | null } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function listen() {
  if (listening) return;
  listening = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'background' || state === 'inactive') void flushCloudSave();
  });
}

async function sessionUid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function withTimeout<T>(work: PromiseLike<T>, ms: number): Promise<T | 'timeout'> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve('timeout'), ms);
    Promise.resolve(work).then(
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

/** Remember the newest doc (stamped with the account it belongs to) and push it shortly. */
export function queueCloudSave(doc: PlayStoreDoc, now: number = Date.now()): void {
  listen();
  pending = { doc, at: now, owner: checkedUid };
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushCloudSave();
  }, CLOUD_PUSH_DELAY_MS);
}

/** Push the newest queued doc now (if this phone is checked for the signed-in account). */
export async function flushCloudSave(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const next = pending;
  if (!next) return;
  pending = null;
  try {
    const uid = await sessionUid();
    const stored = await AsyncStorage.getItem(CHECKED_KEY);
    if (!cloudPushAllowed({ sessionUid: uid, checkedUid: stored, owner: next.owner })) return;
    const args = cloudSavePayload(next.doc, next.at);
    if (!args) return;
    const { error } = await supabase.rpc('save_play_doc', args);
    if (error && __DEV__) console.warn('[play-cloud-save]', error.message);
  } catch (err) {
    if (__DEV__) console.warn('[play-cloud-save]', err);
  }
}

/** Bring the account's Divecore save back on a new or reset phone. Null = keep the local save. */
export async function restoreFromCloud(now: number = Date.now()): Promise<PlayStoreDoc | null> {
  try {
    const uid = await sessionUid();
    if (!uid) return null;
    const [localRaw, stored, provisional] = await Promise.all([
      AsyncStorage.getItem(PLAY_STORE_KEY),
      AsyncStorage.getItem(CHECKED_KEY),
      AsyncStorage.getItem(PROVISIONAL_KEY),
    ]);
    const before = cloudRestoreStep({ uid, checkedUid: stored, hasLocal: !!localRaw, provisional: provisional === '1' }, null);
    if (before.done) {
      if (before.markChecked) await AsyncStorage.setItem(CHECKED_KEY, uid);
      checkedUid = uid;
      return null;
    }
    const res = await withTimeout(supabase.from('play_saves').select('doc').maybeSingle(), CLOUD_RESTORE_TIMEOUT_MS);
    let answer: { kind: 'none' } | { kind: 'doc'; doc: PlayStoreDoc } | { kind: 'unknown' };
    if (res === 'timeout' || res.error) answer = { kind: 'unknown' };
    else if (!res.data) answer = { kind: 'none' };
    else {
      const parsed = parsePlayStore(JSON.stringify((res.data as { doc?: unknown }).doc ?? null), now);
      answer = parsed ? { kind: 'doc', doc: parsed } : { kind: 'unknown' };
    }
    const step = cloudRestoreStep(
      { uid, checkedUid: stored, hasLocal: !!localRaw, provisional: provisional === '1' },
      answer.kind,
    );
    if (step.markChecked) {
      await AsyncStorage.setItem(CHECKED_KEY, uid);
      await AsyncStorage.removeItem(PROVISIONAL_KEY);
      checkedUid = uid;
    } else if (step.markProvisional) {
      await AsyncStorage.setItem(PROVISIONAL_KEY, '1');
    }
    return step.restore && answer.kind === 'doc' ? answer.doc : null;
  } catch {
    return null;
  }
}
