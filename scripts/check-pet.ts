/**
 * Pet check (v20, 2026-09-29).
 *
 * Pins the virtual-pet rules offline, against the real code:
 *   - time maths: stage lengths (~10 days to God), exact + split-proof aging;
 *   - the clock guard: clock set back = no time passes; one gap ≤ 48h;
 *   - care: hearts drop on schedule, 2h grace, then at most one mistake per
 *     meter every 6h;
 *   - branches (Scruffy / Battle / Bright / Standard) and the per-stage reset;
 *   - TD links: a cleared wave feeds + counts + tallies the element; the
 *     once-per-wave pounce (not spent with no foe near); rebirth bonus in the
 *     damage pass;
 *   - Dive links: the bust cut (floor kept) and the rescue on a bust;
 *   - economy: +5 a round, 30 a day, the ymd guard; rebirth cap +10%;
 *   - save: a real v19 save loads as v20 with a fresh egg; v20 round-trips.
 *
 * Run: npm run check:pet
 */
import assert from 'node:assert/strict';

import {
  castPetPounce,
  createDefendLive,
  puffPosition,
  retryDefendLive,
  stepDefendLive,
  type DefendLive,
} from '../src/play/defend';
import { BOARD_MAPS } from '../src/play/board-data';
import { junkLookId, rollPowerFind } from '../src/play/items';
import {
  PET_GRACE_MS,
  PET_HUNGER_TICK_MS,
  PET_MAX_GAP_MS,
  PET_MISTAKE_GAP_MS,
  PET_REMIND_MIN_GAP_MS,
  PET_STAGE_MS,
  advancePet,
  agePet,
  branchFor,
  feedPet,
  newPet,
  parsePet,
  petHungerEmptyAt,
  petLines,
  petReminderLastFired,
  petReminderTarget,
  petTokensForRound,
  petWaveCleared,
  rebirthBonus,
  type PetState,
} from '../src/play/pet';
import {
  bestFinds,
  deeperDive,
  defaultPlayStore,
  effectiveBustPct,
  finishPetRound,
  parsePlayStore,
  rebirthPetDoc,
  recordDefendWin,
  touchPet,
  type PlayStoreDoc,
} from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const H = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 8, 29, 12, 0, 0);

function stageAt(pet: PetState, hours: number): PetState {
  return agePet(pet, hours * H);
}

/* ------------------------------------------------------------ time maths --- */

const total = PET_STAGE_MS.egg + PET_STAGE_MS.baby + PET_STAGE_MS.child + PET_STAGE_MS.teen + PET_STAGE_MS.adult;
assert.equal(total / H, 241, 'Egg → God is 241h');
assert.ok(total / (24 * H) > 9.9 && total / (24 * H) < 10.2, 'about 10 days to God');
const egg = newPet(T0);
assert.equal(stageAt(egg, 0.99).stage, 'egg');
assert.equal(stageAt(egg, 1).stage, 'baby', 'hatches at 1h');
assert.equal(stageAt(egg, 13).stage, 'child');
assert.equal(stageAt(egg, 49).stage, 'teen');
assert.equal(stageAt(egg, 121).stage, 'adult');
assert.equal(stageAt(egg, 241).stage, 'god', 'God at 241h even with zero care');
assert.equal(stageAt(egg, 5000).stage, 'god', 'and God is the last stage');
ok('stages: Egg 1h → Baby 12h → Child 36h → Teen 72h → Adult 120h → God (≈10 days), never dies');

// Split-proof: many small visits land on the same state as one long one.
const once = agePet(egg, 97 * H);
let pieces = egg;
for (const h of [0.5, 3, 7.25, 11, 0.25, 30, 20, 25]) pieces = agePet(pieces, h * H);
assert.deepEqual(pieces, once, 'aging 97h in pieces == aging 97h at once');
ok('aging is exact and split-proof (97h in 8 visits == 97h at once)');

/* ---------------------------------------------------------- clock guard --- */

const seen = { ...newPet(T0) };
assert.equal(advancePet(seen, T0 - 5 * H), seen, 'clock set back: nothing passes (same object)');
assert.equal(advancePet(seen, T0).seen_at, T0, 'no time: nothing passes');
const jumped = advancePet(seen, T0 + 30 * 24 * H);
assert.equal(jumped.total_age_ms, PET_MAX_GAP_MS, 'a 30-day jump counts only 48h');
assert.equal(jumped.seen_at, T0 + 30 * 24 * H, 'and the high-water mark moves to now');
const back = advancePet(jumped, jumped.seen_at - 20 * H);
assert.equal(back, jumped, 'a rewind of up to 48h changes nothing');
const later = advancePet(jumped, T0 + 30 * 24 * H + 2 * H);
assert.equal(later.total_age_ms, PET_MAX_GAP_MS + 2 * H, 'time counts again only past the mark');
// Set far ahead once (even by accident), then back to the real date: the pet
// must not freeze until the far-future date — the mark re-anchors, no time added.
const reAnchored = advancePet(jumped, T0 + 1 * H);
assert.equal(reAnchored.total_age_ms, jumped.total_age_ms, 'a big rewind adds no time');
assert.equal(reAnchored.seen_at, T0 + 1 * H, 'and moves the mark back to the real clock');
assert.equal(advancePet(reAnchored, T0 + 3 * H).total_age_ms, jumped.total_age_ms + 2 * H, 'so time flows again');
ok('clock guard: back = nothing passes; one gap capped at 48h; a far-ahead mark re-anchors, never freezes');

/* ----------------------------------------------------------------- care --- */

const child: PetState = { ...newPet(T0), stage: 'child', hunger: 1, mood: 4 };
const c3 = agePet(child, PET_HUNGER_TICK_MS);
assert.equal(c3.hunger, 0, 'hunger drops a heart every 3h');
assert.equal(c3.mood, 4, 'mood (4h tick) not yet');
assert.equal(agePet(c3, PET_GRACE_MS - 1).mistakes, 0, 'within the 2h grace: no mistake');
const m1 = agePet(c3, PET_GRACE_MS);
assert.equal(m1.mistakes, 1, 'empty for 2h: one care mistake');
assert.equal(agePet(m1, PET_MISTAKE_GAP_MS - 60_000).mistakes, 1, 'no second mistake inside 6h');
assert.equal(agePet(m1, PET_MISTAKE_GAP_MS).mistakes, 2, 'one more after 6h');
// Feeding a little after a mistake must not bring the next one sooner.
const fedAfter = feedPet(m1, 1);
assert.ok(fedAfter.hunger_empty_ms < 0, 'feeding keeps the 6h gap after a mistake');
assert.equal(agePet(fedAfter, PET_HUNGER_TICK_MS + PET_GRACE_MS).mistakes, 1, 'a 1-heart feed does not speed up the next mistake');
assert.equal(agePet(fedAfter, PET_MISTAKE_GAP_MS).mistakes, 2, 'the next one lands 6h after the last, fed or not');
const longFed = agePet(feedPet(m1, 4), 5 * H);
assert.equal(longFed.hunger_empty_ms, 0, 'while fed, the gap runs out on its own (no stale gap later)');
const eggCare = agePet({ ...newPet(T0), hunger: 1 }, 0.9 * H);
assert.equal(eggCare.hunger, 1, 'an egg does not get hungry');
ok('care: −1 hunger/3h, 2h grace, then at most one mistake per meter every 6h; eggs never decay');

/* ------------------------------------------------------------- branches --- */

assert.equal(branchFor('child', { mistakes: 3, training: 9, waves: 99 }), 'scruffy', 'neglect wins');
assert.equal(branchFor('child', { mistakes: 0, training: 9, waves: 6 }), 'battle', 'lots of TD → Battle');
assert.equal(branchFor('child', { mistakes: 1, training: 3, waves: 5 }), 'bright', 'care + training → Bright');
assert.equal(branchFor('child', { mistakes: 2, training: 3, waves: 0 }), 'standard', 'otherwise Standard');
assert.equal(branchFor('egg', { mistakes: 99, training: 0, waves: 0 }), 'standard', 'hatching has no branch');
const almost: PetState = {
  ...newPet(T0),
  stage: 'child',
  stage_age_ms: PET_STAGE_MS.child - 1000,
  mistakes: 0,
  training: 5,
  waves: 1,
};
const evolved = agePet(almost, 1000);
assert.equal(evolved.stage, 'teen');
assert.equal(evolved.branch, 'bright', 'the ending stage’s care picks the form');
assert.deepEqual([evolved.mistakes, evolved.training, evolved.waves], [0, 0, 0], 'counters reset each stage');
ok('branches: Scruffy > Battle > Bright > Standard, decided at evolution; counters reset');

/* ----------------------------------------------------------------- lines --- */

const lines = petLines();
assert.ok(lines.some((l) => l.id === 'line_knight'), 'Knight → Raven line');
assert.ok(lines.some((l) => l.id === 'line_wizard'), 'Wizard → Maldrath line');
assert.ok(lines.some((l) => l.id === 'line_village'), 'Village Girl → Elowen line');
assert.equal(lines.filter((l) => l.id.startsWith('solo_')).length, 16, 'every hero as its own line');
assert.equal(new Set(lines.map((l) => l.id)).size, lines.length, 'unique line ids');
ok(`pet lines: 3 themed + 16 heroes (${lines.length} total)`);

/* -------------------------------------------------------------- TD links --- */

function docWithPet(pet: PetState): PlayStoreDoc {
  return { ...defaultPlayStore(T0), pet };
}

const hungryChild = docWithPet({ ...newPet(T0), stage: 'child', hunger: 2 });
const won = recordDefendWin(hungryChild, { phase: 'trial', wave: 1, mode: 'campaign' }, T0, () => 0.99).doc;
assert.equal(won.pet.hunger, 3, 'a cleared wave feeds one heart');
assert.equal(won.pet.waves, 1, 'and counts toward Battle');
assert.equal(won.pet.element_uses.root, 1, 'and tallies the Legend element (starter = Root)');
const eggWin = recordDefendWin(docWithPet(newPet(T0)), { phase: 'trial', wave: 1, mode: 'replay' }, T0, () => 0.99).doc;
assert.equal(eggWin.pet.waves, 0, 'an egg does not count waves');
assert.equal(petWaveCleared(newPet(T0), 'ember').stage, 'egg');
ok('TD auto-feed: +1 hunger, +1 wave, element tally (campaign and replay)');

// Pounce: once per wave, only with a foe near, damage scales with the wave.
function liveWithFoe(wave: number): { s: DefendLive; at: { x: number; y: number } } {
  let s = createDefendLive(wave, { mapId: 'main', boardId: 'ato' });
  const buckets = { wavePower: 1, towerSpeed: 1, avatarLevel: 1, legendElement: null, avatarStars: 0 };
  for (let i = 0; i < 200 && s.puffs.length === 0; i += 1) {
    s = stepDefendLive(s, 100, buckets, { x: -500, y: -500 }).state;
  }
  const p = puffPosition(s.puffs[0].dist, BOARD_MAPS.ato);
  return { s, at: { x: p.x * 100, y: p.y * 100 } };
}
const { s: live1, at } = liveWithFoe(1);
assert.equal(castPetPounce(live1, { x: -500, y: -500 }, 40, null), null, 'no foe near: refused, not spent');
const pounced = castPetPounce(live1, at, 40, 'ember');
assert.ok(pounced, 'a foe near: it pounces');
assert.equal(pounced.state.petPounceUsed, true);
assert.equal(castPetPounce(pounced.state, at, 40, null), null, 'once per wave');
assert.equal(castPetPounce(live1, at, 0, null), null, 'too young (base 0): no pounce');
const stepped = stepDefendLive(pounced.state, 100, { wavePower: 1, towerSpeed: 1, avatarLevel: 1, legendElement: null, avatarStars: 0 }, at).state;
assert.equal(stepped.petPounceUsed, true, 'the used flag survives a tick');
assert.equal(retryDefendLive(stepped).petPounceUsed, false, 'a retry is a fresh wave');
const { s: live10, at: at10 } = liveWithFoe(10);
const bite10 = castPetPounce(live10, at10, 40, null)!.hit.damage[0];
const bite1 = pounced.hit.damage[0];
assert.ok(bite10 > bite1, 'the pounce grows with the wave (same bite of a tougher creep)');
ok('pounce: once per wave, never wasted with no foe near, scales with the wave, retry resets');

// Rebirth bonus folds into the damage pass (+10% → the Avatar hits 10% harder).
function firstAvatarHit(rebirth: number): number {
  const { s, at: spot } = liveWithFoe(1);
  const step = stepDefendLive(
    s,
    100,
    { wavePower: 1, towerSpeed: 1, avatarLevel: 1, legendElement: 'void', avatarStars: 0, rebirthBonus: rebirth },
    spot,
  );
  const hit = step.hits.find((h) => h.source === 'avatar');
  assert.ok(hit, 'the Avatar attacked');
  return hit.damage[0];
}
const plain = firstAvatarHit(0);
assert.ok(Math.abs(firstAvatarHit(0.1) / plain - 1.1) < 1e-9, 'rebirth +10% = ×1.10 damage');
assert.equal(rebirthBonus(1), 0.02);
assert.equal(rebirthBonus(5), 0.1);
assert.equal(rebirthBonus(9), 0.1, 'capped at +10%');
ok('rebirth: +2% per rebirth into the damage pass, capped at +10%');

/* ------------------------------------------------------------ Dive links --- */

assert.equal(effectiveBustPct(0.18, {}, null, 0), 18);
assert.equal(effectiveBustPct(0.18, {}, null, 3), 15, 'God: −3 points');
assert.equal(effectiveBustPct(0.55, {}, null, 2), 53, 'Adult: −2 points');
assert.equal(effectiveBustPct(0.18, {}, null, 50), 9, 'the 50%-of-table floor still holds');

const power = rollPowerFind(() => 0);
const look = junkLookId();
assert.deepEqual(bestFinds([look, power, look], 1), [power], 'a Power beats a Look');
assert.deepEqual(bestFinds([look, power], 0), [], 'no rescue below Adult');

function bustWith(stage: PetState['stage']): { doc: PlayStoreDoc; rescued: string[] } {
  const doc: PlayStoreDoc = {
    ...docWithPet({ ...newPet(T0), stage }),
    dive_run: { deepers: 1, haul: [look, power, look] },
    inventory: [],
  };
  const res = deeperDive(doc, () => 0)!;
  assert.ok(res.outcome.busted, 'forced bust');
  return { doc: res.doc, rescued: res.outcome.busted ? res.outcome.rescued : [] };
}
const teenBust = bustWith('teen');
assert.deepEqual(teenBust.rescued, [], 'Teen: no rescue');
assert.equal(teenBust.doc.inventory.length, 0);
const adultBust = bustWith('adult');
assert.deepEqual(adultBust.rescued, [power], 'Adult: saves the best find');
assert.equal(adultBust.doc.inventory.reduce((a, st) => a + st.count, 0), 1, 'and it lands in the bag');
const godBust = bustWith('god');
assert.equal(godBust.rescued.length, 2, 'God: saves two');
assert.equal(godBust.doc.dive_run, null, 'the dive still ends');
assert.equal(godBust.doc.pet.stage, 'god', 'the pet is never lost');
ok('dive buddy: −1/−2/−3 points (floor kept), rescue 1 (Adult) / 2 (God) best finds, pet never lost');

/* --------------------------------------------------------------- economy --- */

let econ = docWithPet({ ...newPet(T0), stage: 'child' });
let paid = 0;
for (let i = 0; i < 8; i += 1) {
  const r = finishPetRound(econ, T0 + i * 1000, i % 2 ? 'catch' : 'train', 5);
  econ = r.doc;
  paid += r.result.tokensGranted;
}
assert.equal(paid, 30, 'eight rounds pay 30 — the daily cap');
const low = finishPetRound(econ, T0 + 9000, 'catch', 2);
assert.equal(low.result.counted, false, 'a round under the minimum does not count');
const nextDay = finishPetRound(econ, T0 + 24 * H, 'catch', 5);
assert.equal(nextDay.result.tokensGranted, 5, 'a new day pays again');
assert.equal(petTokensForRound('2026-09-28', '2026-09-29', 30).tokens, 0, 'clock set back a day: the cap does not reset');
assert.equal(petTokensForRound('2026-09-29', '2027-09-29', 30).tokens, 5, 'a far-future stored day (clock once set a year ahead) does not lock the cap for a year');
const eggRound = finishPetRound(docWithPet(newPet(T0)), T0, 'catch', 9);
assert.equal(eggRound.result.counted, false, 'no mini-games for an egg');
ok('tokens: +5 a round, 30 a day, day guard against a rewound clock');

const god = docWithPet({ ...newPet(T0), stage: 'god', element_uses: { tide: 4, ember: 2 } });
assert.equal(rebirthPetDoc(docWithPet({ ...newPet(T0), stage: 'adult' }), T0), null, 'rebirth only from God');
const reborn = rebirthPetDoc(god, T0 + 1)!;
assert.equal(reborn.pet.stage, 'egg');
assert.equal(reborn.pet_rebirths, 1);
assert.equal(reborn.pet_hall.length, 1);
assert.equal(reborn.pet_hall[0].aura, 'tide', 'the Hall keeps the aura element');
ok('rebirth: God only → Hall of pets + new egg + counter');

/* ------------------------------------------------------------- reminder --- */

const fed: PetState = { ...newPet(T0), stage: 'child', hunger: 4, hunger_acc_ms: 0 };
assert.equal(petHungerEmptyAt(fed, T0), T0 + 12 * H, 'full hunger empties in 12h');
assert.equal(petReminderTarget(newPet(T0), T0, null), null, 'no reminder for an egg');
assert.equal(petReminderTarget(fed, T0, null), T0 + 12 * H, 'fires when hunger runs out');
assert.equal(petReminderTarget(fed, T0, T0 - H), T0 - H + PET_REMIND_MIN_GAP_MS, 'never within 20h of the last one');
assert.ok(petReminderTarget({ ...fed, hunger: 0 }, T0, null)! > T0, 'never in the past');
// The review repro: fired at T, reopened at T+1h (next scheduled T+20h), then a
// TD feed re-syncs. The fired one must still count.
const T = T0;
const log1 = { lastFiredAt: petReminderLastFired({ lastFiredAt: null, scheduledAt: T }, T + H), scheduledAt: T + 20 * H };
assert.equal(log1.lastFiredAt, T, 'a passed pending reminder becomes the last fired');
const again = petReminderLastFired(log1, T + 2 * H);
assert.equal(again, T, 're-syncing before the next one fires still remembers T');
assert.ok(petReminderTarget(fed, T + 2 * H, again)! >= T + PET_REMIND_MIN_GAP_MS, 'so the next one is at least 20h after T');
ok('reminder timing: at hunger-empty, at most one per 20h, never for an egg');

/* ------------------------------------------------------------------ save --- */

const v19: Record<string, unknown> = { ...defaultPlayStore(T0), version: 19 };
for (const k of ['pet', 'pet_hall', 'pet_rebirths', 'pet_tokens_today', 'pet_tokens_ymd', 'pet_remind']) delete v19[k];
const loaded = parsePlayStore(JSON.stringify(v19), T0 + 5 * H);
assert.ok(loaded, 'a v19 save loads');
assert.equal(loaded.version, 20);
assert.equal(loaded.pet.stage, 'egg', 'old saves get a fresh egg');
assert.equal(loaded.pet.seen_at, T0 + 5 * H, 'seen now — no time before the update counts');
assert.deepEqual([loaded.pet_hall, loaded.pet_rebirths, loaded.pet_remind], [[], 0, false]);
const withProgress: PlayStoreDoc = {
  ...loaded,
  pet: { ...agePet(loaded.pet, 60 * H), element_uses: { spark: 3 } },
  pet_hall: [{ line: 'solo_raven', branch: 'battle', aura: 'ember', rebirth: 1, days: 10 }],
  pet_rebirths: 1,
  pet_tokens_today: 15,
  pet_tokens_ymd: '2026-09-29',
  pet_remind: true,
};
assert.deepEqual(parsePlayStore(JSON.stringify(withProgress), T0), withProgress, 'v20 round-trips unchanged');
assert.equal(parsePet({ stage: 'nope' }, T0).stage, 'egg', 'a corrupt pet becomes a fresh egg');
const touched = touchPet(loaded, T0 + 7 * H);
assert.equal(touched.pet.total_age_ms, 2 * H, 'opening the app ages the pet from the saved mark');
assert.equal(touchPet(touched, T0 + 7 * H), touched, 'and a second touch at the same time is a no-op');
ok('save v19 → v20: fresh egg seen now; v20 round-trips; corrupt pet → egg');

console.log(`\ncheck:pet — ${passed} groups passed.`);
