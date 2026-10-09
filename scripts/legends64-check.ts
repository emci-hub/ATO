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
  isThreeWordSkin,
  LEGEND_SKINS,
  LEGENDS64_COPY_REVIEWED,
  MODIFIER_DESCRIPTORS,
  NAME_STYLES_V2_COPY_REVIEWED,
  splitArchetypeCode,
  THIRD_WORDS,
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
ok(`all ${LEGEND_SKINS.length} skins have complete 8-entry core + modifier content`);

const allComposedNames: string[] = [];
let threeWordCount = 0;
for (const code of ALL_ARCHETYPE_CODES) {
  for (const skin of LEGEND_SKINS) {
    if (isThreeWordSkin(skin)) {
      for (const third of POLE_COMBOS) {
        const name = archetypeName(code, skin, third);
        assert.ok(name && name.split(' ').length >= 3, `archetypeName(${code}, ${skin}, ${third}) is three words`);
        allComposedNames.push(name!);
        threeWordCount += 1;
      }
    } else {
      const name = archetypeName(code, skin);
      assert.ok(name && name.length > 0, `archetypeName(${code}, ${skin}) resolves to a non-empty name`);
      allComposedNames.push(name!);
    }
  }
}
assert.equal(LEGEND_SKINS.length, 9, 'Primal Genius replaced Plain; High Fantasy, Corporate Realist and Oxymoron added');
assert.equal(LEGEND_SKINS.filter(isThreeWordSkin).length, 3);
assert.equal(threeWordCount, 3 * 64 * 8);
assert.equal(allComposedNames.length, 6 * 64 + 3 * 64 * 8, 'every two- and three-word combination resolves');
for (const skin of LEGEND_SKINS.filter(isThreeWordSkin)) {
  for (const combo of POLE_COMBOS) assert.ok(THIRD_WORDS[skin]?.[combo], `THIRD_WORDS.${skin}.${combo} is non-empty`);
}
ok(`every code resolves a name under all ${LEGEND_SKINS.length} styles (${allComposedNames.length} names)`);

// Name styles v2 (emci, 2026-10-05): fictional character names may tease, but
// never a clinical word, and every name fits the share image.
const CLINICAL = /(anxious|anxiety|depress\w*|ocd|adhd|bipolar|autis\w*|narcissis\w*|psycho\w*|schizo\w*|toxic|addict\w*|trauma\w*|disorder\w*|panic|suicid\w*|mental)/i;
for (const name of allComposedNames) {
  assert.doesNotMatch(name, CLINICAL, `"${name}" uses a clinical word`);
  assert.ok(name.length <= 34, `"${name}" is ${name.length} characters (max 34, name formula 2026-10-09)`);
}
assert.equal(NAME_STYLES_V2_COPY_REVIEWED, false, 'the new words are draft until emci reads them');
ok('no clinical words, every name is 34 characters or less, and the new words are draft');

// Name formula (emci, 2026-10-09): describer + role + one twist. Roles are
// people, never places or things; gaming roles are team roles, never "Boss";
// Mythic reads "The {role} Who {verb}"; never a private-trait word.
const PRIVATE_WORDS = /(watchful|private|secretive|mysterious|shadowy|silent|elusive|vigilant|veiled|solitary|lone|loner|guarded|burned-out|overthinking|sleepless)/i;
for (const name of allComposedNames) assert.doesNotMatch(name, PRIVATE_WORDS, `"${name}" uses a private-trait word`);
for (const skin of LEGEND_SKINS) {
  for (const role of Object.values(CORE_ROLES[skin])) {
    assert.doesNotMatch(role, /(group chat|ceo|icon|goblin|gremlin|poster|warden)/i, `role "${role}" must be a person, not a place or thing`);
  }
}
for (const role of Object.values(CORE_ROLES.gaming)) assert.doesNotMatch(role, /boss/i, `gaming role "${role}" must be a team role`);
for (const code of ALL_ARCHETYPE_CODES) {
  assert.match(archetypeName(code, 'godType')!, /^The \S.* Who \S/, `Mythic "${archetypeName(code, 'godType')}" reads "The {role} Who {verb}"`);
  const words = archetypeName(code, 'primal')!.split(' ').length;
  assert.ok(words >= 2 && words <= 4, 'two to four words');
}
for (const name of allComposedNames) assert.ok(name.split(' ').length <= 4, `"${name}" is 2–4 words`);
ok('name formula: people roles, gaming team roles, Mythic "The X Who Y", no private-trait words, 2–4 words');

for (const name of allComposedNames) {
  assert.doesNotMatch(name, /\bThe\s+.*\bThe\b/i, `"${name}" should not double up an article/title word`);
  assert.doesNotMatch(name, /\s{2,}/, `"${name}" should not have doubled internal spacing`);
}
ok('no composed name shows the double-article/run-on defect caught in review (e.g. "The X The Y")');

assert.equal(DEFAULT_LEGEND_SKIN, 'primal', 'Primal Genius replaced Plain as the default (2026-10-05)');
assert.equal(archetypeName('LHH-HHH', 'primal', 'HHL'), 'Hungry Warm Artist');
assert.equal(archetypeName('HHH-HHH', 'oxymoron', 'HHH'), 'Polite Anarchist Leader', 'oxymoron: soft, sharp, role');
assert.equal(archetypeName('LHH-LHH', 'highFantasy'), 'Bold Bard');
assert.equal(archetypeName('HHL-HLH', 'godType'), 'The Sovereign Who Listens', 'Mythic: The role Who verb');
assert.equal(
  archetypeName('LHH-HHH', 'gaming'),
  'Wholesome Shot Caller',
  'core=LHH (low follow-through, high sociability, high curiosity), modifier=HHH (all-high)',
);
ok("worked examples compose in each style's own word order");

assert.equal(archetypeName('XXX-HHH', 'gaming'), null, 'invalid core half returns null, not a silent fallback');
assert.equal(archetypeName('HHH-XXX', 'gaming'), null, 'invalid modifier half returns null, not a silent fallback');
assert.equal(archetypeName('HHH', 'gaming'), null, 'malformed code (no modifier half) returns null');
assert.equal(archetypeName('HHH-HHH-XXX', 'gaming'), null, 'malformed code (extra segment) returns null, not a silent match on the first two parts');
assert.equal(
  archetypeName('HHH-HHH', 'not-a-real-skin' as never),
  null,
  'unrecognized skin at runtime returns null, does not throw',
);
ok('invalid codes and unrecognized skins return null rather than throwing or a silent/wrong fallback');

assert.equal(isLegendSkin('real'), false, 'Plain is retired; a saved "real" opens as the default');
assert.equal(isLegendSkin('primal'), true);
assert.equal(isLegendSkin('dark'), true);
assert.equal(isLegendSkin('nonsense'), false);
assert.equal(isLegendSkin(null), false);
ok('isLegendSkin validates a persisted/user-chosen skin string before it reaches archetypeName');

// emci approved the names on 2026-10-02 after 13 words were replaced; the
// 2026-10-09 name formula changed words in every style, so it is draft again.
assert.equal(LEGENDS64_COPY_REVIEWED, false);
for (const word of ['Rizzy', 'MIA', 'Petty', 'Judgy', 'Savage', 'Cult Leader', 'Ruthless', 'Unrepentant', 'Tsundere', 'Dandere', 'Kuudere', 'Kakkoii', 'Genius Loner']) {
  for (const name of allComposedNames) {
    assert.ok(!name.includes(word), `retired word "${word}" is back in "${name}"`);
  }
}
ok(`LEGENDS64_COPY_REVIEWED is false (draft), and none of the 13 retired words appears in any of the ${allComposedNames.length} names`);

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
