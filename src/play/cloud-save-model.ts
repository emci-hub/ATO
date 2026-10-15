/**
 * Divecore cloud save + anonymous counters — the pure rules (2026-10-15, server: wave96).
 *
 * Cloud save: the phone's Play save is pushed to `play_saves` (one row per account) a short
 * while after a change and when the app goes to the background. It is restored ONLY when this
 * phone has no real Divecore save (a reinstall, a new phone, or a fresh pet made while a restore
 * got no answer): a phone's own save always wins. Pushes start only once this phone has a definite
 * answer for the signed-in account, so a failed restore can never overwrite the real save.
 *
 * Counters: six anonymous daily counters (no user id is stored server-side). This phone sends each
 * at most once per local day, so a day's count reads as "players who did this today".
 * Pure: no React Native, no network — `cloud-save.ts` and `play-counters.ts` do the I/O.
 */

/** Wait this long after a change before pushing (the latest doc wins; one push per burst). */
export const CLOUD_PUSH_DELAY_MS = 15_000;
/** Matches the server's check (octet_length <= 1 MB). Bigger docs are not pushed. */
export const CLOUD_DOC_MAX_BYTES = 1_048_576;

/** Give up on the restore read after this long (the player starts with a provisional pet). */
export const CLOUD_RESTORE_TIMEOUT_MS = 4_000;

/** Restore from the server only when this phone has no Divecore save at all. */
export function shouldRestoreFromCloud(localRaw: string | null, remote: unknown): boolean {
  if (localRaw != null && localRaw.length > 0) return false;
  return remote != null && typeof remote === 'object' && !Array.isArray(remote);
}

export type CloudRestoreInput = {
  /** The signed-in account. */
  uid: string;
  /** The account this phone was last checked for (null = never). */
  checkedUid: string | null;
  /** This phone has a Divecore save. */
  hasLocal: boolean;
  /** That save is a fresh pet made because an earlier restore got no answer. */
  provisional: boolean;
};

export type CloudRestoreStep = {
  /** Nothing to ask the server. */
  done: boolean;
  /** Replace the local save with the server's. */
  restore: boolean;
  /** This phone is now checked for `uid` (pushes may start). */
  markChecked: boolean;
  /** The local save is a fresh pet waiting for an answer (pushes stay off). */
  markProvisional: boolean;
};

/**
 * One step of the restore. `answer` is null before asking the server; then 'doc' (a save came
 * back and parses), 'none' (no save on the server) or 'unknown' (offline, timeout, read error, or a
 * save from a newer app version). Only 'doc' / 'none' mark the phone checked.
 */
export function cloudRestoreStep(input: CloudRestoreInput, answer: 'doc' | 'none' | 'unknown' | null): CloudRestoreStep {
  const nothing = { done: true, restore: false, markChecked: false, markProvisional: false };
  if (input.checkedUid === input.uid) return nothing;
  // A real save made on this phone before cloud save existed is the source: keep it, start pushing.
  if (input.hasLocal && !input.provisional) return { ...nothing, markChecked: true };
  if (answer == null) return { done: false, restore: false, markChecked: false, markProvisional: false };
  if (answer === 'doc') return { done: true, restore: true, markChecked: true, markProvisional: false };
  if (answer === 'none') return { done: true, restore: false, markChecked: true, markProvisional: false };
  return { done: true, restore: false, markChecked: false, markProvisional: true };
}

/** Push only for the account this phone is checked for, and only a doc queued under it. */
export function cloudPushAllowed(input: { sessionUid: string | null; checkedUid: string | null; owner: string | null }): boolean {
  return input.sessionUid != null && input.checkedUid === input.sessionUid && input.owner === input.sessionUid;
}

/** The RPC arguments for one push, or null when the doc is too big to send. */
export function cloudSavePayload(
  doc: { version: number },
  savedAt: number,
  json: string = JSON.stringify(doc),
): { p_doc: unknown; p_version: number; p_saved_at: string } | null {
  if (utf8Bytes(json) > CLOUD_DOC_MAX_BYTES) return null;
  return { p_doc: doc, p_version: doc.version, p_saved_at: new Date(savedAt).toISOString() };
}

function utf8Bytes(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i += 1;
    } else n += 3;
  }
  return n;
}

/* ------------------------------------------------------------------ counters --- */

/** The server's fixed list (bump_play_counter ignores anything else). */
export const PLAY_COUNTERS = ['play_open', 'hideout_open', 'rail_action', 'turf_wave_start', 'dive_start', 'return_next_day'] as const;
export type PlayCounter = (typeof PLAY_COUNTERS)[number];

export type CounterState = { ymd: string; sent: PlayCounter[]; lastOpenYmd: string | null };

export const EMPTY_COUNTERS: CounterState = { ymd: '', sent: [], lastOpenYmd: null };

/** Local calendar day, YYYY-MM-DD. */
export function localYmd(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The local day before `now`. */
export function previousYmd(now: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return localYmd(d.getTime());
}

/** Send `name` today? (once per local day per counter). */
export function planBump(state: CounterState, name: PlayCounter, ymd: string): { send: boolean; next: CounterState } {
  const today = state.ymd === ymd ? state : { ...state, ymd, sent: [] };
  if (today.sent.includes(name)) return { send: false, next: today };
  return { send: true, next: { ...today, sent: [...today.sent, name] } };
}

/** Opening Play: `play_open`, plus `return_next_day` when the last open was yesterday. */
export function planOpen(state: CounterState, now: number): { send: PlayCounter[]; next: CounterState } {
  const ymd = localYmd(now);
  const send: PlayCounter[] = [];
  let next = state;
  const open = planBump(next, 'play_open', ymd);
  next = open.next;
  if (open.send) send.push('play_open');
  if (state.lastOpenYmd === previousYmd(now)) {
    const back = planBump(next, 'return_next_day', ymd);
    next = back.next;
    if (back.send) send.push('return_next_day');
  }
  return { send, next: { ...next, lastOpenYmd: ymd } };
}

/** Parse the stored state; anything odd starts fresh. */
export function parseCounterState(raw: string | null): CounterState {
  if (!raw) return EMPTY_COUNTERS;
  try {
    const v = JSON.parse(raw) as Partial<CounterState>;
    const sent = Array.isArray(v.sent) ? v.sent.filter((n): n is PlayCounter => (PLAY_COUNTERS as readonly string[]).includes(n as string)) : [];
    return {
      ymd: typeof v.ymd === 'string' ? v.ymd : '',
      sent,
      lastOpenYmd: typeof v.lastOpenYmd === 'string' ? v.lastOpenYmd : null,
    };
  } catch {
    return EMPTY_COUNTERS;
  }
}
