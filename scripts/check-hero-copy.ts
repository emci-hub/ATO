/**
 * Hero roster copy check (Dress redesign, 2026-09-28).
 *
 * Pins what the hero grid promises the player, so a later data edit can't turn
 * a tile back into the old `name + skill_archangel` row:
 *   - every hero has a portrait frame (the packed `rotations` sheet) — no blank
 *     tiles and no silent Corvus fallback;
 *   - every hero has both role lines (Avatar Veil, tower kit) and an unlock
 *     hint, and none of them leaks an internal id;
 *   - the tower line names the hero's real behavior + element;
 *   - status resolves in the right order, and the two-tap guard fires exactly
 *     for a hero that is bound as a tower (setting it as Avatar unbinds it).
 *
 * Run: npm run check:hero-copy
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  HERO_SHARED_NOTE,
  heroAvatarLine,
  heroStatusOf,
  heroTowerLine,
  heroUnlockLine,
  setAvatarUnbinds,
} from '../src/play/hero-copy';
import { allHeroes } from '../src/play/heroes-data';
import { BEHAVIOR_LABEL, ELEMENT_LABEL } from '../src/play/kits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const heroes = allHeroes();

// The grid draws the east-facing frame of each hero's packed `rotations`
// sheet. `skin.ts` can't be imported here (the generated registry `require`s
// PNGs, which plain Node can't load), so the registry is read as text — the
// same approach `check-heroes.ts` uses.
const sheetRegistry = fs.readFileSync(
  path.resolve(process.cwd(), 'src/play/generated-play-sheets.ts'),
  'utf8',
);
for (const hero of heroes) {
  const base = hero.folder.replace(/^assets\/play\//, '');
  assert.ok(
    sheetRegistry.includes(`sheets/${base.replace('skins/', '')}/rotations`) ||
      sheetRegistry.includes(`${base}/rotations`),
    `${hero.id}: no packed rotations sheet — its grid tile would be blank`,
  );
}
ok(`all ${heroes.length} heroes have a portrait frame for the grid`);

/** Anything that looks like an internal id rather than player copy. */
const LEAKS = /skill_|_veil|\b[a-z]+_[a-z]+\b|undefined|null/;
for (const hero of heroes) {
  for (const [what, line] of [
    ['avatar', heroAvatarLine(hero)],
    ['tower', heroTowerLine(hero)],
    ['unlock', heroUnlockLine(hero)],
  ] as const) {
    assert.ok(line.trim().length > 0, `${hero.id}: ${what} line is empty`);
    assert.ok(!LEAKS.test(line), `${hero.id}: ${what} line leaks an internal id — "${line}"`);
  }
}
ok('every hero has an Avatar line, a tower line and an unlock hint — no internal ids');

for (const hero of heroes) {
  const line = heroTowerLine(hero);
  assert.ok(line.startsWith(`${BEHAVIOR_LABEL[hero.kit.behavior]} · ${ELEMENT_LABEL[hero.kit.element]} —`), `${hero.id}: tower line must name its real kit`);
}
ok('each tower line names that hero\'s real behavior and element');

// The Veils barely differ; the Avatar line must state the numbers, not imply
// a unique playstyle (red team, 2026-09-28).
const avatarLines = new Set(heroes.map((hero) => heroAvatarLine(hero)));
assert.ok(avatarLines.size >= 8, 'Avatar lines should still distinguish most heroes by their Veil numbers');
for (const hero of heroes) {
  assert.match(heroAvatarLine(hero), /slows nearby foes \d+% for [\d.]+s/, `${hero.id}: Avatar line must state the real slow numbers`);
}
ok('Avatar lines state the real Veil numbers instead of overselling variety');

const ids = heroes.map((hero) => hero.id);
const opts = { activeHeroId: ids[0], ownedIds: [ids[0], ids[1], ids[2]], boundIds: [ids[1]] };
assert.equal(heroStatusOf(ids[0], opts), 'active', 'the active hero wins over owned');
assert.equal(heroStatusOf(ids[1], opts), 'bound', 'a bound hero reads as a tower');
assert.equal(heroStatusOf(ids[2], opts), 'owned');
assert.equal(heroStatusOf(ids[3], opts), 'locked');
ok('status resolves active → bound → owned → locked');

assert.equal(setAvatarUnbinds(ids[1], opts.boundIds), true, 'a bound hero needs the two-tap confirm');
assert.equal(setAvatarUnbinds(ids[2], opts.boundIds), false, 'an idle owned hero sets in one tap');
ok('the two-tap confirm fires exactly for a hero bound as a tower');

assert.match(HERO_SHARED_NOTE, /bag, tokens and campaign progress/i);
assert.match(HERO_SHARED_NOTE, /tower/i, 'the note must name the one real cost: a bound tower is given up');
assert.ok(!/swap freely/i.test(HERO_SHARED_NOTE), 'the old misleading "swap freely" line must not come back');
assert.ok(
  !/nothing is lost/i.test(HERO_SHARED_NOTE),
  'the note must not claim nothing is lost — setAvatarHero unbinds that hero\'s tower',
);
ok('the shared-progress note is honest: shared progress, and the bound-tower cost');

console.log(`\nAll ${passed} hero-copy checks passed.`);
