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
 *   - v21 Dive + Pet loop: the Deep branch (threshold, order, margin
 *     tie-break); Dive care (mood only, never training, deep_surfaces); the
 *     rescue cap of 2; the solo expedition (once a day, ≥ 1h, can't bust,
 *     collected once); away turns every perk off; the Logbook (first depth,
 *     count, survives rebirth, empty for old saves); Dive never moves the
 *     stage clock; the shown bust % is the rolled one.
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
import { diveCollectibleIds } from '../src/play/dive-loot';
import {
  PET_GRACE_MS,
  PET_HUNGER_TICK_MS,
  PET_MAX_GAP_MS,
  PET_MISTAKE_GAP_MS,
  PET_REMIND_MIN_GAP_MS,
  PET_STAGE_MS,
  PET_RESCUE_MAX,
  advancePet,
  agePet,
  chooseEgg,
  branchFor,
  branchThresholds,
  feedPet,
  logPetFind,
  newPet,
  petBustCutPp,
  petRescueKeep,
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
  devPetExpeditionReset,
  dismissExpeditionNote,
  effectiveBustPct,
  finishPetRound,
  localYmd,
  markExpeditionToasted,
  parsePlayStore,
  petAt,
  playView,
  rebirthPetDoc,
  recordDefendWin,
  sendPetExpedition,
  startDive,
  surfaceDive,
  touchPet,
  type PlayStoreDoc,
} from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const H = 60 * 60 * 1000;

/** A v22 dive run (charged, no pre-rolled next). */
function diveRun(deepers: number, haul: string[]): PlayStoreDoc['dive_run'] {
  return { deepers, haul, free_n: null, next: null };
}
const T0 = Date.UTC(2026, 8, 29, 12, 0, 0);

function stageAt(pet: PetState, hours: number): PetState {
  return agePet(pet, hours * H);
}

/* ------------------------------------------------------------ time maths --- */

const MIN = 60 * 1000;
const total = PET_STAGE_MS.egg + PET_STAGE_MS.baby + PET_STAGE_MS.child + PET_STAGE_MS.teen + PET_STAGE_MS.adult;
assert.equal(total / H, 228.25, 'Egg → God is 228.25h (5 min + 10 min + 36h + 72h + 120h)');
assert.ok(total / (24 * H) > 9.4 && total / (24 * H) < 9.7, 'about 9.5 days to God');
/** A chosen Knight egg (a blank picker slot never ages). */
const egg = chooseEgg(newPet(T0), 'knight', 12345, null, T0)!;
assert.equal(agePet(newPet(T0), 100 * H).total_age_ms, 0, 'the egg picker: no egg chosen, no time passes');
assert.equal(agePet(egg, 5 * MIN - 1).stage, 'egg');
assert.equal(agePet(egg, 5 * MIN).stage, 'baby', 'hatches at 5 min');
assert.equal(agePet(egg, 15 * MIN - 1).stage, 'baby');
assert.equal(agePet(egg, 15 * MIN).stage, 'child', 'Child (hero revealed) at 15 min');
assert.equal(stageAt(egg, 36.25).stage, 'teen');
assert.equal(stageAt(egg, 108.25).stage, 'adult');
assert.equal(stageAt(egg, 228.25).stage, 'god', 'God at 228.25h even with zero care');
assert.equal(stageAt(egg, 5000).stage, 'god', 'and God is the last stage');
ok('stages: Egg 5 min → Baby 10 min → Child 36h → Teen 72h → Adult 120h → God (≈9.5 days), never dies');

// Split-proof: many small visits land on the same state as one long one.
const once = agePet(egg, 97 * H);
let pieces = egg;
for (const h of [0.5, 3, 7.25, 11, 0.25, 30, 20, 25]) pieces = agePet(pieces, h * H);
assert.deepEqual(pieces, once, 'aging 97h in pieces == aging 97h at once');
ok('aging is exact and split-proof (97h in 8 visits == 97h at once)');

/* ---------------------------------------------------------- clock guard --- */

const seen = { ...egg };
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
const eggCare = agePet({ ...egg, hunger: 1 }, 4 * MIN);
assert.equal(eggCare.hunger, 1, 'an egg does not get hungry');
ok('care: −1 hunger/3h, 2h grace, then at most one mistake per meter every 6h; eggs never decay');

/* ------------------------------------------------------------- branches --- */

assert.equal(branchFor('child', { mistakes: 3, training: 9, waves: 99 }), 'scruffy', 'neglect wins');
assert.equal(branchFor('child', { mistakes: 0, training: 9, waves: 6 }), 'battle', 'lots of TD → Battle');
assert.equal(branchFor('child', { mistakes: 1, training: 3, waves: 5 }), 'bright', 'care + training → Bright');
assert.equal(branchFor('child', { mistakes: 2, training: 3, waves: 0 }), 'standard', 'otherwise Standard');
assert.equal(branchFor('egg', { mistakes: 99, training: 0, waves: 0 }), 'standard', 'hatching has no branch');
assert.equal(branchFor('baby', { mistakes: 0, training: 1, waves: 0 }), 'standard', 'one round in a 10-min Baby is not Bright');
assert.equal(branchFor('baby', { mistakes: 9, training: 9, waves: 99, deep_surfaces: 9 }), 'standard', 'every Child starts Standard');
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
ok('branches: Scruffy > Battle > Bright > Standard, decided at evolution (first at Teen); counters reset');

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
    dive_run: diveRun(1, [look, power, look]),
    inventory: [],
  };
  const res = deeperDive(doc, T0, 'safe', () => 0)!;
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
assert.equal(reborn.pet.egg, null, 'back to the egg picker');
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
assert.equal(loaded.version, 23);
assert.equal(loaded.pet.stage, 'egg', 'old saves get a fresh egg');
assert.equal(loaded.pet.egg, null, '— the egg picker');
assert.equal(loaded.pet.seen_at, T0 + 5 * H, 'seen now — no time before the update counts');
assert.deepEqual([loaded.pet_hall, loaded.pet_rebirths, loaded.pet_remind], [[], 0, false]);
const withProgress: PlayStoreDoc = {
  ...loaded,
  pet: { ...agePet(chooseEgg(loaded.pet, 'village', 777, null, T0)!, 60 * H), element_uses: { spark: 3 } },
  pet_hall: [
    { line: 'solo_raven', branch: 'battle', aura: 'ember', rebirth: 1, days: 10, hero: 'raven', grade: 'epic', shiny: true, egg: 'knight', released: false },
  ],
  pet_rebirths: 1,
  pet_tokens_today: 15,
  pet_tokens_ymd: '2026-09-29',
  pet_remind: true,
};
assert.deepEqual(parsePlayStore(JSON.stringify(withProgress), T0), withProgress, 'v20 round-trips unchanged');
assert.equal(parsePet({ stage: 'nope' }, T0).stage, 'egg', 'a corrupt pet becomes a fresh egg');
const loadedEgg = { ...loaded, pet: chooseEgg(loaded.pet, 'knight', 1, null, T0 + 5 * H)! };
const touched = touchPet(loadedEgg, T0 + 7 * H);
assert.equal(touched.pet.total_age_ms, 2 * H, 'opening the app ages the pet from the saved mark');
assert.equal(touchPet(touched, T0 + 7 * H), touched, 'and a second touch at the same time is a no-op');
ok('save v19 → v23: the egg picker, seen now; round-trips; corrupt pet → egg');

/* ============================================ v21 — Dive + Pet loop ===== */

const D = 24 * H;
const petOf = (over: Partial<PetState>): PetState => ({ ...newPet(T0), ...over });

/* ----------------------------------------------------------- Deep branch --- */

assert.equal(branchThresholds('baby').deepSurfaces, 3);
assert.equal(branchThresholds('child').deepSurfaces, 6);
assert.equal(branchThresholds('teen').deepSurfaces, 12);
assert.equal(branchThresholds('adult').deepSurfaces, 20);
for (const st of ['baby', 'child', 'teen', 'adult'] as const) {
  assert.equal(branchThresholds(st).deepSurfaces, branchThresholds(st).battleWaves, `${st}: same formula as battleWaves`);
}
const c = (o: { mistakes?: number; training?: number; waves?: number; deep_surfaces?: number }) => ({
  mistakes: 0,
  training: 0,
  waves: 0,
  deep_surfaces: 0,
  ...o,
});
assert.equal(branchFor('child', c({ deep_surfaces: 6 })), 'deep', '6 deep surfaces at Child → Deep');
assert.equal(branchFor('child', c({ deep_surfaces: 5 })), 'standard', '5 is not enough');
assert.equal(branchFor('child', c({ mistakes: 3, deep_surfaces: 99 })), 'scruffy', 'neglect still wins first');
assert.equal(branchFor('child', c({ waves: 6, deep_surfaces: 6 })), 'battle', 'equal margins → Battle');
assert.equal(branchFor('child', c({ waves: 6, deep_surfaces: 7 })), 'deep', 'bigger Deep margin → Deep');
assert.equal(branchFor('child', c({ waves: 8, deep_surfaces: 7 })), 'battle', 'bigger Battle margin → Battle');
assert.equal(branchFor('child', c({ training: 9, deep_surfaces: 6 })), 'deep', 'Deep comes before Bright');
assert.equal(branchFor('child', { mistakes: 0, training: 0, waves: 0 }), 'standard', 'an old counter set (no deep field) still works');
assert.equal(branchFor('egg', c({ deep_surfaces: 99 })), 'standard', 'hatching has no branch');
const deepChild = petOf({ stage: 'child', deep_surfaces: 6, stage_age_ms: PET_STAGE_MS.child - 1000 });
const deepEvolved = agePet(deepChild, 1000);
assert.equal(deepEvolved.stage, 'teen');
assert.equal(deepEvolved.branch, 'deep', 'the evolution picks Deep');
assert.equal(deepEvolved.deep_surfaces, 0, 'deep_surfaces resets at each evolution');
ok('Deep branch: threshold = battleWaves formula; scruffy → deep/battle by margin (ties Battle) → bright → standard; resets');

/* --------------------------------------------------------- Deep perks --- */

assert.equal(petBustCutPp(petOf({ stage: 'child', branch: 'deep' })), 1, 'Child Deep: 1 point');
assert.equal(petBustCutPp(petOf({ stage: 'teen', branch: 'deep' })), 2, 'Teen Deep: 1 + 1');
assert.equal(petBustCutPp(petOf({ stage: 'god', branch: 'deep' })), 4, 'God Deep: 3 + 1');
assert.equal(effectiveBustPct(0.18, {}, null, 4), 14, 'God Deep on Deeper #1: 18 → 14');
assert.equal(effectiveBustPct(0.18, {}, null, 40), 9, 'the half-table floor still holds');
assert.equal(petRescueKeep(petOf({ stage: 'teen', branch: 'deep' })), 0, 'no rescue before Adult, even Deep');
assert.equal(petRescueKeep(petOf({ stage: 'adult', branch: 'standard' })), 1);
assert.equal(petRescueKeep(petOf({ stage: 'adult', branch: 'deep' })), 2, 'Adult Deep: 1 + 1');
assert.equal(petRescueKeep(petOf({ stage: 'god', branch: 'standard' })), 2);
assert.equal(petRescueKeep(petOf({ stage: 'god', branch: 'deep' })), PET_RESCUE_MAX, 'God Deep: capped at 2');
assert.equal(PET_RESCUE_MAX, 2);
const pwr = rollPowerFind(() => 0);
const lk = junkLookId();
const godDeepBust = deeperDive({ ...docWithPet(petOf({ stage: 'god', branch: 'deep' })), dive_run: diveRun(3, [lk, pwr, lk, pwr, lk]), inventory: [] },
  T0, 'safe',
  () => 0,
)!;
assert.ok(godDeepBust.outcome.busted && godDeepBust.outcome.rescued.length === 2, 'a God Deep bust saves exactly 2');
ok('Deep perks: +1 bust point (floor kept); +1 rescue at Adult/God, never above 2');

/* ------------------------------------------------------------ Dive care --- */

function diving(pet: PetState, deepers: number): PlayStoreDoc {
  return { ...docWithPet(pet), dive_run: diveRun(deepers, [lk]), inventory: [] };
}
const moody = petOf({ stage: 'child', mood: 1, training: 0 });
const s3 = surfaceDive(diving(moody, 3), T0)!.doc.pet;
assert.equal(s3.mood, 3, 'surfacing: +2 mood');
assert.equal(s3.training, 0, 'surfacing never adds training');
assert.equal(s3.deep_surfaces, 1, 'a surface from 3 Deepers counts toward Deep');
const s2 = surfaceDive(diving(moody, 2), T0)!.doc.pet;
assert.equal(s2.deep_surfaces, 0, 'from 2 Deepers it does not');
assert.equal(s2.mood, 3);
const s0 = surfaceDive(diving(petOf({ stage: 'child', mood: 4 }), 0), T0)!.doc.pet;
assert.equal(s0.mood, 4, 'mood caps at 4');
const b = deeperDive(diving(moody, 1), T0, 'safe', () => 0)!;
assert.ok(b.outcome.busted);
assert.equal(b.doc.pet.mood, 2, 'a bust: +1 mood');
assert.equal(b.doc.pet.training, 0, 'a bust never adds training');
assert.equal(b.doc.pet.deep_surfaces, 0, 'a bust is not a surface');
const eggSurf = surfaceDive(diving(newPet(T0), 4), T0)!.doc.pet;
assert.deepEqual(eggSurf, newPet(T0), 'an egg is not cared for by dives');
assert.equal(surfaceDive(diving(moody, 3), T0)!.petCared, true, 'petCared reports the mood lift');
assert.equal(surfaceDive(diving(newPet(T0), 3), T0)!.petCared, false, 'and not for an egg');
const bustCared = deeperDive(diving(moody, 1), T0, 'safe', () => 0)!.outcome;
assert.ok(bustCared.busted && bustCared.petCared, 'a bust reports its +1 too');
ok('Dive care: surface +2 mood, bust +1 mood, never training; deep_surfaces only from 3+ Deepers');

/* ------------------------------------------ Dive never moves the clock --- */

{
  let doc: PlayStoreDoc = { ...docWithPet(petOf({ stage: 'teen', stage_age_ms: 10 * H, total_age_ms: 59 * H })), inventory: [] };
  const now = T0 + 3 * H;
  const baseline = touchPet(doc, now).pet;
  for (let i = 0; i < 25; i += 1) {
    const started = startDive(doc, now, () => 0.5);
    if (!started) break;
    doc = started.doc;
    for (let d = 0; d < 4 && doc.dive_run; d += 1) {
      const r = deeperDive(doc, now, 'safe', () => (i % 3 === 0 ? 0 : 0.99));
      if (r) doc = r.doc;
    }
    if (doc.dive_run) doc = surfaceDive(doc, now)!.doc;
  }
  assert.equal(doc.pet.stage, baseline.stage, 'same stage');
  assert.equal(doc.pet.stage_age_ms, baseline.stage_age_ms, 'stage_age_ms is only real time');
  assert.equal(doc.pet.total_age_ms, baseline.total_age_ms, 'total_age_ms too');
  assert.equal(doc.pet.seen_at, now);
  assert.ok(doc.pet.deep_surfaces > 0, 'the dives did count as care');
}
ok('Dive never changes stage_age_ms: a full bar of dives at one moment = no time passes');

/* ----------------------------------------------------------- expedition --- */

{
  const child = docWithPet(petOf({ stage: 'child', total_age_ms: 20 * H, seen_at: T0 }));
  const sent = sendPetExpedition(child, T0);
  assert.ok(sent.result.ok, 'a Child can go');
  assert.ok(sent.doc.pet_expedition, 'it is out');
  assert.equal(sent.doc.pet_expedition_ymd, localYmd(new Date(T0)));
  const again = sendPetExpedition(sent.doc, T0 + 1000);
  assert.deepEqual(again.result, { ok: false, reason: 'away' }, 'not while it is out');
  const baby = sendPetExpedition(docWithPet(petOf({ stage: 'baby' })), T0);
  assert.deepEqual(baby.result, { ok: false, reason: 'egg_or_baby' }, 'Child and up only');

  const early = touchPet(sent.doc, T0 + 59 * 60 * 1000, () => 0);
  assert.ok(early.pet_expedition, 'at 59 minutes it is still away');
  assert.equal(early.pet_expedition_note, null);
  const bagBefore = early.inventory.reduce((a, st) => a + st.count, 0);
  const back = touchPet(early, T0 + H, () => 0); // rng 0 busts any real dive
  assert.equal(back.pet_expedition, null, 'at 1h it is collected');
  assert.equal(back.inventory.reduce((a, st) => a + st.count, 0), bagBefore + 1, 'exactly one find, even with a busting rng');
  assert.ok(back.pet_expedition_note && diveCollectibleIds().includes(back.pet_expedition_note), 'the note names a dive find');
  assert.deepEqual(back.pet_logbook[back.pet_expedition_note!], { depth: 0, count: 1 }, 'logged at depth 0');
  const twice = touchPet(back, T0 + 2 * H, () => 0);
  assert.equal(twice.inventory.reduce((a, st) => a + st.count, 0), bagBefore + 1, 'collected once, never twice');

  const rewound = touchPet(sent.doc, T0 - 5 * H, () => 0);
  assert.ok(rewound.pet_expedition, 'setting the clock back never brings it home');

  const sameDay = sendPetExpedition(back, T0 + 2 * H);
  assert.deepEqual(sameDay.result, { ok: false, reason: 'done_today' }, 'once a device-local day');
  const nextDay = sendPetExpedition(back, T0 + D);
  assert.ok(nextDay.result.ok, 'the next day it can go again');

  const godAway = sendPetExpedition(docWithPet(petOf({ stage: 'god', total_age_ms: 250 * H })), T0).doc;
  assert.equal(rebirthPetDoc(godAway, T0 + 10 * 60 * 1000), null, 'no rebirth while it is away');
  assert.ok(rebirthPetDoc(godAway, T0 + H), 'rebirth works once it is back (collected first)');
}
{
  // Announced once per return: collection marks it fresh, the shell marks it
  // shown, and dismissing the note never re-arms it.
  const out = sendPetExpedition(docWithPet(petOf({ stage: 'child', total_age_ms: 20 * H })), T0).doc;
  const home = touchPet(out, T0 + H, () => 0.5);
  assert.equal(playView(home, T0 + H).pet.expeditionNoteFresh, true, 'a fresh return needs its message');
  const shown = markExpeditionToasted(home)!;
  assert.equal(playView(shown, T0 + H).pet.expeditionNoteFresh, false, 'shown once');
  assert.equal(markExpeditionToasted(shown), null, 'and never again');
  assert.equal(playView(shown, T0 + H).pet.expeditionNote, home.pet_expedition_note, 'the note stays until dismissed');
  assert.equal(dismissExpeditionNote(shown).pet_expedition_note, null);
  // Dev "back now" works even for a pet younger than the 1h minimum.
  const young = sendPetExpedition(docWithPet(petOf({ stage: 'child', total_age_ms: 10 * 60 * 1000 })), T0).doc;
  const reset = devPetExpeditionReset(young, T0 + 1000);
  assert.equal(petAt(reset, T0 + 1000).away, false, 'dev reset: counts as back');
  assert.equal(touchPet(reset, T0 + 1000, () => 0.5).pet_expedition, null, 'and is collected on the next touch');
}
ok('expedition: Child+, once a day, away ≥ 1h (counted time), can’t bust, one find, collected once, announced once, no rebirth while out');

/* --------------------------------------------------------- away rule --- */

{
  const godDoc = docWithPet(petOf({ stage: 'god', branch: 'deep', total_age_ms: 250 * H }));
  const out = sendPetExpedition(godDoc, T0).doc;
  const v = playView(out, T0 + 10 * 60 * 1000);
  assert.equal(v.pet.away, true);
  assert.deepEqual([v.pet.pounceBase, v.pet.bustCutPp, v.pet.rescueKeep], [0, 0, 0], 'away: no pounce, no bust cut, no rescue');
  const running = { ...out, dive_run: diveRun(1, [lk, pwr]), inventory: [] };
  const shown = playView(running, T0 + 10 * 60 * 1000).diveRun;
  assert.equal(shown.petAway, true);
  assert.equal(shown.bustPctNext, 20, 'away: the plain Safer % (28 − 8, no cut)');
  const bustAway = deeperDive(running, T0 + 10 * 60 * 1000, 'safe', () => 0)!;
  assert.ok(bustAway.outcome.busted && bustAway.outcome.rescued.length === 0, 'away: nothing rescued');
  const moodBefore = advancePet(out.pet, T0 + 10 * 60 * 1000).mood;
  assert.equal(bustAway.doc.pet.mood, moodBefore, 'away: dives are not its care');
  const safeAway = deeperDive(running, T0 + 10 * 60 * 1000, 'safe', () => 0.99)!;
  assert.ok(!safeAway.outcome.busted && !safeAway.outcome.changed);
  assert.deepEqual(safeAway.doc.pet_logbook, out.pet_logbook, 'away: its Logbook does not change');
  const home = playView(out, T0 + H);
  assert.equal(home.pet.away, false, 'once its time is up it counts as home');
  assert.ok(home.pet.pounceBase > 0 && home.pet.bustCutPp === 4 && home.pet.rescueKeep === 2, 'and every perk is back');
  assert.equal(petAt(out, T0 + H).away, false);
}
ok('away: pounce, bust cut and rescue all off (view and roll), dives not its care, perks back when it returns');

/* ------------------------------------------------------------- Logbook --- */

{
  let book = logPetFind({}, 'x', 3);
  book = logPetFind(book, 'x', 0);
  book = logPetFind(book, 'x', 4);
  assert.deepEqual(book.x, { depth: 3, count: 3 }, 'first depth kept, count grows');

  const start = startDive(docWithPet(petOf({ stage: 'teen' })), T0, () => 0.5)!;
  assert.deepEqual(start.doc.pet_logbook[start.firstFind], { depth: 0, count: 1 }, 'the first card is depth 0');
  const deeper = deeperDive(start.doc, T0, 'safe', () => 0.99)!;
  assert.ok(!deeper.outcome.busted && !deeper.outcome.changed);
  const added = (deeper.outcome as { addedId: string }).addedId;
  assert.equal(deeper.doc.pet_logbook[added].depth, added === start.firstFind ? 0 : 1, 'a Deeper find is logged at its depth');
  const lost = deeperDive(deeper.doc, T0, 'safe', () => 0)!;
  assert.ok(lost.outcome.busted);
  assert.deepEqual(lost.doc.pet_logbook, deeper.doc.pet_logbook, 'finds lost to a bust stay in the Logbook');

  const godWithBook = { ...docWithPet(petOf({ stage: 'god' })), pet_logbook: { [lk]: { depth: 2, count: 5 } } };
  assert.deepEqual(rebirthPetDoc(godWithBook, T0)!.pet_logbook, godWithBook.pet_logbook, 'the Logbook survives a rebirth');

  assert.ok(diveCollectibleIds().length >= 5 && diveCollectibleIds().includes('item_deep_pearl_01'), 'the Logbook slots are the Dive table');
}
{
  const v20: Record<string, unknown> = { ...defaultPlayStore(T0), version: 20, pet: { ...petOf({ stage: 'teen' }) } };
  for (const k of ['pet_expedition', 'pet_expedition_ymd', 'pet_expedition_note', 'pet_logbook']) delete v20[k];
  delete (v20.pet as Record<string, unknown>).deep_surfaces;
  const up = parsePlayStore(JSON.stringify(v20), T0)!;
  assert.equal(up.version, 23);
  assert.deepEqual(
    [up.pet_expedition, up.pet_expedition_ymd, up.pet_expedition_note, up.pet_logbook, up.pet.deep_surfaces],
    [null, null, null, {}, 0],
    'a v20 save opens with no expedition, an empty Logbook and 0 deep surfaces',
  );
  assert.equal(up.pet.stage, 'teen', 'and keeps its pet');
  const full: PlayStoreDoc = {
    ...up,
    pet: { ...up.pet, deep_surfaces: 4 },
    pet_expedition: { left_age_ms: 12345 },
    pet_expedition_ymd: '2026-09-29',
    pet_expedition_note: lk,
    pet_logbook: { [lk]: { depth: 3, count: 2 } },
  };
  assert.deepEqual(parsePlayStore(JSON.stringify(full), T0), full, 'v23 round-trips unchanged');
}
ok('Logbook: first depth + count, busted finds kept, survives rebirth; v20 → v23 opens empty; round-trips');

/* --------------------------------------------- shown % = rolled % --- */

{
  // Adult, 1 Deeper done: the view's % must be the exact roll threshold.
  const doc = { ...docWithPet(petOf({ stage: 'adult', branch: 'deep' })), dive_run: diveRun(1, [lk, pwr]), inventory: [] };
  const shown = playView(doc, T0).diveRun.bustPctNext!;
  assert.equal(shown, 17, 'Deeper #2 Safer (28 − 8 = 20%) − 3 Adult Deep points');
  const justUnder = deeperDive(doc, T0, 'safe', () => shown / 100 - 1e-9, shown)!;
  assert.ok(justUnder.outcome.busted, 'a roll just under the shown % busts');
  const atIt = deeperDive(doc, T0, 'safe', () => shown / 100, shown)!;
  assert.ok(!atIt.outcome.busted && !atIt.outcome.changed, 'a roll at the shown % is safe');

  // The pet evolves between showing and pressing: nothing is rolled.
  const teenEdge = {
    ...docWithPet(petOf({ stage: 'teen', stage_age_ms: PET_STAGE_MS.teen - 60_000 })),
    dive_run: diveRun(1, [lk]),
    inventory: [],
  };
  const shownThen = playView(teenEdge, T0).diveRun.bustPctNext!;
  const pressedLater = deeperDive(teenEdge, T0 + 2 * 60_000, 'safe', () => 0, shownThen)!;
  assert.ok(pressedLater.outcome.changed, 'odds moved (Teen → Adult) → changed, no roll');
  assert.notEqual(pressedLater.outcome.bustPct, shownThen);
  assert.deepEqual(pressedLater.doc.dive_run, teenEdge.dive_run, 'the haul is untouched');
  assert.equal(pressedLater.outcome.bustPct, playView(pressedLater.doc, T0 + 2 * 60_000).diveRun.bustPctNext, 'the new % is what the screen now shows');
}
ok('shown % = rolled %: exact threshold, and a moved % refuses the roll instead of using a different number');

console.log(`\ncheck:pet — ${passed} groups passed.`);
