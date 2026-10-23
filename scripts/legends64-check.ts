/**
 * 64-archetype classification + content coverage (core loop redesign §4).
 * Run: npm run check:legends64
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  LEGENDARY_TITLES,
  LEGEND_SKINS,
  LEGENDS64_COPY_REVIEWED,
  MODIFIER_DESCRIPTORS,
  NAME_STYLES_V2_COPY_REVIEWED,
  splitArchetypeCode,
  THIRD_WORDS,
} from '../src/lib/legends64/archetypes';
import { collectTitleBankErrors, dedupeTitles, TITLE_TRAIT_WORDS } from '../src/lib/legends64/title-dedupe';
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
        const words = name ? name.replace(/,/g, '').split(/\s+/).filter(Boolean).length : 0;
        assert.ok(name && words >= 2 && words <= 4, `archetypeName(${code}, ${skin}, ${third}) is 2–4 words`);
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
const CLINICAL = /\b(anxious|anxiety|depress\w*|ocd|adhd|bipolar|autis\w*|narcissis\w*|psycho\w*|schizo\w*|toxic|addict\w*|trauma\w*|disorder\w*|panic|suicid\w*|mental)\b/i;
for (const name of allComposedNames) {
  assert.doesNotMatch(name, CLINICAL, `"${name}" uses a clinical word`);
  assert.ok(name.length <= 34, `"${name}" is ${name.length} characters (max 34, name formula 2026-10-09)`);
}
assert.equal(NAME_STYLES_V2_COPY_REVIEWED, true, 'emci approved the name-style words (v5, 2026-10-12)');
ok('no clinical words, every name is 34 characters or less, and the new words are approved');

// Name styles v5 (emci, 2026-10-12): trait-end words never appear; roles are
// people, never places or things; gaming roles are team roles, never "Boss";
// Mythic reads "The {role} Who {verb}" (Legendary Mythic too).
const TRAIT_WORD = new RegExp(
  `\\b(${TITLE_TRAIT_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'i',
);
for (const name of allComposedNames) assert.doesNotMatch(name, TRAIT_WORD, `"${name}" uses a trait word`);
for (const skin of LEGEND_SKINS) {
  for (const role of Object.values(CORE_ROLES[skin])) {
    assert.doesNotMatch(role, /\b(group chat|ceo|icon|goblin|gremlin|poster)\b/i, `role "${role}" must be a person, not a place or thing`);
  }
}
for (const role of Object.values(CORE_ROLES.gaming)) assert.doesNotMatch(role, /\bboss\b/i, `gaming role "${role}" must be a team role`);
for (const code of ALL_ARCHETYPE_CODES) {
  assert.match(archetypeName(code, 'godType')!, /^The \S.* Who \S/, `Mythic "${archetypeName(code, 'godType')}" reads "The {role} Who {verb}"`);
  const words = archetypeName(code, 'primal')!.split(' ').length;
  assert.ok(words >= 2 && words <= 4, 'two to four words');
}
for (const name of allComposedNames) {
  const words = name.replace(/,/g, '').split(/\s+/).filter(Boolean).length;
  assert.ok(words >= 2 && words <= 4, `"${name}" is 2–4 words`);
}
ok('name formula: people roles, gaming team roles, Mythic "The X Who Y", no trait words, 2–4 words');

for (const name of allComposedNames) {
  assert.doesNotMatch(name, /\bThe\s+.*\bThe\b/i, `"${name}" should not double up an article/title word`);
  assert.doesNotMatch(name, /\s{2,}/, `"${name}" should not have doubled internal spacing`);
}
ok('no composed name shows the double-article/run-on defect caught in review (e.g. "The X The Y")');

assert.equal(DEFAULT_LEGEND_SKIN, 'primal', 'Primal Genius replaced Plain as the default (2026-10-05)');
assert.equal(archetypeName('LHH-HHH', 'primal', 'HHL'), 'Grinning Muralist, Hungry');
assert.equal(archetypeName('HHH-HHL', 'oxymoron', 'HHH'), 'Cheerful Anarchist Ambassador', 'oxymoron: soft, sharp, role');
assert.equal(archetypeName('LHH-LHH', 'highFantasy'), 'Bard of the Vanguard');
assert.equal(archetypeName('HHL-HLH', 'godType'), 'The Oathbinder Who Listens', 'Mythic: The role Who verb');
assert.equal(
  archetypeName('LHH-HHH', 'gaming'),
  'MVP Shot Caller',
  'core=LHH (low follow-through, high sociability, high curiosity), modifier=HHH (all-high)',
);
assert.equal(archetypeName('HHH-HHH', 'primal', 'HHH'), LEGENDARY_TITLES.primal);
assert.equal(archetypeName('HHH-HHH', 'highFantasy'), LEGENDARY_TITLES.highFantasy);
assert.equal(archetypeName('HHH-HHH', 'corporate', 'HHH'), LEGENDARY_TITLES.corporate);
assert.equal(archetypeName('HHH-HHH', 'oxymoron', 'HHH'), LEGENDARY_TITLES.oxymoron);
assert.equal(archetypeName('HHH-HHH', 'gaming'), LEGENDARY_TITLES.gaming);
assert.equal(archetypeName('LLL-LLL', 'godType'), LEGENDARY_TITLES.godType);
assert.equal(archetypeName('LLL-LLL', 'anime'), LEGENDARY_TITLES.anime);
assert.equal(archetypeName('HHH-HHH', 'funny'), LEGENDARY_TITLES.funny);
assert.equal(archetypeName('HHH-HHH', 'dark'), LEGENDARY_TITLES.dark);
assert.equal(archetypeName('HHH-HHH', 'primal', 'HHL'), 'Grinning Pathfinder, Hungry', 'Legendary needs every code, including the third');
ok("worked examples compose in each style's own word order, including Legendary ★");

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
// 2026-10-09 name formula changed words in every style; emci approved them the same day.
assert.equal(LEGENDS64_COPY_REVIEWED, true);
for (const word of ['Rizzy', 'MIA', 'Petty', 'Judgy', 'Savage', 'Cult Leader', 'Ruthless', 'Tsundere', 'Dandere', 'Kuudere', 'Kakkoii', 'Genius Loner']) {
  for (const name of allComposedNames) {
    assert.ok(!name.includes(word), `retired word "${word}" is back in "${name}"`);
  }
}
ok(`LEGENDS64_COPY_REVIEWED is true, and none of the retired words appears in any of the ${allComposedNames.length} names`);

const allAuthoredStrings: string[] = [];
for (const skin of LEGEND_SKINS) {
  allAuthoredStrings.push(...Object.values(CORE_ROLES[skin]));
  allAuthoredStrings.push(...Object.values(MODIFIER_DESCRIPTORS[skin]));
  if (THIRD_WORDS[skin]) allAuthoredStrings.push(...Object.values(THIRD_WORDS[skin]!));
}
for (const text of [...allAuthoredStrings, ...allComposedNames]) {
  const hit = matchingJargonTerm(text);
  assert.equal(hit, null, `authored/composed archetype text "${text}" must not contain jargon term "${hit}"`);
}
ok(
  `all ${allAuthoredStrings.length} authored fragments and all ${allComposedNames.length} composed names are clear of jargon-guard terms (via matchingJargonTerm, not raw substring match)`,
);


const bankErrors = collectTitleBankErrors();
assert.deepEqual(bankErrors, [], bankErrors.join('\n') || 'title banks are unique');
ok('v5 dedupe: no stem repeats, no same-code synonym clusters, no trait words, legendary length ok');

function parseTitlesCsv(raw: string): { style: string; codes: string; title: string }[] {
  const rows: { style: string; codes: string; title: string }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('style,')) continue;
    const match = line.match(/^([^,]+),([^,]+),("(?:[^"]|"")*"|[^,]*),/);
    if (!match) throw new Error(`bad fixture row: ${line}`);
    const title = match[3].startsWith('"') ? match[3].slice(1, -1).replace(/""/g, '"') : match[3];
    rows.push({ style: match[1], codes: match[2], title: title.replace(/\s*★\s*$/u, '').trim() });
  }
  return rows;
}

const fixturePath = resolve(__dirname, '../src/lib/legends64/ato-titles-v5.csv');
const fixture = parseTitlesCsv(readFileSync(fixturePath, 'utf8'));
assert.equal(fixture.length, 1920, 'v5 fixture lists all 1,920 combos');
const expected = new Map(fixture.map((row) => [`${row.style}\t${row.codes}`, row.title]));
assert.equal(expected.size, 1920, 'fixture keys are unique');

let compared = 0;
for (const skin of LEGEND_SKINS) {
  for (const code of ALL_ARCHETYPE_CODES) {
    if (isThreeWordSkin(skin)) {
      for (const third of POLE_COMBOS) {
        const key = `${skin}\t${code}/${third}`;
        const got = archetypeName(code, skin, third);
        assert.equal(got, expected.get(key), `${key}: app="${got}" fixture="${expected.get(key)}"`);
        compared += 1;
      }
    } else {
      const key = `${skin}\t${code}`;
      const got = archetypeName(code, skin);
      assert.equal(got, expected.get(key), `${key}: app="${got}" fixture="${expected.get(key)}"`);
      compared += 1;
    }
  }
}
assert.equal(compared, 1920);
ok('every combo matches src/lib/legends64/ato-titles-v5.csv exactly');

for (const code of ALL_ARCHETYPE_CODES) {
  for (const third of [undefined, ...POLE_COMBOS]) {
    const rows = LEGEND_SKINS.map((skin) => ({
      skin,
      title: isThreeWordSkin(skin)
        ? (archetypeName(code, skin, third ?? 'HHH') ?? '')
        : (archetypeName(code, skin) ?? ''),
    }));
    const deduped = dedupeTitles(rows);
    assert.deepEqual(
      deduped.map((row) => row.title),
      rows.map((row) => row.title),
      `dedupeTitles must be a no-op on v5 banks (${code}/${third ?? '-'})`,
    );
  }
}
ok('dedupeTitles is a deterministic no-op on every v5 picker set');

const copyReview = readFileSync(resolve(__dirname, '../docs/copy-review.md'), 'utf8');
assert.match(copyReview, /## 2\. Archetype names — name styles v5/);
assert.match(copyReview, /\{Role\} of the \{Place\}/);
assert.match(copyReview, /\{Describer\} \{Role\}, \{Extra\}/);
assert.match(copyReview, /\{Describer\} \{Role\} of \{Domain\}/);
assert.match(copyReview, /\{Role\} the \{Epithet\}/);
assert.match(copyReview, /Pure Sunbeam Energy/);
assert.match(copyReview, /The Rumor Who Lingers/);
assert.match(copyReview, /Mid-Credits Twist/);
ok('docs/copy-review.md §2 pins the v5 templates, banks and Legendary ★ titles');

console.log(`\n${passed} legends64 checks passed`);
