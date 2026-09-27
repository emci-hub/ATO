/**
 * Saved board layouts check (emci, 2026-09-26).
 *
 * The player's tower setup is remembered per map (`src/play/board-layouts.ts`,
 * its own AsyncStorage key — never inside the meta-only PlayStoreDoc) and put
 * back on the next fresh board by `restoreBoardLayout` (`src/play/defend.ts`).
 * This pins the rules that keep a stale or corrupt layout harmless:
 *   - a round trip restores pads, kinds and levels, for free;
 *   - pads the board doesn't have, unknown kinds and malformed rows are dropped;
 *   - a Bound Boss the player can no longer place (unbound hero, hero made the
 *     Avatar) is dropped; one that is allowed uses its CURRENT stars;
 *   - tower and Bound Boss caps still hold;
 *   - the scrap bank survives a save and parses back;
 *   - setup scrap: start scrap only on an EMPTY board, a kept board runs on
 *     its banked balance (emci, 2026-09-27 — the gentler rule).
 *
 * Run: npm run check:board-layouts
 */
import assert from 'node:assert/strict';

import {
  KEPT_BOARD_MIN_SCRAP,
  parseLayout,
  parseLayoutsDoc,
  setupBankFor,
  setupScrapFor,
} from '../src/play/board-layouts';
import {
  BOUND_BOSS_MAX_ON_BOARD,
  MAX_TOWERS,
  boardLayoutOf,
  createDefendLive,
  placeTower,
  restoreBoardLayout,
  upgradeTower,
} from '../src/play/defend';
import { BOARD_MAPS } from '../src/play/board-data';
import { allHeroes } from '../src/play/heroes-data';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const fresh = () => createDefendLive(1, { mapId: 'trial', boardId: 'ato' });
const startScrap = fresh().scrap;
const heroes = allHeroes();
const heroA = heroes[0].id;
const heroB = heroes[1].id;

// Round trip: build a board, read its layout, restore it on a fresh board.
let built = fresh();
built = { ...built, scrap: 10_000 };
built = placeTower(built, 0, 'archer')!;
built = placeTower(built, 1, 'crystal')!;
built = upgradeTower(built, built.towers[1].id)!;
built = upgradeTower(built, built.towers[1].id)!;
const layout = boardLayoutOf(built);
const restored = restoreBoardLayout(fresh(), layout, new Map());
assert.deepEqual(
  restored.towers.map((t) => [t.pad, t.kind, t.level]),
  [
    [0, 'archer', 1],
    [1, 'crystal', 3],
  ],
);
assert.equal(restored.scrap, startScrap, 'restored towers are free (scrap untouched)');
ok('a layout round-trips pads, kinds and levels, for free');

const bad = restoreBoardLayout(
  fresh(),
  {
    towers: [
      { pad: BOARD_MAPS.ato.pads.length + 3, kind: 'archer', level: 1 },
      { pad: -1, kind: 'vine', level: 1 },
      { pad: 2, kind: 'archer', level: 99 },
      { pad: 2, kind: 'crystal', level: 1 },
    ],
    bosses: [],
  },
  new Map(),
);
assert.deepEqual(
  bad.towers.map((t) => [t.pad, t.kind, t.level]),
  [[2, 'archer', 3]],
  'missing pads dropped, level clamped to 3, second tower on an occupied pad dropped',
);
ok('pads the board lacks and occupied pads are dropped; levels clamp to 1..3');

const withBosses = restoreBoardLayout(
  fresh(),
  {
    towers: [],
    bosses: [
      { pad: 3, bossId: heroA },
      { pad: 4, bossId: heroB },
    ],
  },
  new Map([[heroA, 2]]),
);
assert.deepEqual(
  withBosses.boundBosses.map((b) => [b.pad, b.bossId, b.stars]),
  [[3, heroA, 2]],
  'the no-longer-bound hero is dropped; the allowed one uses its current stars',
);
ok('a Bound Boss the player can no longer place is dropped; allowed ones use current stars');

const crowded = restoreBoardLayout(
  fresh(),
  {
    towers: BOARD_MAPS.ato.pads.map((_, pad) => ({ pad, kind: 'archer' as const, level: 1 })),
    bosses: [],
  },
  new Map(),
);
assert.equal(crowded.towers.length, MAX_TOWERS, 'the tower cap still holds on restore');
const bossCrowd = restoreBoardLayout(
  fresh(),
  { towers: [], bosses: heroes.slice(0, 4).map((h, i) => ({ pad: i, bossId: h.id })) },
  new Map(heroes.slice(0, 4).map((h) => [h.id, 1])),
);
assert.equal(bossCrowd.boundBosses.length, BOUND_BOSS_MAX_ON_BOARD, 'the Bound Boss cap still holds');
ok(`caps hold on restore (${MAX_TOWERS} towers, ${BOUND_BOSS_MAX_ON_BOARD} Bound Bosses)`);

assert.equal(restoreBoardLayout(fresh(), null, new Map()).towers.length, 0, 'no layout → empty board');
ok('no saved layout leaves the board as it was');

const parsed = parseLayout({
  towers: [
    { pad: 1, kind: 'archer', level: 2 },
    { pad: 'x', kind: 'archer', level: 1 },
    { pad: 2, kind: 'laser', level: 1 },
    null,
  ],
  bosses: [{ pad: 3, bossId: heroA }, { pad: 4 }],
  bankScrap: 37.9,
});
assert.deepEqual(parsed, {
  towers: [{ pad: 1, kind: 'archer', level: 2 }],
  bosses: [{ pad: 3, bossId: heroA }],
  bankScrap: 37,
});
assert.deepEqual(parseLayoutsDoc('garbage').layouts, {}, 'an unreadable file becomes an empty doc');
assert.equal(parseLayout({ bankScrap: -5 })?.bankScrap, 0, 'a negative bank reads as 0');
ok('malformed rows are dropped on load; the kill-scrap bank parses back');

assert.equal(setupScrapFor({ keptBoard: false, startScrap: 80, bank: 0 }), 80, 'an empty board gets start scrap');
assert.equal(setupScrapFor({ keptBoard: false, startScrap: 80, bank: 25 }), 105, 'plus any bank');
assert.equal(setupScrapFor({ keptBoard: true, startScrap: 80, bank: 125 }), 125, 'a kept board runs on its bank');
assert.equal(setupScrapFor({ keptBoard: true, startScrap: 80, bank: 0 }), 0, 'a REBUILD never mints scrap (no floor here)');
assert.equal(setupScrapFor({ keptBoard: true, startScrap: 80, bank: -3.7 }), 0, 'a bad bank never goes negative');
assert.ok(KEPT_BOARD_MIN_SCRAP > 0, 'the one-tower floor exists for wave results');
ok('setup scrap: start scrap only on an empty board; a kept board gets its bank exactly');

// Rebuild round trips: bank what setup would give back, never more.
const rebuild = (kept: boolean, scrap: number) =>
  setupScrapFor({ keptBoard: kept, startScrap: 80, bank: setupBankFor({ keptBoard: kept, scrap, startScrap: 80 }) });
assert.equal(rebuild(true, 0), 0, 'spend to 0, re-enter Defend → still 0 (no free 40)');
assert.equal(rebuild(true, 55), 55, 'a kept board keeps its exact balance across a rebuild');
assert.equal(rebuild(false, 130), 130, 'an emptied board with 130 gets 130 back (80 start + 50 bank)');
assert.equal(rebuild(false, 30), 80, 'an emptied board below start scrap gets start scrap (nothing to farm: towers cannot be sold)');
ok('a rebuild before the wave restores the exact balance (no farming by re-entering Defend)');

console.log(`\nAll ${passed} board-layout checks passed.`);
