/**
 * Elemental Legends check (2026-09-28).
 *
 * The Legends were repurposed from ten ids (one real starter + nine
 * placeholders) into five, one per element, and the save moved v18 → v19. This
 * is the highest-risk part of the change, so it runs REAL v18 saves through the
 * real loader (`parsePlayStore`) — emci asked specifically for both cases:
 *   A. a save with NO placeholder Legends unlocked (the common case);
 *   B. a save with SEVERAL placeholders unlocked, including two that fold onto
 *      the same new Legend, and an active placeholder.
 * Then it pins the rules the screens explain:
 *   - the level curve (effects ×1.0 → ×1.5, resist recovery 0 → ½, never 100%);
 *   - the ONE matchup rule (+25% weak, −25% own element softened by level,
 *     Void never matched either way);
 *   - hero affinity and gear match, and that the old board-wide +20% is gone.
 *
 * Run: npm run check:legends
 */
import assert from 'node:assert/strict';

import {
  GEAR_MATCH_BONUS,
  HERO_AFFINITY_BONUS,
  LEGACY_LEGEND_MAP,
  STARTER_AVATAR_ID,
  allAvatarDefs,
  legendElementOf,
  legendResistRecovery,
  legendRiderScale,
  migrateLegendRecords,
} from '../src/play/avatars';
import { heroAffinityMult } from '../src/play/defend';
import { waveDefFor } from '../src/play/director';
import { KIT_TUNING, matchupMult, strikeCreep, type KitCreep } from '../src/play/kit-combat';
import { ELEMENTS } from '../src/play/kits';
import { stageMatchupFor } from '../src/play/legend-copy';
import {
  defaultPlayStore,
  equippedStatSums,
  gearMatchesLegend,
  parsePlayStore,
  totalOwnedAcrossAvatars,
} from '../src/play/playStore';
import { getTune } from '../src/play/tune';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

/* ------------------------------------------------------------ the roster --- */

const defs = allAvatarDefs();
assert.equal(defs.length, 5, 'five Legends');
assert.deepEqual([...new Set(defs.map((d) => d.element))].sort(), [...ELEMENTS].sort(), 'one per element');
assert.equal(legendElementOf(STARTER_AVATAR_ID), 'root', 'the starter Druid is the nature Legend');
for (const target of Object.values(LEGACY_LEGEND_MAP)) {
  assert.ok(defs.some((d) => d.id === target), `legacy map points at a real Legend: ${target}`);
}
ok('five Legends, one per element; every old id maps onto a real one');

/* ------------------------------------------------------ migration (pure) --- */

const gearA = { weapon: { id: 'item_tide_blade_01', star: 1 } };
const gearB = { armor: { id: 'item_bark_aegis_01', star: 0 } };
const merged = migrateLegendRecords(
  [
    { id: 'ava_sprout', xp: 3, level: 5, stars: 1, equipped: gearA, park: {} },
    { id: 'ava_champion', xp: 9, level: 9, stars: 1, equipped: gearB, park: {} },
    { id: 'ava_demon_guardian', xp: 0, level: 3, stars: 4, equipped: {}, park: {} },
    { id: 'something_unknown', xp: 0, level: 50, stars: 5, equipped: {}, park: {} },
  ],
  'ava_sprout',
);
const ember = merged.rows.find((r) => r.id === 'legend_ember')!;
assert.equal(merged.returnedEquipped.length, 2, 'the merged-away Ember record and the unknown id hand back their loadouts');
assert.equal(ember.level, 9, 'merge keeps the highest level');
assert.equal(ember.xp, 9, 'with that record’s xp');
assert.equal(ember.stars, 4, 'and the max stars across the group');
assert.deepEqual(ember.equipped, gearB, 'gear comes from the highest-level record when the active one is elsewhere');
assert.ok(!merged.rows.some((r) => r.id === 'something_unknown'), 'unknown ids are dropped');
assert.equal(merged.activeId, 'legend_root', 'the active id follows its record');
ok('pure migration: merge keeps highest level + its xp, max stars, the right loadout; unknown ids dropped');

// A corrupt save repeating an id must not mint items: the duplicate is ignored
// and its gear is NOT handed back (review, 2026-09-28).
const dup = migrateLegendRecords(
  [
    { id: 'ava_sprout', xp: 0, level: 3, stars: 0, equipped: gearA, park: {} },
    { id: 'ava_sprout', xp: 0, level: 9, stars: 0, equipped: gearB, park: {} },
  ],
  'ava_sprout',
);
assert.equal(dup.rows.length, 1);
assert.equal(dup.rows[0].level, 3, 'the first copy of a repeated id wins');
assert.equal(dup.returnedEquipped.length, 0, 'a duplicate row never returns gear (no item minting)');
ok('a corrupt save repeating an id cannot duplicate items');

/* ------------------------------------------- migration through the loader --- */

const base = JSON.parse(JSON.stringify(defaultPlayStore(0))) as Record<string, unknown>;
const inventory = [
  { id: 'item_tide_blade_01', count: 2, star: 1 },
  { id: 'item_bark_aegis_01', count: 1, star: 0 },
  { id: 'item_curator_cloak_01', count: 1, star: 0 },
];

// A. No placeholders unlocked: only the starter, active, with gear.
const saveA = parsePlayStore(
  JSON.stringify({
    ...base,
    version: 18,
    inventory,
    avatars: [{ id: 'ava_sprout', xp: 12, level: 7, stars: 2, equipped: gearA, park: {} }],
    active_avatar_id: 'ava_sprout',
  }),
  0,
);
assert.ok(saveA, 'case A parses');
assert.equal(saveA.version, 30, 'and becomes the current version (v30 since pet finishes)');
assert.equal(saveA.avatars.length, 1, 'no extra record appears (the old split-progress trap)');
assert.equal(saveA.avatars[0].id, 'legend_root');
assert.equal(saveA.avatars[0].level, 7, 'level kept');
assert.equal(saveA.avatars[0].xp, 12, 'xp kept');
assert.equal(saveA.avatars[0].stars, 2, 'stars kept');
assert.deepEqual(saveA.avatars[0].equipped, gearA, 'worn gear kept');
assert.equal(saveA.active_avatar_id, 'legend_root', 'still the active Legend');
assert.deepEqual(saveA.inventory, inventory, 'the bag is untouched');
ok('case A — no placeholders unlocked: the starter carries level, xp, stars, gear; bag untouched');

// B. Several placeholders unlocked; two fold onto Ember; an active placeholder.
const saveB = parsePlayStore(
  JSON.stringify({
    ...base,
    version: 18,
    inventory,
    avatars: [
      { id: 'ava_sprout', xp: 1, level: 4, stars: 0, equipped: gearA, park: {} },
      { id: 'ava_champion', xp: 20, level: 8, stars: 1, equipped: gearB, park: {} },
      { id: 'ava_demon_guardian', xp: 0, level: 2, stars: 3, equipped: {}, park: {} },
      { id: 'ava_berserker', xp: 5, level: 6, stars: 0, equipped: {}, park: {} },
      { id: 'ava_witch', xp: 0, level: 1, stars: 0, equipped: {}, park: {} },
    ],
    active_avatar_id: 'ava_berserker',
  }),
  0,
);
assert.ok(saveB, 'case B parses');
assert.equal(saveB.version, 30);
const byId = new Map(saveB.avatars.map((a) => [a.id, a]));
assert.deepEqual([...byId.keys()].sort(), ['legend_ember', 'legend_root', 'legend_tide', 'legend_void'], 'five old records fold onto four Legends');
assert.equal(byId.get('legend_root')?.level, 4, 'starter progress kept');
assert.deepEqual(byId.get('legend_root')?.equipped, gearA, 'starter gear kept');
assert.equal(byId.get('legend_ember')?.level, 8, 'Ember merge keeps the higher level');
assert.equal(byId.get('legend_ember')?.stars, 3, 'and the higher stars');
assert.deepEqual(byId.get('legend_ember')?.equipped, gearB, 'and the higher-level record’s gear');
assert.equal(saveB.active_avatar_id, 'legend_tide', 'an active placeholder hands its active state to its Legend');
assert.deepEqual(saveB.inventory, inventory, 'the bag is untouched');
ok('case B — placeholders unlocked: records fold and merge, the active one carries over, bag untouched');

// D. The data-loss case caught in review: two old Legends that BOTH wore gear
// fold onto one Legend. Worn gear is NOT in the bag (equipping takes the copy
// out), so the merged-away loadout must go back to the bag — total items owned
// (bag + everything worn) must not change. Also an unknown old id wearing gear.
const wornSprout = { weapon: { id: 'item_tide_blade_01', star: 1 } };
const wornRatkin = { armor: { id: 'item_bark_aegis_01', star: 0 } };
const wornUnknown = { cloak: { id: 'item_curator_cloak_01', star: 0 } };
const smallBag = [{ id: 'item_copper_keeper_01', count: 1, star: 0 }];
const beforeD = {
  ...base,
  version: 18,
  inventory: smallBag,
  avatars: [
    { id: 'ava_sprout', xp: 0, level: 6, stars: 0, equipped: wornSprout, park: {} },
    { id: 'ava_ratkin', xp: 0, level: 2, stars: 0, equipped: wornRatkin, park: {} },
    { id: 'ava_gone_forever', xp: 0, level: 1, stars: 0, equipped: wornUnknown, park: {} },
  ],
  active_avatar_id: 'ava_sprout',
};
const ownedBefore = 1 + 3; // one in the bag + three worn across the old records
const saveD = parsePlayStore(JSON.stringify(beforeD), 0);
assert.ok(saveD, 'case D parses');
assert.equal(totalOwnedAcrossAvatars(saveD), ownedBefore, 'no item is lost when loadouts merge or ids vanish');
assert.deepEqual(saveD.avatars.find((a) => a.id === 'legend_root')?.equipped, wornSprout, 'the active loadout stays worn');
const bagIds = saveD.inventory.map((st) => `${st.id}@${st.star}×${st.count}`).sort();
assert.deepEqual(
  bagIds,
  ['item_bark_aegis_01@0×1', 'item_copper_keeper_01@0×1', 'item_curator_cloak_01@0×1'].sort(),
  'the merged-away and unknown-id loadouts are back in the bag',
);
ok('case D — two Legends that both wore gear merge: the other loadout returns to the bag, nothing lost');

// Case B again, counted: nothing lost there either.
const ownedB = totalOwnedAcrossAvatars(saveB);
const expectedB = inventory.reduce((a, st) => a + st.count, 0) + 2; // gearA + gearB were worn
assert.equal(ownedB, expectedB, 'case B keeps every item (bag + worn)');
ok('case B keeps every item it owned (bag + worn)');

// C. A v19 save is not migrated again (idempotent).
const saveC = parsePlayStore(JSON.stringify(saveB), 0);
assert.deepEqual(
  saveC?.avatars.map((a) => [a.id, a.level, a.stars]),
  saveB.avatars.map((a) => [a.id, a.level, a.stars]),
  'a v19 save round-trips unchanged',
);
assert.equal(saveC?.active_avatar_id, saveB.active_avatar_id);
ok('case C — a v19 save round-trips unchanged');

/* ----------------------------------------------------------- level curve --- */

assert.equal(legendRiderScale(1), 1);
assert.equal(legendRiderScale(20), 1.5);
assert.equal(legendRiderScale(99), 1.5, 'effects stop growing past Lv20');
assert.equal(legendResistRecovery(1), 0);
assert.equal(legendResistRecovery(20), 0.5, 'a maxed Legend recovers half the penalty');
assert.ok(legendResistRecovery(1000) <= 0.5, 'and never more — switching stays worthwhile');
ok('level curve: effects ×1.0 → ×1.5 and resist recovery 0 → ½ by Lv20, capped');

/* ---------------------------------------------------------- matchup rule --- */

const creep = (tint: KitCreep['tint']): KitCreep => ({ id: 1, dist: 0.5, hp: 100, kind: 'puff', slowMs: 0, slowFactor: 1, tint });
assert.equal(matchupMult(creep('ember'), 'tide'), 1 + (KIT_TUNING.weakDamage - 1), 'Tide beats an Ember stage: +25%');
assert.equal(matchupMult(creep('ember'), 'ember'), 0.75, 'an Ember stage resists Ember: −25%');
assert.equal(matchupMult(creep('ember'), 'ember', 0.5), 0.875, 'a maxed Legend softens it to −12.5%');
assert.equal(matchupMult(creep('ember'), 'void'), 1, 'Void is never weak or resisted');
assert.equal(matchupMult(creep(null), 'ember'), 1, 'a neutral stage changes nothing');
ok('one matchup rule: +25% weak, −25% own element (−12.5% at max Legend), Void neutral');

// The Spark Legend promises single hits jump — true for the Avatar's own hit.
const pair = [creep(null), { ...creep(null), id: 2 }];
const spark = strikeCreep(pair, 1, 10, 'spark', { posOf: (c) => ({ x: c.id * 3, y: 0 }) });
assert.equal(spark.arcId, 2, 'a Spark Avatar hit jumps to the nearest other foe');
assert.ok(spark.creeps[1].hp < 100, 'and the jump deals damage');
const fire = strikeCreep(pair, 1, 10, 'ember', { posOf: (c) => ({ x: c.id * 3, y: 0 }) });
assert.equal(fire.arcId, null, 'other elements do not jump');
ok('the Spark Legend really does make single hits jump (Avatar attack included)');

for (const wave of [1, 2, 3]) assert.equal(waveDefFor('main', wave)?.element, undefined, `Main ${wave} is neutral`);
for (const wave of [1, 2, 3, 4, 5]) assert.equal(waveDefFor('trial', wave)?.element, undefined, `Trial ${wave} is neutral`);
const tinted = [4, 5, 6, 7, 8, 9, 10].map((w) => waveDefFor('main', w)?.element);
assert.ok(tinted.every(Boolean), 'Main 4-10 each carry a stage element');
assert.deepEqual(stageMatchupFor(null, 'ember', 1), { kind: 'neutral' });
assert.equal(stageMatchupFor('ember', 'tide', 1).kind, 'favoured');
const resisted = stageMatchupFor('ember', 'ember', 20);
assert.ok(resisted.kind === 'resisted' && resisted.legendPct === -13, 'the stage row shows the softened loss');
ok('early stages neutral, Main 4-10 elemental; the stage row reports the same numbers combat uses');

/* ------------------------------------------------- affinity and gear match --- */

assert.equal(getTune().heroAffinityBonus, HERO_AFFINITY_BONUS, 'tune default matches the documented affinity bonus');
assert.equal(getTune().gearMatchBonus, GEAR_MATCH_BONUS, 'tune default matches the documented gear bonus');
assert.equal(heroAffinityMult('void', 'void'), 1 + HERO_AFFINITY_BONUS, 'matching affinity: +15%');
assert.equal(heroAffinityMult('void', 'ember'), 1, 'no match: no bonus');
assert.equal(heroAffinityMult('void', null), 1);
ok(`hero affinity: +${Math.round(HERO_AFFINITY_BONUS * 100)}% when the hero's element matches the Legend`);

assert.equal(gearMatchesLegend('item_tide_blade_01', 'tide'), true);
assert.equal(gearMatchesLegend('item_tide_blade_01', 'ember'), false);
assert.equal(gearMatchesLegend('item_tide_blade_01', null), false);
const worn = { weapon: { id: 'item_tide_blade_01', star: 0 } };
const plain = equippedStatSums(worn, 'ember');
const matched = equippedStatSums(worn, 'tide');
for (const stat of Object.keys(plain) as (keyof typeof plain)[]) {
  assert.ok(
    Math.abs(matched[stat] - plain[stat] * (1 + GEAR_MATCH_BONUS)) < 1e-9,
    `${stat}: a matching Power's own stats rise by ${Math.round(GEAR_MATCH_BONUS * 100)}%`,
  );
}
ok(`gear match: a worn Power of the Legend's element gets its own stats +${Math.round(GEAR_MATCH_BONUS * 100)}%`);

console.log(`\nAll ${passed} Legend checks passed.`);
