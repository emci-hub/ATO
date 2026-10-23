/**
 * Leader = active pet (pet team roadmap P4, emci 2026-10-18).
 * Run: npm run check:pet-leader
 *
 * - The Turf leader is the ACTIVE PET's hero once it is revealed; an egg / baby keeps the stored Avatar (corvus
 *   by default). A hero bound as a tower never leads.
 * - An old save (no `leader_folded`) whose Avatar was a real choice loads with that hero as a pet that leads:
 *   found in the Den, or taken from a Collection copy, or hatched at Child; the old active pet rests in the Den;
 *   nothing is lost (copies / stars, uids, Den slots); idempotent; the starter Avatar changes nothing.
 * - It waits (flag stays off, tries again next load) while the stage holds an egg or baby.
 * - A campaign band clear grants an egg COPY of its hero (a star), not just ownership; replays grant none.
 * - The save stays v33 and the flag is additive; pet-owned heroes count as owned in the roster.
 * - Wired: parse runs the fold, the view says where the leader comes from, Dress / the hero sheet drop the
 *   manual "Fight as this hero" pick while the pet leads.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { PetState } from '../src/play/pet';
import {
  bindHeroAsTower,
  boundHeroIdsOf,
  defaultPlayStore,
  foldAvatarIntoPets,
  heroBookOf,
  heroOwned,
  normalizedAvatarHeroId,
  ownedHeroIdsOf,
  parsePlayStore,
  playView,
  recordDefendWin,
  setAvatarHero,
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
const fresh = defaultPlayStore(T);
function pet(over: Partial<PetState>): PetState {
  return { ...fresh.pet, seen_at: T, stage: 'child', grade: 'common', ...over };
}
/** A save as P3 left it: Avatar chosen, no `leader_folded`. */
function oldSave(mut: (d: PlayStoreDoc) => void): PlayStoreDoc {
  const d: PlayStoreDoc = {
    ...defaultPlayStore(T),
    owned_hero_ids: ['corvus', 'oni'],
    active_avatar_hero_id: 'oni',
    leader_folded: false,
    pet: pet({ uid: 1, hero: 'kael', egg: 'village', line: 'solo_kael', stage: 'adult' }),
    pet_uid_next: 2,
    den_slots: 6,
  };
  mut(d);
  return d;
}
const reload = (d: PlayStoreDoc): PlayStoreDoc => {
  const parsed = parsePlayStore(JSON.stringify(d), T);
  assert.ok(parsed, 'the save parses');
  return parsed;
};
const copies = (d: PlayStoreDoc, hero: string) => heroBookOf(d)[hero]?.copies ?? 0;
const petsOf = (d: PlayStoreDoc) => [d.pet, ...d.pet_den];

// --- who leads ----------------------------------------------------------------------------------------
{
  assert.equal(fresh.leader_folded, true, 'a new save has nothing to fold');
  assert.equal(normalizedAvatarHeroId(fresh), 'corvus', 'an egg: the stored Avatar (corvus) leads');
  const kael = { ...fresh, pet: pet({ uid: 1, hero: 'kael', egg: 'village', line: 'solo_kael' }) };
  assert.equal(normalizedAvatarHeroId(kael), 'kael', 'a revealed active pet leads');
  const baby = { ...fresh, pet: pet({ uid: 1, hero: null, stage: 'baby', egg: 'village' }) };
  assert.equal(normalizedAvatarHeroId(baby), 'corvus', 'a baby (no hero yet): the stored Avatar leads');
  const bound = bindHeroAsTower({ ...kael, owned_hero_ids: ['corvus', 'kael'] }, 'kael');
  assert.equal(bound.ok, false, 'the leader cannot also be bound');
  const boundFirst = {
    ...kael,
    owned_hero_ids: ['corvus', 'kael'],
    bound_bosses: [{ id: 'kael', stars: 1, frags: 0, bound_wave: null }],
  };
  assert.deepEqual(boundHeroIdsOf(boundFirst), ['kael']);
  assert.equal(normalizedAvatarHeroId(boundFirst), 'corvus', 'a hero bound as a tower never leads');
  assert.equal(playView(kael, T).leaderFromPet, true);
  assert.equal(playView(fresh, T).leaderFromPet, false);
  ok('leader = the revealed active pet; egg / baby / bound fall back to the stored Avatar');
}

// --- the old Avatar becomes a pet, and leads ----------------------------------------------------------
{
  // Oni is not a pet and not in the book: hatched at Child, Kael rests.
  const before = oldSave(() => {});
  const after = reload(before);
  assert.equal(after.leader_folded, true);
  assert.equal(after.pet.hero, 'oni', 'the chosen Avatar is now the active pet');
  assert.equal(after.pet.stage, 'child');
  assert.equal(after.pet.reveals.length, 0, 'no reveal to replay');
  assert.equal(normalizedAvatarHeroId(after), 'oni', 'and it leads');
  assert.ok(after.pet_den.some((p) => p.hero === 'kael' && p.stage === 'adult'), 'the old pet rests in the Den, unchanged');
  assert.equal(new Set(petsOf(after).map((p) => p.uid)).size, petsOf(after).length, 'unique pet ids');
  assert.equal(copies(before, 'kael'), 1);
  assert.equal(copies(after, 'kael'), 1, 'Kael keeps his star');
  assert.equal(copies(after, 'oni'), 1, 'Oni is 1★ as a new pet');
  assert.ok(after.den_slots >= petsOf(after).length, 'the Den grew to fit, nothing evicted');
  assert.ok(heroOwned(after, 'oni') && after.owned_hero_ids.includes('oni'), 'still owned (older bundles keep working)');
  // Idempotent: loading it again changes nothing, and a later "Make active" is not undone.
  const again = reload(after);
  assert.equal(again.pet.uid, after.pet.uid);
  assert.equal(petsOf(again).length, petsOf(after).length);
  const swappedBack = { ...after, pet: after.pet_den.find((p) => p.hero === 'kael')!, pet_den: [...after.pet_den.filter((p) => p.hero !== 'kael'), after.pet] };
  assert.equal(reload(swappedBack).pet.hero, 'kael', 'the fold runs once: choosing another pet later sticks');
  assert.equal(after.version, 33, 'the save stays v33');
  ok('old save: the chosen Avatar is hatched as a pet, leads, the old pet rests, nothing lost, runs once');
}
{
  // Oni already a resting pet: it is woken, no extra pet.
  const oniPet = pet({ uid: 4, hero: 'oni', egg: 'knight', line: 'solo_oni', grade: 'epic', stage: 'teen' as PetState['stage'] });
  const before = oldSave((d) => {
    d.pet_den = [oniPet];
    d.pet_uid_next = 5;
  });
  const after = reload(before);
  assert.equal(after.pet.uid, 4, 'the existing Oni pet is the active one');
  assert.equal(after.pet.grade, 'epic', 'with its grade');
  assert.equal(petsOf(after).length, 2, 'no extra pet');
  ok('an Avatar that is already a pet in the Den is woken, not duplicated');
}
{
  // Oni only as a Collection copy (a band clear gave it): the pet takes over that copy, stars unchanged.
  const withCopy = oldSave((d) => {
    d.pet_heroes = { oni: { copies: 2, shinies: 0, grades: ['rare'], forms: [], dye: false, styles: [] } };
  });
  const after = reload(withCopy);
  assert.equal(after.pet.hero, 'oni');
  assert.equal(after.pet.grade, 'rare', 'its best grade');
  assert.equal(copies(after, 'oni'), copies(withCopy, 'oni'), 'stars are exactly what they were');
  ok('an Avatar held as a Collection copy hatches from it with its stars and best grade');
}
{
  // The starter, or a hero that cannot be a pet: nothing to carry; flag set.
  const starter = reload(oldSave((d) => {
    d.owned_hero_ids = ['corvus'];
    d.active_avatar_hero_id = 'corvus';
  }));
  assert.equal(starter.pet.hero, 'kael', 'the starter Avatar never swaps the pet');
  assert.equal(starter.leader_folded, true);
  assert.equal(petsOf(starter).length, 1);
  ok('the starter Avatar changes nothing');
}
{
  // Waits: an egg on the stage, a baby, a reveal to play.
  const egg = oldSave((d) => {
    d.pet = pet({ uid: 1, hero: null, stage: 'egg', egg: 'village' });
  });
  const parked = reload(egg);
  assert.equal(parked.leader_folded, true);
  assert.equal(parked.pet.stage, 'egg', 'the egg on the stage is not moved');
  assert.ok(parked.pet_den.some((p) => p.hero === 'oni'), 'Oni waits in the Den as a pet');
  assert.equal(normalizedAvatarHeroId(parked), 'corvus', 'nothing leads until the egg hatches');
  // When the egg hatches into a different hero it leads, and a later load does not swap Oni in over it.
  const hatched = { ...parked, pet: pet({ uid: 1, hero: 'sak', egg: 'village', line: 'solo_sak' }) };
  assert.equal(normalizedAvatarHeroId(reload(hatched)), 'sak');
  const revealing = oldSave((d) => {
    d.pet = { ...d.pet, reveals: ['child'] };
  });
  assert.equal(foldAvatarIntoPets(revealing, T).leader_folded, false, 'waits for a reveal to play');
  ok('an egg on the stage is left alone: the hero waits in the Den, no later surprise swap');
}
{
  // An older bundle rebuilds the save and drops the flag: the fold must find nothing to do.
  const after = reload(oldSave(() => {}));
  const dropped = reload({ ...after, leader_folded: false } as PlayStoreDoc);
  const kael = after.pet_den.find((p) => p.hero === 'kael')!;
  const picked = { ...after, pet: kael, pet_den: [...after.pet_den.filter((p) => p.uid !== kael.uid), after.pet], leader_folded: false } as PlayStoreDoc;
  assert.equal(reload(picked).pet.hero, 'kael', 'a pet the player picked stays active when the flag is lost');
  assert.equal(dropped.pet.hero, 'oni');
  assert.equal(after.active_avatar_hero_id, 'corvus', 'the stored Avatar went back to the starter');
  // setAvatarHero for a hero held only as a pet survives a reload (it is listed as owned).
  const held = { ...defaultPlayStore(T), pet: pet({ uid: 1, hero: 'sak', egg: 'village', line: 'solo_sak' }) };
  const heldEgg = { ...held, pet: pet({ uid: 1, hero: null, stage: 'egg', egg: 'village' }), pet_den: [pet({ uid: 2, hero: 'sak', egg: 'village', line: 'solo_sak' })] };
  const set = setAvatarHero(heldEgg, 'sak');
  assert.equal(set.ok, true);
  assert.ok(set.doc.owned_hero_ids.includes('sak'), 'it is added to the owned list');
  assert.equal(reload(set.doc).active_avatar_hero_id, 'sak', 'and the choice survives a reload');
  ok('a lost flag cannot swap again; a pet-held Avatar choice survives a reload');
}
{
  // A bound Avatar is left alone.
  const bound = reload(oldSave((d) => {
    d.bound_bosses = [{ id: 'oni', stars: 1, frags: 0, bound_wave: null }];
    d.active_avatar_hero_id = 'corvus';
  }));
  assert.equal(bound.pet.hero, 'kael');
  ok('a hero bound as a tower is not swapped in');
}

// --- grants -------------------------------------------------------------------------------------------
{
  const NEVER_ROLLS = () => 1;
  const clear = (d: PlayStoreDoc, wave: number, mode: 'campaign' | 'replay') =>
    recordDefendWin({ ...d, campaign: { phase: 'main', wave_in_phase: wave } }, { phase: 'main', wave, mode }, 0, NEVER_ROLLS);
  const scout = clear(fresh, 5, 'campaign');
  assert.equal(copies(scout.doc, 'oni'), 1, 'Main w5 gives an egg copy of Oni (1★)');
  assert.ok(heroOwned(scout.doc, 'oni'));
  assert.ok(ownedHeroIdsOf(scout.doc).includes('oni'), 'and Oni is on the roster');
  assert.equal(normalizedAvatarHeroId(scout.doc), 'corvus', 'but it does not make Oni the leader by itself');
  const final = clear(fresh, 10, 'campaign');
  assert.equal(copies(final.doc, 'archangel'), 1, 'Main w10 gives an egg copy of Archangel');
  const twice = clear(scout.doc, 5, 'campaign');
  assert.equal(copies(twice.doc, 'oni'), 2, 'a campaign clear of an owned hero is still a star');
  const replay = clear(fresh, 5, 'replay');
  assert.equal(copies(replay.doc, 'oni'), 0, 'a replay grants nothing');
  const havePet = { ...fresh, pet: pet({ uid: 1, hero: 'oni', egg: 'knight', line: 'solo_oni' }) };
  assert.equal(copies(clear(havePet, 5, 'campaign').doc, 'oni'), 2, 'with Oni as your pet, the clear is a second star');
  ok('a hero clear grants an egg copy (a star) of its hero; replays grant none');
}

// --- stage-wide pins and wiring -----------------------------------------------------------------------
{
  const set = setAvatarHero({ ...fresh, owned_hero_ids: ['corvus', 'oni'] }, 'oni');
  assert.equal(set.ok, true, 'the stored Avatar can still be set (the fallback while an egg is on the stage)');
  const store = read('src/play/playStore.ts');
  assert.match(store, /foldAvatarIntoPets\(foldDuplicatePets\(parsed, now\)\.doc, now\)/, 'parse runs the fold after the duplicate fold');
  assert.match(store, /leader_folded: data\.leader_folded === true/, 'the flag is read loosely (absent = fold)');
  assert.match(store, /version: 33/, 'still v33');
  const grid = read('src/play/hero-grid.tsx');
  assert.match(grid, /leaderFromPet/, 'the roster knows the pet leads');
  const sheet = read('src/play/hero-own-sheet.tsx');
  assert.match(sheet, /leaderFromPet \? null : \(/, 'the hero sheet drops "Set as Avatar" while the pet leads');
  assert.match(read('src/play/dress-screen.tsx'), /leaderFromPet=\{view\.leaderFromPet\}/);
  assert.match(read('src/play/defend-screen.tsx'), /leaderFromPet=\{view\.leaderFromPet\}/);
  assert.match(read('src/play/defend-screen.tsx'), /heroAvatarRole\(view\.activeAvatarHeroId\)/, 'Turf draws the leader from the view');
  ok('wired: parse, view, Dress, hero sheet, Turf; save stays v33');
}

console.log(`\ncheck:pet-leader — ${passed} groups passed`);
