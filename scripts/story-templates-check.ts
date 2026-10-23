/**
 * Story v3 templates (emci 2026-10-13).
 * Run: npm run check:story-templates
 *
 * Renders every compatible combo, pins the four approved references,
 * requires light+dark joke tags, and refuses harm-boundary lines (humor is
 * 18+: dark topics pass), unpaid setups and repeated nouns.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CATEGORY_DEFS, type CategoryId } from '../src/lib/categories';
import { STORY_ANGLES, type StoryAngle } from '../src/lib/ai-library/story';
import type { TraitLean } from '../src/lib/traits';
import {
  STORY_AI_POLISH,
  STORY_MAP_CATEGORY_LEAN_TODO,
  STORY_REFERENCES,
  STORY_STAR_TOPICS,
  checkBanned,
  checkJokes,
  checkRepeats,
  checkScript,
  checkUnpaid,
  pickStoryTemplate,
  referenceById,
  renderEveryCompatibleCombo,
} from '../src/lib/story-v3';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:story-templates'], 'tsx ./scripts/story-templates-check.ts');
ok('wired as check:story-templates');

assert.equal(STORY_AI_POLISH, false, 'Gemini/DeepSeek polish stays off until emci flips the flag');
assert.deepEqual([...STORY_MAP_CATEGORY_LEAN_TODO].sort(), ['cat_independence', 'cat_love', 'cat_structure']);
ok('polish off; map-category high/low left open');

assert.equal(STORY_STAR_TOPICS.length, 14, '14 star topics');
assert.equal(STORY_REFERENCES.length, 4, 'four approved reference stories');
ok('14 star topics and 4 reference stories');

const captain = referenceById('ref_captain_table_for_three');
assert.ok(captain);
assert.equal(captain.title, 'Captain Table for Three');
assert.equal(captain.settingTag, 'Café. 7:02 PM. Friday.');
assert.equal(captain.hook[0]?.kind === 'narrator' ? captain.hook[0].text : '', "You're meeting your date for the first time.");
assert.equal(captain.move[0]?.kind === 'narrator' ? captain.move[0].text : '', 'You pull up a third chair.');
assert.equal(captain.reveal, "Awkward moments don't scare you. You give them a chair.");
assert.equal(captain.otherWay, "The other way, you'd have hidden behind the menu until Rory left.");
assert.equal(captain.card6.categoryName, 'Everyday social energy');
assert.equal(captain.card6.evidence, 'you turned a wrong-table mix-up into a table for three');
ok('Captain Table for Three is exact');

const samples = readFileSync(resolve(root, 'docs/story/full-samples.md'), 'utf8');
for (const title of [
  'The Group Chat Whisperer',
  'Captain Table for Three',
  'Captain Fifteen Minutes',
  'Professor Closet Door',
]) {
  assert.match(samples, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const ref = STORY_REFERENCES.find((row) => row.title === title);
  assert.ok(ref, title);
  assert.ok(samples.includes(ref.reveal), `${title} reveal pinned`);
}
ok('four references match docs/story/full-samples.md');

const combos = renderEveryCompatibleCombo();
assert.ok(combos.length >= 14 * 2, `rendered ${combos.length} scripts`);
const hard: string[] = [];
for (const script of combos) {
  const flags = [
    ...checkScript(script),
    ...checkJokes(script),
    ...checkBanned(script),
    ...checkUnpaid(script),
    ...checkRepeats(script),
  ];
  // checkScript already includes those; unique by code+message
  const seen = new Set<string>();
  for (const flag of flags) {
    const key = `${script.id}:${flag.code}:${flag.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!flag.review) hard.push(`${script.id} ${flag.code}: ${flag.message}`);
  }
}
assert.equal(hard.length, 0, hard.slice(0, 12).join('\n'));
ok(`${combos.length} compatible combos pass joke, harm-boundary, unpaid, repeat and script checks`);

// Humor is 18+ (emci, 2026-10-19): dark doom passes; only the harm filter refuses.
{
  const dark = { ...captain, otherWay: 'The other way, the date dies of boredom and the menu attends the funeral.' };
  assert.deepEqual(checkBanned(dark).filter((row) => row.code === 'banned-topic'), [], 'death and funerals pass');
  for (const harmful of [
    'The other way, you tell Rory to kill himself over a chair.',
    'The other way, you call Rory a retard and leave.',
    'The other way, you drink and drive to a second café.',
  ]) {
    assert.ok(
      checkBanned({ ...captain, otherWay: harmful }).some((row) => row.code === 'banned-topic'),
      `refused: ${harmful}`,
    );
  }
  ok('dark story lines pass; self-harm encouragement, slurs and drunk driving are refused');
}

const settings = Object.keys(STORY_ANGLES) as StoryAngle[];
const leans: TraitLean[] = ['high', 'low'];
for (const def of CATEGORY_DEFS) {
  for (const setting of settings) {
    for (const lean of leans) {
      const script = pickStoryTemplate({
        categoryId: def.id as CategoryId,
        setting,
        lean,
        seed: `ci|${def.id}|${setting}|${lean}`,
      });
      assert.ok(script, `no template for ${def.id} × ${setting} × ${lean}`);
      assert.equal(checkScript(script!).filter((row) => !row.review).length, 0, script!.id);
    }
  }
}
ok(`pickStoryTemplate covers ${CATEGORY_DEFS.length} categories × ${settings.length} settings × 2 leans`);

// Insights (2026-10-14): the Story card serves templates only and never reads
// the polish flag, so no model can touch a story whatever the flag says.
const fold = readFileSync(resolve(root, 'src/components/insights/insights-story-card.tsx'), 'utf8');
assert.match(fold, /pickStoryTemplate\(/);
assert.doesNotMatch(fold, /STORY_AI_POLISH/);
assert.match(fold, /scriptToCard\(/);
ok('the Story card serves templates first and never reads the AI polish flag');

const notice = readFileSync(resolve(root, 'docs/story/NOTICE-tracery.txt'), 'utf8');
assert.match(notice, /Apache License, Version 2\.0/);
assert.match(readFileSync(resolve(root, 'src/lib/story-v3/tracery.ts'), 'utf8'), /Apache-2\.0/);
ok('Tracery Apache-2.0 notice is in the repo');

console.log(`\n${passed} story-templates checks passed (${combos.length} combos)`);
