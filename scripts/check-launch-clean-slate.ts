/**
 * Launch flip clean slate (master-plan Step 12, 2026-10-20). Run: npm run check:launch-clean-slate
 *
 *   1. The flag is off, so the free pre-launch build is gone.
 *   2. A tester save (every hero owned, auras + finishes bought free and worn) loses them once:
 *      owned heroes = the starter, Avatar hero = the starter, no aura / finish owned or worn.
 *   3. Tokens and the rest of the save stay; a pet hatched from an egg still counts as owned.
 *   4. It runs once (`launch_reset`), survives a save round-trip, and a fresh save is untouched.
 */
import assert from 'node:assert/strict';

import { PLAY_EVERYTHING_FREE } from '../src/lib/dev-mode';
import { AURA_STYLES } from '../src/play/auras';
import { DEFAULT_AVATAR_HERO_ID, allHeroes } from '../src/play/heroes-data';
import { EMPTY_HERO_RECORD } from '../src/play/pet-eggs';
import { defaultPlayStore, heroOwned, launchCleanSlate, parsePlayStore, type PlayStoreDoc } from '../src/play/playStore';

let passed = 0;
function check(label: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok  ${label}`);
}

const now = Date.UTC(2026, 9, 20, 12);
const other = allHeroes().find((hero) => hero.id !== DEFAULT_AVATAR_HERO_ID);
assert.ok(other, 'heroes.json has a hero besides the starter');
const style = AURA_STYLES[0];

function testerSave(): PlayStoreDoc {
  const base = defaultPlayStore(now);
  const worn = { ...base.pet, finish_kind: 'holo' as const, finish_color: 'x', auras: [{ style, color: 'sword' as const }] };
  return {
    ...base,
    tokens: 1234,
    owned_hero_ids: allHeroes().map((hero) => hero.id),
    active_avatar_hero_id: other!.id,
    hero_offer: { hero_id: other!.id, label: 'x' },
    aura_owned: [style],
    aura_mixes: [],
    finish_wallet: { holo: true, reverse: true, colors: ['x'] },
    pet: worn,
    pet_den: [worn],
    launch_reset: false,
  } as PlayStoreDoc;
}

check('PRE_LAUNCH_DEV is off, so Play is no longer free', () => {
  assert.equal(PLAY_EVERYTHING_FREE, false);
});

check('a tester save is reset to the starter hero, no auras, no finishes', () => {
  const reset = launchCleanSlate(testerSave());
  assert.deepEqual(reset.owned_hero_ids, [DEFAULT_AVATAR_HERO_ID]);
  assert.equal(reset.active_avatar_hero_id, DEFAULT_AVATAR_HERO_ID);
  assert.equal(reset.hero_offer, null);
  assert.deepEqual(reset.aura_owned, []);
  assert.deepEqual(reset.finish_wallet, { holo: false, reverse: false, colors: [] });
  for (const pet of [reset.pet, ...reset.pet_den]) {
    assert.equal(pet.finish_kind, 'none');
    assert.deepEqual(pet.auras, []);
  }
  assert.equal(reset.launch_reset, true);
});

check('tokens stay', () => {
  assert.equal(launchCleanSlate(testerSave()).tokens, 1234);
});

check('a hero held as a hatched pet stays owned (and may stay the Avatar hero)', () => {
  const save = testerSave();
  const withPet: PlayStoreDoc = { ...save, pet_heroes: { ...save.pet_heroes, [other!.id]: { ...EMPTY_HERO_RECORD, copies: 1 } } };
  const reset = launchCleanSlate(withPet);
  assert.equal(heroOwned(reset, other!.id), true);
  assert.equal(reset.active_avatar_hero_id, other!.id);
});

check('it runs once: a reset save is returned unchanged', () => {
  const reset = launchCleanSlate(testerSave());
  const again = launchCleanSlate({ ...reset, aura_owned: [style] });
  assert.deepEqual(again.aura_owned, [style]); // bought after the flip: kept
});

check('a fresh save is already clean and is not touched', () => {
  const fresh = defaultPlayStore(now);
  assert.equal(fresh.launch_reset, true);
  assert.equal(launchCleanSlate(fresh), fresh);
});

check('the flag survives a save round-trip; an old save without it is reset on load', () => {
  const reset = launchCleanSlate(testerSave());
  assert.equal(parsePlayStore(JSON.stringify(reset), now)?.launch_reset, true);
  const old = { ...testerSave() } as Record<string, unknown>;
  delete old.launch_reset;
  const parsed = parsePlayStore(JSON.stringify(old), now);
  assert.ok(parsed);
  assert.equal(parsed.launch_reset, false);
  assert.deepEqual(launchCleanSlate(parsed).owned_hero_ids, [DEFAULT_AVATAR_HERO_ID]);
});

console.log(`\n${passed} launch-clean-slate checks passed`);
