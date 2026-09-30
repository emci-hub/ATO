/**
 * Expedition ladder checks (v25, 2026-09-30). Run: npm run check:expedition-ladder
 *
 *   - Order 1m → 5m → 15m → 30m → 1h → 2h → 4h, then done for the day; the
 *     ladder restarts at the local day reset and a rewound clock never
 *     restarts it early.
 *   - Counted time: a trip can't be sped up by the clock (forward = at most
 *     48h per gap, back = nothing).
 *   - Rewards by step: food/shells early, finds from 30m, Powers only on the
 *     2h (20%) and 4h (35%) trips — ≈ 0.55 Powers a day (old rule: 0.5).
 *   - A trip from before the ladder keeps its old rule.
 *   - No perks and no release while away.
 *   - Phone notices only for trips of 30 min or longer (and only when on);
 *     shorter trips just show the in-app banner.
 */
import assert from 'node:assert/strict';

import {
  EXPEDITION_LADDER_MS,
  EXPEDITION_NOTICE_MIN_MS,
  EXPEDITION_STEPS,
  expectedPowersPerDay,
  rollExpeditionReward,
} from '../src/play/expedition-ladder';
import { findKind, shellsOf } from '../src/play/dive-loot';
import { getItemDef } from '../src/play/items';
import { PET_MAX_GAP_MS, expeditionStepsToday, newPet, parsePetExpedition, type PetState } from '../src/play/pet';
import { planPlayNotices } from '../src/play/play-notices';
import { defaultSettings } from '../src/play/play-settings';
import {
  defaultPlayStore,
  localYmd,
  parsePlayStore,
  playView,
  releasePetDoc,
  sendPetExpedition,
  touchPet,
  type PlayStoreDoc,
} from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const MIN = 60_000;
const H = 60 * MIN;
const T0 = new Date(2026, 9, 1, 9, 0, 0).getTime();
const child = (over: Partial<PetState> = {}): PetState => ({
  ...newPet(T0),
  stage: 'child',
  egg: 'knight',
  hero: 'raven',
  grade: 'common',
  line: 'solo_raven',
  total_age_ms: 20 * H,
  ...over,
});
const doc = (over: Partial<PlayStoreDoc> = {}): PlayStoreDoc => ({ ...defaultPlayStore(T0), pet: child(), ...over });
const seeded = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

/* -------------------------------------------------------------- order --- */

{
  assert.deepEqual(EXPEDITION_LADDER_MS.map((ms) => ms / MIN), [1, 5, 15, 30, 60, 120, 240]);
  let d = doc();
  const lengths: number[] = [];
  let now = T0;
  for (let i = 0; i < EXPEDITION_STEPS; i += 1) {
    const sent = sendPetExpedition(d, now);
    assert.ok(sent.result.ok, `trip ${i + 1} can go`);
    lengths.push(sent.doc.pet_expedition!.len_ms / MIN);
    now += sent.doc.pet_expedition!.len_ms;
    d = touchPet(sent.doc, now, () => 0.5);
    assert.equal(d.pet_expedition, null, `trip ${i + 1} comes home on time`);
  }
  assert.deepEqual(lengths, [1, 5, 15, 30, 60, 120, 240], 'each trip longer than the last');
  assert.deepEqual(sendPetExpedition(d, now).result, { ok: false, reason: 'done_today' }, 'after the 4h trip: done for today');
  assert.equal(playView(d, now).pet.nextTripMs, null, 'no next trip shown');
  const tomorrow = new Date(2026, 9, 2, 8, 0, 0).getTime();
  const fresh = sendPetExpedition(d, tomorrow);
  assert.ok(fresh.result.ok, 'the ladder starts again after the local day reset');
  assert.equal(fresh.doc.pet_expedition!.len_ms, MIN, 'back to the 1-min trip');
  // A rewound clock (the stored day is ahead) never restarts it early.
  assert.equal(expeditionStepsToday('2026-10-01', '2026-10-02', 7), 7, 'rewind: the ladder holds');
  assert.equal(expeditionStepsToday('2026-10-02', '2026-10-01', 7), 0, 'a new day: it restarts');
}
ok('ladder: 1m → 5m → 15m → 30m → 1h → 2h → 4h, then done until the local day reset; a rewind never restarts it');

/* ------------------------------------------------------- counted time --- */

{
  const withLadder = { ...doc(), pet_expedition_ymd: localYmd(new Date(T0)), pet_expedition_steps: 6 };
  const out = sendPetExpedition(withLadder, T0).doc;
  assert.equal(out.pet_expedition!.len_ms, 4 * H);
  assert.ok(touchPet(out, T0 - 10 * H, () => 0.5).pet_expedition, 'clock set back: never home early');
  assert.ok(touchPet(out, T0 + 4 * H - MIN, () => 0.5).pet_expedition, 'a minute early: still away');
  const jumped = touchPet(out, T0 + 30 * 24 * H, () => 0.5);
  assert.equal(jumped.pet_expedition, null, 'a big forward jump brings it home…');
  assert.ok(jumped.pet.total_age_ms - out.pet.total_age_ms <= PET_MAX_GAP_MS, '…but counts at most 48h, like every other timer');
  assert.equal(releasePetDoc(out, T0 + H), null, 'no release while away');
  const v = playView(out, T0 + H);
  assert.deepEqual([v.pet.away, v.pet.pounceBase, v.pet.bustCutPp, v.pet.rescueKeep], [true, 0, 0, 0], 'no perks while away');
}
ok('counted time: the clock can’t speed a trip up; no release and no perks while away');

/* ------------------------------------------------------------ rewards --- */

{
  const N = 20_000;
  const powersAt = (step: number) => {
    const rng = seeded(step * 7919 + 1);
    let powers = 0;
    for (let i = 0; i < N; i += 1) {
      const id = rollExpeditionReward(step, rng);
      assert.notEqual(findKind(id), 'unknown', `step ${step}: a real find (${id})`);
      if (step <= 2) assert.ok(findKind(id) === 'food' || shellsOf(id) > 0, `step ${step}: food or shells, got ${id}`);
      if (getItemDef(id)?.core.kind === 'power') powers += 1;
    }
    return powers / N;
  };
  for (const step of [0, 1, 2, 3, 4]) assert.equal(powersAt(step), 0, `step ${step + 1}: never a Power`);
  const p2h = powersAt(5);
  const p4h = powersAt(6);
  assert.ok(Math.abs(p2h - 0.2) < 0.015, `2h: ~20% Powers (got ${p2h})`);
  assert.ok(Math.abs(p4h - 0.35) < 0.015, `4h: ~35% Powers (got ${p4h})`);
  assert.ok(Math.abs(expectedPowersPerDay() - 0.55) < 1e-9, 'a full ladder: 0.55 Powers a day');
  assert.ok(expectedPowersPerDay() <= 0.6, 'no more than 0.6 Powers a day (old rule: 0.5) — no new TD power');
  assert.equal(rollExpeditionReward(0, () => 0.1), 'food_kelp');
  assert.equal(rollExpeditionReward(0, () => 0.9), 'shells_1');
  assert.equal(rollExpeditionReward(2, () => 0.9), 'shells_4');
}
ok('rewards: food/shells at 1m-15m, finds at 30m-1h, Powers only at 2h (20%) and 4h (35%) — 0.55 a day');

/* ------------------------------------------------------------ old trip --- */

{
  const legacy = parsePetExpedition({ left_age_ms: 20 * H });
  assert.deepEqual(legacy, { left_age_ms: 20 * H, len_ms: H, step: -1 }, 'a trip from before the ladder: 1h, old reward');
  const d = doc({ pet_expedition: legacy });
  assert.ok(touchPet(d, T0 + 30 * MIN, () => 0.5).pet_expedition, 'still out at 30 min');
  const home = touchPet(d, T0 + H, () => 0.1);
  assert.equal(home.pet_expedition, null, 'home at 1h');
  assert.equal(getItemDef(home.pet_expedition_note!)?.core.kind, 'power', 'and the old rule (half the time a Power)');
}
{
  // A v24 save that already sent today's one trip: that trip is step 1, no
  // full ladder on top; one from another day starts fresh.
  const base = defaultPlayStore(T0);
  const today = localYmd(new Date(T0));
  const v24 = (ymd: string | null) => {
    const old: Record<string, unknown> = { ...base, version: 24, pet_expedition_ymd: ymd };
    delete old.pet_expedition_steps;
    return parsePlayStore(JSON.stringify(old), T0)!;
  };
  assert.equal(v24(today).pet_expedition_steps, 1, 'sent today → step 1');
  assert.equal(expeditionStepsToday(today, v24('2000-01-01').pet_expedition_ymd, v24('2000-01-01').pet_expedition_steps), 0, 'another day → fresh');
  assert.equal(v24(null).pet_expedition_steps, 0, 'never sent → 0');
}
ok('an expedition already out when the update lands finishes under the old rule');

/* ------------------------------------------------------------- notices --- */

{
  const pet = child({ seen_at: T0 });
  const base = {
    settings: defaultSettings(),
    pet,
    name: 'Kiki',
    chargesFullAt: null,
    chargesArmed: false,
    hungerLastFiredAt: null,
    chargesLastFiredAt: null,
    now: T0,
  };
  const kinds = (tripMs: number, on = true) =>
    planPlayNotices({
      ...base,
      settings: { ...base.settings, notif: { ...base.settings.notif, hunger: false, expedition: on } },
      expeditionBackInMs: tripMs,
      expeditionTripMs: tripMs,
    }).map((n) => n.kind);
  for (const ms of [MIN, 5 * MIN, 15 * MIN]) assert.deepEqual(kinds(ms), [], `${ms / MIN}m trip: banner only, no phone notice`);
  for (const ms of [30 * MIN, H, 2 * H, 4 * H]) assert.deepEqual(kinds(ms), ['expedition'], `${ms / MIN}m trip: a phone notice`);
  assert.deepEqual(kinds(4 * H, false), [], 'toggle off: none');
  assert.equal(EXPEDITION_NOTICE_MIN_MS, 30 * MIN);
}
ok('phone notices only for trips of 30 min or longer, and only with the toggle on');

console.log(`\ncheck:expedition-ladder — ${passed} groups passed.`);
