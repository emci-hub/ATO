/**
 * Den checks (v27, Part D · T-D7). Run: npm run check:den
 *
 *   1. Slots: 6 to start (the active pet counts), 7th 100 … 12th 750, 12 max.
 *   2. Resting pets are frozen: no aging, hunger/mood loss, care mistakes or
 *      warmth loss, however long — only the active pet ever ages.
 *   3. Waking a pet: `seen_at = max(now, seen_at)` (no time passed while it
 *      rested, and a clock set back adds none); before Child it takes the
 *      pity position as of now.
 *   4. Swap refused mid-dive, while away on an expedition, while a mini-game
 *      is open, and while a paid-for egg is waiting to be picked. A swap
 *      never touches per-player state (buffs, ladder, tokens, records, pity).
 *   5. New egg needs a free slot; full → refused; buying slots; release.
 *   6. Resting pets count in the Collection.
 *   7. Old saves: the v26 pet → active slot 1, Den empty, 6 slots, nothing
 *      lost; broken Den rows (blanks, duplicate ids, too many) are repaired.
 *   8. The Den lists static figures only, and lives only in the Pet room.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEN_MAX_SLOTS,
  DEN_SLOT_PRICES,
  DEN_START_SLOTS,
  clampDenSlots,
  denSlotPrice,
  denSwapBlock,
  sortDen,
  wakePet,
} from '../src/play/den';
import { PET_STAGE_MS, newPet, type PetState } from '../src/play/pet';
import { seededRng } from '../src/play/pet-eggs';
import {
  activateDenPet,
  buyDenSlot,
  changeEggDoc,
  chooseEggDoc,
  defaultPlayStore,
  devFillDen,
  devGrantAllBuffs,
  devPetEndStage,
  devPetSetStage,
  newEggDoc,
  parsePlayStore,
  playView,
  releaseDenPet,
  renameDenPet,
  sendPetExpedition,
  setPetFav,
  startDive,
  touchPet,
  type PlayStoreDoc,
} from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const ROOT = path.join(__dirname, '..');
const T0 = new Date(2026, 9, 1, 12, 0, 0).getTime();
const MIN = 60_000;
const H = 60 * MIN;
const D = 24 * H;
const rng = seededRng(2701);
/** After `base` has been touched through three days. */
const LATE = T0 + 3 * D + H;

function pick(doc: PlayStoreDoc, now: number, egg: 'knight' | 'wizard' | 'village' = 'knight'): PlayStoreDoc {
  const next = chooseEggDoc(doc, now, egg, null, rng);
  assert.ok(next, 'the egg pick goes through');
  return next;
}
function revealActive(doc: PlayStoreDoc, now: number): PlayStoreDoc {
  return devPetEndStage(devPetEndStage(doc, now, 'egg'), now, 'baby');
}

/* --------------------------------------------------------------- 1. slots --- */

{
  assert.equal(DEN_START_SLOTS, 6);
  assert.deepEqual([...DEN_SLOT_PRICES], [100, 150, 225, 340, 500, 750]);
  assert.equal(DEN_MAX_SLOTS, 12);
  assert.deepEqual([6, 7, 8, 9, 10, 11, 12].map(denSlotPrice), [100, 150, 225, 340, 500, 750, null]);
  assert.equal(clampDenSlots(3), 6);
  assert.equal(clampDenSlots(99), 12);
  assert.equal(clampDenSlots('x'), 6);
  const fresh = defaultPlayStore(T0);
  assert.equal(fresh.den_slots, 6);
  assert.deepEqual(fresh.pet_den, []);
  const v = playView(fresh, T0).pet.den;
  assert.equal(v.used, 1, 'the active pet counts as one slot');
  assert.equal(v.nextSlotPrice, 100);

  let doc: PlayStoreDoc = { ...fresh, shells: 10_000 };
  for (const price of DEN_SLOT_PRICES) {
    const before = doc.shells;
    const r = buyDenSlot(doc);
    assert.ok(r.result.ok);
    assert.equal(before - r.doc.shells, price, `slot ${r.doc.den_slots} costs ${price}`);
    doc = r.doc;
  }
  assert.equal(doc.den_slots, 12);
  assert.deepEqual(buyDenSlot(doc).result, { ok: false, reason: 'max' });
  const poor = buyDenSlot({ ...fresh, shells: 99 });
  assert.deepEqual(poor.result, { ok: false, reason: 'shells' });
  assert.equal(poor.doc.shells, 99, 'a refused slot costs nothing');
}
ok('slots: 6 to start (active counts), 7th 100 … 12th 750, 12 max; short of shells refused at no cost');

/* -------------------------------------------------------- 2. frozen pets --- */

let base = pick(defaultPlayStore(T0), T0, 'knight');
assert.equal(base.pet.uid, 1, 'the first pet gets id 1');
{
  const egg = base.pet;
  const r = newEggDoc(base, T0 + MIN);
  assert.ok(r.result.ok);
  assert.equal(r.doc.pet_den.length, 1);
  assert.equal(r.doc.pet.egg, null, 'the new active pet is an empty picker');
  let doc = pick(r.doc, T0 + MIN, 'wizard');
  assert.equal(doc.pet.uid, 2);
  const resting = doc.pet_den[0];
  assert.equal(resting.uid, egg.uid);
  // Three days pass (hours of touches, dives of time) — the resting egg is unchanged.
  for (let t = T0 + H; t <= T0 + 3 * D; t += 6 * H) doc = touchPet(doc, t);
  assert.deepEqual(doc.pet_den[0], resting, 'a resting egg is frozen: no aging, no warmth lost');
  assert.notEqual(doc.pet.stage_age_ms, 0, 'the active pet aged');

  // A revealed pet resting: no hunger / mood loss, no care mistakes.
  let grown = revealActive(pick(defaultPlayStore(T0), T0), T0 + MIN);
  grown = devPetSetStage(grown, T0 + MIN, 'adult');
  const r2 = newEggDoc(grown, T0 + 2 * MIN);
  assert.ok(r2.result.ok);
  // Aged up to the moment it went to rest, then never again.
  const adult = r2.doc.pet_den.find((p) => p.uid === grown.pet.uid)!;
  assert.equal(adult.stage, 'adult');
  let later = r2.doc;
  for (let t = T0 + H; t <= T0 + 5 * D; t += 12 * H) later = touchPet(later, t);
  const frozen = later.pet_den.find((p) => p.uid === adult.uid)!;
  assert.equal(frozen.hunger, adult.hunger, 'no hunger lost');
  assert.equal(frozen.mood, adult.mood, 'no mood lost');
  assert.equal(frozen.care_mistakes, adult.care_mistakes, 'no care mistakes');
  assert.equal(frozen.total_age_ms, adult.total_age_ms, 'no growth');
  assert.equal(frozen.stage, adult.stage);
  assert.deepEqual(frozen, adult, 'nothing about it changed');
  base = doc;
}
ok('frozen: resting eggs and pets never age, lose hunger/mood/warmth or make care mistakes (days of touches)');

/* --------------------------------------------------------------- 3. wake --- */

{
  const later = T0 + 3 * D;
  const r = activateDenPet(base, later, 1);
  assert.ok(r.result.ok);
  const woke = r.doc.pet;
  assert.equal(woke.uid, 1);
  assert.equal(woke.seen_at, later, 'seen_at moves to now: no time passed while resting');
  assert.equal(woke.stage_age_ms, base.pet_den[0].stage_age_ms, 'no age added at wake');
  assert.ok(r.doc.pet_den.some((p) => p.uid === 2), 'the old active pet rests');
  const aMin = touchPet(r.doc, later + MIN).pet;
  assert.ok(aMin.stage_age_ms - woke.stage_age_ms <= MIN, 'after waking it ages only from now');
  // A clock set back: seen_at never moves back (no time added either).
  const pet: PetState = { ...newPet(T0), seen_at: T0 + D };
  assert.equal(wakePet(pet, T0, 0).seen_at, T0 + D);
  // Before Child the pity position is re-stamped to the counter now.
  const stamped = activateDenPet({ ...base, eggs_since_legendary: 17 }, later, 1);
  assert.equal(stamped.doc.pet.pity_from, 17, 'an egg woken takes today’s pity position');
  const child: PetState = { ...newPet(T0), stage: 'child', hero: 'oni', grade: 'rare', pity_from: 3 };
  assert.equal(wakePet(child, T0, 30).pity_from, 3, 'a revealed pet keeps its stamp (already rolled)');
}
ok('wake: seen_at = max(now, seen_at); ages only from now; pre-Child pets take the pity counter now');

/* -------------------------------------------------------- 4. swap blocks --- */

{
  // A fresh pair: a Knight egg resting (id 1), a Wizard egg active (id 2).
  const pair = pick(newEggDoc(pick(defaultPlayStore(T0), T0, 'knight'), T0).doc, T0, 'wizard');
  assert.deepEqual([pair.pet.uid, ...pair.pet_den.map((p) => p.uid)], [2, 1]);
  const t = T0 + 30_000;
  // Mid-dive.
  let doc = pair;
  const dive = startDive(doc, t, rng);
  assert.ok(dive, 'a dive starts');
  const diving = activateDenPet(dive.doc, t, 1);
  assert.deepEqual(diving.result, { ok: false, reason: 'diving' });
  assert.deepEqual(diving.doc.pet_den.map((p) => p.uid), dive.doc.pet_den.map((p) => p.uid));
  assert.deepEqual(newEggDoc(dive.doc, t).result, { ok: false, reason: 'diving' });

  // A mini-game open (UI state).
  assert.deepEqual(activateDenPet(pair, t, 1, true).result, { ok: false, reason: 'game' });
  assert.deepEqual(newEggDoc(pair, t, true).result, { ok: false, reason: 'game' });

  // Away on an expedition.
  doc = revealActive(pair, t);
  const sent = sendPetExpedition(doc, t);
  assert.ok(sent.result.ok, 'the Child goes on a trip');
  const away = activateDenPet(sent.doc, t + 10_000, 1);
  assert.deepEqual(away.result, { ok: false, reason: 'away' });
  assert.equal(away.doc.pet.uid, 2, 'the active pet is still the one away');

  // A paid-for egg waiting in the picker ("Change egg").
  const changed = changeEggDoc(pair, t)!;
  assert.ok(changed.pet.prepaid && changed.pet.egg == null);
  assert.deepEqual(activateDenPet(changed, t, 1).result, { ok: false, reason: 'pick_egg' });
  assert.deepEqual(newEggDoc(changed, t).result, { ok: false, reason: 'pick_egg' });

  // An unpaid empty picker is just closed on a swap (no slot used by it).
  const blank = newEggDoc(pair, t);
  assert.ok(blank.result.ok);
  const swapped = activateDenPet(blank.doc, t, 1);
  assert.ok(swapped.result.ok);
  assert.ok(swapped.doc.pet_den.every((p) => p.egg != null), 'no blank goes into the Den');

  assert.equal(denSwapBlock({ diving: false, away: false, gameOpen: false, active: pair.pet }), null);
}
ok('swap blocked mid-dive, while away, while a mini-game is open, and while a paid egg waits; refusals change nothing');

{
  // Per-player state rides through a swap untouched.
  const rich: PlayStoreDoc = {
    ...devGrantAllBuffs(base),
    tokens: 77,
    pet_tokens_today: 15,
    pet_expedition_steps: 3,
    eggs_since_legendary: 12,
    shine_stones: 4,
    glimmers: 2,
  };
  const r = activateDenPet(rich, LATE, 1);
  assert.ok(r.result.ok);
  for (const k of ['buffs', 'tokens', 'pet_tokens_today', 'pet_expedition_steps', 'game_records', 'eggs_since_legendary', 'shine_stones', 'glimmers', 'daily_games'] as const) {
    assert.deepEqual(r.doc[k], rich[k], `a swap never touches ${k}`);
  }
}
ok('a swap never touches buffs, the expedition ladder, tokens, records, pity or Stones');

/* ---------------------------------------------- 5. full / release / rename --- */

{
  const full = devFillDen(base, LATE, rng);
  assert.equal(full.pet_den.length + 1, full.den_slots, 'Fill Den fills every free slot');
  assert.deepEqual(newEggDoc(full, LATE).result, { ok: false, reason: 'full' });
  assert.equal(playView(full, LATE).pet.den.used, DEN_START_SLOTS);
  const bought = buyDenSlot({ ...full, shells: 500 });
  assert.ok(bought.result.ok);
  assert.ok(newEggDoc(bought.doc, LATE).result.ok, 'a bought slot makes room');

  const child = full.pet_den[full.pet_den.length - 1];
  assert.equal(child.stage, 'child');
  const released = releaseDenPet(full, LATE, child.uid)!;
  assert.ok(released, 'a resting Child can be released');
  assert.equal(released.pet_den.length, full.pet_den.length - 1);
  assert.equal(released.pet_hall.length, full.pet_hall.length + 1, 'it goes to the Hall');
  assert.equal(released.pet_shards[child.grade!], full.pet_shards[child.grade!] + 1, 'and leaves a shard');
  assert.ok(released.pet_heroes[child.hero!]?.copies >= 1, 'and stays in the Collection');
  assert.equal(releaseDenPet(full, LATE, 1), null, 'a resting egg can’t be released');
  assert.equal(releaseDenPet(full, LATE, 999), null);

  const named = renameDenPet(full, LATE, child.uid, 'Pip')!;
  assert.equal(named.pet_den.find((p) => p.uid === child.uid)!.name, 'Pip');
  assert.equal(named.pet_den.find((p) => p.uid === child.uid)!.total_age_ms, child.total_age_ms, 'renaming never ages it');
  const fav = setPetFav(full, LATE, child.uid, true)!;
  assert.equal(sortDen(fav.pet_den, 'recent')[0].uid, child.uid, 'favourites sort first');
  const byGrade = sortDen(full.pet_den, 'grade');
  for (let i = 1; i < byGrade.length; i += 1) {
    const g = (p: PetState) => ['common', 'rare', 'epic', 'legendary'].indexOf(p.grade ?? '');
    assert.ok(g(byGrade[i - 1]) >= g(byGrade[i]), 'grade sort: best first');
  }
}
ok('full Den refuses a new egg; a bought slot makes room; release → Hall + shard + Collection; rename / ★ / sort');

/* ---------------------------------------------------- 6. the Collection --- */

{
  const grown = revealActive(pick(defaultPlayStore(T0), T0, 'village'), T0 + MIN);
  const hero = grown.pet.hero!;
  const r = newEggDoc(grown, T0 + 2 * MIN);
  assert.ok(r.result.ok);
  const v = playView(r.doc, T0 + 2 * MIN);
  assert.ok((v.pet.heroes[hero]?.copies ?? 0) >= 1, 'a resting pet counts in the Collection');
  assert.ok(v.pet.heroes[hero].grades.includes(grown.pet.grade!), 'with its grade');
}
ok('resting pets count in the Collection (copies, grades)');

/* ------------------------------------------------------ 7. old saves --- */

{
  const v27 = revealActive(pick(defaultPlayStore(T0), T0), T0 + MIN);
  const raw = JSON.parse(JSON.stringify(v27)) as Record<string, unknown>;
  raw.version = 26;
  for (const k of ['pet_den', 'den_slots', 'pet_uid_next', 'eggs_today', 'eggs_ymd', 'eggs_since_legendary', 'shine_stones', 'glimmers', 'stones_used', 'stone_seq', 'prism_stones', 'shop_weekly']) delete raw[k];
  const pet = raw.pet as Record<string, unknown>;
  for (const k of ['uid', 'pity_from', 'shiny_style', 'glimmer', 'fav', 'prepaid']) delete pet[k];
  const up = parsePlayStore(JSON.stringify(raw), T0 + MIN)!;
  assert.ok(up, 'a v26 save loads');
  assert.equal(up.version, 27);
  assert.deepEqual(up.pet_den, [], 'Den empty');
  assert.equal(up.den_slots, DEN_START_SLOTS, '6 slots');
  assert.equal(up.pet.uid, 1, 'the current pet is active in slot 1');
  assert.equal(up.pet_uid_next, 2);
  for (const k of ['hero', 'grade', 'shiny', 'stage', 'total_age_ms', 'hunger', 'mood', 'seed', 'egg', 'forms'] as const) {
    assert.deepEqual(up.pet[k], v27.pet[k], `the pet's ${k} is kept`);
  }
  assert.deepEqual(up.pet_hall, v27.pet_hall, 'Hall unchanged');
  assert.deepEqual(up.pet_heroes, v27.pet_heroes, 'Collection unchanged');
  assert.equal(up.eggs_since_legendary, 0, 'pity starts at 0');
  assert.equal(up.shells, v27.shells);
  // A blank picker on a v26 save keeps uid 0 (nothing to number yet).
  const blankRaw = JSON.parse(JSON.stringify(defaultPlayStore(T0))) as Record<string, unknown>;
  blankRaw.version = 26;
  delete blankRaw.pet_den;
  assert.equal(parsePlayStore(JSON.stringify(blankRaw), T0)!.pet.egg, null);

  // Broken Den rows: blanks dropped, duplicate / missing ids renumbered, at most 11 resting.
  const full = devFillDen({ ...v27, den_slots: 12 }, T0 + MIN, rng);
  const broken = JSON.parse(JSON.stringify(full)) as Record<string, unknown>;
  const rows = broken.pet_den as Record<string, unknown>[];
  rows[1].uid = rows[0].uid;
  rows[2].uid = 0;
  rows.push({ ...rows[3] }, JSON.parse(JSON.stringify(newPet(T0))));
  broken.den_slots = 3;
  const fixed = parsePlayStore(JSON.stringify(broken), T0 + MIN)!;
  const uids = [fixed.pet.uid, ...fixed.pet_den.map((p) => p.uid)];
  assert.equal(new Set(uids).size, uids.length, 'every pet has its own id');
  assert.ok(uids.every((u) => u > 0));
  assert.ok(fixed.pet_uid_next > Math.max(...uids), 'the next id is past every id');
  assert.ok(fixed.pet_den.length <= DEN_MAX_SLOTS - 1, 'at most 11 resting');
  assert.ok(fixed.pet_den.every((p) => p.egg != null), 'blank rows dropped');
  assert.ok(fixed.den_slots >= fixed.pet_den.length + 1, 'slots never below the pets kept (nothing lost)');
  assert.deepEqual(parsePlayStore(JSON.stringify(fixed), T0 + MIN), fixed, 'v27 round-trips');
}
ok('old saves: v26 pet → active slot 1, Den empty, 6 slots, nothing lost; broken Den rows repaired; v27 round-trips');

/* ----------------------------------------------- 8. static + Pet room only --- */

{
  const sheet = fs.readFileSync(path.join(ROOT, 'src/play/den-sheet.tsx'), 'utf8');
  assert.ok(sheet.includes('<PetFigure'), 'the Den draws PetFigure');
  assert.ok(!/PetAnimSprite|usePetArt/.test(sheet), 'no animated sprites in the Den list');
  const users = ['src/app/play.tsx', ...fs.readdirSync(path.join(ROOT, 'src/play')).map((f) => `src/play/${f}`)]
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('den-sheet.tsx'))
    .filter((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('<DenSheetBody'));
  assert.deepEqual(users, ['src/play/pet-screen.tsx'], 'the Den opens only from the Pet room (TD can’t run at the same time)');
  assert.ok(PET_STAGE_MS.egg > 0);
}
ok('the Den lists static figures only and opens only from the Pet room');

console.log(`\ncheck:den — ${passed} groups passed.`);
