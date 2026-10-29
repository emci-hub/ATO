import type { ActiveRun } from '@/lib/quests/run';
import type { AxisVerdict } from '@/lib/quests/score';
import { SCORE } from '@/lib/quests/score';
import type { KV } from '@/lib/quests/run-store';
import type { TraitAxis } from '@/lib/traits';

/**
 * Quests Save / Apply / Undo on the phone (ATO-BUILD PHASE-17). The server
 * (wave116: record_quest_run, apply_quest_result, undo_quest_result) decides
 * everything; this file only builds the payloads, keeps one call per run in
 * flight (R07), queues a Save that could not reach the server and retries it
 * with the same run id, and maps every server error to a code the screen can
 * say. The 7-day stamps kept here are a mirror for the Said screen (R09).
 *
 * The storage and the RPC caller are passed in (`createQuestApplier`) so the
 * offline check runs it on a Map and a fake server; the app uses `questApplier`.
 */
export const QUEST_APPLY_QUEUE_KEY = 'ato.quests.apply-queue.v1';
/** Last Apply time per axis, plus the axes each run applied (so Undo can clear them). */
export const QUEST_APPLIED_KEY = 'ato.quests.applied.v1';

const MAX_QUEUE = 20;
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RecordArgs {
  p_run_id: string;
  p_campaign_id: string;
  p_content_version: number;
  p_ending_id: string;
  p_for_fun: boolean;
  p_stats: Record<string, number>;
  p_events: QuestEvent[];
}

export interface QuestEvent {
  t: 'quest_start' | 'scene_view' | 'commit' | 'rewind' | 'd20' | 'quit' | 'ending' | 'said_view' | 'for_fun';
  s?: string;
  c?: string;
  n?: number;
}

export interface AxisWrite {
  axis: TraitAxis;
  s: number;
  g: number;
}

export interface ApplyJob {
  /** The server run id (a uuid made from the local run id). */
  runId: string;
  record: RecordArgs;
  /** Empty = record only (a for-fun run, or nothing ticked). */
  axes: AxisWrite[];
  /** Undone while offline: never sent as a Save again; the next flush asks the server to undo it. */
  cancelled?: boolean;
}

export type RpcError = { message?: string; code?: string } | null;
export type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }>;

/** Every server code (wave116 raises 'quests:<code>') plus the phone's own. */
export const QUEST_ERROR_CODES = [
  'not_signed_in',
  'quests_disabled',
  'apply_disabled',
  'campaign_disabled',
  'bad_input',
  'run_not_found',
  'run_taken',
  'run_used',
  'not_evidence',
  'too_many_axes',
  'axis_not_allowed',
  'axis_cooldown',
  'not_applied',
  'undo_expired',
  'offline',
  'not_ready',
  'unknown',
] as const;
export type QuestErrorCode = (typeof QUEST_ERROR_CODES)[number];

export type SaveOutcome =
  | { status: 'saved'; counts: boolean; applied: AxisWrite[] }
  | { status: 'queued' }
  | { status: 'error'; code: QuestErrorCode };

export type UndoOutcome = { status: 'undone' } | { status: 'error'; code: QuestErrorCode };

// --- pure helpers -----------------------------------------------------------------------------

/** FNV-1a 32-bit with a seed. */
function fnv(text: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The server id for a local run id: the same uuid every time (so a retry or a
 * double tap lands on the same row), version-4 shaped. A uuid passes through.
 */
export function serverRunId(runId: string): string {
  if (UUID_RE.test(runId)) return runId.toLowerCase();
  const hex = [1, 2, 3, 4].map((seed) => fnv(runId, seed).toString(16).padStart(8, '0')).join('');
  const v = `${hex.slice(0, 12)}4${hex.slice(13, 16)}${((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 32)}`;
  return `${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20, 32)}`;
}

/** Analytics events from the run's log (ids the server would refuse are left out, never sent). */
export function runEvents(run: Pick<ActiveRun, 'history' | 'mode'>): QuestEvent[] {
  const out: QuestEvent[] = [{ t: 'quest_start' }];
  for (const p of run.history.slice(0, 90)) {
    if (!ID_RE.test(p.sceneId) || !ID_RE.test(p.choiceId)) continue;
    out.push({ t: 'scene_view', s: p.sceneId });
    out.push({ t: p.undone ? 'rewind' : 'commit', s: p.sceneId, c: p.choiceId });
    if (typeof p.roll === 'number') out.push({ t: 'd20', s: p.sceneId, n: Math.max(0, Math.min(1000, Math.round(p.roll))) });
  }
  out.push({ t: 'ending' }, { t: 'said_view' });
  if (run.mode === 'fun') out.push({ t: 'for_fun' });
  return out;
}

export function recordArgs(run: ActiveRun): RecordArgs {
  return {
    p_run_id: serverRunId(run.runId),
    p_campaign_id: run.campaignId,
    p_content_version: run.contentVersion,
    p_ending_id: run.endingId ?? '',
    p_for_fun: run.mode === 'fun',
    p_stats: { supplies: run.stats.supplies, morale: run.stats.morale, renown: run.stats.renown },
    p_events: runEvents(run),
  };
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** The ticked cards that were not turned away, as {axis, s, g} (at most 3, server limits kept). */
export function axisWrites(apply: readonly AxisVerdict[], ticked: ReadonlySet<TraitAxis>, notMe: ReadonlySet<TraitAxis>): AxisWrite[] {
  return apply
    .filter((v) => v.status === 'apply' && ticked.has(v.axis) && !notMe.has(v.axis) && v.s != null && v.g != null)
    .slice(0, SCORE.maxAxesPerRun)
    .map((v) => ({
      axis: v.axis,
      s: round4(Math.max(0.2, Math.min(0.8, v.s!))),
      g: round4(Math.max(0, Math.min(SCORE.maxWeight, v.g!))),
    }))
    .filter((w) => w.g > 0);
}

/** A server or network error to a code. No Postgres code = the request never got an answer. */
export function errorCode(err: RpcError | unknown): QuestErrorCode {
  if (!err || typeof err !== 'object') return 'unknown';
  const e = err as { message?: unknown; code?: unknown };
  const message = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';
  const m = /quests:([a-z_]+)/.exec(message);
  if (m && (QUEST_ERROR_CODES as readonly string[]).includes(m[1]!)) return m[1] as QuestErrorCode;
  // The RPC is not there yet (wave116 not applied): PostgREST PGRST202, Postgres 42883.
  if (code === 'PGRST202' || code === '42883') return 'not_ready';
  if (!code) return 'offline';
  return 'unknown';
}

/** Only a request that never got an answer is retried; every server answer is final. */
export const isRetryable = (code: QuestErrorCode): boolean => code === 'offline';

/**
 * The server's Apply value (wave116 apply_quest_result), mirrored:
 * to = clamp(from + g·(s − from), from ± 0.08), no game row = 0.5.
 */
export function applyValue(from: number | null, s: number, g: number): number {
  const f = from ?? SCORE.neutralGame;
  const to = Math.max(f - SCORE.maxDelta, Math.min(f + SCORE.maxDelta, f + g * (s - f)));
  return round4(Math.max(0, Math.min(1, to)));
}

/**
 * The server's Undo value (wave116 undo_quest_result), mirrored. No newer write:
 * the old value comes back exactly (null = the row Apply made is removed).
 * A newer write (R08): take the delta back, inside pre ± 0.08 and [0.2, 0.8],
 * never moving the value further than Apply did, and only ever against
 * Apply's direction (never past the current value the way Apply went).
 */
export function undoValue(pre: number | null, applied: { from: number; to: number }, cur: number, newer: boolean): number | null {
  if (!newer) return pre;
  const p = pre ?? SCORE.neutralGame;
  const delta = applied.to - applied.from;
  const lo = Math.max(0.2, p - SCORE.maxDelta);
  const hi = Math.min(0.8, p + SCORE.maxDelta);
  let v = Math.min(hi, Math.max(lo, cur - delta));
  v = Math.min(cur + Math.abs(delta), Math.max(cur - Math.abs(delta), v));
  v = delta >= 0 ? Math.min(v, cur) : Math.max(v, cur);
  return round4(Math.max(0, Math.min(1, v)));
}

// --- storage ----------------------------------------------------------------------------------

interface AppliedStamps {
  axes: Partial<Record<TraitAxis, string>>;
  runs: Record<string, { axes: TraitAxis[]; at: string }>;
}

const isJob = (j: unknown): j is ApplyJob => {
  if (typeof j !== 'object' || j === null) return false;
  const o = j as Record<string, unknown>;
  return typeof o.runId === 'string' && typeof o.record === 'object' && o.record !== null && Array.isArray(o.axes);
};

function parseQueue(raw: string | null): ApplyJob[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter(isJob).slice(-MAX_QUEUE) : [];
  } catch {
    return [];
  }
}

function parseStamps(raw: string | null): AppliedStamps {
  const empty: AppliedStamps = { axes: {}, runs: {} };
  if (!raw) return empty;
  try {
    const v = JSON.parse(raw) as Partial<AppliedStamps>;
    return {
      axes: typeof v.axes === 'object' && v.axes !== null ? v.axes : {},
      runs: typeof v.runs === 'object' && v.runs !== null ? v.runs : {},
    };
  } catch {
    return empty;
  }
}

export function createQuestApplier(deps: { kv: KV; rpc: Rpc; now?: () => Date; onChange?: () => void }) {
  const { kv, rpc } = deps;
  /** Fires after the server accepted an Apply or an Undo (also from flush), so profile screens refetch. */
  const changed = () => {
    try {
      deps.onChange?.();
    } catch (err) {
      console.log('[quests] onChange skipped:', err instanceof Error ? err.message : err);
    }
  };
  const now = deps.now ?? (() => new Date());

  // Read-then-write on the phone runs one at a time, in call order.
  let turn: Promise<unknown> = Promise.resolve();
  const inTurn = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = turn.then(fn, fn);
    turn = run.catch(() => undefined);
    return run;
  };
  const quiet = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      console.log('[quests] apply storage skipped:', err instanceof Error ? err.message : err);
      return fallback;
    }
  };

  const readQueue = () => quiet(async () => parseQueue(await kv.getItem(QUEST_APPLY_QUEUE_KEY)), [] as ApplyJob[]);
  const writeQueue = (q: ApplyJob[]) =>
    quiet(() => (q.length ? kv.setItem(QUEST_APPLY_QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE))) : kv.removeItem(QUEST_APPLY_QUEUE_KEY)), undefined);
  const enqueue = (job: ApplyJob) =>
    inTurn(async () => writeQueue([...(await readQueue()).filter((j) => j.runId !== job.runId), job]));
  const dequeue = (runId: string) => inTurn(async () => writeQueue((await readQueue()).filter((j) => j.runId !== runId)));

  const readStamps = () => quiet(async () => parseStamps(await kv.getItem(QUEST_APPLIED_KEY)), { axes: {}, runs: {} } as AppliedStamps);
  const writeStamps = (s: AppliedStamps) => quiet(() => kv.setItem(QUEST_APPLIED_KEY, JSON.stringify(s)), undefined);

  /** R07: one call per run id in flight; a second Save of the same run waits for the first. */
  const inflight = new Map<string, Promise<SaveOutcome>>();

  async function send(job: ApplyJob): Promise<SaveOutcome> {
    const fail = async (err: RpcError | unknown): Promise<SaveOutcome> => {
      const code = errorCode(err);
      if (isRetryable(code)) {
        await enqueue(job);
        return { status: 'queued' };
      }
      await dequeue(job.runId);
      return { status: 'error', code };
    };
    try {
      const rec = await rpc('record_quest_run', { ...job.record, p_run_id: job.runId });
      if (rec.error) return fail(rec.error);
      const counts = !!(rec.data as { counts?: unknown } | null)?.counts;
      if (job.axes.length === 0) {
        await dequeue(job.runId);
        return { status: 'saved', counts, applied: [] };
      }
      // The server stored this run as for fun (30-day rule): nothing to apply.
      if (!counts) {
        await dequeue(job.runId);
        return { status: 'error', code: 'not_evidence' };
      }
      const app = await rpc('apply_quest_result', { p_run_id: job.runId, p_axes: job.axes });
      if (app.error) return fail(app.error);
      await dequeue(job.runId);
      await inTurn(async () => {
        const s = await readStamps();
        const at = now().toISOString();
        for (const w of job.axes) s.axes[w.axis] = at;
        s.runs[job.runId] = { axes: job.axes.map((w) => w.axis), at };
        await writeStamps(s);
      });
      changed();
      return { status: 'saved', counts, applied: job.axes };
    } catch (err) {
      return fail(err);
    }
  }

  /**
   * Undo an Apply. A queued Save leaves the queue first, then the server is
   * still asked: a Save is queued whenever no answer came back, and that
   * includes an Apply that landed but whose answer was lost. For a queued
   * Save, "never got there" (run_not_found / not_applied) counts as undone.
   * Offline, the Save stays in the queue marked cancelled (never sent as a
   * Save again) and the next Undo or flush finishes it.
   */
  async function undo(runId: string): Promise<UndoOutcome> {
    await inflight.get(runId);
    const job = (await inTurn(readQueue)).find((j) => j.runId === runId);
    if (job) await dequeue(runId);
    let code: QuestErrorCode | null = null;
    try {
      const { error } = await rpc('undo_quest_result', { p_run_id: runId });
      if (error) code = errorCode(error);
    } catch (err) {
      code = errorCode(err);
    }
    if (code && job && isRetryable(code)) {
      await enqueue({ ...job, cancelled: true });
      return { status: 'error', code };
    }
    if (code && !(job && (code === 'run_not_found' || code === 'not_applied'))) return { status: 'error', code };
    await inTurn(async () => {
      const s = await readStamps();
      const entry = s.runs[runId];
      if (entry) {
        for (const a of entry.axes) if (s.axes[a] === entry.at) delete s.axes[a];
        delete s.runs[runId];
        await writeStamps(s);
      }
    });
    changed();
    return { status: 'undone' };
  }

  const save = (job: ApplyJob): Promise<SaveOutcome> => {
    const open = inflight.get(job.runId);
    if (open) return open;
    const p = send(job).finally(() => inflight.delete(job.runId));
    inflight.set(job.runId, p);
    return p;
  };

  return {
    save,

    /** Retry every queued Save (and finish offline Undos), oldest first. Returns how many Saves reached the server. */
    async flush(): Promise<number> {
      let sent = 0;
      for (const job of await inTurn(readQueue)) {
        // Undo may have taken it out (or cancelled it) since the list was read.
        const now = (await inTurn(readQueue)).find((j) => j.runId === job.runId);
        if (!now) continue;
        if (now.cancelled) {
          const u = await undo(job.runId);
          if (u.status === 'error' && isRetryable(u.code)) break; // still offline
          continue;
        }
        const out = await save(now);
        if (out.status === 'saved') sent += 1;
        if (out.status === 'queued') break; // still offline: try again later
      }
      return sent;
    },

    undo,

    /** The 7-day mirror for scoreRun (`lastAppliedAt`). */
    lastAppliedAt: () => inTurn(async () => (await readStamps()).axes),
    /** Applied runs on this phone, by server run id (PHASE-23: "From your quests" and its Undo). */
    appliedRuns: () => inTurn(async () => (await readStamps()).runs),
    queued: () => inTurn(readQueue),
    /**
     * Start Fresh clears the Quest numbers on the server and marks applied runs undone, so the phone's
     * mirror (7-day stamps, "From your quests" list) goes too. Profile screens refetch on `onChange`.
     */
    clearStamps: async () => {
      await inTurn(() => quiet(() => kv.removeItem(QUEST_APPLIED_KEY), undefined));
      changed();
    },
  };
}

export type QuestApplier = ReturnType<typeof createQuestApplier>;

const asyncStorageKV: KV = {
  async getItem(key) {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    return AsyncStorage.getItem(key);
  },
  async setItem(key, value) {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key) {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.removeItem(key);
  },
};

const supabaseRpc: Rpc = async (fn, args) => {
  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase.rpc(fn, args);
  return { data, error };
};

export const questApplier = createQuestApplier({
  kv: asyncStorageKV,
  rpc: supabaseRpc,
  // Fix 8: the full profile refetches on this signal, so it never shows a stale combined value.
  // (Not the account-data epoch: that one resets Questions, Legends and the buddy.)
  onChange: () => {
    void import('@/lib/quests/quest-change').then((m) => m.bumpQuestChange());
  },
});
