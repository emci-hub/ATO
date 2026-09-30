/**
 * Dive + Pet main game check (v22, Part B).
 *
 * Pins, against the real code:
 *   - depth loot: tiers sum to 100, every id is a real find, no uniques,
 *     rings only from the Trench down, auras only from the Abyss down, Powers
 *     rise with depth;
 *   - two paths: ±8 points, their tiers, the shown % = the rolled % on both,
 *     and the Lamp preview is exactly what the path gives;
 *   - Net (+1 find only from depth 2+), Oxygen (5th Deeper, 65% table);
 *   - shells: TD campaign +4 / replay +1, gear prices and refusals;
 *   - free dives: only with no charges, keep only shells (fall-off after 10),
 *     mood yes, never Deep, no rescue;
 *   - pantry: max 8 (overflow → 1 shell), eaten only on Feed;
 *   - cosmetics: duplicates → 5 shells, token buys (tints/badges only), wear
 *     rules; Collection: forms recorded, kept through rebirth, seeded on load;
 *   - expedition: a Power when the first roll is under 50%;
 *   - save v21 → v22 opens with safe empty defaults; v22 round-trips;
 *   - TD band: the pounce table is unchanged by Part B.
 *
 * Run: npm run check:dive
 */
import assert from 'node:assert/strict';

import {
  DIVE_GEAR_COST,
  DIVE_TIERS,
  PANTRY_MAX,
  SHELLS_PER_CLEAR,
  SHELLS_PER_REPLAY,
  diveTierRolls,
  findKind,
  freeDiveShells,
  pathBaseBust,
  pathTier,
  tierAt,
} from '../src/play/dive-loot';
import { getItemDef, rollPowerFind } from '../src/play/items';
import { PET_POUNCE_BASE, PET_STAGE_MS, agePet, newPet, type PetState } from '../src/play/pet';
import { EGG_POOLS } from '../src/play/pet-eggs';
import {
  buyCosmetic,
  buyDiveGear,
  defaultPlayStore,
  deeperDive,
  feedFromPantry,
  parsePlayStore,
  playView,
  rebirthPetDoc,
  recordDefendWin,
  sendPetExpedition,
  startDive,
  startFreeDive,
  surfaceDive,
  touchPet,
  wearCosmetic,
  type PlayStoreDoc,
} from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const H = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 8, 30, 12, 0, 0);
const pet = (over: Partial<PetState>): PetState => ({ ...newPet(T0), ...over });
const doc = (over: Partial<PlayStoreDoc> = {}): PlayStoreDoc => ({ ...defaultPlayStore(T0), inventory: [], ...over });
const run = (deepers: number, haul: string[], extra: Partial<NonNullable<PlayStoreDoc['dive_run']>> = {}) => ({
  deepers,
  haul,
  free_n: null,
  next: null,
  ...extra,
});
const bagCount = (d: PlayStoreDoc) => d.inventory.reduce((a, st) => a + st.count, 0);

/* -------------------------------------------------------- depth loot --- */

for (const tier of DIVE_TIERS) {
  const rolls = diveTierRolls(tier);
  assert.equal(rolls.reduce((a, r) => a + r.weight, 0), 100, `${tier} weights sum to 100`);
  for (const r of rolls) {
    assert.notEqual(findKind(r.id), 'unknown', `${tier}: ${r.id} is a real find`);
    assert.ok(!r.id.startsWith('item_uni_'), `${tier}: no uniques`);
  }
}
const has = (tier: (typeof DIVE_TIERS)[number], prefix: string) => diveTierRolls(tier).some((r) => r.id.startsWith(prefix));
assert.ok(!has('shallows', 'cos_ring') && !has('reef', 'cos_ring') && has('trench', 'cos_ring'), 'rings: Trench and deeper only');
assert.ok(!has('trench', 'cos_aura') && has('abyss', 'cos_aura') && has('hadal', 'cos_aura'), 'auras: Abyss and deeper only');
const powerShare = (tier: (typeof DIVE_TIERS)[number]) =>
  diveTierRolls(tier)
    .filter((r) => getItemDef(r.id)?.core.kind === 'power')
    .reduce((a, r) => a + r.weight, 0);
const shares = DIVE_TIERS.map(powerShare);
assert.deepEqual([...shares].sort((a, b) => a - b), shares, `Power share rises with depth (${shares.join(' → ')})`);
assert.deepEqual([0, 1, 2, 3, 4, 5].map(tierAt), ['shallows', 'reef', 'reef', 'trench', 'abyss', 'hadal']);
ok(`depth loot: 5 tiers × 100, real ids, no uniques, rings Trench+, auras Abyss+, Powers ${shares.join('→')}%`);

/* ------------------------------------------------------------- paths --- */

assert.ok(Math.abs(pathBaseBust(0.18, 'safe') - 0.1) < 1e-9 && Math.abs(pathBaseBust(0.18, 'rich') - 0.26) < 1e-9);
assert.equal(pathBaseBust(0.55, 'rich'), 0.63);
assert.equal(pathBaseBust(0.9, 'rich'), 0.9, 'clamped at 90%');
assert.deepEqual([pathTier(1, 'safe', false), pathTier(1, 'rich', false)], ['shallows', 'trench']);
assert.deepEqual([pathTier(4, 'rich', false), pathTier(4, 'rich', true)], ['abyss', 'hadal'], 'Hadal only with Oxygen');
{
  const d = doc({ pet: pet({ stage: 'adult' }), dive_run: run(1, ['food_kelp'], { next: { safe: 'food_kelp', rich: 'shells_5' } }) });
  const v = playView(d, T0).diveRun;
  assert.deepEqual(v.bustPct, { safe: 18, rich: 34 }, 'Deeper #2: 28 ∓ 8, minus 2 Adult points');
  for (const path of ['safe', 'rich'] as const) {
    const pcts: Record<"safe" | "rich", number> = v.bustPct!;
    const shown: number = pcts[path];
    const under = deeperDive(d, T0, path, () => shown / 100 - 1e-9, shown)!;
    assert.ok(under.outcome.busted, `${path}: a roll just under the shown % busts`);
    const at = deeperDive(d, T0, path, () => shown / 100, shown)!;
    assert.ok(!at.outcome.busted && !at.outcome.changed, `${path}: a roll at the shown % is safe`);
    assert.equal((at.outcome as { addedId: string }).addedId, d.dive_run!.next![path], `${path}: the pre-rolled find is what lands`);
  }
  assert.equal(v.preview, null, 'no Lamp → no preview');
  const lit = playView({ ...d, dive_gear: { lamp: true, net: false, oxygen: false } }, T0).diveRun;
  assert.deepEqual(lit.preview, { safe: 'food_kelp', rich: 'shells_5' }, 'Lamp → the exact next finds');
}
ok('two paths: ±8 points and ±1 tier, both shown % = rolled %, Lamp preview = what lands');

/* ------------------------------------------------------ Net + Oxygen --- */

{
  const netOn = { lamp: false, net: true, oxygen: false };
  const at1 = surfaceDive(doc({ dive_gear: netOn, dive_run: run(1, ['item_leaf_cape_01', 'item_leaf_cape_01']) }), T0)!;
  assert.equal(at1.netFind, null, 'Net: nothing from depth 1');
  const at2 = surfaceDive(doc({ dive_gear: netOn, dive_run: run(2, ['a', 'b', 'c'].map(() => 'item_leaf_cape_01')) }), T0, () => 0)!;
  assert.ok(at2.netFind, 'Net: +1 find from depth 2');
  assert.equal(at2.banked.length, 4);
  const noNet = surfaceDive(doc({ dive_run: run(3, ['item_leaf_cape_01']) }), T0)!;
  assert.equal(noNet.netFind, null, 'no Net owned → nothing extra');
  const four = doc({ dive_run: run(4, ['food_kelp']) });
  assert.equal(deeperDive(four, T0, 'safe'), null, 'without Oxygen, 4 Deepers is the max');
  assert.equal(playView(four, T0).diveRun.maxDeepers, 4);
  const oxy = { ...four, dive_gear: { lamp: false, net: false, oxygen: true } };
  const v = playView(oxy, T0).diveRun;
  assert.equal(v.maxDeepers, 5);
  assert.deepEqual(v.bustPct, { safe: 57, rich: 73 }, 'Deeper #5: 65 ∓ 8');
}
ok('Net: +1 find only from depth 2; Oxygen: a 5th Deeper at 65% (57/73 by path)');

/* ------------------------------------------------------------ shells --- */

{
  const child = doc({ pet: pet({ stage: 'child' }) });
  const camp = recordDefendWin(child, { phase: 'trial', wave: 1, mode: 'campaign' }, T0, () => 0.99);
  assert.equal(camp.doc.shells, SHELLS_PER_CLEAR);
  assert.equal(camp.result.shellsGranted, 4);
  const rep = recordDefendWin(child, { phase: 'trial', wave: 1, mode: 'replay' }, T0, () => 0.99);
  assert.equal(rep.doc.shells, SHELLS_PER_REPLAY);
  assert.deepEqual(buyDiveGear(doc({ shells: 59 }), 'lamp').result, { ok: false, reason: 'shells' });
  const bought = buyDiveGear(doc({ shells: 60 }), 'lamp');
  assert.ok(bought.result.ok && bought.doc.shells === 0 && bought.doc.dive_gear.lamp);
  assert.deepEqual(buyDiveGear(bought.doc, 'lamp').result, { ok: false, reason: 'owned' });
  assert.deepEqual(DIVE_GEAR_COST, { lamp: 60, net: 150, oxygen: 300 });
  assert.deepEqual(buyDiveGear(doc({ shells: 999, dive_run: run(3, ['food_kelp']) }), 'oxygen').result, { ok: false, reason: 'diving' }, 'no gear bought mid-dive');
}
ok('shells: TD campaign +4 / replay +1; Lamp 60 · Net 150 · Oxygen 300; refused when short or owned');

/* -------------------------------------------------------- free dives --- */

{
  const empty = doc({ dive_charge: 0, dive_charge_at: T0, pet: pet({ stage: 'teen', mood: 1 }) });
  assert.equal(startFreeDive(doc(), T0), null, 'no free dive while a charge is left');
  const started = startFreeDive(empty, T0, () => 0.5)!;
  assert.equal(started.doc.dive_run!.free_n, 0);
  assert.equal(started.doc.free_dives_today, 1);
  const deep3 = { ...started.doc, dive_run: { ...started.doc.dive_run!, deepers: 3, haul: ['item_tide_blade_01', 'food_shrimp', 'cos_ring_thick', 'shells_12'] } };
  const up = surfaceDive(deep3, T0)!;
  assert.ok(up.free);
  assert.equal(bagCount(up.doc), 0, 'free: no gear kept');
  assert.deepEqual(up.doc.pet_pantry, {}, 'free: no food kept');
  assert.deepEqual(up.doc.pet_cosmetics, [], 'free: no cosmetics kept');
  assert.equal(up.doc.shells, freeDiveShells(3, 0), 'free: only the free-dive shells');
  assert.equal(up.doc.pet.mood, 3, 'free: +2 mood');
  assert.equal(up.doc.pet.deep_surfaces, 0, 'free dives never count toward Deep');
  const eggUp = surfaceDive({ ...empty, pet: newPet(T0), dive_run: run(3, ['food_kelp'], { free_n: 0 }) }, T0)!;
  assert.equal(eggUp.petCared, false, 'an egg on a free dive: no mood claimed');
  assert.equal(freeDiveShells(2, 0), 4);
  assert.equal(freeDiveShells(2, 9), 4, 'the 10th free dive still pays full');
  assert.equal(freeDiveShells(2, 10), 3, 'the 11th pays ×0.7');
  assert.equal(freeDiveShells(2, 20), 0, 'and it falls to nothing');
  const bust = deeperDive({ ...started.doc, pet: pet({ stage: 'god', mood: 1 }), dive_run: run(1, ['item_tide_blade_01'], { free_n: 0 }) }, T0, 'safe', () => 0)!;
  assert.ok(bust.outcome.busted && bust.outcome.rescued.length === 0, 'free: no rescue');
  assert.equal(bagCount(bust.doc), 0);
}
ok('free dives: only with no charges; only shells kept (full ×10, then ×0.7); +2 mood; never Deep; no rescue');

/* ------------------------------------------------------------ pantry --- */

{
  const hungry = pet({ stage: 'teen', hunger: 1 });
  const surfaced = surfaceDive(doc({ pet: hungry, dive_run: run(0, ['food_kelp']) }), T0)!.doc;
  assert.equal(surfaced.pet_pantry.food_kelp, 1, 'food goes to the pantry');
  assert.equal(surfaced.pet.hunger, 1, 'it is not eaten until you tap Feed');
  const fed = feedFromPantry(surfaced, T0, 'food_kelp')!;
  assert.equal(fed.pet.hunger, 2);
  assert.equal(fed.pet_pantry.food_kelp, 0);
  assert.equal(feedFromPantry(fed, T0, 'food_kelp'), null, 'none left');
  assert.equal(feedFromPantry(doc({ pet: pet({ stage: 'teen', hunger: 4 }), pet_pantry: { food_kelp: 1 } }), T0, 'food_kelp'), null, 'full → refused');
  assert.equal(feedFromPantry(doc({ pet: newPet(T0), pet_pantry: { food_kelp: 1 } }), T0, 'food_kelp'), null, 'egg → refused');
  const away = sendPetExpedition(doc({ pet: pet({ stage: 'teen', hunger: 1, total_age_ms: 60 * H }), pet_pantry: { food_kelp: 1 } }), T0).doc;
  assert.equal(feedFromPantry(away, T0 + 60_000, 'food_kelp'), null, 'away → refused');
  const full = doc({ pet_pantry: { food_kelp: PANTRY_MAX }, dive_run: run(0, ['food_shrimp', 'food_kelp']) });
  const over = surfaceDive(full, T0)!;
  assert.equal(over.doc.pet_pantry.food_kelp, PANTRY_MAX, 'the pantry holds at most 8');
  assert.equal(over.shellsGained, 2, 'each food that does not fit is 1 shell');
}
ok('pantry: max 8 (overflow → 1 shell), eaten only on Feed; refused when full, empty, egg or away');

/* --------------------------------------------------------- cosmetics --- */

{
  const first = surfaceDive(doc({ dive_run: run(3, ['cos_ring_thick']) }), T0)!.doc;
  assert.deepEqual(first.pet_cosmetics, ['cos_ring_thick']);
  const dupe = surfaceDive({ ...first, dive_run: run(3, ['cos_ring_thick']) }, T0)!;
  assert.equal(dupe.shellsGained, 5, 'a duplicate cosmetic is 5 shells');
  assert.deepEqual(buyCosmetic(doc({ tokens: 500 }), 'cos_ring_thick').result, { ok: false, reason: 'not_for_sale' }, 'rings are Dive-only');
  assert.deepEqual(buyCosmetic(doc({ tokens: 59 }), 'cos_tint_ice').result, { ok: false, reason: 'tokens' });
  const tint = buyCosmetic(doc({ tokens: 60 }), 'cos_tint_ice');
  assert.ok(tint.result.ok && tint.doc.tokens === 0, 'a tint costs 60 tokens');
  assert.equal(wearCosmetic(tint.doc, 'ring', 'cos_tint_ice'), null, 'wrong slot refused');
  assert.equal(wearCosmetic(tint.doc, 'tint', 'cos_tint_gold'), null, 'not owned refused');
  const worn = wearCosmetic(tint.doc, 'tint', 'cos_tint_ice')!;
  assert.equal(worn.pet_wear.tint, 'cos_tint_ice');
  assert.equal(wearCosmetic(worn, 'tint', null)!.pet_wear.tint, null, 'and it comes off');
}
ok('cosmetics: found → owned, duplicate → 5 shells; tints/badges for tokens, rings/auras Dive-only; wear rules');

/* -------------------------------------------------------- Collection --- */

{
  const baby = pet({ stage: 'baby', egg: 'knight', seed: 123, line: 'line_knight', stage_age_ms: PET_STAGE_MS.baby - 1, mood: 4, hunger: 4 });
  const child = agePet(baby, 1);
  assert.deepEqual(child.forms, ['standard'], 'Baby → Child records its form');
  assert.ok(child.hero != null && EGG_POOLS.knight.includes(child.hero), 'the hero comes from the Knight pool');
  const hero = child.hero!;
  const d = doc({ pet: { ...child, stage: 'god' } });
  assert.equal(playView(d, T0).pet.heroes[hero]?.copies, 1, 'the live pet counts in the Collection');
  const reborn = rebirthPetDoc(d, T0)!;
  assert.equal(reborn.pet_heroes[hero]?.copies, 1, 'kept through rebirth');
  assert.deepEqual(reborn.pet_heroes[hero]?.forms, ['standard']);
  assert.equal(reborn.pet.egg, null, 'back to the egg picker');
  assert.deepEqual(reborn.pet.forms, [], 'the next pet starts empty');
}
ok('Collection (v23): per hero; forms recorded from Child; kept through rebirth');

/* -------------------------------------------------------- expedition --- */

{
  const out = sendPetExpedition(doc({ pet: pet({ stage: 'child', total_age_ms: 20 * H }) }), T0).doc;
  const back = touchPet(out, T0 + H, () => 0.1);
  assert.equal(getItemDef(back.pet_expedition_note!)?.core.kind, 'power', 'first roll under 50% → a Power');
  assert.equal(back.pet_expedition_note, rollPowerFind(() => 0.1));
  const shallow = touchPet(out, T0 + H, () => 0.9);
  assert.notEqual(findKind(shallow.pet_expedition_note!), 'unknown', 'otherwise a Shallows find');
}
ok('expedition: a Power half the time, else a Shallows find');

/* -------------------------------------------------------------- save --- */

{
  const v21: Record<string, unknown> = {
    ...defaultPlayStore(T0),
    version: 21,
    pet: { ...pet({ stage: 'teen', branch: 'battle' }) },
    pet_hall: [{ line: 'solo_raven', branch: 'deep', aura: null, rebirth: 1, days: 10 }],
    dive_run: { deepers: 2, haul: ['item_leaf_cape_01'] },
  };
  for (const k of ['shells', 'dive_gear', 'pet_pantry', 'pet_cosmetics', 'pet_wear', 'pet_heroes', 'pet_shards', 'pet_tickets', 'free_dives_today', 'free_dives_ymd']) delete v21[k];
  for (const k of ['egg', 'seed', 'ticket', 'warmth', 'warmth_acc_ms', 'warm_ms', 'care_skill', 'care_acts', 'hero', 'grade', 'shiny', 'band', 'reveals']) {
    delete (v21.pet as Record<string, unknown>)[k];
  }
  delete (v21.pet as Record<string, unknown>).forms;
  const up = parsePlayStore(JSON.stringify(v21), T0)!;
  assert.equal(up.version, 24);
  assert.deepEqual(
    [up.shells, up.dive_gear, up.pet_pantry, up.pet_cosmetics, up.pet_wear, up.free_dives_today, up.free_dives_ymd],
    [0, { lamp: false, net: false, oxygen: false }, {}, [], { badge: null, tint: null, ring: null, aura: null }, 0, null],
    'a v21 save opens with safe empty defaults',
  );
  assert.equal(up.pet_heroes.raven?.copies, 1, 'the Collection is seeded from the Hall');
  assert.deepEqual(up.pet_heroes.raven?.forms, ['deep']);
  assert.deepEqual(up.pet.forms, ['battle'], 'and the live pet is credited for its current form');
  assert.deepEqual(up.dive_run, { deepers: 2, haul: ['item_leaf_cape_01'], free_n: null, next: null }, 'an old run stays a charged run');
  const full: PlayStoreDoc = {
    ...up,
    shells: 77,
    dive_gear: { lamp: true, net: false, oxygen: true },
    pet_pantry: { food_kelp: 3, food_shrimp: 1 },
    pet_cosmetics: ['cos_tint_ice', 'cos_ring_thick'],
    pet_wear: { badge: null, tint: 'cos_tint_ice', ring: 'cos_ring_thick', aura: null },
    pet_heroes: { raven: { copies: 2, shinies: 1, grades: ['common', 'epic'], forms: ['deep', 'bright'], dye: true } },
    pet_shards: { common: 3, rare: 0, epic: 1, legendary: 0 },
    pet_tickets: { common: 0, rare: 1, epic: 0, legendary: 0 },
    free_dives_today: 4,
    free_dives_ymd: '2026-09-30',
    dive_run: { deepers: 1, haul: ['food_kelp'], free_n: 3, next: { safe: 'shells_3', rich: 'cos_ring_double' } },
  };
  assert.deepEqual(parsePlayStore(JSON.stringify(full), T0), full, 'v24 round-trips unchanged');
  const bad = parsePlayStore(JSON.stringify({ ...full, pet_pantry: { food_kelp: 50 }, pet_wear: { tint: 'cos_tint_gold' } }), T0)!;
  assert.equal(bad.pet_pantry.food_kelp, PANTRY_MAX, 'an oversized pantry is capped on load');
  assert.equal(bad.pet_wear.tint, null, 'wearing something not owned is dropped on load');
}
ok('save v21 → v23: safe empty defaults, Collection seeded, old run kept; v23 round-trips; bad values cleaned');

/* ----------------------------------------------------------- TD band --- */

assert.deepEqual(PET_POUNCE_BASE, { egg: 0, baby: 0, child: 4.5, teen: 5.5, adult: 6.5, god: 7.5 }, 'Part B leaves the pounce alone');
{
  // A charged dive start/deeper/surface never changes anything TD reads
  // except the bag (gear stays under the same slots + soft cap).
  const before = doc({ pet: pet({ stage: 'god' }) });
  const started = startDive(before, T0, () => 0.5)!.doc;
  assert.deepEqual(
    [started.avatars, started.campaign, started.pet_rebirths, started.cycle_power],
    [before.avatars, before.campaign, before.pet_rebirths, before.cycle_power],
  );
}
ok('TD band: pounce table unchanged; Dive touches no TD state beyond the bag');

console.log(`\ncheck:dive — ${passed} groups passed.`);
