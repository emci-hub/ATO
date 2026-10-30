/**
 * Quests server, Apply, Undo, flags (ATO-BUILD PHASE-17).
 * Run: npm run check:quest-apply
 *
 * Offline. The phone side runs against a fake server that keeps the wave116
 * rules (record once per run id, the 30-day rule, Apply once per run, the
 * 7-day axis rule, the capped game-value write, the 24 h Undo). Pins:
 * - the offline queue: a Save that never got an answer waits and is retried
 *   with the same run id; an answered error is never retried;
 * - idempotency (R07): a retry of the same Save makes no second write; two
 *   concurrent Applies (one phone, or two phones/restarts) make ONE write;
 * - Undo: exact restore with no newer write; after a newer write the bounded
 *   inverse (R08) never leaves pre ± 0.08 or [0.2, 0.8] and never moves more
 *   than Apply did;
 * - error mapping: every server code has a sentence, 'quests:<code>' parsing,
 *   no answer = offline (retry), a missing RPC = not ready;
 * - flags fail closed and the dev override is ignored outside dev tools;
 * - wave116 itself: R10 option A (no _trait_write call, game value only),
 *   R11 security on every RPC, R09 server-side rules, R12 reset/delete coverage;
 * - the Said wiring: Save calls the applier, the stub is gone, the copy passes
 *   the Quests fence.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  QUEST_APPLIED_KEY,
  QUEST_APPLY_QUEUE_KEY,
  QUEST_ERROR_CODES,
  applyValue,
  axisWrites,
  createQuestApplier,
  errorCode,
  isRetryable,
  recordArgs,
  runEvents,
  serverRunId,
  undoValue,
  type ApplyJob,
  type AxisWrite,
  type Rpc,
} from '../src/lib/quests/apply';
import { monthlyShifts } from '../src/lib/almanac/shift';
import { questCopyHits } from '../src/lib/quests/banned';
import { FLAGS_OFF, applyAllowed, flagsFromFetch, nextOverride, parseFlags, questsVisible, resolveFlags } from '../src/lib/quests/flags';
import type { KV } from '../src/lib/quests/run-store';
import type { ActiveRun } from '../src/lib/quests/run';
import { SCORE, previewGameValue, type AxisVerdict } from '../src/lib/quests/score';
import { QUEST_ERROR_COPY, UI_COPY } from '../src/lib/quests/strings';
import { QUEST_AXES } from '../src/lib/quests/types';

const ok = (msg: string) => console.log(`  ok  ${msg}`);
const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

// --- a Map store and a fake wave116 ------------------------------------------------------------
class MapKV implements KV {
  map = new Map<string, string>();
  async getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  async removeItem(k: string) {
    this.map.delete(k);
  }
}

interface FakeRun {
  user: string;
  campaign: string;
  forFun: boolean;
  createdAt: number;
  applied: (AxisWrite & { from: number; to: number })[] | null;
  pre: Record<string, number | null> | null;
  appliedAt: number | null;
  undoneAt: number | null;
}

const H = 3_600_000;
const D = 24 * H;
const raise = (code: string) => ({ data: null, error: { message: `quests:${code}`, code: 'P0001' } });

class FakeServer {
  clock = Date.parse('2026-10-28T12:00:00.000Z');
  runs = new Map<string, FakeRun>();
  quest = new Map<string, number>(); // `${user}:${axis}` → quest value
  history: { user: string; axis: string; at: number }[] = [];
  writes = 0;
  calls: string[] = [];
  offline = false;
  enabled = true;
  applyEnabled = true;
  /** A tick between a call arriving and its answer, so concurrent calls interleave. */
  async tick() {
    await new Promise((r) => setTimeout(r, 1));
  }
  rpcFor(user: string): Rpc {
    return async (fn, args) => {
      this.calls.push(fn);
      await this.tick();
      if (this.offline) return { data: null, error: { message: 'TypeError: Network request failed', code: '' } };
      if (fn === 'record_quest_run') return this.record(user, args);
      if (fn === 'apply_quest_result') return this.apply(user, args);
      if (fn === 'undo_quest_result') return this.undo(user, args);
      return { data: null, error: { message: 'Could not find the function', code: 'PGRST202' } };
    };
  }
  record(user: string, a: Record<string, unknown>) {
    const id = String(a.p_run_id);
    const have = this.runs.get(id);
    if (have) return have.user === user ? { data: { ok: true, already: true, counts: !have.forFun }, error: null } : raise('run_taken');
    if (!this.enabled) return raise('quests_disabled');
    const campaign = String(a.p_campaign_id);
    const inside = [...this.runs.values()].some(
      (r) => r.user === user && r.campaign === campaign && !r.forFun && r.createdAt > this.clock - 30 * D,
    );
    const forFun = a.p_for_fun === true || inside;
    this.runs.set(id, { user, campaign, forFun, createdAt: this.clock, applied: null, pre: null, appliedAt: null, undoneAt: null });
    return { data: { ok: true, already: false, counts: !forFun }, error: null };
  }
  apply(user: string, a: Record<string, unknown>) {
    const r = this.runs.get(String(a.p_run_id));
    if (!r || r.user !== user) return raise('run_not_found');
    if (r.appliedAt != null) return { data: { ok: true, already: true, applied: r.applied }, error: null };
    if (r.undoneAt != null) return raise('run_used');
    if (r.forFun) return raise('not_evidence');
    if (!this.enabled) return raise('quests_disabled');
    if (!this.applyEnabled) return raise('apply_disabled');
    const axes = a.p_axes as AxisWrite[];
    if (!Array.isArray(axes) || axes.length < 1) return raise('bad_input');
    if (axes.length > 3) return raise('too_many_axes');
    for (const w of axes) {
      if (!(QUEST_AXES as readonly string[]).includes(w.axis)) return raise('axis_not_allowed');
      if (w.s < 0.2 || w.s > 0.8 || w.g <= 0 || w.g > 0.25) return raise('bad_input');
      const recent = [...this.runs.values()].some(
        (x) => x.user === user && x.appliedAt != null && x.appliedAt > this.clock - 7 * D && x.undoneAt == null && x.applied!.some((y) => y.axis === w.axis),
      );
      if (recent) return raise('axis_cooldown');
    }
    r.pre = {};
    r.applied = [];
    for (const w of axes) {
      const key = `${user}:${w.axis}`;
      const from = this.quest.has(key) ? this.quest.get(key)! : null;
      const to = applyValue(from, w.s, w.g);
      this.quest.set(key, to);
      this.history.push({ user, axis: w.axis, at: this.clock });
      this.writes += 1;
      r.pre[w.axis] = from;
      r.applied.push({ ...w, from: from ?? 0.5, to });
    }
    r.appliedAt = this.clock;
    return { data: { ok: true, already: false, applied: r.applied }, error: null };
  }
  undo(user: string, a: Record<string, unknown>) {
    const r = this.runs.get(String(a.p_run_id));
    if (!r || r.user !== user) return raise('run_not_found');
    if (r.undoneAt != null) return { data: { ok: true, already: true }, error: null };
    if (r.appliedAt == null) return raise('not_applied');
    if (r.appliedAt < this.clock - 24 * H) return raise('undo_expired');
    for (const w of r.applied!) {
      const key = `${user}:${w.axis}`;
      if (!this.quest.has(key)) continue;
      const cur = this.quest.get(key)!;
      const newer = Math.round(cur * 1e4) !== Math.round(w.to * 1e4) || this.history.some((h) => h.user === user && h.axis === w.axis && h.at > r.appliedAt!);
      const v = undoValue(r.pre![w.axis] ?? null, w, cur, newer);
      if (v === null) this.quest.delete(key);
      else this.quest.set(key, v);
      if (newer) this.writes += 1;
    }
    r.undoneAt = this.clock;
    return { data: { ok: true, already: false }, error: null };
  }
  /** A newer quest-track write (a second Apply). */
  gameWrite(user: string, axis: string, value: number) {
    this.clock += 1000;
    this.quest.set(`${user}:${axis}`, value);
    this.history.push({ user, axis, at: this.clock });
  }
}

// --- a run to save ------------------------------------------------------------------------------
const RUN: ActiveRun = {
  phase: 'said',
  campaignId: 'sample-lantern',
  contentVersion: 1,
  runId: 'mkx1abc-9f3k2l1m',
  sceneId: null,
  endingId: 'lantern_daylight',
  history: [
    { sceneId: 'lantern_s1_gate', choiceId: 'own_way', undone: false },
    { sceneId: 'lantern_s2_fork', choiceId: 'blue_glow', undone: true },
    { sceneId: 'lantern_s2_fork', choiceId: 'miners_road', undone: false, roll: 14 },
    { sceneId: 'Bad Id!', choiceId: 'x', undone: false },
  ],
  stats: { supplies: 3, morale: 4, renown: 2 },
  flags: [],
  rewinds: {},
  mode: 'me',
  typedDone: [],
};
const AXES: AxisWrite[] = [
  { axis: 'openness', s: 0.664, g: 0.131 },
  { axis: 'playfulness', s: 0.3, g: 0.2 },
];
const job = (run: ActiveRun = RUN, axes: AxisWrite[] = AXES): ApplyJob => ({ runId: serverRunId(run.runId), record: recordArgs(run), axes });

async function main() {
  // --- payloads ---------------------------------------------------------------------------------
  {
    const id = serverRunId(RUN.runId);
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, 'a v4-shaped uuid');
    assert.equal(serverRunId(RUN.runId), id, 'the same local run id always gives the same server id (retries hit one row)');
    assert.notEqual(serverRunId(`${RUN.runId}x`), id);
    const u = '1B4E28BA-2FA1-41D2-883F-0016D3CCA427';
    assert.equal(serverRunId(u), u.toLowerCase(), 'a uuid passes through');
    const ev = runEvents(RUN);
    assert.deepEqual(ev[0], { t: 'quest_start' });
    assert.ok(ev.some((e) => e.t === 'rewind' && e.s === 'lantern_s2_fork' && e.c === 'blue_glow'), 'an undone pick is a rewind event');
    assert.ok(ev.some((e) => e.t === 'd20' && e.n === 14), 'the d20 roll is an event');
    assert.ok(!ev.some((e) => e.s === 'Bad Id!'), 'an id the server would refuse is never sent');
    assert.deepEqual(ev.slice(-2), [{ t: 'ending' }, { t: 'said_view' }]);
    assert.ok(runEvents({ ...RUN, mode: 'fun' }).some((e) => e.t === 'for_fun'));
    const rec = recordArgs(RUN);
    assert.deepEqual(rec.p_stats, { supplies: 3, morale: 4, renown: 2 });
    assert.equal(rec.p_for_fun, false);
    assert.equal(rec.p_ending_id, 'lantern_daylight');

    const v = (axis: AxisVerdict['axis'], status: AxisVerdict['status'], s = 0.7, g = 0.2): AxisVerdict =>
      ({ axis, status, s, g, P: 0, W: 0, lean: 0, scenes: 4, primaryPicks: 4, agreeing: 4, consistency: 1, eligible: true }) as AxisVerdict;
    const w = axisWrites(
      [v('openness', 'apply', 0.66361, 0.131249), v('playfulness', 'apply'), v('autonomy', 'apply'), v('agreeableness', 'cooldown')],
      new Set(['openness', 'playfulness', 'autonomy', 'agreeableness']),
      new Set(['autonomy']),
    );
    assert.deepEqual(w, [
      { axis: 'openness', s: 0.6636, g: 0.1312 },
      { axis: 'playfulness', s: 0.7, g: 0.2 },
    ], 'only ticked, not "Not me", status apply; rounded to 4 places');
    assert.deepEqual(axisWrites([v('openness', 'apply')], new Set(), new Set()), [], 'nothing pre-ticked');
    ok('payloads: stable v4 run id, events from the log (bad ids left out), only ticked cards are sent');
  }

  // --- the capped write and the undo math (port of wave116) -------------------------------------
  {
    assert.ok(close(applyValue(0.6, 0.6636, 0.13125), 0.6083), 'the PHASE-13 worked example lands at .6083/.6084 (4 places)');
    assert.ok(Math.abs(applyValue(0.6, 0.6636, 0.13125) - previewGameValue(0.6, 0.6636, 0.13125)) < 1e-4, 'server write = score.ts preview');
    assert.equal(applyValue(null, 0.8, 0.25), 0.575, 'no quest row starts at 0.5');
    assert.equal(applyValue(0.2, 0.8, 0.25), 0.28, '|Δ| ≤ 0.08');
    assert.equal(applyValue(0.8, 0.2, 0.25), 0.72, '|Δ| ≤ 0.08 downward');
    // No newer write: back exactly (null = the row Apply made goes).
    assert.equal(undoValue(0.6, { from: 0.6, to: 0.68 }, 0.68, false), 0.6);
    assert.equal(undoValue(null, { from: 0.5, to: 0.575 }, 0.575, false), null);
    // Newer write: bounded inverse.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 5000; i += 1) {
      const pre = 0.05 + rnd() * 0.9;
      const s = 0.2 + rnd() * 0.6;
      const g = rnd() * 0.25;
      const to = applyValue(pre, s, g);
      const delta = to - pre;
      const cur = rnd();
      const out = undoValue(pre, { from: pre, to }, cur, true)!;
      assert.ok(Math.abs(out - cur) <= Math.abs(delta) + 1e-4, 'never moves more than Apply did');
      const lo = Math.max(0.2, pre - 0.08);
      const hi = Math.min(0.8, pre + 0.08);
      // Never against the undo: the value only moves opposite to Apply's delta (or stays).
      assert.ok(delta >= 0 ? out <= cur + 1e-4 : out >= cur - 1e-4, 'never moves the way Apply went');
      // Inside the band, or (when a newer write already pushed it out) only ever moved toward it.
      if (cur >= lo && cur <= hi) assert.ok(out >= lo - 1e-4 && out <= hi + 1e-4, 'never leaves pre ± 0.08 ∩ [0.2, 0.8]');
      else assert.ok(Math.abs(out - Math.min(hi, Math.max(lo, out))) <= Math.abs(cur - Math.min(hi, Math.max(lo, cur))) + 1e-4, 'only moves toward the band');
    }
    // The reviewer's case: pre 0.5, Apply +0.05, a newer write to 0.30 → Undo leaves it at 0.30.
    assert.equal(undoValue(0.5, { from: 0.5, to: 0.55 }, 0.3, true), 0.3);
    // The R08 example: Apply 0.60 → 0.68, a newer write to 0.70, Undo → 0.62 (delta taken back, inside 0.52…0.68).
    assert.ok(close(undoValue(0.6, { from: 0.6, to: 0.68 }, 0.7, true)!, 0.62));
    ok('capped write = score.ts preview; Undo restores exactly, or a bounded inverse after a newer write (5,000 random cases)');
  }

  // --- save + idempotency -------------------------------------------------------------------------
  {
    const server = new FakeServer();
    const kv = new MapKV();
    const ap = createQuestApplier({ kv, rpc: server.rpcFor('u1'), now: () => new Date(server.clock) });
    const out = await ap.save(job());
    assert.equal(out.status, 'saved');
    assert.equal(server.writes, 2, 'two axes, two writes');
    assert.ok(close(server.quest.get('u1:openness')!, applyValue(null, 0.664, 0.131)));
    const again = await ap.save(job());
    assert.equal(again.status, 'saved');
    assert.equal(server.writes, 2, 'the same Save again writes nothing (run id used once)');
    assert.equal(kv.map.has(QUEST_APPLY_QUEUE_KEY), false, 'nothing left queued');
    assert.deepEqual(Object.keys((await ap.lastAppliedAt())).sort(), ['openness', 'playfulness'], '7-day mirror stamped');
    // Start Fresh: the phone's mirror (7-day stamps + "From your quests" list) is dropped and the profile is told.
    let signalled = 0;
    const ap2 = createQuestApplier({ kv, rpc: server.rpcFor('u1'), onChange: () => { signalled += 1; } });
    assert.equal(Object.keys(await ap2.appliedRuns()).length, 1, 'the run is listed before Start Fresh');
    await ap2.clearStamps();
    assert.deepEqual(await ap2.lastAppliedAt(), {}, 'no 7-day cooldown stamps after Start Fresh');
    assert.deepEqual(await ap2.appliedRuns(), {}, 'no applied runs listed after Start Fresh');
    assert.equal(signalled, 1, 'clearStamps tells the profile screens');
    ok('Save records then applies once; a repeat Save makes no second write');
  }

  // --- concurrent double Apply = one write --------------------------------------------------------
  {
    const server = new FakeServer();
    const ap = createQuestApplier({ kv: new MapKV(), rpc: server.rpcFor('u1') });
    const [a, b] = await Promise.all([ap.save(job()), ap.save(job())]);
    assert.equal(a.status, 'saved');
    assert.equal(b.status, 'saved');
    assert.equal(server.calls.filter((c) => c === 'apply_quest_result').length, 1, 'the in-flight lock sends one Apply');
    assert.equal(server.writes, 2, 'one write per axis');
    // Two phones (or a restart mid-flight): no shared lock, the server still makes one write.
    const s2 = new FakeServer();
    const p1 = createQuestApplier({ kv: new MapKV(), rpc: s2.rpcFor('u1') });
    const p2 = createQuestApplier({ kv: new MapKV(), rpc: s2.rpcFor('u1') });
    await Promise.all([p1.save(job()), p2.save(job())]);
    assert.equal(s2.writes, 2, 'two appliers, same run id: still one write per axis');
    ok('concurrent double Apply = one write (client lock, and the server on its own)');
  }

  // --- offline queue -----------------------------------------------------------------------------
  {
    const server = new FakeServer();
    const kv = new MapKV();
    const ap = createQuestApplier({ kv, rpc: server.rpcFor('u1') });
    server.offline = true;
    assert.deepEqual(await ap.save(job()), { status: 'queued' });
    const queued = JSON.parse(kv.map.get(QUEST_APPLY_QUEUE_KEY)!) as ApplyJob[];
    assert.equal(queued.length, 1);
    assert.equal(queued[0]!.runId, serverRunId(RUN.runId), 'queued with the same run id');
    assert.deepEqual(await ap.save(job()), { status: 'queued' });
    assert.equal((JSON.parse(kv.map.get(QUEST_APPLY_QUEUE_KEY)!) as ApplyJob[]).length, 1, 'one entry per run, never doubled');
    assert.equal(await ap.flush(), 0, 'still offline: nothing sent');
    assert.equal(server.writes, 0);
    server.offline = false;
    assert.equal(await ap.flush(), 1, 'back online: the queued Save goes through');
    assert.equal(server.writes, 2);
    assert.equal(kv.map.has(QUEST_APPLY_QUEUE_KEY), false, 'queue emptied');
    assert.equal(await ap.flush(), 0, 'and is not sent twice');
    assert.equal(server.writes, 2);

    // An answered error is final: never queued, never retried.
    const s3 = new FakeServer();
    s3.applyEnabled = false;
    const kv3 = new MapKV();
    const ap3 = createQuestApplier({ kv: kv3, rpc: s3.rpcFor('u1') });
    assert.deepEqual(await ap3.save(job()), { status: 'error', code: 'apply_disabled' });
    assert.equal(kv3.map.has(QUEST_APPLY_QUEUE_KEY), false);

    // A queued Save that is undone before it ever reached the server leaves the queue; the server,
    // asked anyway, has no such run, which counts as undone.
    const s4 = new FakeServer();
    s4.offline = true;
    const kv4 = new MapKV();
    const ap4 = createQuestApplier({ kv: kv4, rpc: s4.rpcFor('u1') });
    await ap4.save(job());
    assert.deepEqual(await ap4.undo(serverRunId(RUN.runId)), { status: 'error', code: 'offline' }, 'offline: Undo says so, never a false "undone"');
    const held = JSON.parse(kv4.map.get(QUEST_APPLY_QUEUE_KEY)!) as ApplyJob[];
    assert.equal(held.length, 1);
    assert.equal(held[0]!.cancelled, true, 'kept, marked cancelled: it is never sent as a Save again');
    s4.offline = false;
    assert.deepEqual(await ap4.undo(serverRunId(RUN.runId)), { status: 'undone' }, 'online again: run_not_found = undone');
    assert.equal(kv4.map.has(QUEST_APPLY_QUEUE_KEY), false);
    assert.equal(await ap4.flush(), 0);
    assert.equal(s4.writes, 0, 'nothing reaches the server');

    // An offline Undo of a lost-answer Apply is finished by the next flush (the Save is not re-sent).
    const s7 = new FakeServer();
    s7.quest.set('u1:openness', 0.6);
    const kv7 = new MapKV();
    let drop = true;
    const lossy7: Rpc = async (fn, args) => {
      const out = await s7.rpcFor('u1')(fn, args);
      return fn === 'apply_quest_result' && drop ? { data: null, error: { message: 'Network request failed', code: '' } } : out;
    };
    const ap7 = createQuestApplier({ kv: kv7, rpc: lossy7 });
    assert.deepEqual(await ap7.save(job()), { status: 'queued' });
    drop = false;
    s7.offline = true;
    assert.deepEqual(await ap7.undo(serverRunId(RUN.runId)), { status: 'error', code: 'offline' });
    s7.offline = false;
    assert.equal(await ap7.flush(), 0, 'flush sends no Save for a cancelled entry');
    assert.equal(s7.calls.filter((c) => c === 'apply_quest_result').length, 1, 'no second Apply');
    assert.equal(s7.quest.get('u1:openness'), 0.6, 'the flush finished the Undo on the server');
    assert.equal(kv7.map.has(QUEST_APPLY_QUEUE_KEY), false);

    // The Apply landed but its answer was lost (so the Save was queued): Undo still reverses it on the server.
    const s6 = new FakeServer();
    s6.quest.set('u1:openness', 0.6);
    const kv6 = new MapKV();
    const lossy: Rpc = async (fn, args) => {
      const out = await s6.rpcFor('u1')(fn, args);
      return fn === 'apply_quest_result' && !out.error ? { data: null, error: { message: 'TypeError: Network request failed', code: '' } } : out;
    };
    const ap6 = createQuestApplier({ kv: kv6, rpc: lossy });
    assert.deepEqual(await ap6.save(job()), { status: 'queued' });
    assert.equal(s6.writes, 2, 'the server did write');
    assert.deepEqual(await createQuestApplier({ kv: kv6, rpc: s6.rpcFor('u1') }).undo(serverRunId(RUN.runId)), { status: 'undone' });
    assert.equal(s6.quest.get('u1:openness'), 0.6, 'the lost-answer Apply is reversed on the server');
    assert.equal(kv6.map.has(QUEST_APPLY_QUEUE_KEY), false);

    // A corrupt queue is read as empty.
    const kv5 = new MapKV();
    kv5.map.set(QUEST_APPLY_QUEUE_KEY, '{not json');
    assert.equal((await createQuestApplier({ kv: kv5, rpc: s4.rpcFor('u1') }).queued()).length, 0);
    ok('offline queue: retried with the same run id, deduped, emptied once sent; answered errors are final');
  }

  // --- server rules seen from the phone -----------------------------------------------------------
  {
    const server = new FakeServer();
    const ap = createQuestApplier({ kv: new MapKV(), rpc: server.rpcFor('u1') });
    assert.equal((await ap.save(job())).status, 'saved');
    // Second as-me run of the campaign inside 30 days: stored as for fun, nothing applied.
    const run2 = { ...RUN, runId: 'second-run' };
    assert.deepEqual(await ap.save(job(run2)), { status: 'error', code: 'not_evidence' });
    assert.equal(server.calls.filter((c) => c === 'apply_quest_result').length, 1, 'no Apply is even sent for a run that does not count');
    // Another campaign inside 7 days on the same axis: cooldown.
    const run3 = { ...RUN, runId: 'third-run', campaignId: 'other-campaign' };
    assert.deepEqual(await ap.save(job(run3, [{ axis: 'openness', s: 0.7, g: 0.2 }])), { status: 'error', code: 'axis_cooldown' });
    // A fake axis is refused by the server.
    const run4 = { ...RUN, runId: 'fourth-run', campaignId: 'c4' };
    assert.deepEqual(await ap.save(job(run4, [{ axis: 'steadiness' as AxisWrite['axis'], s: 0.7, g: 0.2 }])), { status: 'error', code: 'axis_not_allowed' });
    ok('server rules reach the screen: 30-day (no Apply sent), 7-day per axis, allow-list');
  }

  // --- Undo ----------------------------------------------------------------------------------------
  {
    // No newer write: exact restore (a track Apply created disappears).
    const server = new FakeServer();
    server.quest.set('u1:openness', 0.6);
    const kv = new MapKV();
    const ap = createQuestApplier({ kv, rpc: server.rpcFor('u1'), now: () => new Date(server.clock) });
    await ap.save(job());
    assert.ok(server.quest.get('u1:openness')! > 0.6);
    assert.deepEqual(await ap.undo(serverRunId(RUN.runId)), { status: 'undone' });
    assert.equal(server.quest.get('u1:openness'), 0.6, 'restored exactly');
    assert.equal(server.quest.has('u1:playfulness'), false, 'a track Apply created is gone again');
    assert.deepEqual(await ap.lastAppliedAt(), {}, 'the 7-day mirror is cleared');
    assert.deepEqual(await ap.undo(serverRunId(RUN.runId)), { status: 'undone' }, 'a second Undo is a no-op');

    // Undo after a newer write: bounded inverse.
    const s2 = new FakeServer();
    s2.quest.set('u1:openness', 0.6);
    const ap2 = createQuestApplier({ kv: new MapKV(), rpc: s2.rpcFor('u1') });
    await ap2.save(job(RUN, [{ axis: 'openness', s: 0.8, g: 0.25 }]));
    assert.equal(s2.quest.get('u1:openness'), 0.65);
    s2.gameWrite('u1', 'openness', 0.7);
    await ap2.undo(serverRunId(RUN.runId));
    const after = s2.quest.get('u1:openness')!;
    assert.ok(close(after, 0.65, 1e-4), 'the newer write is kept, only this Apply’s +0.05 comes off');
    assert.ok(after >= 0.52 && after <= 0.68, 'inside pre ± 0.08');

    // 24 h window, and nothing to undo.
    const s3 = new FakeServer();
    const ap3 = createQuestApplier({ kv: new MapKV(), rpc: s3.rpcFor('u1') });
    await ap3.save(job());
    s3.clock += 25 * H;
    assert.deepEqual(await ap3.undo(serverRunId(RUN.runId)), { status: 'error', code: 'undo_expired' });
    await ap3.save(job({ ...RUN, runId: 'fun-run', mode: 'fun' }, []));
    assert.deepEqual(await ap3.undo(serverRunId('fun-run')), { status: 'error', code: 'not_applied' });
    ok('Undo: exact restore, bounded inverse after a newer write, 24 h window, idempotent');
  }

  // --- error mapping ------------------------------------------------------------------------------
  {
    assert.equal(errorCode({ message: 'quests:axis_cooldown', code: 'P0001' }), 'axis_cooldown');
    assert.equal(errorCode({ message: 'quests:not_signed_in', code: '28000' }), 'not_signed_in');
    assert.equal(errorCode({ message: 'TypeError: Network request failed', code: '' }), 'offline');
    assert.equal(errorCode(new TypeError('Network request failed')), 'offline');
    assert.equal(errorCode({ message: 'Could not find the function public.apply_quest_result', code: 'PGRST202' }), 'not_ready');
    assert.equal(errorCode({ message: 'function does not exist', code: '42883' }), 'not_ready');
    assert.equal(errorCode({ message: 'quests:made_up', code: 'P0001' }), 'unknown', 'an unknown server code is not trusted');
    assert.equal(errorCode({ message: 'JWT expired', code: 'PGRST301' }), 'unknown');
    assert.equal(errorCode(null), 'unknown');
    assert.deepEqual(QUEST_ERROR_CODES.filter(isRetryable), ['offline'], 'only "no answer" is retried');
    const wave = read('supabase/migrations/wave116_quest_runs.sql');
    const raised = [...new Set([...wave.matchAll(/'quests:([a-z_]+)'/g)].map((m) => m[1]!))].sort();
    for (const c of raised) assert.ok((QUEST_ERROR_CODES as readonly string[]).includes(c), `wave116 raises ${c}, which the phone does not know`);
    for (const c of QUEST_ERROR_CODES) {
      const text = QUEST_ERROR_COPY[c];
      assert.ok(typeof text === 'string' && text.length > 0, `no sentence for ${c}`);
      assert.deepEqual(questCopyHits(text), [], `QUEST_ERROR_COPY.${c} hits the fence`);
    }
    assert.deepEqual(Object.keys(QUEST_ERROR_COPY).sort(), [...QUEST_ERROR_CODES].sort(), 'one sentence per code, no extras');
    ok(`error mapping: ${raised.length} server codes + offline / not_ready / unknown, each with a sentence that passes the fence`);
  }

  // --- flags --------------------------------------------------------------------------------------
  {
    assert.deepEqual(parseFlags(null), FLAGS_OFF, 'no row (or wave116 not applied) = off');
    assert.deepEqual(parseFlags({ quests_enabled: 'true' }), FLAGS_OFF, 'only a real true counts');
    assert.equal(parseFlags({ quests_enabled: false, quests_apply_enabled: true }).applyEnabled, false, 'Apply needs Quests on');
    const on = parseFlags({ quests_enabled: true, quests_apply_enabled: true, quests_disabled_campaigns: ['sample-lantern', 7] });
    assert.deepEqual(on.disabledCampaigns, ['sample-lantern']);
    assert.equal(questsVisible(on), true);
    assert.equal(questsVisible(on, 'sample-lantern'), false, 'a disabled campaign is hidden');
    assert.equal(applyAllowed(on, 'other'), true);
    assert.equal(applyAllowed(parseFlags({ quests_enabled: true }), 'other'), false, 'Apply off = ticks off');
    assert.deepEqual(resolveFlags(FLAGS_OFF, 'on', false), FLAGS_OFF, 'the dev override is ignored without dev tools');
    assert.equal(resolveFlags(FLAGS_OFF, 'on', true).applyEnabled, true);
    assert.deepEqual(resolveFlags(on, 'off', true), FLAGS_OFF);
    assert.deepEqual(resolveFlags(on, null, true), on);
    assert.deepEqual([nextOverride(null), nextOverride('on'), nextOverride('off')], ['on', 'off', null]);
    const flagsSrc = read('src/lib/quests/flags.ts');
    const cachedOn = parseFlags({ quests_enabled: true, quests_apply_enabled: true });
    assert.deepEqual(flagsFromFetch({ data: null, error: { code: '42703' } }, cachedOn), FLAGS_OFF, 'a server error fails closed, even with a cache');
    assert.deepEqual(flagsFromFetch({ data: null, error: { message: 'Network request failed', code: '' } } as never, cachedOn), cachedOn, 'offline keeps the last server flags');
    assert.deepEqual(flagsFromFetch('threw', cachedOn), cachedOn);
    assert.deepEqual(flagsFromFetch('threw', null), FLAGS_OFF, 'offline with no cache = off');
    assert.deepEqual(flagsFromFetch({ data: { quests_enabled: true }, error: null }, null), parseFlags({ quests_enabled: true }));
    assert.match(flagsSrc, /export const QUEST_FLAGS_CACHE_KEY = 'ato\.quests\./, 'the cache is wiped on sign-out');
    assert.match(flagsSrc, /if \(!DEV_TOOLS_AVAILABLE\) return null;/, 'release never reads the override');
    assert.match(flagsSrc, /export const QUEST_DEV_FLAGS_KEY = 'ato\.quests\./, 'the override is wiped on sign-out with every Quests key');
    ok('flags: fail closed, Apply needs Quests on, disabled campaigns hidden, dev override only with dev tools');
  }

  // --- wave116 ------------------------------------------------------------------------------------
  {
    const sql = read('supabase/migrations/wave116_quest_runs.sql');
    const code = sql.replace(/--[^\n]*/g, '');
    const fn = (name: string) => {
      const s = code.indexOf(`create or replace function public.${name}(`);
      assert.ok(s >= 0, `${name} is defined`);
      return code.slice(s, code.indexOf('$$;', code.indexOf('as $$', s)) + 3);
    };
    // R10 option A
    assert.doesNotMatch(code, /_trait_write\s*\(/, 'R10: wave116 never calls _trait_write');
    const write = fn('_quest_game_write');
    assert.match(write, /values \(p_uid, p_axis, 'quest', p_value, 0, 0, now\(\)\)\s*on conflict \(user_id, axis, track\) do update set value = excluded\.value;/, 'only the quest value moves');
    assert.doesNotMatch(write, /public\.me\b|trait_sources|stability =|answer_count =/, 'never me, trait_sources, stability or answer_count');
    assert.match(write, /insert into public\.trait_history \(user_id, axis, value, source\) values \(p_uid, p_axis, p_value, 'self_quest'\);/);
    const apply = fn('apply_quest_result');
    assert.match(apply, /v_to := coalesce\(v_from, 0\.5\) \+ v_g \* \(v_s - coalesce\(v_from, 0\.5\)\);/, 'to = game + g·(s − game), no row = 0.5');
    assert.match(apply, /v_to := least\(coalesce\(v_from, 0\.5\) \+ 0\.08, greatest\(coalesce\(v_from, 0\.5\) - 0\.08, v_to\)\);/, '|Δ| ≤ 0.08 on the server');
    assert.equal(SCORE.maxDelta, 0.08);
    assert.match(apply, /v_s not between 0\.2 and 0\.8 or v_g <= 0 or v_g > 0\.25/, 's ∈ [0.2, 0.8], 0 < g ≤ 0.25');
    assert.match(apply, /jsonb_array_length\(p_axes\) > 3 then\s*raise exception 'quests:too_many_axes'/);
    const allow = /if v_axis not in \(([\s\S]*?)\) then\s*raise exception 'quests:axis_not_allowed'/.exec(apply);
    assert.ok(allow, 'the allow-list');
    assert.deepEqual([...allow![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort(), [...QUEST_AXES].sort(), 'the server allow-list = QUEST_AXES');
    assert.match(apply, /if r\.applied_at is not null then\s*return jsonb_build_object\('ok', true, 'already', true/, 'R07: the run id is used once (a retry gets the stored answer)');
    assert.match(apply, /from public\.quest_runs where id = p_run_id and user_id = uid for update;/, 'the run row is locked');
    // R09
    assert.match(apply, /q\.applied_at > now\(\) - interval '7 days' and q\.undone_at is null/, 'R09: 7 days per axis, from quest_runs');
    const record = fn('record_quest_run');
    assert.match(record, /v_for_fun := p_for_fun or exists \(\s*select 1 from public\.quest_runs q\s*where q\.user_id = uid and q\.campaign_id = p_campaign_id and not q\.for_fun\s*and q\.created_at > now\(\) - interval '30 days'/, 'R09: the 30-day rule on the server');
    for (const f of [record, apply]) assert.match(f, /pg_advisory_xact_lock\(hashtext\('quest_runs:' \|\| uid::text\)\);/, 'one account at a time');
    assert.match(record, /if r\.user_id is distinct from uid then\s*raise exception 'quests:run_taken'/, 'another account’s run id is refused');
    // R08
    const undo = fn('undo_quest_result');
    assert.match(undo, /r\.applied_at < now\(\) - interval '24 hours'/, '24 h');
    assert.match(undo, /v_lo := greatest\(0\.2, v_pre - 0\.08\);\s*v_hi := least\(0\.8, v_pre \+ 0\.08\);\s*v_new := least\(v_hi, greatest\(v_lo, v_cur - v_delta\)\);\s*v_new := least\(v_cur \+ abs\(v_delta\), greatest\(v_cur - abs\(v_delta\), v_new\)\);\s*v_new := case when v_delta >= 0 then least\(v_new, v_cur\) else greatest\(v_new, v_cur\) end;/, 'R08: the bounded inverse (= undoValue)');
    assert.match(undo, /h\.source = 'self_quest' and h\.created_at > r\.applied_at/, 'a newer quest write is seen in the history');
    assert.match(undo, /delete from public\.trait_history\s*where user_id = uid and axis = v_axis and source = 'self_quest' and created_at = r\.applied_at;/, 'Undo drops exactly the self_quest row Apply wrote');
    // Quests own their track and history source: Apply, Undo and the write never name game / self_game.
    for (const [name, body] of [['_quest_game_write', write], ['apply_quest_result', apply], ['undo_quest_result', undo]] as const) {
      assert.doesNotMatch(body, /'game'|self_game/, `${name} never reads or writes the game track or self_game`);
      assert.match(body, /'quest'/, `${name} names the quest track`);
    }
    // The new constraint values (wave21 / wave38 pattern): quest next to report + game; self_quest after wave38's eight.
    assert.match(code, /alter table public\.trait_tracks drop constraint if exists trait_tracks_kind;\s*alter table public\.trait_tracks\s*add constraint trait_tracks_kind check \(track in \('report', 'game', 'quest'\)\);/, 'trait_tracks_kind allows quest');
    const wave38 = read('supabase/migrations/wave38_trait_history_self_scenario.sql');
    const w38 = /check \(source in \(([\s\S]*?)\)\);/.exec(wave38.replace(/--[^\n]*/g, ''));
    const w116 = /trait_history_source_known check \(source in \(([\s\S]*?)\)\);/.exec(code);
    assert.ok(w38 && w116, 'both source constraints are found');
    const srcList = (s: string) => [...s.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
    assert.deepEqual(srcList(w116![1]!), [...srcList(w38![1]!), 'self_quest'], 'trait_history_source_known = wave38 list + self_quest');
    assert.match(code, /alter table public\.trait_history drop constraint if exists trait_history_source_known;/);
    // Restated function bodies only name tables that exist (wave115 drops ai_provider_log).
    const migDir = resolve(root, 'supabase', 'migrations');
    const allSql = readdirSync(migDir).filter((f) => f.endsWith('.sql')).map((f) => readFileSync(resolve(migDir, f), 'utf8').replace(/--[^\n]*/g, ''));
    const baselineDir = resolve(root, 'supabase', 'baseline');
    if (existsSync(baselineDir)) {
      for (const f of readdirSync(baselineDir).filter((x) => x.endsWith('.sql'))) allSql.push(readFileSync(resolve(baselineDir, f), 'utf8').replace(/--[^\n]*/g, ''));
    }
    const dropped = new Set<string>();
    for (const s of allSql) {
      for (const m of s.matchAll(/drop table (?:if exists )?(?:public\.)?"?([a-z_0-9]+)"?/gi)) dropped.add(m[1]!.toLowerCase());
    }
    for (const name of ['reset_my_account', 'reset_dev_test_user', 'count_user_rows']) {
      const named = [...fn(name).matchAll(/\b(?:from|join|into|update)\s+public\.([a-z_0-9]+)\b(?!\s*\()/g)].map((m) => m[1]!);
      assert.ok(named.length > 0, `${name} names tables`);
      for (const t of named) {
        // Early tables (me, checks…) predate the migrations, so "exists" = not dropped by any migration.
        assert.ok(!dropped.has(t), `${name} names ${t}, which a migration drops`);
      }
    }
    assert.doesNotMatch(code, /ai_provider_log/, 'wave116 no longer names ai_provider_log (wave115 drops it)');
    // start_fresh also clears the Quest numbers (emci 2026-10-29, decision 4): wave101's body with exactly two changes.
    {
      const startFresh = (src: string) => {
        const s = src.indexOf('create or replace function public.start_fresh(');
        assert.ok(s >= 0, 'start_fresh is defined');
        return src.slice(s, src.indexOf('\n$$;', s));
      };
      const w101 = read('supabase/migrations/wave101_under18_server_gate.sql').replace(/--[^\n]*/g, '');
      const mine = startFresh(code);
      assert.match(mine, /delete from public\.trait_tracks where user_id = uid and track in \('report', 'quest'\);/, 'start_fresh deletes the quest track with the report track');
      assert.match(mine, /update public\.quest_runs set undone_at = now\(\)\n\s+where user_id = uid and applied_at is not null and undone_at is null;/, 'start_fresh marks applied runs undone (frees the 7-day cooldown, keeps the runs)');
      assert.doesNotMatch(mine, /delete from public\.quest_runs/, 'run history is kept');
      assert.doesNotMatch(mine, /track = 'game'|'game'/, 'scenario picks (game track) are untouched');
      const back = mine
        .replace("track in ('report', 'quest')", "track = 'report'")
        .replace(/  update public\.quest_runs set undone_at = now\(\)\n.*\n/, '');
      assert.equal(back, startFresh(w101), 'start_fresh = wave101 + the two Quest changes, nothing else');
      assert.match(code, /revoke all on function public\.start_fresh\(boolean\) from public, anon;\s*grant execute on function public\.start_fresh\(boolean\) to authenticated;/);
      const finishFold = read('src/components/bank-finish-fold.tsx');
      assert.match(finishFold, /await startFresh\(keepHistory\);\n\s+await questApplier\.clearStamps\(\);/, 'the phone drops its Quest stamps and signals the Full Profile after Start Fresh');
    }
    // R11
    for (const name of ['record_quest_run', 'apply_quest_result', 'undo_quest_result']) {
      const f = fn(name);
      assert.match(f, /security definer\s*set search_path = public, pg_temp/, `${name}: definer + search_path`);
      assert.match(f, /uid uuid := auth\.uid\(\);[\s\S]*?if uid is null then\s*raise exception 'quests:not_signed_in' using errcode = '28000';\s*end if;\s*perform public\.require_adult\(\);/, `${name}: rejects a null auth.uid(), then the 18+ gate`);
      assert.match(code, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon;\\s*grant execute on function public\\.${name}\\([^)]*\\) to authenticated;`), `${name}: revoked from public/anon, granted to authenticated`);
    }
    for (const name of ['_quests_gate', '_quest_game_write']) {
      assert.match(fn(name), /security definer\s*set search_path = public, pg_temp/);
      assert.match(code, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated;`), `${name} is private`);
    }
    assert.match(code, /alter table public\.quest_runs enable row level security;/);
    assert.match(code, /create policy quest_runs_select_own on public\.quest_runs\s*for select using \(user_id = auth\.uid\(\)\);/);
    assert.doesNotMatch(code, /create policy[^;]*quest_runs[^;]*for (?:insert|update|delete|all)/, 'no write policy');
    assert.match(code, /revoke all on public\.quest_runs from public, anon, authenticated;\s*grant select on public\.quest_runs to authenticated;/, 'no direct DML');
    assert.match(record, /jsonb_array_length\(p_events\) > 300 or pg_column_size\(p_events\) > 32768/, 'events are size-capped');
    assert.match(record, /'quest_start', 'scene_view', 'commit', 'rewind', 'd20', 'quit', 'ending', 'said_view', 'for_fun'/, 'events from the analytics list only');
    // Columns + flags (spec)
    for (const col of ['id uuid primary key', 'user_id uuid not null references auth.users (id) on delete cascade', 'campaign_id text', 'content_version int', 'ending_id text', 'for_fun boolean', 'applied jsonb', 'pre_values jsonb', 'stats jsonb', 'events jsonb', 'created_at timestamptz', 'applied_at timestamptz', 'undone_at timestamptz']) {
      assert.ok(code.includes(col), `quest_runs.${col}`);
    }
    for (const col of ['quests_enabled boolean not null default false', 'quests_apply_enabled boolean not null default false', "quests_disabled_campaigns text[] not null default '{}'"]) {
      assert.ok(code.includes(col), `app_config.${col}`);
    }
    // R12: reset + delete
    assert.match(fn('reset_my_account'), /delete from public\.quest_runs where user_id = uid; get diagnostics n = row_count; v_rows := v_rows \+ n;/);
    assert.match(fn('reset_dev_test_user'), /delete from public\.quest_runs where user_id = v_dev_id;/);
    assert.match(fn('count_user_rows'), /from public\.quest_runs where user_id = p_user_id/);
    ok('wave116: R10 game value only (no _trait_write), R11 on every RPC, R09 server rules, R08 bounded Undo, R12 reset + delete');
  }

  // --- the quest track on the phone ---------------------------------------------------------------
  {
    assert.match(read('src/lib/trait-stability.ts'), /export type TraitTrackKind = 'report' \| 'game' \| 'quest';/);
    assert.match(read('src/lib/trait-tracks-store.ts'), /raw\.track !== 'quest'\) return null;/, 'the parser keeps quest rows');
    assert.match(read('src/lib/quests/score.ts'), /trackFor\(tracks, x\.axis, 'quest'\)/, 'the Said preview reads the quest track');
    assert.doesNotMatch(read('src/lib/quests/score.ts'), /trackFor\([^)]*'game'\)/, 'the Said preview never reads the game track');
    assert.doesNotMatch(read('src/lib/traits.ts'), /self_quest/, 'self_quest stays out of the client TraitSource list, so fetchTraitHistory drops it');
    const rows = [
      { axis: 'openness' as const, value: 0.3, createdAt: '2026-10-01T00:00:00Z', source: 'self_slider' },
      { axis: 'openness' as const, value: 0.9, createdAt: '2026-10-20T00:00:00Z', source: 'self_game' },
    ];
    assert.deepEqual(monthlyShifts(rows, new Date('2026-10-25T00:00:00Z')), [], 'a self_game row is not an almanac shift');
    assert.equal(monthlyShifts(rows.map((r) => ({ ...r, source: 'self_slider' })), new Date('2026-10-25T00:00:00Z')).length, 1);
    ok('quest track on the phone: parser, type, Said preview, self_quest dropped, self_game out of "What shifted"');
  }

  // --- the Said wiring and the copy ---------------------------------------------------------------
  {
    const screen = read('src/app/quest/[id].tsx');
    assert.doesNotMatch(screen, /saidSaveStub/, 'the stub is gone');
    assert.match(screen, /const record = \{ \.\.\.recordArgs\(run\), p_for_fun: run\.mode === 'fun' \|\| !applyOn \};\s*const out = await questApplier\.save\(\{ runId: serverId, record, axes \}\)/, 'Save goes to the server; Apply off records the run as for fun');
    assert.match(screen, /await questApplier\.undo\(serverId\)/, 'Undo goes to the server');
    assert.match(screen, /void questApplier\.flush\(\);/, 'a queued Save is retried');
    assert.match(screen, /lastAppliedAt: stamps,/, 'the 7-day mirror feeds scoreRun');
    assert.match(screen, /applyOff=\{!applyOn \|\| save\.kind !== 'idle'\}/, 'Apply off (or saved) disables the ticks');
    assert.match(screen, /if \(busy\.current \|\| !score \|\| !flags\) return;/, 'one Save at a time from the screen');
    const card = read('src/components/quests/said-card.tsx');
    assert.match(card, /disabled=\{notMe \|\| applyOff\}/);
    const select = read('src/app/quest/index.tsx');
    assert.match(select, /const shown = flags \? SHOWN\.filter\(\(c\) => questsVisible\(flags, c\.id\)\) : \[\];/, 'flag off hides the campaigns (empty state)');
    assert.match(select, /\{DEV_TOOLS_AVAILABLE \? \(/, 'the override control is dev only');
    assert.equal(UI_COPY.saidSaved, 'Saved. Your answers still count most.', 'spec copy after Save');
    for (const k of ['saidSaving', 'saidSaved', 'saidQueued', 'saidUndo', 'saidUndoHint', 'saidUndone', 'saidApplyOff'] as const) {
      assert.deepEqual(questCopyHits(UI_COPY[k]), [], `UI_COPY.${k} hits the fence`);
    }
    for (const k of [QUEST_APPLY_QUEUE_KEY, QUEST_APPLIED_KEY]) assert.ok(k.startsWith('ato.quests.'), `${k} is wiped on sign-out`);
    ok('Said wiring: Save/Undo/flush go through the applier, Apply off disables ticks, flag off hides the list, copy passes the fence');
  }

  console.log('\ncheck:quest-apply passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
