/**
 * Per-hero Locker (pet team roadmap P6, emci 2026-10-18).
 * Run: npm run check:locker-per-hero
 *
 * - Old saves: the ACTIVE Legend's worn gear lands on the Turf leader's hero; every other Legend's worn gear
 *   goes back to the bag (a Legend has no hero, so no guessed mapping); a slot the leader already wears keeps
 *   its item and the older one goes to the bag. A move, never a copy: total owned is unchanged, nothing is
 *   lost, the Legend records end empty, it runs once, and the save stays v33 (additive fields only).
 * - Equip / unequip / merge act on the DRESSED hero (the Locker's pick, default the leader), never a Legend;
 *   an unowned hero cannot be picked; the bag stays shared and every count includes every hero's gear.
 * - The view carries the leader's, the helper's and the dressed hero's sums apart; the Hideout badge reads
 *   the per-hero worn count.
 * - Turf: the leader's gear still boosts the whole board; the helper's own gear scales only the helper's
 *   hits and skill (×1 with none, never below ×1).
 * - Wired: the Locker's hero picker, the leader sums in the Turf buckets, the helper's gear in the team
 *   spec, and a fixed-height gear chip inside the Hideout name-tag row.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { BOARD_MAPS } from '../src/play/board-data';
import { createDefendLive, helperUnitId, placeTurfTeam, puffPosition, stepDefendLive, type DefendLive, type Puff } from '../src/play/defend';
import { getItemDef } from '../src/play/items';
import type { PetState } from '../src/play/pet';
import {
  bagItemCount,
  canMergeWorn,
  defaultAvatarRecord,
  defaultPlayStore,
  equipItem,
  equippedStatSums,
  foldGearIntoHeroes,
  helperHeroIdOf,
  heroLoadoutOf,
  leaderLoadoutOf,
  lockerHeroIdOf,
  mergeItem,
  normalizedAvatarHeroId,
  ownedCountsAcross,
  parsePlayStore,
  playView,
  setLockerHero,
  totalOwnedAcrossAvatars,
  unequipItem,
  wornItemCount,
  type ItemRef,
  type PlayStoreDoc,
} from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');

const T = Date.UTC(2026, 9, 18, 9, 0, 0);
const BLADE = 'item_tide_blade_01';
const AEGIS = 'item_bark_aegis_01';
const KEEPER = 'item_copper_keeper_01';
const CLOAK = 'item_curator_cloak_01';
for (const id of [BLADE, AEGIS, KEEPER, CLOAK]) assert.ok(getItemDef(id), `item ${id} exists`);
const slotOf = (id: string) => getItemDef(id)!.core.slot;
const ref = (id: string, star = 0): ItemRef => ({ id, star });
const reload = (d: PlayStoreDoc): PlayStoreDoc => {
  const parsed = parsePlayStore(JSON.stringify(d), T);
  assert.ok(parsed, 'the save parses');
  return parsed;
};
const count = (d: PlayStoreDoc, id: string, star = 0) => d.inventory.find((s) => s.id === id && s.star === star)?.count ?? 0;

/** A save as P5b left it: gear worn on Legend records, no hero_gear / gear_moved. */
function oldSave(): PlayStoreDoc {
  return {
    ...defaultPlayStore(T),
    gear_moved: false,
    hero_gear: {},
    avatars: [
      { ...defaultAvatarRecord('legend_root'), equipped: { [slotOf(BLADE)]: ref(BLADE, 2), [slotOf(AEGIS)]: ref(AEGIS) } },
      { ...defaultAvatarRecord('legend_ember'), equipped: { [slotOf(CLOAK)]: ref(CLOAK, 1), [slotOf(KEEPER)]: ref(KEEPER) } },
    ],
    active_avatar_id: 'legend_root',
    inventory: [{ id: BLADE, star: 0, count: 1 }],
  };
}

// --- the one-time move ---------------------------------------------------------------------------------
{
  const before = oldSave();
  const leader = normalizedAvatarHeroId(before);
  const after = reload(before);
  assert.equal(after.version, 33, 'the save stays v33');
  assert.equal(after.gear_moved, true);
  assert.deepEqual(after.hero_gear[leader], { [slotOf(BLADE)]: ref(BLADE, 2), [slotOf(AEGIS)]: ref(AEGIS) }, 'the active Legend’s loadout is on the leader');
  assert.ok(after.avatars.every((a) => wornItemCount(a.equipped) === 0), 'the Legend records end empty');
  assert.equal(count(after, CLOAK, 1), 1, 'the other Legend’s cloak is back in the bag');
  assert.equal(count(after, KEEPER), 1, 'and its trinket');
  assert.equal(count(after, BLADE), 1, 'the bag’s own copy is untouched');
  assert.equal(totalOwnedAcrossAvatars(after), totalOwnedAcrossAvatars(before), 'total owned is unchanged (a move, not a copy)');
  assert.equal(totalOwnedAcrossAvatars(after), 5);
  const owned = ownedCountsAcross(after);
  assert.equal(owned[BLADE], 2, 'the drop preview counts the worn blade and the bagged one');
  // Once: a second load changes nothing.
  const again = reload(after);
  assert.deepEqual(again.hero_gear, after.hero_gear);
  assert.deepEqual(again.inventory, after.inventory);
  // The pure fold is idempotent too.
  assert.equal(foldGearIntoHeroes(after), after);
  // The move waits for P4's leader fold: with it still pending (leader_folded false) nothing moves, the gear
  // stays on the Legend records (still counted), and it lands once the fold has run.
  const waiting = oldSave();
  waiting.leader_folded = false;
  assert.equal(foldGearIntoHeroes(waiting), waiting, 'waits for the leader fold');
  assert.equal(totalOwnedAcrossAvatars(waiting), 5, 'and nothing is lost while waiting');
  assert.equal(foldGearIntoHeroes({ ...waiting, leader_folded: true }).gear_moved, true, 'then it moves');
  // A save with no gear anywhere just sets the flag.
  const empty = reload({ ...defaultPlayStore(T), gear_moved: false });
  assert.equal(empty.gear_moved, true);
  assert.deepEqual(empty.hero_gear, {});
  ok('old save: active Legend gear → leader, other Legends → bag, nothing lost or doubled, runs once, v33');
}
{
  // A slot the leader already wears keeps its item; the older worn one goes to the bag.
  const before = oldSave();
  const leader = normalizedAvatarHeroId(before);
  before.hero_gear = { [leader]: { [slotOf(BLADE)]: ref(BLADE, 4) } };
  const total = totalOwnedAcrossAvatars(before);
  const after = reload(before);
  assert.deepEqual(after.hero_gear[leader], { [slotOf(BLADE)]: ref(BLADE, 4), [slotOf(AEGIS)]: ref(AEGIS) }, 'the hero keeps its blade, gains the aegis');
  assert.equal(count(after, BLADE, 2), 1, 'the older ★2 blade is in the bag');
  assert.equal(totalOwnedAcrossAvatars(after), total, 'still nothing lost');
  // Unknown heroes / junk in hero_gear are dropped on load.
  const junk = reload({ ...defaultPlayStore(T), hero_gear: { nobody: { weapon: ref(BLADE) }, [leader]: 'x' as never } });
  assert.deepEqual(junk.hero_gear, {});
  ok('a taken slot keeps the hero’s item and bags the older one; junk in hero_gear is dropped');
}

// --- dressing a hero ------------------------------------------------------------------------------------
const kaelPet = (over: Partial<PetState>): PetState => ({ ...defaultPlayStore(T).pet, seen_at: T, stage: 'child', grade: 'common', ...over });
/** Leader = Oni (active pet), helper = Kael (Den pet, picked); blade ×2 + aegis in the bag. */
function team(): PlayStoreDoc {
  return {
    ...defaultPlayStore(T),
    owned_hero_ids: ['corvus', 'oni', 'kael'],
    pet: kaelPet({ uid: 1, hero: 'oni', egg: 'knight', line: 'solo_oni' }),
    pet_den: [kaelPet({ uid: 2, hero: 'kael', egg: 'village', line: 'solo_kael' })],
    pet_uid_next: 3,
    den_slots: 6,
    turf_helpers: [{ uid: 2, x: 50, y: 50 }],
    inventory: [
      { id: BLADE, star: 0, count: 2 },
      { id: AEGIS, star: 0, count: 1 },
      { id: CLOAK, star: 0, count: 1 },
    ],
  };
}
{
  let d = team();
  assert.equal(normalizedAvatarHeroId(d), 'oni');
  assert.equal(helperHeroIdOf(d), 'kael');
  assert.equal(lockerHeroIdOf(d), 'oni', 'the Locker dresses the leader by default');
  // Leader: equip a blade.
  const e1 = equipItem(d, BLADE, 0);
  assert.ok(e1.outcome.ok);
  d = e1.doc;
  assert.deepEqual(heroLoadoutOf(d, 'oni'), { [slotOf(BLADE)]: ref(BLADE) });
  assert.ok(d.avatars.every((a) => wornItemCount(a.equipped) === 0), 'a Legend never holds gear again');
  assert.equal(count(d, BLADE), 1, 'one copy left the bag');
  // Pick the helper and dress it from the same bag.
  assert.equal(setLockerHero(d, 'nobody'), d, 'an unknown hero is ignored');
  assert.equal(setLockerHero(d, 'frost-lich'), d, 'an unowned hero cannot be picked');
  const picked = setLockerHero(d, 'kael');
  assert.equal(lockerHeroIdOf(picked), 'kael');
  assert.equal(setLockerHero(picked, 'kael'), picked, 'unchanged → same doc');
  d = picked;
  const e2 = equipItem(d, AEGIS, 0);
  assert.ok(e2.outcome.ok);
  d = e2.doc;
  const e3 = equipItem(d, BLADE, 0);
  assert.ok(e3.outcome.ok, 'the second blade can go on the helper');
  d = e3.doc;
  assert.equal(count(d, BLADE), 0, 'a worn copy leaves the bag: one wearer each');
  assert.deepEqual(heroLoadoutOf(d, 'kael'), { [slotOf(AEGIS)]: ref(AEGIS), [slotOf(BLADE)]: ref(BLADE) });
  assert.deepEqual(heroLoadoutOf(d, 'oni'), { [slotOf(BLADE)]: ref(BLADE) }, 'the leader is untouched');
  assert.equal(totalOwnedAcrossAvatars(d), 4, 'bag 1 (cloak) + 3 worn');
  assert.equal(equipItem(d, BLADE, 0).outcome.ok, false, 'no copy left in the bag');
  // The view keeps the three loadouts apart.
  const view = playView(d, T);
  const element = view.legendElement;
  assert.equal(view.lockerHeroId, 'kael');
  assert.equal(view.turfHelperHeroId, 'kael');
  assert.deepEqual(view.equipped, heroLoadoutOf(d, 'kael'));
  assert.deepEqual(view.statSums, equippedStatSums(heroLoadoutOf(d, 'kael'), element), 'statSums = the dressed hero');
  assert.deepEqual(view.leaderStatSums, equippedStatSums(leaderLoadoutOf(d), element), 'leaderStatSums = the Turf leader');
  assert.deepEqual(view.helperStatSums, equippedStatSums(heroLoadoutOf(d, 'kael'), element), 'helperStatSums = the helper');
  assert.deepEqual(view.heroWorn, { oni: 1, kael: 2 }, 'the Hideout badge counts per hero');
  assert.notDeepEqual(view.leaderStatSums, view.helperStatSums, 'leader and helper sums differ');
  // Back on the leader: a helper change never moves the leader's sums.
  const back = playView(setLockerHero(d, 'oni'), T);
  assert.deepEqual(back.statSums, back.leaderStatSums);
  // No helper picked → zero helper sums and no id.
  const noHelper = { ...d, turf_helpers: [] };
  assert.equal(helperHeroIdOf(noHelper), null);
  assert.deepEqual(playView(noHelper, T).helperStatSums, equippedStatSums({}, element));
  // Unequip returns the copy to the bag, from the dressed hero only.
  const off = unequipItem(d, slotOf(AEGIS)).doc;
  assert.equal(count(off, AEGIS), 1);
  assert.equal(heroLoadoutOf(off, 'kael')[slotOf(AEGIS)], undefined);
  assert.deepEqual(heroLoadoutOf(off, 'oni'), heroLoadoutOf(d, 'oni'));
  // Gear on a hero the save no longer owns can still be reached and taken off; an empty unowned hero cannot be picked.
  const lost = { ...d, owned_hero_ids: ['corvus'], pet_den: [], turf_helpers: [], hero_gear: { ...d.hero_gear, 'frost-lich': { [slotOf(CLOAK)]: ref(CLOAK) } } };
  assert.equal(lockerHeroIdOf(setLockerHero(lost, 'frost-lich')), 'frost-lich', 'a hero still wearing gear can be dressed');
  assert.equal(setLockerHero(lost, 'velkhar'), lost, 'an unowned hero wearing nothing cannot');
  // A pick that becomes unowned (and wears nothing) falls back to the leader.
  assert.equal(lockerHeroIdOf({ ...lost, locker_hero_id: 'kael', hero_gear: {} }), normalizedAvatarHeroId(lost));
  // A save round trip keeps everything.
  const rt = reload(d);
  assert.deepEqual(rt.hero_gear, d.hero_gear);
  assert.equal(rt.locker_hero_id, 'kael');
  ok('Locker: equip / unequip act on the dressed hero, shared bag, one wearer each; leader / helper / dressed sums apart');
}
{
  // Merge acts on the dressed hero's worn copy.
  let d = team();
  d = { ...d, inventory: [{ id: BLADE, star: 0, count: 3 }] };
  d = setLockerHero(d, 'kael');
  d = equipItem(d, BLADE, 0).doc;
  assert.equal(canMergeWorn(d, slotOf(BLADE)), true, 'fuel in the bag: the dressed hero’s blade can merge');
  assert.equal(canMergeWorn(setLockerHero(d, 'oni'), slotOf(BLADE)), false, 'the leader wears nothing to merge');
  const m = mergeItem(d, { id: BLADE, star: 0, main: 'worn' }, () => 0);
  assert.ok(m && m.outcome.success);
  assert.deepEqual(m.doc.hero_gear.kael?.[slotOf(BLADE)], ref(BLADE, 1), 'the merge raised the helper’s blade');
  assert.ok(m.doc.avatars.every((a) => wornItemCount(a.equipped) === 0));
  assert.equal(totalOwnedAcrossAvatars(m.doc), totalOwnedAcrossAvatars(d) - 1, 'one fuel spent');
  assert.equal(bagItemCount(m.doc.inventory), 1);
  ok('merge works on the dressed hero’s gear');
}

// --- Turf -------------------------------------------------------------------------------------------------
{
  const map = BOARD_MAPS.ato;
  const buckets = { wavePower: 1, towerSpeed: 1, avatarLevel: 1, legendElement: null, avatarStars: 0 };
  function boardWith(dist: number): DefendLive {
    let s = createDefendLive(1, { mapId: 'trial', boardId: 'ato' });
    for (let i = 0; i < 400 && s.puffs.length === 0; i += 1) s = stepDefendLive(s, 100, buckets, { x: 50, y: 50 }).state;
    const puffs: Puff[] = [{ ...s.puffs[0], dist, hp: 1e9, maxHp: 1e9, kind: 'puff', slowMs: 0, slowFactor: 1 }];
    return { ...s, puffs, schedule: [], helpers: [] };
  }
  const p = puffPosition(0.3, map);
  const at = { x: p.x * 100 + 10, y: p.y * 100 };
  const hit = (gearPower: number | undefined) => {
    const spec = { slot: 0, heroId: 'kael', x: at.x, y: at.y, stars: 1, grade: 'common' as const, gearPower };
    const step = stepDefendLive(placeTurfTeam(boardWith(0.3), [spec], null), 1, buckets, at);
    return step.hits.find((h) => h.sourceId === helperUnitId(0))?.damage[0] ?? 0;
  };
  const base = hit(undefined);
  assert.ok(base > 0, 'the helper hits');
  assert.ok(Math.abs(hit(1.5) / base - 1.5) < 1e-6, 'gearPower ×1.5 → the helper hits 50% harder');
  assert.equal(hit(1), base);
  assert.equal(hit(0.2), base, 'never below ×1');
  assert.equal(hit(Number.NaN), base, 'junk reads as ×1');
  // The leader’s hit does not move with the helper’s gear.
  const leaderHit = (gp: number) => {
    const spec = { slot: 0, heroId: 'kael', x: -500, y: -500, stars: 1, grade: 'common' as const, gearPower: gp };
    const step = stepDefendLive(placeTurfTeam(boardWith(0.3), [spec], null), 100, buckets, at);
    return 1e9 - step.state.puffs[0].hp;
  };
  assert.equal(leaderHit(1), leaderHit(2), 'helper gear never touches the leader');
  ok('Turf: helper gear scales only the helper’s hits (×1 floor); the leader’s gear still feeds the board');
}

// --- wiring -------------------------------------------------------------------------------------------------
{
  const dress = read('src/play/dress-screen.tsx');
  assert.match(dress, /Dress which hero\?/, 'the Locker opens on a hero picker');
  assert.match(dress, /setLockerHero\(doc, id\)/, 'a tap picks the hero');
  assert.match(dress, /view\.heroWorn\[id\]/, 'each chip shows its worn count');
  assert.ok(!/record\.worn\}\/4 worn/.test(dress), 'a Legend card no longer shows worn slots');
  const defend = read('src/play/defend-screen.tsx');
  assert.match(defend, /bucketMultiplier\('wave_power', view\.leaderStatSums\)/, 'the board buckets read the leader’s gear');
  assert.match(defend, /bucketMultiplier\('tower_speed', view\.leaderStatSums\)/);
  assert.match(defend, /bucketMultiplier\('wave_power', view\.helperStatSums\)/, 'the helper’s gear is its own bucket');
  assert.match(defend, /gearPower: helperGearPower/, 'and goes into the team spec');
  const street = read('src/play/street-room.tsx');
  assert.match(street, /gearChip: \{[^}]*height: 18/, 'the gear chip has a fixed height');
  assert.match(street, /strip: \{[^}]*flexWrap: 'nowrap',[^}]*height: 36/, 'the name-tag row stays one 36 px row');
  assert.match(read('src/play/pet-screen.tsx'), /gearWorn=\{pet\.hero/, 'the Hideout passes the hero’s worn count');
  const store = read('src/play/playStore.ts');
  assert.match(store, /hero_gear: parseHeroGear\(data\.hero_gear\)/, 'additive v33 read');
  assert.match(store, /gear_moved: data\.gear_moved === true/);
  assert.match(store, /foldGearIntoHeroes\(foldAvatarIntoPets/, 'the move runs on load');
  assert.match(store, /version: 33,/, 'save stays v33');
  assert.ok(!/version: 34/.test(store), 'no v34');
  ok('wired: hero picker in the Locker, leader sums in the buckets, helper gear in the spec, fixed-height Hideout chip, v33');
}

console.log(`\ncheck:locker-per-hero — ${passed} groups passed.`);
