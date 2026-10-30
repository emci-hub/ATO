/**
 * Quests run engine + saves (ATO-BUILD PHASE-14).
 * Run: npm run check:quest-run
 *
 * Pins: the reducer flow (select → scene → commit → beat → ending → said),
 * stats clamped 0–6, flags driving variants, gates and endings; the d20 (seeded,
 * odds shown = real odds for every dc × stat); kill/resume; Rewind restore (one
 * per chapter, the d20 result comes back, the pick is logged `undone`); no d20
 * re-roll on restart or on a hand-edited save; migration (redirects, a content
 * version bump, a removed choice restarting its chapter, the endings tracker
 * kept); the corrupt-save fixtures; the 30-day rule (a UX mirror, R09); and the
 * account-switch clear (every Quests key is wiped by clearLocalAccountData).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { campaignById } from '../src/lib/quests/content';
import { checkOdds, fnv1a, rollD20, rollPasses } from '../src/lib/quests/d20';
import { SAVE_LIMITS, migrateSave } from '../src/lib/quests/migrate-save';
import {
  RUN,
  SELECT,
  picksOf,
  reduceRun,
  sceneLines,
  startMode,
  toSave,
  type ActiveRun,
  type RunAction,
  type RunSave,
  type RunState,
} from '../src/lib/quests/run';
import {
  QUEST_PROGRESS_KEY,
  QUEST_RUN_KEY,
  QUEST_TUTORIAL_KEY,
  createRunStore,
  endingsFound,
  type KV,
} from '../src/lib/quests/run-store';
import { scoreRun, type QuestPick } from '../src/lib/quests/score';
import type { QuestCampaign, QuestChoice, QuestScene } from '../src/lib/quests/types';

const ok = (msg: string) => console.log(`  ok  ${msg}`);
const NOW = new Date('2026-10-28T12:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

// --- a small campaign with a check, a gate, a variant and a retired scene -------
const line = (text: string) => ({ kind: 'narrator' as const, text });
const ch = (id: string, extra: Partial<QuestChoice> = {}): QuestChoice => ({
  id,
  label: 'We go on.',
  approach: 'steady',
  result: [line('On we go.')],
  tags: [],
  ...extra,
});
const scene = (id: string, chapter: QuestScene['chapter'], choices: QuestChoice[], next: string | null, extra: Partial<QuestScene> = {}): QuestScene => ({
  id,
  chapter,
  lines: [line(`Scene ${id}.`)],
  choices,
  next,
  art: { location: 'lantern.flooded-gate' },
  ...extra,
});

function testCampaign(version = 1, choiceX = 'x'): QuestCampaign {
  return {
    id: 'test-run',
    title: 'Test run',
    setting: 'fantasy',
    minutes: 5,
    contentVersion: version,
    sceneIdsFrozen: [],
    targetAxes: ['autonomy', 'openness', 'agreeableness'],
    startStats: { supplies: 0, morale: 5, renown: 3 },
    firstScene: 's1',
    scenes: [
      scene(
        's1',
        1,
        [
          ch('a', { stats: { supplies: -1, renown: 2 }, setFlags: ['fa'], tags: [{ axis: 'autonomy', pole: 1, w: 1 }] }),
          ch('b', { stats: { morale: 2 }, tags: [{ axis: 'autonomy', pole: -1, w: 1 }] }),
        ],
        's2',
      ),
      scene(
        's2',
        1,
        [ch('risky', { check: { stat: 'morale', dc: 16, success: 's3w', fail: 's3l' } }), ch('safe', { next: 's3l' })],
        's3l',
        { variants: [{ requires: { flags: ['fa'] }, lines: [line('You came the bold way.')] }] },
      ),
      scene('old_s2', 1, [], 's2', { retired: true, redirect: 's2' }),
      scene('s3w', 2, [ch(choiceX), ch('x_alt')], 's4'),
      scene('s3l', 2, [ch('y', { stats: { morale: -2 } }), ch('y_alt')], 's4'),
      scene('s4', 3, [ch('z'), ch('z_alt')], 'secret'),
      scene('secret', 3, [ch('peek'), ch('leave')], 's5', { requires: { flags: ['fa'] } }),
      scene('s5', 4, [ch('end'), ch('end_alt')], null),
    ],
    endings: [
      { id: 'e_bold', title: 'Bold', when: { flags: ['fa'] }, lines: [line('Bold.')], art: 'lantern.ending-rooks-lantern' },
      { id: 'e_cheer', title: 'Cheer', when: { minStat: { morale: 6 } }, lines: [line('Cheer.')], art: 'lantern.ending-toll-forward' },
      { id: 'e_home', title: 'Home', when: {}, lines: [line('Home.')], art: 'lantern.ending-long-way-home' },
    ],
  };
}

let CAMPAIGN = testCampaign();
const lookup = (id: string) => (id === CAMPAIGN.id ? CAMPAIGN : campaignById(id));
const R = (s: RunState, a: RunAction) => reduceRun(s, a, lookup);
const active = (s: RunState): ActiveRun => {
  assert.notEqual(s.phase, 'select', 'expected an active run');
  return s as ActiveRun;
};
const pick = (s: RunState, choiceId: string) => R(R(s, { type: 'select', choiceId }), { type: 'commit' });
const pickOn = (s: RunState, choiceId: string) => R(pick(s, choiceId), { type: 'continue' });

function memoryKV(map = new Map<string, string>()): KV & { map: Map<string, string> } {
  return {
    map,
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    removeItem: async (k) => void map.delete(k),
  };
}

/** A runId whose d20 for s2/risky passes (wantPass) at morale `m`, or fails. */
function runIdFor(wantPass: boolean, m: number): string {
  for (let i = 0; i < 10_000; i += 1) {
    const id = `run-${i}`;
    if (rollPasses(rollD20(id, 's2', 'risky'), m, 16) === wantPass) return id;
  }
  throw new Error('no runId found');
}

async function main() {
  // --- d20 ---------------------------------------------------------------------
  assert.equal(fnv1a(''), 0x811c9dc5);
  assert.equal(rollD20('r', 's', 'c'), rollD20('r', 's', 'c'), 'same inputs, same roll');
  const counts = new Array<number>(21).fill(0);
  for (let i = 0; i < 20_000; i += 1) counts[rollD20(`run-${i}`, 's2', 'risky')] += 1;
  assert.equal(counts[0], 0);
  for (let face = 1; face <= 20; face += 1) assert.ok(counts[face] > 850 && counts[face] < 1150, `face ${face}: ${counts[face]}`);
  ok('d20 is seeded (run|scene|choice), 1–20, about uniform over 20,000 runs');

  for (let dc = 1; dc <= 30; dc += 1) {
    for (let stat = 0; stat <= 6; stat += 1) {
      let pass = 0;
      for (let roll = 1; roll <= 20; roll += 1) if (rollPasses(roll, stat, dc)) pass += 1;
      assert.ok(Math.abs(pass / 20 - checkOdds(dc, stat)) < 1e-9, `dc ${dc} stat ${stat}: shown ${checkOdds(dc, stat)}, real ${pass / 20}`);
    }
  }
  assert.equal(checkOdds(16, 5), 0.5);
  assert.ok(rollPasses(11, 5, 16) && !rollPasses(10, 5, 16), 'roll + stat ≥ dc');
  ok('the odds shown before commit are the real odds for every dc 1–30 × stat 0–6');

  // --- reducer flow ------------------------------------------------------------------
  let s: RunState = R(SELECT, { type: 'start', campaignId: 'test-run', runId: 'flow', mode: 'me' });
  let a = active(s);
  assert.equal(a.phase, 'scene');
  assert.equal(a.sceneId, 's1');
  assert.deepEqual(a.stats, { supplies: 0, morale: 5, renown: 3 });
  assert.equal(R(s, { type: 'select', choiceId: 'nope' }), s, 'an unknown choice is ignored');
  s = R(s, { type: 'select', choiceId: 'a' });
  assert.equal(active(s).phase, 'commit');
  assert.equal(active(s).pending, 'a');
  assert.equal(active(R(s, { type: 'cancel' })).phase, 'scene');
  s = R(s, { type: 'commit' });
  a = active(s);
  assert.equal(a.phase, 'beat');
  assert.deepEqual(a.history, [{ sceneId: 's1', choiceId: 'a', undone: false }]);
  assert.deepEqual(a.stats, { supplies: 0, morale: 5, renown: 5 }, 'supplies clamp at 0');
  assert.deepEqual(a.flags, ['fa']);
  s = R(s, { type: 'continue' });
  a = active(s);
  assert.equal(a.sceneId, 's2');
  const s2 = CAMPAIGN.scenes.find((x) => x.id === 's2');
  assert.ok(s2);
  assert.equal(sceneLines(s2, a.flags)[0].text, 'You came the bold way.', 'a flag picks the variant');
  assert.equal(sceneLines(s2, [])[0].text, 'Scene s2.');

  let c: RunState = R(SELECT, { type: 'start', campaignId: 'test-run', runId: 'clamp', mode: 'me' });
  c = pickOn(c, 'b');
  assert.equal(active(c).stats.morale, 6, 'morale 5 + 2 clamps at 6');
  c = pickOn(c, 'safe');
  c = pickOn(c, 'y');
  assert.equal(active(c).stats.morale, 4);
  c = pickOn(c, 'z');
  assert.equal(active(c).sceneId, 's5', 'a closed gate skips the secret scene');
  c = pick(c, 'end');
  assert.equal(active(c).sceneId, null);
  c = R(c, { type: 'continue' });
  assert.equal(active(c).phase, 'ending');
  assert.equal(active(c).endingId, 'e_home', 'no flag, morale 4: the fallback ending');
  c = R(c, { type: 'continue' });
  assert.equal(active(c).phase, 'said');
  assert.equal(R(c, { type: 'finish' }).phase, 'select');

  let bold: RunState = R(SELECT, { type: 'start', campaignId: 'test-run', runId: runIdFor(false, 5), mode: 'me' });
  for (const id of ['a', 'risky', 'y', 'z']) bold = pickOn(bold, id);
  assert.equal(active(bold).sceneId, 'secret', 'the fa flag opens the secret scene');
  bold = pickOn(pickOn(bold, 'peek'), 'end');
  assert.equal(active(bold).endingId, 'e_bold');
  ok('flow select → scene → commit → beat → ending → said; stats clamp 0–6; flags drive variants, gates and endings');

  // --- picks log = score.ts input ---------------------------------------------------
  const picks: QuestPick[] = picksOf(active(bold));
  assert.deepEqual(Object.keys(picks[0]).sort(), ['choiceId', 'sceneId', 'undone']);
  const scored = scoreRun({ campaign: CAMPAIGN, picks, mode: 'me', now: NOW, tracks: [] });
  assert.ok(scored.axes.some((v) => v.axis === 'autonomy'), 'score.ts reads the log');

  const lantern = campaignById('sample-lantern');
  assert.ok(lantern);
  let real: RunState = reduceRun(SELECT, { type: 'start', campaignId: lantern.id, runId: 'real', mode: 'me' });
  for (let i = 0; i < 20 && active(real).phase !== 'ending'; i += 1) {
    const at = active(real);
    const sc: QuestScene | undefined = lantern.scenes.find((x) => x.id === at.sceneId);
    assert.ok(sc);
    real = reduceRun(reduceRun(reduceRun(real, { type: 'select', choiceId: sc.choices[0].id }), { type: 'commit' }), { type: 'continue' });
  }
  assert.equal(active(real).endingId, 'end_singing_deep', 'first choice everywhere ends in daylight');
  assert.equal(active(real).history.length, 5);
  ok('the picks log is {sceneId, choiceId, undone}, read by scoreRun; the sample Lantern plays to an ending');

  // --- kill / resume -----------------------------------------------------------------
  const kv = memoryKV();
  const store = createRunStore(kv, lookup);
  const step = async (state: RunState, action: RunAction) => {
    const next = R(state, action);
    await store.afterAction(state, action, next, NOW);
    return next;
  };
  let k: RunState = await step(SELECT, { type: 'start', campaignId: 'test-run', runId: 'kill', mode: 'me' });
  k = await step(k, { type: 'select', choiceId: 'a' });
  k = await step(k, { type: 'commit' });
  const saved = JSON.parse(kv.map.get(QUEST_RUN_KEY) ?? 'null') as RunSave;
  assert.equal(saved.history.length, 1, 'written after the commit');
  assert.deepEqual(
    Object.keys(saved).sort(),
    ['campaignId', 'contentVersion', 'flags', 'history', 'mode', 'rewinds', 'runId', 'sceneId', 'stats', 'typedDone'],
    'the save is exactly the spec shape (no user id)',
  );
  // killed on the beat: back in the next scene, its text in full
  const back = await createRunStore(kv, lookup).loadRun();
  assert.ok(back.run && back.restarted === false);
  assert.equal(back.run.phase, 'scene');
  assert.equal(back.run.sceneId, 's2');
  assert.deepEqual(back.run.stats, active(k).stats);
  assert.deepEqual(back.run.flags, ['fa']);
  assert.deepEqual(back.run.history, active(k).history);
  assert.ok(back.run.typedDone.includes('s2'), 'resume skips straight to the full text');
  // killed at the ending
  let e: RunState = back.run;
  for (const id of ['safe', 'y', 'z', 'leave', 'end']) {
    e = await step(e, { type: 'select', choiceId: id });
    e = await step(e, { type: 'commit' });
    e = await step(e, { type: 'continue' });
  }
  assert.equal(active(e).phase, 'ending');
  const atEnd = await createRunStore(kv, lookup).loadRun();
  assert.equal(atEnd.run?.phase, 'ending');
  assert.equal(atEnd.run?.endingId, 'e_bold');
  // killed on the LAST beat (ending not shown yet): resuming shows it and marks it found
  const lastKV = memoryKV();
  const lastStore = createRunStore(lastKV, lookup);
  let lb: RunState = R(SELECT, { type: 'start', campaignId: 'test-run', runId: 'lastbeat', mode: 'me' });
  for (const id of ['b', 'safe', 'y_alt', 'z']) lb = pickOn(lb, id);
  const prevLb = R(lb, { type: 'select', choiceId: 'end' });
  lb = R(prevLb, { type: 'commit' });
  await lastStore.afterAction(prevLb, { type: 'commit' }, lb, NOW);
  assert.equal(active(lb).phase, 'beat');
  assert.deepEqual(await lastStore.loadProgress(), { endings: {}, evidence: {} }, 'not found until it shows');
  const resumedEnd = await createRunStore(lastKV, lookup).loadRun();
  assert.equal(resumedEnd.run?.phase, 'ending');
  assert.deepEqual((await lastStore.loadProgress()).endings['test-run'], ['e_cheer'], 'the resumed ending is marked found');
  ok('kill on a beat resumes in the next scene with full text; kill at (or just before) the ending resumes at the ending, marked found');

  // --- endings tracker + Said: finish / discard --------------------------------------
  assert.deepEqual(endingsFound(await store.loadProgress(), CAMPAIGN), { found: 1, total: 3 });
  e = await step(e, { type: 'continue' });
  assert.equal(active(e).phase, 'said');
  e = await step(e, { type: 'finish' });
  assert.equal(e.phase, 'select');
  assert.equal(kv.map.has(QUEST_RUN_KEY), false, 'a finished run leaves no save');
  assert.deepEqual((await store.loadProgress()).evidence['test-run'], [NOW.toISOString()], 'as-me finish stamps evidence');

  let d: RunState = await step(SELECT, { type: 'start', campaignId: 'test-run', runId: 'mess', mode: 'me' });
  for (const id of ['b', 'safe', 'y_alt', 'z', 'end']) d = await step(await step(await step(d, { type: 'select', choiceId: id }), { type: 'commit' }), { type: 'continue' });
  assert.equal(active(d).endingId, 'e_cheer');
  d = await step(await step(d, { type: 'continue' }), { type: 'discard' });
  assert.equal(d.phase, 'select');
  assert.equal(kv.map.has(QUEST_RUN_KEY), false);
  const prog = await store.loadProgress();
  assert.equal(prog.evidence['test-run'].length, 1, '"I was messing around" adds no evidence');
  assert.deepEqual(endingsFound(prog, CAMPAIGN), { found: 2, total: 3 }, 'N of M endings found');
  await store.recordEnding('test-run', 'e_cheer');
  assert.deepEqual((await store.loadProgress()).endings['test-run'], ['e_bold', 'e_cheer'], 'an ending is counted once');
  ok('endings tracker (N of M, no duplicates); finish stamps as-me evidence; discard keeps none');

  // --- Rewind ------------------------------------------------------------------------
  const failId = runIdFor(false, 6);
  let w: RunState = R(SELECT, { type: 'start', campaignId: 'test-run', runId: failId, mode: 'me' });
  w = pickOn(w, 'b');
  const before = active(w);
  w = pick(w, 'risky');
  const firstRoll = active(w).history[1].roll;
  assert.ok(firstRoll !== undefined);
  assert.equal(active(w).sceneId, 's3l', 'this runId fails the check');
  w = R(w, { type: 'rewind' });
  let rw = active(w);
  assert.equal(rw.phase, 'scene');
  assert.equal(rw.sceneId, 's2');
  assert.deepEqual(rw.stats, before.stats);
  assert.deepEqual(rw.flags, before.flags);
  assert.equal(rw.history[1].undone, true, 'the original pick is marked undone');
  assert.equal(rw.rewinds['1'], 1);
  assert.equal(R(w, { type: 'rewind' }), w, 'one Rewind per chapter');
  w = pick(w, 'risky');
  assert.equal(active(w).history[2].roll, firstRoll, 'the same pick gets the same roll back');
  assert.equal(active(w).sceneId, 's3l', 'no re-roll by rewinding a check');
  w = R(w, { type: 'continue' });
  assert.equal(R(w, { type: 'rewind' }), w, 'chapter 1 has used its Rewind');
  w = pick(w, 'y');
  w = R(w, { type: 'rewind' });
  rw = active(w);
  assert.equal(rw.sceneId, 's3l');
  assert.equal(rw.stats.morale, 6, 'chapter 2 Rewind restores morale');
  assert.equal(rw.rewinds['2'], 1);
  assert.deepEqual(
    picksOf(rw).map((p) => p.undone),
    [false, true, false, true],
  );
  assert.equal(RUN.rewindsPerChapter, 1);

  let wf: RunState = R(SELECT, { type: 'start', campaignId: 'test-run', runId: 'flagback', mode: 'me' });
  wf = R(pick(wf, 'a'), { type: 'rewind' });
  assert.deepEqual(active(wf).flags, [], 'Rewind takes a set flag back');
  assert.deepEqual(active(wf).stats, CAMPAIGN.startStats);
  ok('Rewind restores stats, flags and the d20 result, marks the pick undone, one per chapter');

  // --- no d20 re-roll on restart --------------------------------------------------------
  for (let i = 0; i < 50; i += 1) {
    const kv2 = memoryKV();
    const st = createRunStore(kv2, lookup);
    let r: RunState = R(SELECT, { type: 'start', campaignId: 'test-run', runId: `restart-${i}`, mode: 'me' });
    r = pickOn(r, 'b');
    r = pick(r, 'risky');
    await st.saveRun(r);
    const roll = active(r).history[1].roll;
    for (let j = 0; j < 3; j += 1) {
      const again = await createRunStore(kv2, lookup).loadRun();
      assert.equal(again.run?.history[1].roll, roll);
      assert.equal(again.run?.sceneId, active(r).sceneId);
    }
  }
  // a hand-edited roll or a hand-moved scene does not stick
  let h: RunState = R(SELECT, { type: 'start', campaignId: 'test-run', runId: runIdFor(false, 6), mode: 'me' });
  h = pick(pickOn(h, 'b'), 'risky');
  const edited = { ...toSave(active(h)), stats: { supplies: 6, morale: 6, renown: 6 }, flags: ['fa'] } as RunSave;
  edited.history = edited.history.map((p) => (p.roll ? { ...p, roll: 20 } : p));
  const fixed = migrateSave(JSON.stringify(edited), lookup);
  assert.ok(fixed.run);
  assert.equal(fixed.run.history[1].roll, active(h).history[1].roll, 'the roll is recomputed, never read');
  assert.deepEqual(fixed.run.stats, active(h).stats, 'stats come from the replay');
  assert.deepEqual(fixed.run.flags, [], 'a hand-added flag is dropped');
  const moved = migrateSave(JSON.stringify({ ...toSave(active(h)), sceneId: 's3w' }), lookup);
  assert.ok(moved.run && moved.restarted);
  assert.equal(moved.run.notice, 'restarted');
  assert.equal(moved.run.sceneId, 's3l', 'a save pointing past a failed check is put back where the picks lead');
  ok('no d20 re-roll on restart (50 runs × 3 reloads); hand-edited rolls, stats, flags and scene do not stick');

  // --- migration ---------------------------------------------------------------------------
  let m: RunState = R(SELECT, { type: 'start', campaignId: 'test-run', runId: runIdFor(true, 6), mode: 'me' });
  m = pickOn(m, 'b');
  m = R(pickOn(m, 'risky'), { type: 'rewind' }); // chapter 1 Rewind used
  m = pickOn(m, 'risky');
  assert.equal(active(m).sceneId, 's3w');
  m = pickOn(m, 'x');
  assert.equal(active(m).sceneId, 's4');
  const v1 = toSave(active(m));

  const redirected = { ...v1, history: v1.history.map((p) => (p.sceneId === 's2' ? { ...p, sceneId: 'old_s2' } : p)) };
  const viaRedirect = migrateSave(JSON.stringify(redirected), lookup);
  assert.ok(viaRedirect.run && !viaRedirect.restarted, 'a retired id follows its redirect');
  assert.equal(viaRedirect.run.sceneId, 's4');
  assert.ok(viaRedirect.run.history.every((p) => p.sceneId !== 'old_s2'));

  const progressKV = memoryKV();
  const pst = createRunStore(progressKV, lookup);
  await pst.recordEnding('test-run', 'e_home');
  await pst.saveRun(active(m));

  CAMPAIGN = testCampaign(2);
  const bumped = await pst.loadRun();
  assert.ok(bumped.run && !bumped.restarted, 'a version bump with every id intact needs no restart');
  assert.equal(bumped.run.contentVersion, 2);
  assert.equal(bumped.run.sceneId, 's4');

  CAMPAIGN = testCampaign(3, 'x_new'); // choice x is gone
  const broken = await pst.loadRun();
  assert.ok(broken.run && broken.restarted, 'an unknown choice restarts the chapter');
  assert.equal(broken.run.notice, 'restarted', 'with the kind notice');
  assert.equal(broken.run.sceneId, 's3w', 'back at the start of chapter 2');
  assert.equal(broken.run.phase, 'scene');
  assert.deepEqual(
    broken.run.history.map((p) => `${p.sceneId}/${p.choiceId}/${p.undone}`),
    ['s1/b/false', 's2/risky/true', 's2/risky/false'],
    'chapter 1 picks (and their undone pick) are kept',
  );
  assert.equal(broken.run.rewinds['1'], 1, 'chapter 1 keeps its used Rewind');
  assert.equal(broken.run.contentVersion, 3);
  assert.deepEqual(endingsFound(await pst.loadProgress(), CAMPAIGN), { found: 1, total: 3 }, 'endings tracker kept');
  assert.equal(R(broken.run, { type: 'dismissNotice' }).phase, 'scene');
  assert.equal(active(R(broken.run, { type: 'dismissNotice' })).notice, undefined);

  // A save at the end of a path with no chapter-4 pick restarts the chapter of the last pick, not an unreached ending.
  CAMPAIGN = testCampaign();
  let short: RunState = R(SELECT, { type: 'start', campaignId: 'test-run', runId: 'short', mode: 'me' });
  for (const id of ['b', 'safe', 'y']) short = pickOn(short, id);
  const atS4 = toSave(active(short));
  CAMPAIGN = { ...testCampaign(4), scenes: testCampaign(4).scenes.map((x) => (x.id === 's4' ? { ...x, next: null } : x)) };
  const ended = migrateSave(JSON.stringify({ ...atS4, sceneId: null, history: [...atS4.history, { sceneId: 's4', choiceId: 'z', undone: false }] }), lookup);
  assert.ok(ended.run && !ended.restarted, 'a path that now ends at s4 is followed to its ending');
  assert.equal(ended.run.phase, 'ending');
  const lostLast = migrateSave(JSON.stringify({ ...atS4, sceneId: null, history: [...atS4.history, { sceneId: 's4', choiceId: 'gone', undone: false }] }), lookup);
  assert.ok(lostLast.run && lostLast.restarted);
  assert.equal(lostLast.run.sceneId, 's4', 'restarts chapter 3 (the chapter it stopped in), never jumps to an ending');
  const noLastPick = migrateSave(JSON.stringify({ ...atS4, sceneId: 's5' }), lookup);
  assert.ok(noLastPick.run && noLastPick.restarted, 'a save past where the picks lead restarts');
  assert.equal(noLastPick.run.sceneId, 's4');
  assert.notEqual(noLastPick.run.phase, 'ending');
  // Rewinds are counted from the undone picks, never read from the file.
  CAMPAIGN = testCampaign();
  const forged = migrateSave(JSON.stringify({ ...v1, rewinds: {} }), lookup);
  assert.equal(forged.run?.rewinds['1'], 1, 'a hand-cleared Rewind count is rebuilt from the undone pick');
  const restartCh1 = migrateSave(JSON.stringify({ ...v1, history: v1.history.map((p, i) => (i === 2 ? { ...p, choiceId: 'gone' } : p)) }), lookup);
  assert.ok(restartCh1.run && restartCh1.restarted);
  assert.equal(restartCh1.run.sceneId, 's1', 'restarting chapter 1 goes back to its start');
  assert.deepEqual(restartCh1.run.rewinds, {}, 'and gives chapter 1 its Rewind back');
  assert.ok(restartCh1.run.history.length === 0, 'with no stale undone pick left behind');
  CAMPAIGN = testCampaign(3, 'x_new');

  const gone = migrateSave(JSON.stringify({ ...v1, sceneId: 'no_such_scene' }), lookup);
  assert.ok(gone.run && gone.restarted, 'an unknown current scene restarts the chapter');
  CAMPAIGN = testCampaign();
  assert.deepEqual(migrateSave(JSON.stringify({ ...v1, campaignId: 'retired-campaign' }), lookup), { run: null, why: 'unknown_campaign' });
  ok('migration: redirects followed, version bump, unknown id restarts the chapter with a notice, endings kept');

  // --- corrupt saves (R15) -------------------------------------------------------------------
  const nulls: [string, string | null][] = [
    ['null raw', null],
    ['empty', ''],
    ['not json', '{"campaignId": "test-run", '],
    ['json null', 'null'],
    ['array', '[]'],
    ['no campaign', '{}'],
    ['campaign not a string', '{"campaignId": 7, "runId": "x"}'],
    ['too big', JSON.stringify({ ...v1, flags: ['x'.repeat(SAVE_LIMITS.maxChars)] })],
    ['readable campaign, no run id', '{"campaignId": "test-run"}'],
  ];
  for (const [label, raw] of nulls) {
    const r = migrateSave(raw, lookup);
    assert.equal(r.run, null, label);
  }
  const restarts: [string, unknown][] = [
    ['history not a list', { ...v1, history: 'lots' }],
    ['pick missing undone', { ...v1, history: [{ sceneId: 's1', choiceId: 'b' }] }],
    ['roll out of range', { ...v1, history: [{ sceneId: 's1', choiceId: 'b', undone: false, roll: 99 }] }],
    ['stats not numbers', { ...v1, stats: { supplies: 'lots', morale: 1, renown: 1 } }],
    ['rewind key 9', { ...v1, rewinds: { '9': 1 } }],
    ['mode god', { ...v1, mode: 'god' }],
    ['scene a number', { ...v1, sceneId: 123 }],
    ['history too long', { ...v1, history: new Array(SAVE_LIMITS.maxHistory + 1).fill({ sceneId: 's1', choiceId: 'b', undone: true }) }],
    ['flag not a string', { ...v1, flags: [{}] }],
    ['notice unknown', { ...v1, notice: 'hacked' }],
  ];
  for (const [label, bad] of restarts) {
    const r = migrateSave(JSON.stringify(bad), lookup);
    assert.ok(r.run && r.restarted, label);
    assert.equal(r.run.sceneId, 's1', `${label}: restarts at the first scene`);
    assert.equal(r.run.history.length, 0, label);
    assert.equal(r.run.notice, 'restarted', label);
    assert.equal(r.run.runId, v1.runId, `${label}: same run id, so no new d20 seeds`);
  }
  assert.equal(migrateSave(JSON.stringify({ ...v1, mode: 'god' }), lookup).run?.mode, 'fun', 'an unreadable mode never becomes evidence');
  const kvBad = memoryKV(new Map([[QUEST_RUN_KEY, '\u0000garbage'], [QUEST_PROGRESS_KEY, '{"endings": 5}']]));
  const badStore = createRunStore(kvBad, lookup);
  assert.equal((await badStore.loadRun()).run, null);
  assert.deepEqual(await badStore.loadProgress(), { endings: {}, evidence: {} }, 'a broken progress key reads as empty');
  const throwing: KV = {
    getItem: () => Promise.reject(new Error('disk')),
    setItem: () => Promise.reject(new Error('disk')),
    removeItem: () => Promise.reject(new Error('disk')),
  };
  const ts = createRunStore(throwing, lookup);
  assert.equal((await ts.loadRun()).run, null);
  await ts.saveRun(active(m));
  await ts.recordEnding('test-run', 'e_home');
  // Quick taps: overlapping calls run in order, nothing is lost.
  const raceKV = memoryKV();
  const race = createRunStore(raceKV, lookup);
  await Promise.all([
    race.recordEnding('test-run', 'e_bold'),
    race.recordEnding('test-run', 'e_cheer'),
    race.recordEvidence('test-run', NOW),
    race.recordEnding('test-run', 'e_home'),
  ]);
  const raced = await race.loadProgress();
  assert.deepEqual(raced.endings['test-run'], ['e_bold', 'e_cheer', 'e_home'], 'no ending lost to a race');
  assert.equal(raced.evidence['test-run'].length, 1);
  const r1 = R(SELECT, { type: 'start', campaignId: 'test-run', runId: 'race', mode: 'me' });
  const r2 = pick(r1, 'b');
  await Promise.all([race.saveRun(r1), race.saveRun(r2)]);
  assert.equal((JSON.parse(raceKV.map.get(QUEST_RUN_KEY) ?? '{}') as RunSave).history.length, 1, 'the newer save lands last');
  ok(`corrupt-save fixtures: ${nulls.length} drop to no save, ${restarts.length} restart the run kindly; storage errors never throw`);

  // --- the 30-day rule (UX mirror, R09) ------------------------------------------------------------
  assert.deepEqual(startMode('fun', [], NOW), { mode: 'fun' });
  assert.deepEqual(startMode('me', [], NOW), { mode: 'me' });
  assert.deepEqual(startMode('me', [daysAgo(29.9)], NOW), { mode: 'fun', why: 'evidence_window' });
  assert.deepEqual(startMode('me', [daysAgo(30)], NOW), { mode: 'me' });
  assert.deepEqual(startMode('me', [daysAgo(45), daysAgo(1)], NOW), { mode: 'fun', why: 'evidence_window' });
  assert.deepEqual(startMode('me', [daysAgo(-3)], NOW), { mode: 'fun', why: 'evidence_window' }, 'a future stamp (clock change) is inside');
  assert.deepEqual(startMode('me', ['not a date'], NOW), { mode: 'me' });
  const fun = R(SELECT, { type: 'start', campaignId: 'test-run', runId: 'f', mode: startMode('me', [daysAgo(2)], NOW).mode });
  assert.equal(active(fun).mode, 'fun', 'the later run is labelled for fun');
  const fkv = memoryKV();
  const fst = createRunStore(fkv, lookup);
  let fr: RunState = fun;
  for (const id of ['b', 'safe', 'y', 'z', 'end']) fr = pickOn(fr, id);
  const said = R(fr, { type: 'continue' });
  await fst.afterAction(said, { type: 'finish' }, R(said, { type: 'finish' }), NOW);
  assert.deepEqual((await fst.loadProgress()).evidence, {}, 'a for-fun finish stamps nothing');
  const runSrc = readFileSync('src/lib/quests/run.ts', 'utf8');
  assert.match(runSrc, /server decides what counts \(R09/, 'run.ts says the rule is a mirror');
  ok('30-day rule: as-me inside 30 days (or a future stamp) is labelled for fun; for-fun runs stamp no evidence');

  // --- account switch: every Quests key is wiped by clearLocalAccountData ------------------------
  const lib = readFileSync('src/lib/local-account-data.ts', 'utf8');
  const keepList = [...(/export const DEVICE_LEVEL_KEYS: readonly string\[\] = \[([\s\S]*?)\];/.exec(lib)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1]);
  const keepPrefixes = [...(/export const DEVICE_LEVEL_PREFIXES: readonly string\[\] = \[([\s\S]*?)\];/.exec(lib)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert.ok(keepList.length > 0 && keepPrefixes.length > 0, 'keep-lists found');
  assert.match(lib, /return !DEVICE_LEVEL_PREFIXES\.some\(\(prefix\) => key\.startsWith\(prefix\)\);/, 'still deny by default');
  const wouldWipe = (key: string) => key.startsWith('ato.') && !keepList.includes(key) && !keepPrefixes.some((p) => key.startsWith(p));
  for (const key of [QUEST_RUN_KEY, QUEST_PROGRESS_KEY, QUEST_TUTORIAL_KEY]) {
    assert.ok(key.startsWith('ato.quests.'), key);
    assert.ok(wouldWipe(key), `${key} must be wiped on sign-out`);
  }
  const shared = memoryKV();
  const acctA = createRunStore(shared, lookup);
  await acctA.saveRun(active(m));
  await acctA.recordEnding('test-run', 'e_bold');
  await acctA.recordEvidence('test-run', NOW);
  shared.map.set(QUEST_TUTORIAL_KEY, '1');
  shared.map.set('ato.appearance.mode', 'soft');
  for (const key of [...shared.map.keys()]) if (wouldWipe(key)) shared.map.delete(key); // what clearLocalAccountData does
  const acctB = createRunStore(shared, lookup);
  assert.equal((await acctB.loadRun()).run, null, 'the next account sees no run');
  assert.deepEqual(await acctB.loadProgress(), { endings: {}, evidence: {} }, 'no endings, no evidence stamps');
  assert.equal(shared.map.has(QUEST_TUTORIAL_KEY), false);
  assert.equal(shared.map.get('ato.appearance.mode'), 'soft', 'device prefs survive');
  const storeSrc = readFileSync('src/lib/quests/run-store.ts', 'utf8');
  assert.doesNotMatch(storeSrc, /new Map|let cache/, 'no in-memory copy that would outlive a sign-out');
  ok('account switch: run, progress and tutorial keys are wiped by the deny-by-default clear; nothing cached in memory');

  console.log('\nquest-run: all checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
