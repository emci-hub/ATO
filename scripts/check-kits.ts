/**
 * Attack-kit check — EFFECTS_PLAN.md step 3.
 *
 * Holds the kit data to the approved plan so a later edit can't drift it
 * silently: every hero carries a valid behavior + element, the roster matches
 * the plan's table exactly, every behavior and element is actually used, the
 * plain towers keep their kits, Void stays OUTSIDE the four-tag match cycle,
 * Spark is yellow and Void violet, and the per-behavior ranges keep their
 * shape (chain longest, pull shortest).
 *
 * Changing a hero's kit is allowed — update `EXPECTED` here in the same change,
 * so the diff shows the design call.
 *
 * Run: npm run check:kits
 */
import assert from 'node:assert/strict';

import { TAG_COLOR, TYPE_TAGS, TYPE_MATCH_CYCLE } from '../src/play/engine/type-match';
import { allHeroes } from '../src/play/heroes-data';
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

console.log(`\nAll ${passed} kit checks passed.`);
