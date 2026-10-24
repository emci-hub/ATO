/**
 * Story Library — offline gate. Run: npm run check:story-library
 *
 * Whole lines, salience, no-repeat, quote-the-answer, the deep-dive and
 * legend renders, the flag defaulting off, the closed client writers, and
 * the prepared (not applied) shutdown of ai-library-fill.
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
import { STORY_LIBRARY } from '../src/lib/story-library/library';
import { pickLine, speak } from '../src/lib/story-library/pick';
import { reviewLibraryVoice } from '../src/lib/story-library/voice-review';
import { getStoryLibrary, resetStoryLibrary, saveStoryLibrary, setStoryLibraryStore, type StoryLibraryStore } from '../src/lib/story-library/persist';
import { pickForReader, renderLibraryDive, renderLibraryLegend, tierForDiveLean, tierForStrength } from '../src/lib/story-library/render';
import { resetShown, unseenOrReset } from '../src/lib/story-library/shown';
import { validateLibrary } from '../src/lib/story-library/validate';
import { cardJokeViolation } from '../src/lib/voice/card-joke';
import { TAG_QUESTION_CAP, tagQuestionShare, type SentenceShape } from '../src/lib/voice/player-copy';
import { expandGrammar, PRONOUNS } from '../src/lib/story-v3/tracery';

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
assert.match(read('src/components/story-library-dev.tsx'), /persistStoryLibraryDevice/);
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
    .map((row) => `${row.trait} ${row.tier}: ${row.detail}`)
    .join('\n'),
);
console.log(`story-library lines: ${STORY_LIBRARY.lines.length} lines, ${report.renders} checks, 0 failures`);

assert.ok(tagQuestionShare(STORY_LIBRARY.lines.map((line) => line.text)) <= TAG_QUESTION_CAP, 'tag questions stay rare');
assert.ok(
  STORY_LIBRARY.lines.every((line) => !line.flip.trim() || line.flip.trim() !== line.text.trim()),
  'a flip note, when present, is not a copy of the line',
);

assert.equal(tierForDiveLean({ lean: 'high', pct: 80 }), 'high');
assert.equal(tierForDiveLean({ lean: 'low', pct: 80 }), 'low');
assert.equal(tierForDiveLean({ lean: 'high', pct: 50 }), 'mid');
assert.equal(tierForStrength('high', 0.3), 'high');
assert.equal(tierForStrength('low', 0.1), 'mid');

const she = pickForReader(
  STORY_LIBRARY,
  'shows',
  { name: 'Alex', pronoun: PRONOUNS.she, dominant: { trait: 'openness', tier: 'high' } },
  'lock',
);
assert.ok(she);
assert.match(speak(she.text, PRONOUNS.she, 'Alex'), /She will still try something new/);
assert.match(speak(she.text, PRONOUNS.she, 'Alex'), /even when a familiar option is right there/);

const quoted = renderLibraryDive({
  categoryId: 'cat_structure',
  leans: [{ axis: 'conscientiousness', lean: 'high', pct: 88 }],
  seed: 'quote',
  answer: 'I make the shared doc anyway',
});
assert.match(quoted.showsUp[0]!.line, /I make the shared doc anyway/);
assert.ok(quoted.lineIds.includes('conscientiousness-quote-shows'), quoted.lineIds.join(','));
assert.equal(diveLineViolation(quoted.showsUp[0]!.line, 'I make the shared doc anyway'), null, quoted.showsUp[0]!.line);

const opennessShows = STORY_LIBRARY.lines.filter(
  (line) =>
    line.slot === 'shows' &&
    (line.trait === 'openness' || line.trait === 'any') &&
    (line.tier === 'high' || line.tier === 'any') &&
    !line.requiresAnswer &&
    !line.answerIncludes &&
    line.recency !== 'recent',
);
const basePick = {
  slot: 'shows' as const,
  trait: 'openness',
  tier: 'high' as const,
  pronoun: PRONOUNS.you,
  name: 'You',
  seed: 'memory',
  usedShapes: new Set<SentenceShape>(),
  preferShape: 'when' as const,
};
const first = pickLine(STORY_LIBRARY.lines, { ...basePick, shown: new Set() });
assert.equal(first?.id, 'openness-high-shows-when', first?.id ?? '');
const second = pickLine(STORY_LIBRARY.lines, { ...basePick, shown: new Set([first!.id]) });
assert.notEqual(second?.id, first?.id, 'a shown line is skipped while the pool still has one');
const fallbackOnly = pickLine(STORY_LIBRARY.lines, {
  ...basePick,
  shown: new Set(opennessShows.filter((line) => line.priority > 0).map((line) => line.id)),
});
assert.equal(fallbackOnly?.priority, 0, 'the broad fallback is still eligible');
const exhausted = unseenOrReset(opennessShows, new Set(opennessShows.map((line) => line.id)));
assert.equal(exhausted.length, opennessShows.length, 'a used-up pool may repeat');
const again = pickLine(STORY_LIBRARY.lines, { ...basePick, shown: new Set(opennessShows.map((line) => line.id)) });
assert.equal(again?.id, first?.id, 'after the pool is used up the top line may return');
resetShown();

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
assert.match(dive.mix, /turn ordinary tasks into a game/, 'openness high + playfulness high takes the combo line');
assert.match(dive.showsUp.find((row) => row.axis === 'steadiness')!.line, /setbacks/, 'mid steadiness is some setbacks fading and some staying');
if (dive.joke) {
  assert.equal(cardJokeViolation(dive.joke), null, dive.joke);
  assert.equal(diveLineViolation(dive.joke, ''), null, dive.joke);
}
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
if (story.joke) {
  assert.equal(cardJokeViolation(story.joke), null, story.joke);
  assert.equal(legendLineViolation(story.joke, allowed, false), null, story.joke);
}
const lowDive = renderLibraryDive({
  categoryId: 'cat_openness',
  leans: [
    { axis: 'openness', lean: 'low', pct: 82 },
    { axis: 'playfulness', lean: 'low', pct: 78 },
    { axis: 'extraversion', lean: 'low', pct: 74 },
  ],
  seed: 'sample-dive-low',
});
const ruth = legendById('lf_babe_ruth');
assert.ok(ruth);
const ruthContrast = renderLibraryLegend({
  legend: ruth,
  angle: ruth.angles[0]!,
  momentId: ruth.moments[0]!.id,
  pairs: [pair('openness', 'high', 0.3)],
  differ: { axis: 'extraversion', lean: 'low', tag: null },
  seed: 'sample-ruth',
});
assert.match(ruthContrast.differ?.line ?? '', /recharge with time to yourself/);
assert.match(ruthContrast.differ?.line ?? '', /hotel suite/);

const memory: { library: ReturnType<typeof getStoryLibrary> | null } = { library: null };
const memoryStore: StoryLibraryStore = {
  read: () => memory.library,
  write: (library) => {
    memory.library = library;
  },
};
setStoryLibraryStore(memoryStore);
const edited = {
  version: STORY_LIBRARY.version,
  templates: STORY_LIBRARY.templates,
  entries: STORY_LIBRARY.entries,
  lines: STORY_LIBRARY.lines.map((line) =>
    line.id === 'openness-high-shows-when'
      ? { ...line, text: 'You would rather try something new when other people stick with a familiar plan.' }
      : line,
  ),
};
const saved = saveStoryLibrary(edited);
assert.equal(saved.ok, true, saved.ok ? '' : saved.failures.slice(0, 4).map((row) => row.detail).join('\n'));
resetStoryLibrary();
const loaded = getStoryLibrary();
assert.equal(validateLibrary(loaded, { requireApproved: true }).failures.length, 0, 'a saved library still passes the check');
const persisted = renderLibraryDive(
  { categoryId: 'cat_openness', leans: [{ axis: 'openness', lean: 'high', pct: 88 }], seed: 'persisted' },
  loaded,
);
assert.match(persisted.showsUp[0]!.line, /would rather try something new when other people/);
const refused = saveStoryLibrary({
  ...loaded,
  lines: loaded.lines.map((line) => (line.id === 'openness-high-shows-when' ? { ...line, text: 'TODO leave this in' } : line)),
});
assert.equal(refused.ok, false, 'a failing edit is not saved');
assert.match(
  getStoryLibrary().lines.find((line) => line.id === 'openness-high-shows-when')?.text ?? '',
  /would rather try something new when other people/,
);
resetStoryLibrary();
setStoryLibraryStore(null);

console.log('\n--- sample ---');
console.log('dive title:', dive.title);
console.log('shows openness:', dive.showsUp[0]!.line);
console.log('shows playfulness:', dive.showsUp[1]!.line);
console.log('shows steadiness mid:', dive.showsUp[2]!.line);
console.log('mix:', dive.mix);
console.log('notice:', dive.othersNotice);
console.log('means:', dive.whatItMeansForYou);
console.log('joke:', dive.joke);
console.log('legend title:', story.title);
console.log('won:', story.howTheTraitWon[0]!.line);
console.log('scene:', story.metScene);
console.log('differ:', story.differ?.line);
console.log('won 2:', story.howTheTraitWon[1]!.line);
console.log('legend means:', story.whatItMeansForYou);
console.log('legend joke:', story.joke);
console.log('quote:', quoted.showsUp[0]!.line);
console.log('--- low dive ---');
console.log('title:', lowDive.title);
for (const row of lowDive.showsUp) console.log(`shows ${row.axis}:`, row.line);
console.log('mix:', lowDive.mix);
console.log('notice:', lowDive.othersNotice);
console.log('means:', lowDive.whatItMeansForYou);
console.log('joke:', lowDive.joke);
console.log('ruth differ:', ruthContrast.differ?.line);

const voice = reviewLibraryVoice(STORY_LIBRARY);
assert.equal(
  voice.length,
  0,
  voice
    .slice(0, 8)
    .map((row) => row.detail)
    .join('\n'),
);

console.log(`\nmetrics: lines ${STORY_LIBRARY.lines.length}, tag-question share ${tagQuestionShare(STORY_LIBRARY.lines.map((line) => line.text)).toFixed(3)}, no-repeat pool ${opennessShows.length}`);
console.log('story-library: ok');
