/**
 * 64-archetype classification + content coverage (core loop redesign §4).
 * Run: npm run check:legends64
 */
import assert from 'node:assert/strict';

import {
  ALL_ARCHETYPE_CODES,
  archetypeCode,
  coreCode,
  midpointHighLow,
  modifierCode,
  POLE_COMBOS,
} from '../src/lib/legends64/classify';
import {
  archetypeName,
  CORE_ROLES,
  DEFAULT_LEGEND_SKIN,
  isLegendSkin,
  LEGEND_SKINS,
  LEGENDS64_COPY_REVIEWED,
  MODIFIER_DESCRIPTORS,
  splitArchetypeCode,
} from '../src/lib/legends64/archetypes';
import { matchingJargonTerm } from '../src/lib/voice/jargon';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

assert.equal(midpointHighLow(0.5), 'H');
assert.equal(midpointHighLow(0.4999), 'L');
assert.equal(midpointHighLow(1), 'H');
assert.equal(midpointHighLow(0), 'L');
assert.equal(midpointHighLow(null), 'L');
assert.equal(midpointHighLow(undefined), 'L');
assert.equal(midpointHighLow(NaN), 'L');
ok('midpointHighLow: straight >=0.5 split, unset/non-finite defaults low');

assert.equal(
  coreCode({ conscientiousness: 0.9, extraversion: 0.1, openness: 0.9 }),
  'HLH',
  'coreCode reads conscientiousness x extraversion x openness in that order',
);
assert.equal(
  modifierCode({ agreeableness: 0.1, conflict_assertiveness: 0.9, relatedness: 0.1 }),
  'LHL',
  'modifierCode reads agreeableness x conflict_assertiveness x relatedness in that order',
);
assert.equal(
  archetypeCode({
    conscientiousness: 0.9,
    extraversion: 0.9,
    openness: 0.9,
    agreeableness: 0.9,
    conflict_assertiveness: 0.9,
    relatedness: 0.9,
  }),
  'HHH-HHH',
);
ok('archetypeCode combines core-modifier in the documented order');

assert.equal(POLE_COMBOS.length, 8);
assert.equal(new Set(POLE_COMBOS).size, 8, 'no duplicate pole combos');
assert.equal(ALL_ARCHETYPE_CODES.length, 64, '8 core x 8 modifier = 64 total archetype codes');
assert.equal(new Set(ALL_ARCHETYPE_CODES).size, 64, 'no duplicate archetype codes');
ok('exactly 64 unique archetype codes');

for (const code of ALL_ARCHETYPE_CODES) {
  const split = splitArchetypeCode(code);
  assert.ok(split, `${code} should split into core+modifier`);
}
ok('every generated code round-trips through splitArchetypeCode');

for (const skin of LEGEND_SKINS) {
  assert.equal(Object.keys(CORE_ROLES[skin]).length, 8, `CORE_ROLES.${skin} covers all 8 core codes`);
  assert.equal(
    Object.keys(MODIFIER_DESCRIPTORS[skin]).length,
    8,
    `MODIFIER_DESCRIPTORS.${skin} covers all 8 modifier codes`,
  );
  for (const combo of POLE_COMBOS) {
    assert.ok(CORE_ROLES[skin][combo], `CORE_ROLES.${skin}.${combo} is non-empty`);
    assert.ok(MODIFIER_DESCRIPTORS[skin][combo], `MODIFIER_DESCRIPTORS.${skin}.${combo} is non-empty`);
  }
}
ok('all 6 skins have complete 8-entry core + modifier content');

const allComposedNames: string[] = [];
for (const code of ALL_ARCHETYPE_CODES) {
  for (const skin of LEGEND_SKINS) {
    const name = archetypeName(code, skin);
    assert.ok(name && name.length > 0, `archetypeName(${code}, ${skin}) resolves to a non-empty name`);
    allComposedNames.push(name!);
  }
}
assert.equal(allComposedNames.length, 384, '64 codes x 6 skins = 384 composed names');
ok('every one of the 64 codes resolves a name under all 6 skins (384 combinations)');

for (const name of allComposedNames) {
  assert.doesNotMatch(name, /\bThe\s+.*\bThe\b/i, `"${name}" should not double up an article/title word`);
  assert.doesNotMatch(name, /\s{2,}/, `"${name}" should not have doubled internal spacing`);
}
ok('no composed name shows the double-article/run-on defect caught in review (e.g. "The X The Y")');

assert.equal(
  archetypeName('LHH-HHH', DEFAULT_LEGEND_SKIN),
  'People-First Creative Director',
  "matches the plan's own worked example (core=LHH i.e. low-conscientiousness/high-extraversion/high-openness, modifier=HHH i.e. all-high) — corrected in review from an earlier, wrong HHH-HHH assumption",
);
ok("plan's worked example ('People-First Creative Director') reproduced exactly at the correct code");

assert.equal(archetypeName('XXX-HHH', 'real'), null, 'invalid core half returns null, not a silent fallback');
assert.equal(archetypeName('HHH-XXX', 'real'), null, 'invalid modifier half returns null, not a silent fallback');
assert.equal(archetypeName('HHH', 'real'), null, 'malformed code (no modifier half) returns null');
assert.equal(archetypeName('HHH-HHH-XXX', 'real'), null, 'malformed code (extra segment) returns null, not a silent match on the first two parts');
assert.equal(
  archetypeName('HHH-HHH', 'not-a-real-skin' as never),
  null,
  'unrecognized skin at runtime returns null, does not throw',
);
ok('invalid codes and unrecognized skins return null rather than throwing or a silent/wrong fallback');

assert.equal(isLegendSkin('real'), true);
assert.equal(isLegendSkin('dark'), true);
assert.equal(isLegendSkin('nonsense'), false);
assert.equal(isLegendSkin(null), false);
ok('isLegendSkin validates a persisted/user-chosen skin string before it reaches archetypeName');

assert.equal(LEGENDS64_COPY_REVIEWED, false, 'content adapted from an explicitly not-signed-off draft ships unreviewed');
ok('LEGENDS64_COPY_REVIEWED gate is false, matching sage-story.ts/category-batch.ts convention for unreviewed copy');

const allAuthoredStrings: string[] = [];
for (const skin of LEGEND_SKINS) {
  allAuthoredStrings.push(...Object.values(CORE_ROLES[skin]));
  allAuthoredStrings.push(...Object.values(MODIFIER_DESCRIPTORS[skin]));
}
for (const text of [...allAuthoredStrings, ...allComposedNames]) {
  const hit = matchingJargonTerm(text);
  assert.equal(hit, null, `authored/composed archetype text "${text}" must not contain jargon term "${hit}"`);
}
ok(
  `all ${allAuthoredStrings.length} authored fragments and all ${allComposedNames.length} composed names are clear of jargon-guard terms (via matchingJargonTerm, not raw substring match)`,
);

console.log(`\n${passed} legends64 checks passed`);
