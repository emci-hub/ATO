/**
 * Attack-kit check — EFFECTS_PLAN.md steps 3 and 4.
 *
 * Holds the kit data to the approved plan so a later edit can't drift it
 * silently: every hero carries a valid behavior + element, the roster matches
 * the plan's table exactly, every behavior and element is actually used, the
 * plain towers keep their kits, Void stays OUTSIDE the four-tag match cycle,
 * Spark is yellow and Void violet, and the per-behavior ranges keep their
 * shape (chain longest, pull shortest). Step 4: the combat rules in
 * `kit-combat.ts` — weakness chart, 600ms floor, slow / DoT / stun / pull
 * stacking, chain + splash targeting, ultimates — and that the engine reports
 * every hit with its element.
 *
 * Changing a hero's kit is allowed — update `EXPECTED` here in the same change,
 * so the diff shows the design call.
 *
 * Run: npm run check:kits
 */
import assert from 'node:assert/strict';

import { BOARD_MAPS } from '../src/play/board-data';
import { createDefendLive, placeTower, puffPosition, stepDefendLive } from '../src/play/defend';
import { WAVE_TINTS } from '../src/play/director';
import { TAG_COLOR, TYPE_TAGS, TYPE_MATCH_CYCLE } from '../src/play/engine/type-match';
import { allHeroes } from '../src/play/heroes-data';
import {
  KIT_TUNING,
  ULTIMATE_SECONDARY,
  applyDot,
  applyPull,
  applySlow,
  applyStun,
  fireKit,
  floorCooldown,
  isWeakTo,
  tickStatuses,
  weaknessOf,
  type KitCreep,
} from '../src/play/kit-combat';
import {
  ATTACK_COOLDOWN_FLOOR_MS,
  BEHAVIORS,
  BEHAVIOR_BASE_RANGE,
  ELEMENTS,
  ELEMENT_COLOR,
  TOWER_KITS,
  isCycleElement,
  kitLabel,
  type Behavior,
  type Element,
} from '../src/play/kits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

/** The plan's roster table (EFFECTS_PLAN.md → Roster kits). */
const EXPECTED: Record<string, [Behavior, Element]> = {
  archangel: ['burst', 'ember'],
  oni: ['burst', 'spark'],
  raven: ['burst', 'void'],
  aurex: ['splash', 'ember'],
  'frost-lich': ['splash', 'tide'],
  sak: ['splash', 'root'],
  kitsune: ['dot', 'ember'],
  'neon-viper': ['dot', 'root'],
  maldrath: ['dot', 'void'],
  corvus: ['slow', 'root'],
  elowen: ['slow', 'tide'],
  kael: ['slow', 'spark'],
  'cyber-shinobi': ['chain', 'spark'],
  velkhar: ['chain', 'void'],
  morwen: ['pull', 'tide'],
  'void-raven': ['pull', 'void'],
};

const heroes = allHeroes();

for (const hero of heroes) {
  assert.ok(
    (BEHAVIORS as readonly string[]).includes(hero.kit.behavior),
    `${hero.id}: unknown behavior ${hero.kit.behavior}`,
  );
  assert.ok(
    (ELEMENTS as readonly string[]).includes(hero.kit.element),
    `${hero.id}: unknown element ${hero.kit.element}`,
  );
}
ok(`all ${heroes.length} heroes carry a valid behavior + element`);

assert.deepEqual(
  heroes.map((h) => h.id).sort(),
  Object.keys(EXPECTED).sort(),
  'hero roster and the plan table disagree (a hero was added/removed without a kit decision)',
);
for (const hero of heroes) {
  const [behavior, element] = EXPECTED[hero.id];
  assert.equal(hero.kit.behavior, behavior, `${hero.id}: behavior drifted from the plan`);
  assert.equal(hero.kit.element, element, `${hero.id}: element drifted from the plan`);
}
ok('every hero kit matches the plan table');

for (const behavior of BEHAVIORS) {
  const n = heroes.filter((h) => h.kit.behavior === behavior).length;
  assert.ok(n >= 2, `behavior ${behavior} has only ${n} hero(es) — plan wants 2+`);
}
ok('every behavior is used by 2+ heroes');

for (const element of ELEMENTS) {
  const n = heroes.filter((h) => h.kit.element === element).length;
  assert.ok(n >= 3, `element ${element} has only ${n} hero(es) — plan wants 3+`);
}
ok('every element is used by 3+ heroes');

assert.deepEqual(TOWER_KITS.archer, { behavior: 'burst', element: null });
assert.deepEqual(TOWER_KITS.vine, { behavior: 'slow', element: 'root' });
assert.deepEqual(TOWER_KITS.crystal, { behavior: 'burst', element: 'spark' });
ok('plain towers: archer Burst (neutral), vine Slow · Root, crystal Burst · Spark');

assert.equal(TYPE_TAGS.length, 4, 'TYPE_TAGS must stay the locked four');
assert.ok(!(TYPE_TAGS as readonly string[]).includes('void'), 'void must not join TYPE_TAGS');
assert.ok(!(TYPE_MATCH_CYCLE as readonly string[]).includes('void'), 'void must not join the match cycle');
assert.equal(isCycleElement('void'), false);
assert.equal(isCycleElement(null), false);
for (const tag of TYPE_TAGS) assert.equal(isCycleElement(tag), true);
ok('Void sits outside the Tide → Ember → Root → Spark cycle');

assert.equal(TAG_COLOR.spark, '#FACC15', 'Spark is electric yellow (decision 2)');
assert.equal(ELEMENT_COLOR.void, '#A78BFA', 'Void takes the violet (decision 2)');
assert.equal(new Set(Object.values(ELEMENT_COLOR)).size, ELEMENTS.length, 'element colours must be distinct');
ok('Spark is yellow, Void is violet, all five colours distinct');

const ranges = Object.values(BEHAVIOR_BASE_RANGE);
assert.equal(BEHAVIOR_BASE_RANGE.chain, Math.max(...ranges), 'chain must reach furthest');
assert.equal(BEHAVIOR_BASE_RANGE.pull, Math.min(...ranges), 'pull must be shortest');
assert.equal(ATTACK_COOLDOWN_FLOOR_MS, 600, 'attack cooldown floor is 600ms (emci, 2026-09-24)');
ok('ranges keep their shape (chain longest, pull shortest); cooldown floor 600ms');

assert.equal(kitLabel({ behavior: 'chain', element: 'spark' }), 'Chain · Spark');
assert.equal(kitLabel(TOWER_KITS.archer), 'Burst');
ok('kit labels read "Chain · Spark" / "Burst"');

/* ------------------------------------------------ step 4: combat rules --- */

assert.deepEqual([...WAVE_TINTS].sort(), [...TYPE_TAGS].sort(), 'director tint list must equal TYPE_TAGS');
ok('wave-group tints use exactly the four cycle tags');

assert.equal(weaknessOf('ember'), 'tide', 'Tide beats Ember');
assert.equal(weaknessOf('root'), 'ember', 'Ember beats Root');
assert.equal(weaknessOf('spark'), 'root', 'Root beats Spark');
assert.equal(weaknessOf('tide'), 'spark', 'Spark beats Tide');
assert.equal(weaknessOf(null), null);
const tintedCreep: KitCreep = { id: 1, dist: 0.5, hp: 100, kind: 'puff', slowMs: 0, slowFactor: 1, tint: 'ember' };
assert.equal(isWeakTo(tintedCreep, 'tide'), true);
assert.equal(isWeakTo(tintedCreep, 'void'), false, 'Void never matches a weakness');
ok('weakness follows the chart (each tag beats the next); Void never matches');

assert.deepEqual(floorCooldown(900), { cooldownMs: 900, damageMult: 1 });
const fast = floorCooldown(300);
assert.equal(fast.cooldownMs, ATTACK_COOLDOWN_FLOOR_MS);
assert.equal(fast.damageMult, 2, 'speed past the floor turns into damage (300ms → 600ms at 2x)');
ok('600ms attack floor converts extra speed into damage');

const base: KitCreep = { id: 2, dist: 0.5, hp: 100, kind: 'puff', slowMs: 0, slowFactor: 1, tint: null };
let slowed = applySlow(base, 0.7, 1000);
slowed = applySlow(slowed, 0.9, 2000);
assert.equal(slowed.slowFactor, 0.7, 'strongest slow wins');
assert.equal(slowed.slowMs, 1000, 'a weaker slow never extends a stronger one');
const refreshed = applySlow(applySlow(base, 0.7, 1000), 0.6, 2000);
assert.equal(refreshed.slowFactor, 0.6);
assert.equal(refreshed.slowMs, 2000, 'an equal-or-stronger slow refreshes to the longer duration');
let stunTest = applyStun(base, 300);
let ticks = 0;
while ((stunTest.stunMs ?? 0) > 0) {
  stunTest = tickStatuses([stunTest], 100).creeps[0];
  ticks += 1;
}
assert.equal(ticks, 3, 'a 300ms stun spans 3 x 100ms ticks');
assert.equal(applySlow(base, 0.05, 500).slowFactor, KIT_TUNING.slowFloor, 'never below the 30% speed floor');
assert.equal(applySlow({ ...base, kind: 'boss' }, 0.05, 500).slowFactor, KIT_TUNING.slowFloorBoss, 'bosses floor at 50%');
ok('slows: strongest wins, weaker never extends it, 30% floor (bosses 50%)');

let dotted = applyDot(base, { element: 'ember', dps: 5, ms: 1000 });
dotted = applyDot(dotted, { element: 'ember', dps: 3, ms: 3000 });
assert.equal(dotted.dots?.length, 1, 'same element refreshes instead of stacking');
assert.deepEqual(dotted.dots?.[0], { element: 'ember', dps: 5, ms: 3000 });
dotted = applyDot(dotted, { element: 'void', dps: 2, ms: 1000 });
dotted = applyDot(dotted, { element: 'root', dps: 2, ms: 1000 });
assert.deepEqual(dotted.dots?.map((d) => d.element), ['void', 'root'], 'max 2 DoTs, oldest dropped');
ok('DoTs: same element refreshes, different elements coexist up to 2');

let stunned = applyStun(base, 300);
stunned = tickStatuses([stunned], 300).creeps[0];
assert.ok((stunned.stunMs ?? 0) === 0 && (stunned.stunImmuneMs ?? 0) > 0, 'a stun that ends leaves 1s immunity');
assert.equal(applyStun(stunned, 300).stunMs ?? 0, 0, 'no re-stun while immune');
ok('stuns leave 1s of immunity');

const pulledOnce = applyPull(base, 0.1);
assert.ok(Math.abs(pulledOnce.dist - 0.4) < 1e-9);
const pulledTwice = applyPull(pulledOnce, 0.1);
assert.ok(Math.abs(pulledTwice.dist - 0.35) < 1e-9, 'a repeat pull within 3s is half as strong');
assert.ok(Math.abs(applyPull({ ...base, kind: 'boss' }, 0.1).dist - 0.475) < 1e-9, 'bosses take a quarter');
assert.equal(applyPull({ ...base, dist: 0.01 }, 0.1).dist, 0, 'never pulled behind the start');
ok('pulls: repeats halve, bosses take 25%, clamped at the start');

// Five creeps in a line, 5 units apart along x (positions are fed in, so no map).
const line: KitCreep[] = [0, 1, 2, 3, 4].map((i) => ({ ...base, id: 10 + i, dist: 0.9 - i * 0.01 }));
const posOf = (c: KitCreep) => ({ x: (c.id - 10) * 5, y: 0 });
const chainHit = fireKit(line, { kit: { behavior: 'chain', element: 'spark' }, level: 1, damage: 10, heroShare: false, burst: 'first', source: 'hero', sourceId: 1, from: { x: 0, y: 0 } }, 22, { posOf }).hit!;
assert.deepEqual(chainHit.puffIds, [10, 11, 12, 13, 14], 'chain starts first-to-exit and bounces nearest-unhit (3 + Spark +1 = 4 bounces)');
assert.ok(chainHit.damage[1] < chainHit.damage[0], 'each bounce hits softer');
const tideChain = fireKit(line, { kit: { behavior: 'chain', element: 'tide' }, level: 1, damage: 10, heroShare: false, burst: 'first', source: 'hero', sourceId: 1, from: { x: 0, y: 0 } }, 22, { posOf: (c) => ({ x: (c.id - 10) * 7, y: 0 }) }).hit!;
assert.equal(tideChain.puffIds.length, 1, 'Tide tightens the bounce range (7 apart > 6) — "frost chain"');
ok('chain: nearest-unhit bounces, Spark +1 bounce, Tide tighter reach');

const cluster: KitCreep[] = [
  { ...base, id: 20, dist: 0.95 },
  { ...base, id: 21, dist: 0.5 },
  { ...base, id: 22, dist: 0.49 },
  { ...base, id: 23, dist: 0.48 },
];
const clusterPos = (c: KitCreep) => (c.id === 20 ? { x: 15, y: 0 } : { x: 0, y: (c.id - 21) * 2 });
const splashHit = fireKit(cluster, { kit: { behavior: 'splash', element: 'ember' }, level: 1, damage: 10, heroShare: false, burst: 'first', source: 'hero', sourceId: 1, from: { x: 5, y: 0 } }, 16, { posOf: clusterPos }).hit!;
assert.equal(splashHit.puffIds.includes(20), false, 'splash skips the lone runner up front');
assert.equal(splashHit.puffIds.length, 3, 'and blasts the group of three');
ok('splash aims at the most enemies in its radius');

assert.equal(ULTIMATE_SECONDARY.tide, 'void', 'Frosted Gravity: a Tide ultimate mixes in Void');
const ult = fireKit([{ ...base }], { kit: { behavior: 'pull', element: 'tide' }, level: 1, damage: 10, heroShare: true, burst: 'first', source: 'hero', sourceId: 1, from: { x: 0, y: 0 }, ultimate: { radius: 20 } }, 14, { posOf: () => ({ x: 5, y: 0 }) });
assert.equal(ult.hit?.ultimate, true);
assert.equal(ult.hit?.secondary, 'void');
assert.ok((ult.creeps[0].shredMs ?? 0) > 0, 'the secondary element lands (Void shred)');
assert.ok((ult.creeps[0].slowMs ?? 0) > 0, 'and the primary (Tide chill) too');
ok('ultimates fire at level 3 with a second element at half strength');

// Engine: towers report hits with their element (screen draws + colours them).
const board = BOARD_MAPS.ato;
let live = createDefendLive(1, { mapId: 'trial', boardId: 'ato' });
live = placeTower(live, 0, 'crystal') ?? live;
const pad0 = board.pads[0];
let nearD = -1;
for (let d = 0; d <= 1; d += 0.0005) {
  const p = puffPosition(d, board);
  if (Math.hypot(p.x * 100 - pad0.x, p.y * 100 - pad0.y) <= 18) {
    nearD = d;
    break;
  }
}
assert.ok(nearD >= 0, 'found a path point near pad 0');
live = {
  ...live,
  schedule: [],
  puffs: [{ ...base, id: 99, dist: nearD, maxHp: 1000, hp: 1000, size: 1, burstHpPct: null, burstFired: false, laneIndex: 0 }],
};
const stepped = stepDefendLive(live, 100, { wavePower: 1, towerSpeed: 1, avatarLevel: 1, typeMatch: 0, avatarStars: 0 }, { x: -999, y: -999 });
assert.equal(stepped.hits.length, 1, 'one tower shot → one hit record');
assert.equal(stepped.hits[0].element, 'spark', 'the crystal reports its Spark element');
assert.equal(stepped.hits[0].primaryId, 99);
ok('the engine reports every kit hit with its element (drives effects + number colour)');

console.log(`\nAll ${passed} kit checks passed.`);
