/**
 * Story Library — offline gate. Run: npm run check:story-library
 *
 * The filler matrix (every template × trait × tier × pronoun), the lock /
 * no-repeat / ending rules, the deep-dive and legend renders, the flag
 * defaulting off, the closed client writers, and the prepared (not applied)
 * shutdown of ai-library-fill.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DIVE_MEANS_MAX_WORDS,
  DIVE_MEANS_MIN_WORDS,
  MIX_MAX_WORDS,
  MIX_MIN_WORDS,
  NOTICE_MAX_WORDS,
  NOTICE_MIN_WORDS,
  SHOWS_MAX_WORDS,
  SHOWS_MIN_WORDS,
  diveLineViolation,
} from '../src/lib/category-deep-dive/dive';
import { legendById } from '../src/lib/legend-figures/roster';
import {
  DIFFER_MAX_WORDS,
  DIFFER_MIN_WORDS,
  MEANS_MAX_WORDS,
  MEANS_MIN_WORDS,
  SCENE_MAX_WORDS,
  SCENE_MIN_WORDS,
  TITLE_MAX_WORDS,
  WON_MAX_WORDS,
  legendLineViolation,
  titleViolation,
  type LegendPair,
} from '../src/lib/legend-figures/story';
import { STORY_LIBRARY_RUNTIME } from '../src/lib/story-library/flags';
import { STORY_LIBRARY, templateById } from '../src/lib/story-library/library';
import { renderLibraryDive, renderLibraryLegend, tierForDiveLean, tierForStrength } from '../src/lib/story-library/render';
import { validateLibrary } from '../src/lib/story-library/validate';
import { expandGrammar, fill, selectEntry, PRONOUNS } from '../src/lib/story-v3/tracery';

const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

function between(text: string, min: number, max: number, label: string) {
  const n = words(text);
  assert.ok(n >= min && n <= max, `${label} is ${n} words, want ${min}–${max}: ${text}`);
}

assert.equal(STORY_LIBRARY_RUNTIME, false, 'the story library flag ships off');
assert.match(
  read('src/components/ai-consent-card.tsx'),
  /AI_USE_DISCLOSURE = STORY_LIBRARY_RUNTIME \? AI_USE_DISCLOSURE_LIBRARY : AI_USE_DISCLOSURE_MODEL/,
  'while the flag is off the disclosure still names the model',
);
assert.match(read('src/lib/story-library/flags.ts'), /return false/, 'the flag default is written down');

assert.doesNotMatch(read('src/lib/category-deep-dive/generate.ts'), /generateText\(/);
assert.doesNotMatch(read('src/lib/legend-figures/generate.ts'), /generateText\(/);
assert.match(read('src/components/category-deep-dive-card.tsx'), /STORY_LIBRARY_RUNTIME/);
assert.match(read('src/app/(tabs)/legends.tsx'), /STORY_LIBRARY_RUNTIME/);
assert.match(read('src/components/story-library-dev.tsx'), /validateLibrary/);
assert.match(read('src/components/story-library-dev.tsx'), /Ending preview/);
assert.match(read('src/components/story-library-dev.tsx'), /Tap again to approve/);
assert.match(read('src/app/dev-lab.tsx'), /<HubTool id="story-library">/);
assert.match(read('src/lib/dev-hub-catalog.ts'), /id: 'story-library'/);

const shutdown = read('docs/story-library/shutdown/unschedule-ai-library.sql');
assert.match(shutdown, /DO NOT APPLY/);
assert.match(shutdown, /cron\.unschedule\('ai-library-fill'\)/);
assert.equal(existsSync(resolve(root, 'supabase/migrations/unschedule-ai-library.sql')), false, 'the unschedule is not a migration');
assert.match(read('supabase/functions/ai-library/index.ts'), /await complete\(/, 'the live writer still calls the model');
const writerNote = read('docs/story-library/shutdown/ai-library-writer-off.md');
assert.match(writerNote, /do not deploy/i);
assert.match(writerNote, /deep_dive/);
assert.match(writerNote, /legend/);
assert.match(writerNote, /before/);

const expanded = expandGrammar({ start: 'Hello' }, '#start#', {
  categoryId: 'cat_openness',
  setting: 'home',
  lean: 'high',
  seed: 'story-library',
});
assert.equal(expanded.text, 'Hello', 'expandGrammar still expands');

const report = validateLibrary(STORY_LIBRARY, { requireApproved: true });
assert.equal(
  report.failures.length,
  0,
  report.failures
    .slice(0, 8)
    .map((row) => `${row.templateId} ${row.trait} ${row.tier} ${row.pronoun}: ${row.detail}`)
    .join('\n'),
);
console.log(`story-library matrix: ${report.renders} renders, 0 failures`);

const you = {
  name: 'Alex',
  pronoun: PRONOUNS.you,
  dominant: { trait: 'openness', tier: 'low' as const },
};
const verbSlot = templateById('dive-shows')!.slots[0]!;
const avoidedTier = selectEntry(STORY_LIBRARY.entries, verbSlot, you, 'avoid', new Set(['openness-low-verb']));
assert.equal(avoidedTier.entry?.id, 'openness-any-glance', 'no-repeat walks to the trait-any pool');
const avoidedBoth = selectEntry(
  STORY_LIBRARY.entries,
  verbSlot,
  you,
  'avoid',
  new Set(['openness-low-verb', 'openness-any-glance']),
);
assert.equal(avoidedBoth.entry?.id, 'generic-stop', 'no-repeat then walks to generic');

const lock = fill(templateById('dive-lock')!, { ...you, pronoun: PRONOUNS.she, dominant: { trait: 'openness', tier: 'high' } }, STORY_LIBRARY.entries, 'lock', {
  requireApproved: true,
});
assert.equal(lock.issues.length, 0, lock.issues.map((issue) => issue.detail).join('; '));
assert.equal(lock.picks.find, lock.picks.findBare, 'a lock reuses one entry');
assert.match(lock.text, /an open tab/);
assert.match(lock.text, /The same open tab/);
assert.match(lock.text, /She dives/);

const repeat = fill(templateById('dive-repeat')!, you, STORY_LIBRARY.entries, 'repeat', { requireApproved: true });
assert.notEqual(repeat.picks.aside, repeat.picks.aside2, 'a second slot does not repeat the entry');

const combo = fill(
  templateById('dive-means')!,
  { ...you, dominant: { trait: 'openness', tier: 'high' }, secondary: { trait: 'playfulness', tier: 'high' } },
  STORY_LIBRARY.entries,
  'combo',
  { requireApproved: true },
);
assert.equal(combo.endingId, 'end-open-play-high');
assert.match(combo.text, /They|You|She|He|took the detour/);
assert.match(combo.text, /took the detour/);

const mid = fill(
  templateById('dive-means')!,
  { name: 'Alex', pronoun: PRONOUNS.she, dominant: { trait: 'steadiness', tier: 'mid' } },
  STORY_LIBRARY.entries,
  'mid',
  { requireApproved: true },
);
assert.equal(mid.endingId, 'end-steadiness-mid');
assert.match(mid.text, /She left it after one fair look/);
assert.match(mid.text, /The night stays small, and that is enough/);

assert.equal(tierForDiveLean({ lean: 'high', pct: 80 }), 'high');
assert.equal(tierForDiveLean({ lean: 'low', pct: 80 }), 'low');
assert.equal(tierForDiveLean({ lean: 'high', pct: 50 }), 'mid');
assert.equal(tierForStrength('high', 0.3), 'high');
assert.equal(tierForStrength('low', 0.1), 'mid');

const dive = renderLibraryDive({
  categoryId: 'cat_openness',
  leans: [
    { axis: 'openness', lean: 'high', pct: 82 },
    { axis: 'playfulness', lean: 'high', pct: 78 },
    { axis: 'steadiness', lean: 'low', pct: 52 },
  ],
  seed: 'sample-dive',
});
assert.equal(dive.source, 'library');
assert.equal(dive.showsUp.length, 3);
assert.equal(titleViolation(dive.title, ''), null, dive.title);
for (const line of dive.showsUp) {
  between(line.line, SHOWS_MIN_WORDS, SHOWS_MAX_WORDS, `shows ${line.axis}`);
  assert.equal(diveLineViolation(line.line, ''), null, `${line.axis}: ${line.line}`);
}
assert.ok(dive.mix);
between(dive.mix, MIX_MIN_WORDS, MIX_MAX_WORDS, 'mix');
assert.equal(diveLineViolation(dive.mix, ''), null, dive.mix);
assert.ok(dive.othersNotice);
between(dive.othersNotice, NOTICE_MIN_WORDS, NOTICE_MAX_WORDS, 'notice');
assert.equal(diveLineViolation(dive.othersNotice, ''), null, dive.othersNotice);
between(dive.whatItMeansForYou, DIVE_MEANS_MIN_WORDS, DIVE_MEANS_MAX_WORDS, 'means');
assert.equal(diveLineViolation(dive.whatItMeansForYou, ''), null, dive.whatItMeansForYou);
assert.match(dive.whatItMeansForYou, /took the detour/, 'openness high + playfulness high takes the combo ending');
assert.match(dive.showsUp.find((row) => row.axis === 'steadiness')!.line, /\bwait\b/, 'mid steadiness uses the mid verb');

const legend = legendById('lf_marie_curie');
assert.ok(legend);
const pair = (axis: 'openness' | 'steadiness', lean: 'high' | 'low', strength: number): LegendPair => ({
  axis,
  lean,
  strength,
  contrast: false,
  tag: { axis, lean, them: 'their curious side', why: 'the work kept going' },
});
const story = renderLibraryLegend({
  legend,
  angle: legend.angles[0]!,
  momentId: legend.moments[0]!.id,
  pairs: [pair('openness', 'high', 0.3), pair('steadiness', 'low', 0.08)],
  differ: { axis: 'extraversion', lean: 'low', tag: null },
  seed: 'sample-legend',
});
assert.equal(story.source, 'library');
assert.equal(story.whereYouMatch.length, 2);
assert.equal(story.howTheTraitWon[0]!.momentId, legend.moments[0]!.id);
const allowed = `${legend.name} ${legend.whoTheyWere} ${legend.famousFor}`;
assert.equal(titleViolation(story.title ?? '', allowed), null, story.title ?? '');
between(story.metScene ?? '', SCENE_MIN_WORDS, SCENE_MAX_WORDS, 'scene');
between(story.whatItMeansForYou, MEANS_MIN_WORDS, MEANS_MAX_WORDS, 'legend means');
between(story.differ?.line ?? '', DIFFER_MIN_WORDS, DIFFER_MAX_WORDS, 'differ');
for (const won of story.howTheTraitWon) {
  assert.ok(words(won.line) <= WON_MAX_WORDS, won.line);
  assert.ok(words(won.line) >= 8, won.line);
}
assert.ok(words(story.title ?? '') <= TITLE_MAX_WORDS);
for (const line of [story.metScene ?? '', story.whatItMeansForYou, story.differ?.line ?? '', ...story.howTheTraitWon.map((row) => row.line)]) {
  assert.equal(legendLineViolation(line, allowed, false), null, line);
}
assert.doesNotMatch(story.metScene ?? '', /\byou are\b/i);

console.log('\n--- matrix sample ---');
console.log('dive title:', dive.title);
console.log('shows openness:', dive.showsUp[0]!.line);
console.log('shows playfulness:', dive.showsUp[1]!.line);
console.log('shows steadiness mid:', dive.showsUp[2]!.line);
console.log('mix:', dive.mix);
console.log('notice:', dive.othersNotice);
console.log('means:', dive.whatItMeansForYou);
console.log('legend title:', story.title);
console.log('won:', story.howTheTraitWon[0]!.line);
console.log('scene:', story.metScene);
console.log('differ:', story.differ?.line);
console.log('legend means:', story.whatItMeansForYou);
console.log('lock:', lock.text);
console.log('combo ending:', combo.endingId);
console.log('mid ending:', mid.endingId);

console.log('\nstory-library: ok');
