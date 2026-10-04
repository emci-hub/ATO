/**
 * Egg / grade / shiny / shard checks (2026-09-30). Run: npm run check:pet-eggs
 *
 * Holds the rules in `src/play/pet-eggs.ts` and their wiring in `pet.ts` /
 * `playStore.ts`: even hero odds per egg; grade tables sum to 100; the odds
 * shown are the odds used; care moves odds only within limits; the same seed
 * + band always gives the same hero AND grade (no reroll by reopening or
 * re-aging); shiny ≈ 1/50; Egg/Baby leave no shards and can't be released;
 * 5 shards → a ticket that never rolls below its grade; stars cap at 5 with
 * the dye at 3★; dyes never on a shiny; Legendary + shiny Hall entries are
 * never dropped; old saves load with nothing lost; grade never changes stats
 * or the sprite colour; the clock guard holds for the 5/10-minute stages.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { allHeroes } from '../src/play/heroes-data';
import {
  PET_HALL_MAX,
  PET_MAX_GAP_MS,
  PET_STAGE_MS,
  advancePet,
  agePet,
  chooseEgg,
  newPet,
  parsePet,
  parsePetHall,
  petBustCutPp,
  petPounceBase,
  petRescueKeep,
  warmEgg,
  type PetHallEntry,
  type PetState,
} from '../src/play/pet';
import {
  BAND_WEIGHTS,
  CARE_ACT,
  CARE_BANDS,
  EGG_POOLS,
  EGG_TYPES,
  GRADES,
  SHARDS_PER_TICKET,
  SHINY_ODDS,
  WARMTH_DROP_MS,
  careBand,
  careScore,
  dyeApplies,
  gradeOdds,
  gradeRank,
  heroOdds,
  heroStars,
  rollPet,
  trimHall,
  type Grade,
} from '../src/play/pet-eggs';
import {
  chooseEggDoc,
  defaultPlayStore,
  finishPetRound,
  parsePlayStore,
  petDyeOn,
  playView,
  rebirthPetDoc,
  releasePetDoc,
  setHeroDye,
  tradeUpShards,
  warmEggDoc,
  touchPet as touchPetForCheck,
  type PlayStoreDoc,
} from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const T0 = Date.UTC(2026, 8, 30, 12, 0, 0);
const MIN = 60 * 1000;
const H = 60 * MIN;
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

/* ---------------------------------------------------------------- pools --- */

const inPools = EGG_TYPES.flatMap((e) => EGG_POOLS[e]);
assert.equal(new Set(inPools).size, inPools.length, 'each hero is in exactly one egg');
assert.deepEqual([...inPools].sort(), allHeroes().map((h) => h.id).sort(), 'all 16 heroes are in a pool');
assert.deepEqual(EGG_TYPES.map((e) => EGG_POOLS[e].length), [5, 5, 6], 'Knight 5 / Wizard 5 / Village 6');
for (const egg of EGG_TYPES) {
  const odds = heroOdds(egg);
  assert.ok(close(odds.reduce((s, o) => s + o.pct, 0), 100), `${egg}: hero odds sum to 100`);
  assert.ok(odds.every((o) => close(o.pct, 100 / EGG_POOLS[egg].length)), `${egg}: an even split`);
}
assert.ok(EGG_POOLS.village.includes('kitsune'));
ok('pools: all 16 heroes, each in one egg (5/5/6), even hero odds within each egg');

/* ----------------------------------------------------------- grade odds --- */

for (const band of CARE_BANDS) {
  assert.equal(GRADES.reduce((s, g) => s + BAND_WEIGHTS[band][g], 0), 100, `${band}: weights sum to 100`);
  for (const floor of [null, ...GRADES] as (Grade | null)[]) {
    const odds = gradeOdds(band, floor);
    assert.ok(close(GRADES.reduce((s, g) => s + odds[g], 0), 100), `${band}/${floor}: odds sum to 100`);
    for (const g of GRADES) {
      if (floor && gradeRank(g) < gradeRank(floor)) assert.equal(odds[g], 0, `${band}: ${g} is below the ticket`);
    }
  }
}
assert.deepEqual(gradeOdds('poor'), { common: 70, rare: 22, epic: 6, legendary: 2 });
assert.deepEqual(gradeOdds('perfect'), { common: 42, rare: 34, epic: 16, legendary: 8 });
assert.ok(close(gradeOdds('poor', 'rare').rare, (22 / 30) * 100), 'a Rare+ ticket at Poor: 73.3% Rare');
assert.deepEqual(gradeOdds('poor', 'legendary'), { common: 0, rare: 0, epic: 0, legendary: 100 });
// Care only moves odds within the limits: Legendary 2 → 8, Common 70 → 42, monotonic.
const legend = CARE_BANDS.map((b) => BAND_WEIGHTS[b].legendary);
assert.deepEqual(legend, [2, 4, 6, 8], 'Legendary 2% at Poor up to 8% at Perfect');
for (let i = 1; i < CARE_BANDS.length; i += 1) {
  const a = BAND_WEIGHTS[CARE_BANDS[i - 1]];
  const b = BAND_WEIGHTS[CARE_BANDS[i]];
  assert.ok(b.common < a.common && b.legendary > a.legendary && b.epic > a.epic, 'better care = better odds, step by step');
}
ok('grade odds: every table sums to 100, tickets remove lower grades, care moves Legendary only 2% → 8%');

/* ---------------------------------------------------------------- care --- */

const EGG = PET_STAGE_MS.egg;
assert.equal(careBand(careScore({ warmMs: 90_000, eggMs: EGG, skill: 0, acts: 0 })), 'poor', 'left the app → Poor');
assert.equal(careBand(careScore({ warmMs: EGG, eggMs: EGG, skill: 0, acts: 0 })), 'good', 'warm all through, nothing else → Good');
assert.equal(careBand(careScore({ warmMs: EGG, eggMs: EGG, skill: 12, acts: CARE_ACT.fed })), 'great');
// Tapping everything without skill never reaches Perfect.
assert.equal(careBand(careScore({ warmMs: EGG, eggMs: EGG, skill: 12, acts: 7 })), 'great', 'taps alone top out at Great (77)');
assert.equal(careBand(careScore({ warmMs: EGG * 0.9, eggMs: EGG, skill: 25, acts: CARE_ACT.fed | CARE_ACT.dived })), 'perfect', 'Perfect = warm + skill + activity');
assert.equal(careScore({ warmMs: EGG * 5, eggMs: EGG, skill: 99, acts: 255 }), 90, 'the score is capped by its parts');
ok('care: left = Poor, warm = Good, Perfect needs warmth + a skilled round + activity');

/* ------------------------------------------------------------- warmth --- */

const knightEgg = chooseEgg(newPet(T0), 'knight', 42, null, T0)!;
assert.equal(knightEgg.warmth, 3);
assert.equal(agePet(knightEgg, WARMTH_DROP_MS - 1).warmth, 3);
assert.equal(agePet(knightEgg, WARMTH_DROP_MS).warmth, 2, 'one pip lost per 90s');
assert.equal(warmEgg(knightEgg)!.warmth, 4, 'a tap adds a pip');
assert.equal(warmEgg({ ...knightEgg, warmth: 4 }), null, 'max 4');
assert.equal(agePet(knightEgg, EGG).warm_ms, WARMTH_DROP_MS, 'untouched: warm only the first 90s');
let tapped: PetState = knightEgg;
for (let t = 0; t < 5; t += 1) tapped = agePet(warmEgg(tapped) ?? tapped, 60_000);
assert.equal(tapped.warm_ms, EGG, 'tapping every minute keeps it warm the whole egg');
// Split-proof: aging the egg in pieces = at once.
let pieces = knightEgg;
for (const ms of [10_000, 95_000, 33_000, 120_000, 42_000]) pieces = agePet(pieces, ms);
assert.deepEqual(pieces, agePet(knightEgg, 300_000), 'warmth is split-proof');
ok('warmth: starts at 3, −1 per 90s, +1 a tap (max 4); warm time counted exactly');

/* ------------------------------------------------------ deterministic --- */

for (let seed = 1; seed < 400; seed += 37) {
  for (const egg of EGG_TYPES) {
    for (const band of CARE_BANDS) {
      assert.deepEqual(rollPet(seed, egg, band), rollPet(seed, egg, band), 'same seed + band = same pet');
    }
  }
}
// Through the pet: reach Child, then re-age, reopen, rewind — never rerolled.
const baby = agePet(knightEgg, EGG);
assert.equal(baby.stage, 'baby');
assert.deepEqual(baby.reveals, ['hatch']);
const child = agePet(baby, PET_STAGE_MS.baby);
assert.equal(child.stage, 'child');
assert.ok(child.hero && child.grade && child.band, 'hero, grade and band locked at Child');
assert.deepEqual(
  { hero: child.hero, grade: child.grade, shiny: child.shiny },
  rollPet(42, 'knight', child.band!, null),
  'the pet is exactly the seed + band roll',
);
const reaged = agePet(child, 50 * H);
assert.deepEqual([reaged.hero, reaged.grade, reaged.shiny], [child.hero, child.grade, child.shiny], 'aging again never rerolls');
const reopened = parsePet(JSON.parse(JSON.stringify(child)), T0 + 99 * H);
assert.deepEqual([reopened.hero, reopened.grade, reopened.shiny, reopened.band], [child.hero, child.grade, child.shiny, child.band], 'reopening never rerolls');
// Hatched and revealed while the app was closed: decided by the same rules, both reveals queued.
const offline = advancePet({ ...knightEgg, seen_at: T0 }, T0 + 20 * MIN);
assert.equal(offline.stage, 'child');
assert.deepEqual(offline.reveals, ['hatch', 'child'], 'both reveals play on the next view');
assert.equal(offline.band, 'poor', 'away the whole time = Poor');
ok('same seed + band = same hero AND grade; locked at Child; never rerolled by re-aging, reopening or offline');

/* ---------------------------------------------------- odds shown = used --- */

const N = 200_000;
for (const [band, floor] of [['poor', null], ['perfect', null], ['great', 'rare'], ['good', 'epic']] as const) {
  const counts: Record<Grade, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  let s = 7;
  for (let i = 0; i < N; i += 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    counts[rollPet(s, 'village', band, floor).grade] += 1;
  }
  const shown = gradeOdds(band, floor);
  for (const g of GRADES) {
    assert.ok(Math.abs((counts[g] / N) * 100 - shown[g]) < 0.5, `${band}/${floor} ${g}: rolled ${(counts[g] / N) * 100}% vs shown ${shown[g]}%`);
    if (floor && gradeRank(g) < gradeRank(floor)) assert.equal(counts[g], 0, 'a ticket never rolls below its grade');
  }
}
const heroCounts: Record<string, number> = {};
let shinies = 0;
let s2 = 99;
for (let i = 0; i < N; i += 1) {
  s2 = (s2 * 1664525 + 1013904223) >>> 0;
  const r = rollPet(s2, 'knight', 'good');
  heroCounts[r.hero] = (heroCounts[r.hero] ?? 0) + 1;
  if (r.shiny) shinies += 1;
}
for (const hero of EGG_POOLS.knight) assert.ok(Math.abs(heroCounts[hero] / N - 0.2) < 0.005, `${hero} ≈ 20%`);
assert.ok(Math.abs(shinies / N - SHINY_ODDS) < 0.002, `shiny ≈ 1/50 (got ${(shinies / N) * 100}%)`);
ok(`odds shown = odds used (${N.toLocaleString()} rolls): grades, even heroes, tickets never below; shiny ≈ 1/50`);

/* --------------------------------------------------- doc: eggs + shards --- */

function doc(over: Partial<PlayStoreDoc> = {}): PlayStoreDoc {
  return { ...defaultPlayStore(T0), ...over };
}
let d = doc();
assert.equal(d.pet.egg, null, 'a new save starts at the egg picker');
assert.equal(warmEggDoc(d, T0), null, 'nothing to warm before an egg is chosen');
d = chooseEggDoc(d, T0, 'wizard', null, () => 0.5)!;
assert.equal(d.pet.egg, 'wizard');
assert.equal(chooseEggDoc(d, T0, 'knight', null), null, 'one egg at a time');
assert.equal(releasePetDoc(d, T0), null, 'an Egg can’t be released');
assert.equal(rebirthPetDoc(d, T0), null);
const babyDoc = { ...d, pet: agePet(d.pet, EGG) };
assert.equal(babyDoc.pet.stage, 'baby');
assert.equal(releasePetDoc(babyDoc, T0), null, 'a Baby can’t be released');
// Baby care: a skilled round counts toward the band.
const played = finishPetRound(babyDoc, T0, 'catch', { pass: true, quality: 0.8, got: 16, of: 20 }).doc;
assert.equal(played.pet.care_skill, 25);
assert.equal(played.pet.care_acts & CARE_ACT.fed, CARE_ACT.fed);
// Child: release → Hall + Collection + 1 shard of its grade, back to the picker.
const childDoc: PlayStoreDoc = { ...d, pet: { ...agePet(d.pet, EGG + PET_STAGE_MS.baby), seen_at: T0 } };
const grade = childDoc.pet.grade!;
const released = releasePetDoc(childDoc, T0)!;
assert.ok(released, 'Child can be released');
assert.equal(released.pet.egg, null, 'back to the egg picker');
assert.equal(released.pet_shards[grade], 1, 'one shard of its grade');
assert.equal(released.pet_hall.at(-1)?.released, true);
assert.equal(released.pet_rebirths, childDoc.pet_rebirths, 'no rebirth bonus');
assert.equal(released.pet_heroes[childDoc.pet.hero!]?.copies, 1, 'into the Collection');
assert.equal(
  releasePetDoc({ ...childDoc, pet_expedition: { left_age_ms: childDoc.pet.total_age_ms, len_ms: 3_600_000, step: -1 } }, T0),
  null,
  'not while away',
);
// God rebirth: +2% and a shard.
const godDoc: PlayStoreDoc = { ...childDoc, pet: { ...childDoc.pet, stage: 'god' } };
const reborn = rebirthPetDoc(godDoc, T0)!;
assert.equal(reborn.pet_rebirths, godDoc.pet_rebirths + 1);
assert.equal(reborn.pet_shards[grade], 1);
// Trade-up: 5 shards of a grade → 1 ticket of the next.
for (const g of ['common', 'rare', 'epic'] as const) {
  const up = GRADES[gradeRank(g) + 1];
  const full = doc({ pet_shards: { common: 0, rare: 0, epic: 0, legendary: 0, [g]: SHARDS_PER_TICKET } });
  assert.equal(tradeUpShards(doc({ pet_shards: { ...full.pet_shards, [g]: 4 } }), g), null, 'needs 5');
  const traded = tradeUpShards(full, g)!;
  assert.equal(traded.pet_shards[g], 0);
  assert.equal(traded.pet_tickets[up], 1, `5 ${g} → a ${up}+ ticket`);
  const withTicket = chooseEggDoc(traded, T0, 'knight', up)!;
  assert.equal(withTicket.pet.ticket, up);
  assert.equal(withTicket.pet_tickets[up], 0, 'the ticket is spent');
}
assert.equal(tradeUpShards(doc({ pet_shards: { common: 0, rare: 0, epic: 0, legendary: 9 } }), 'legendary'), null, 'nothing above Legendary');
assert.equal(chooseEggDoc(doc(), T0, 'knight', 'epic'), null, 'no ticket, no guarantee');
assert.equal(5 ** 3, 125, 'worst case to a Legendary ticket: 125 Commons');
ok('Egg/Baby can’t be released and leave no shards; release/rebirth leave one; 5 shards → the next-grade ticket');

/* ------------------------------------------------------ stars and dyes --- */

assert.deepEqual([0, 1, 3, 5, 9].map(heroStars), [0, 1, 3, 5, 5], 'stars cap at 5');
assert.equal(dyeApplies(3, true, false), true, 'the dye at 3★');
assert.equal(dyeApplies(2, true, false), false, 'not before 3★');
assert.equal(dyeApplies(5, true, true), false, 'never on a shiny');
const hero = childDoc.pet.hero!;
const twoCopies = doc({ pet_heroes: { [hero]: { copies: 2, shinies: 0, grades: ['common'], forms: [], dye: false, styles: [] } } });
assert.equal(setHeroDye(twoCopies, T0, hero, true), null, 'two stars: no dye yet');
const threeStars: PlayStoreDoc = { ...twoCopies, pet: { ...childDoc.pet, shiny: false } };
const dyed = setHeroDye(threeStars, T0, hero, true)!;
assert.ok(dyed, 'the live pet makes the third star');
assert.equal(petDyeOn(dyed), true);
assert.equal(petDyeOn({ ...dyed, pet: { ...dyed.pet, shiny: true } }), false, 'a shiny keeps its own colour');
assert.equal(playView(dyed, T0).pet.heroes[hero].copies, 3);
ok('stars: one per copy, max 5; the dye unlocks at 3★ and never applies to a shiny');

/* ---------------------------------------------------------------- hall --- */

const entry = (grade: Grade, shiny = false, n = 0): PetHallEntry => ({
  line: 'solo_raven', branch: 'standard', aura: null, rebirth: n, days: 1, hero: 'raven', grade, shiny, egg: 'knight', released: true, name: null,
});
const crowded = [
  entry('legendary', false, 1),
  entry('common', true, 2),
  ...Array.from({ length: 30 }, (_, i) => entry('epic', false, 10 + i)),
  ...Array.from({ length: 30 }, (_, i) => entry('rare', false, 50 + i)),
  ...Array.from({ length: 30 }, (_, i) => entry('common', false, 90 + i)),
];
const trimmed = trimHall(crowded, PET_HALL_MAX);
assert.equal(trimmed.length, PET_HALL_MAX);
assert.ok(trimmed.some((e) => e.grade === 'legendary') && trimmed.some((e) => e.shiny), 'Legendary and shiny are pinned');
assert.equal(trimmed.filter((e) => e.grade === 'common' && !e.shiny).length, 0, 'Commons drop first');
assert.equal(trimmed.filter((e) => e.grade === 'rare').length, 28, 'then the oldest Rares');
const allPinned = Array.from({ length: 70 }, (_, i) => entry('legendary', false, i));
assert.equal(trimHall(allPinned, PET_HALL_MAX).length, 70, 'only pinned left: never dropped');
ok('Hall: cap 60, drops Common → Rare → Epic (oldest first); Legendary and shiny never');

/* ---------------------------------------------------------- old saves --- */

const legacyTeen = parsePet(
  { line: 'line_wizard', stage: 'teen', branch: 'battle', stage_age_ms: 5 * H, total_age_ms: 60 * H, forms: ['standard', 'battle'], seen_at: T0 },
  T0,
);
assert.deepEqual(
  [legacyTeen.hero, legacyTeen.egg, legacyTeen.grade, legacyTeen.shiny, legacyTeen.line, legacyTeen.branch],
  ['maldrath', 'wizard', 'common', false, 'solo_maldrath', 'battle'],
  'a themed pet keeps its hero, counts as revealed, Common',
);
assert.deepEqual(legacyTeen.forms, ['standard', 'battle'], 'forms kept');
assert.equal(parsePet({ line: 'solo_kitsune', stage: 'adult', seen_at: T0 }, T0).hero, 'kitsune', 'a solo pet keeps its hero');
assert.equal(parsePet({ line: 'line_knight', stage: 'egg', seen_at: T0 }, T0).egg, null, 'an old egg → the egg picker');
const oldHall = parsePetHall([{ line: 'line_village', branch: 'bright', aura: 'tide', rebirth: 2, days: 11 }]);
assert.deepEqual(
  [oldHall[0].hero, oldHall[0].grade, oldHall[0].egg, oldHall[0].aura, oldHall[0].days],
  ['elowen', 'common', 'village', 'tide', 11],
  'old Hall entries get a hero, Common and their egg — nothing lost',
);
const v22: Record<string, unknown> = {
  ...defaultPlayStore(T0),
  version: 22,
  pet: { line: 'solo_raven', stage: 'child', forms: ['standard'], seen_at: T0 },
  pet_hall: [
    { line: 'solo_raven', branch: 'deep', aura: null, rebirth: 1, days: 10 },
    { line: 'line_knight', branch: 'battle', aura: null, rebirth: 2, days: 10 },
  ],
  pet_rebirths: 2,
  pet_collection: ['solo_raven:deep', 'line_knight:battle', 'solo_sak:bright'],
};
for (const k of ['pet_heroes', 'pet_shards', 'pet_tickets']) delete v22[k];
const up = parsePlayStore(JSON.stringify(v22), T0)!;
assert.equal(up.version, 31);
assert.equal(up.pet.hero, 'raven');
assert.equal(up.pet_rebirths, 2, 'rebirths kept');
assert.equal(up.pet_hall.length, 2, 'Hall kept');
assert.equal(up.pet_heroes.raven.copies, 2, 'both Hall Ravens count as copies');
assert.deepEqual([...up.pet_heroes.raven.forms].sort(), ['battle', 'deep']);
assert.deepEqual(up.pet_heroes.sak.forms, ['bright'], 'old Collection forms carry over');
assert.equal(playView(up, T0).pet.heroes.raven.copies, 3, 'the live pet adds its star: 3★');
assert.deepEqual(up.pet_shards, { common: 0, rare: 0, epic: 0, legendary: 0 });
ok('old saves: pets keep their hero (Common), eggs → picker, Hall + forms + stars carried over');

/* ------------------------------------------------ looks only, no stats --- */

for (const stage of ['child', 'teen', 'adult', 'god'] as const) {
  const base: PetState = { ...childDoc.pet, stage, branch: 'battle' };
  const stats = (p: PetState) => [petPounceBase(p), petBustCutPp(p), petRescueKeep(p)];
  for (const g of GRADES) {
    for (const shiny of [false, true]) {
      assert.deepEqual(stats({ ...base, grade: g, shiny }), stats(base), `${stage}: ${g}${shiny ? ' shiny' : ''} changes no stat`);
    }
  }
}
// Grade never recolours the sprite: the sprite code never reads grade colours.
for (const file of ['src/play/pet-figure.tsx', 'src/play/pet-anim-sprite.tsx']) {
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(!/GRADE_COLOR/.test(src), `${file}: the sprite never uses grade colours`);
}
ok('grade and shiny are looks only: pounce, bust cut and rescue identical; grade never tints the sprite');

/* ---------------------------------------------------------- clock guard --- */

const fresh = chooseEgg(newPet(T0), 'village', 5, null, T0)!;
assert.equal(advancePet(fresh, T0 - 10 * MIN), fresh, 'clock back: nothing passes');
const jumped = advancePet(fresh, T0 + 30 * 24 * H);
assert.equal(jumped.total_age_ms, PET_MAX_GAP_MS, 'a far jump counts 48h');
const beforeRewind = advancePet(fresh, T0 + 12 * MIN);
assert.equal(advancePet(beforeRewind, T0 + 2 * MIN), beforeRewind, 'rewinding into the Egg changes nothing');
assert.equal(beforeRewind.stage, 'baby');
ok('clock guard holds for the 5- and 10-minute stages');

/* ------------------------------------ the roll is saved, clock-proof --- */

{
  // A Baby one minute from Child, poorly cared for.
  const start = chooseEggDoc(doc(), T0, 'village', null, () => 0.123)!;
  const nearChild: PlayStoreDoc = {
    ...start,
    pet: { ...agePet(start.pet, EGG + PET_STAGE_MS.baby - MIN), seen_at: T0 },
  };
  assert.equal(nearChild.pet.stage, 'baby');
  // The reveal lands and is saved (what the store hook does the moment it shows).
  const saved = touchPetForCheck(nearChild, T0 + 2 * MIN);
  assert.equal(saved.pet.stage, 'child');
  const locked = [saved.pet.hero, saved.pet.grade, saved.pet.shiny, saved.pet.band];
  const reloaded = parsePlayStore(JSON.stringify(saved), T0 + 2 * MIN)!;
  // Clock set back before Child, extra care, then forward again: unchanged.
  const rewound = finishPetRound(reloaded, T0 - 5 * MIN, 'catch', { pass: true, quality: 0.9, got: 18, of: 20 }).doc;
  const forward = touchPetForCheck(rewound, T0 + 60 * MIN);
  assert.deepEqual([forward.pet.hero, forward.pet.grade, forward.pet.shiny, forward.pet.band], locked, 'a saved roll never changes');
  // The store hook saves a reveal the moment the view shows it.
  const hook = fs.readFileSync('src/play/use-play-store.ts', 'utf8');
  assert.match(hook, /view\.pet\.state\.reveals\.length > doc\.pet\.reveals\.length/, 'the view-side reveal is saved at once');
}
ok('a revealed roll is saved at once; setting the clock back and adding care never changes it');

console.log(`\ncheck:pet-eggs — ${passed} groups passed.`);
