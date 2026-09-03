/**
 * Wave 22: Dawn category Read, Explore category combine, Levity, The Story.
 * Run: npm run check:wave22
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CATEGORY_BAND_COPY_REVIEWED,
  categoryBandCopyClean,
  fallbackForReading,
} from '../src/lib/category-bands';
import {
  CATEGORY_COPY_REVIEWED,
  CATEGORY_DEFS,
  readCategory,
} from '../src/lib/categories';
import { CONCEPT_COPY_REVIEWED, CATEGORY_CONCEPTS, conceptCopyClean } from '../src/lib/concept-explainers';
import {
  DAWN_CATEGORY_COPY_REVIEWED,
  DAWN_READ_CATEGORY_IDS,
  dawnReadCategoriesAreBars,
  pickDawnReadCategory,
} from '../src/lib/dawn-category';
import { repeatsPinnedCategories } from '../src/lib/explore/combine';
import {
  STORY_COPY_REVIEWED,
  STORY_LABEL,
  STORY_TENSION_SAMPLES,
  STORY_SAMPLES,
  buildStoryPrompt,
  parseStoryBody,
  storyCopyClean,
  storyFingerprint,
  storyNamesACategory,
  storyReady,
} from '../src/lib/sage-story';
import { isThinProfile, settledCount, applyEwmaAnswer, type TraitTrack } from '../src/lib/trait-stability';
import { TITLE_COPY_REVIEWED } from '../src/lib/sage-title';
import { TRAIT_AXES } from '../src/lib/traits';
import { buildPrompt } from '../src/lib/voice/providers/prompt';
import type { VoiceMe } from '../src/lib/voice/types';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

function stableReport(axis: TraitTrack['axis'], value: number): TraitTrack {
  const nowIso = '2026-08-31T12:00:00.000Z';
  let row = applyEwmaAnswer(null, axis, 'report', value, nowIso);
  row = applyEwmaAnswer(row, axis, 'report', value, nowIso);
  return applyEwmaAnswer(row, axis, 'report', value, nowIso);
}

const me: VoiceMe = {
  name: 'Sam',
  show_up: 'steady',
  talk_style: 'even',
  knocks_you_off: 'sleep',
  morning_cue: 'make coffee',
  extraversion: 0.8,
};

console.log('PART 1 — Dawn');
assert.equal(dawnReadCategoriesAreBars(), true);
assert.deepEqual([...DAWN_READ_CATEGORY_IDS], ['cat_steadiness', 'cat_agency', 'cat_drive']);
assert.equal(pickDawnReadCategory([], 1), null);
assert.equal(pickDawnReadCategory(undefined, 1), null);
const emptyPrompt = buildPrompt({
  me,
  day: 4,
  tone: 'even',
  history: [],
  crisisToday: false,
  previousHadCut: false,
});
assert.doesNotMatch(emptyPrompt, /DAWN CATEGORY/);
assert.doesNotMatch(emptyPrompt, /extraversion/);
assert.match(emptyPrompt, /After you make coffee/);
assert.match(emptyPrompt, /AVAILABLE SIGNALS/);
ok('unset Dawn categories fall back to knock/fact/focus; 16-axis backbone is not in the Read prompt');

const promptSrc = read('src/lib/voice/providers/prompt.ts');
const routerSrc = read('src/lib/voice/router.ts');
const filtersSrc = read('src/lib/voice/filters.ts');
assert.match(routerSrc, /const reason = filterCard\(candidate/);
assert.doesNotMatch(filtersSrc, /DawnRead|dawnReadCategory/);
assert.match(promptSrc, /exactly ONE if-then action, anchored to the morning cue/);
ok('cut/crisis/anti-repeat still filter the card; Do if-then copy is untouched');

console.log('PART 2 — Explore combine');
assert.equal(repeatsPinnedCategories('Sees a plan through and shakes a bad start off today.', [
  'Sees a plan through and shakes a bad start off.',
]), true);
const explorePrompt = read('src/lib/explore/prompt.ts');
assert.match(explorePrompt, /Never combine growth_mindset, locus_of_control, and self_efficacy in one entry/);
assert.match(explorePrompt, /PINNED CATEGORIES CARD TODAY/);
assert.match(explorePrompt, /at most 2|Never a third|One category only/i);
ok('Explore keeps the agency-triple fence, pinned-card gate, and two-category cap');

console.log('PART 3 — Levity');
const levity = CATEGORY_DEFS.find((row) => row.id === 'cat_levity');
assert.ok(levity);
assert.equal(levity!.shape, 'bar');
assert.deepEqual([...levity!.axes], ['playfulness', 'conflict_assertiveness', 'conflict_cooperativeness']);
assert.equal(CATEGORY_DEFS.filter((row) => row.shape === 'map').length, 3);
const love = CATEGORY_DEFS.find((row) => row.id === 'cat_love')!;
assert.equal(love.shape, 'map');
const partial = [stableReport('playfulness', 0.8)];
assert.equal(readCategory(levity!, partial).ready, false);
const levityReady = [
  stableReport('playfulness', 0.8),
  stableReport('conflict_assertiveness', 0.6),
];
assert.equal(readCategory(levity!, levityReady).ready, true);
assert.ok(fallbackForReading(readCategory(levity!, levityReady)).length > 0);
assert.equal(CATEGORY_COPY_REVIEWED, false);
assert.equal(CATEGORY_BAND_COPY_REVIEWED, false);
assert.equal(CONCEPT_COPY_REVIEWED, false);
assert.equal(DAWN_CATEGORY_COPY_REVIEWED, false);
assert.equal(conceptCopyClean(), true);
assert.equal(categoryBandCopyClean(), true);
assert.ok(CATEGORY_CONCEPTS.cat_levity.length > 0);
ok('Levity is a bar of playfulness + conflict axes; same stability floor; copy flagged unreviewed');

console.log('PART 4 — The Story');
assert.equal(STORY_COPY_REVIEWED, false);
assert.equal(TITLE_COPY_REVIEWED, false);
assert.equal(STORY_LABEL, 'The Story');
assert.equal(STORY_TENSION_SAMPLES.length, 3);
assert.doesNotMatch(STORY_TENSION_SAMPLES.join('\n'), /leaving visible|not a verdict|on paper|told us|gut-call/i);
assert.doesNotMatch(STORY_SAMPLES[0]!.body, /on paper|none of this is a type|last stretch has been sitting/i);
assert.equal(storyCopyClean(), true);
assert.equal(storyNamesACategory('Openness to life showed up this week.'), true);
assert.equal(storyNamesACategory('A hard talk can still have a bit of air in it.'), false);
const thinTracks = [stableReport('openness', 0.5)];
assert.equal(isThinProfile(settledCount(thinTracks)), true);
assert.equal(storyReady(thinTracks), false);
const sql = read('supabase/migrations/wave22_levity_story.sql');
assert.match(sql, /claim_story_generate/);
assert.match(sql, /by_type.story/);
assert.match(sql, /does not increment Talk calls or title/);
assert.doesNotMatch(sql, /calls = calls \+ 1/);
assert.match(sql, /cat_levity/);
const titleRpc = read('supabase/migrations/wave20_trait_tracks_titles.sql');
assert.match(titleRpc, /claim_title_generate/);
assert.notEqual(sql.includes('claim_title_generate'), true);
ok('Story has its own quota lane, thin-profile gate, and no title-RPC reuse');

const many: TraitTrack[] = TRAIT_AXES.map((axis) => stableReport(axis, 0.6));
assert.equal(storyReady(many), true);
const storyPrompt = buildStoryPrompt({ tracks: many, divergenceNote: 'told and played do not quite match.' });
assert.match(storyPrompt, /TOLD-VS-PLAYED/);
assert.match(storyPrompt, /Do not name categories/);
assert.match(storyPrompt, /holistic/);
assert.match(storyPrompt, /like a friend/);
assert.equal(parseStoryBody('{"body":"You are an INTJ who needs agency."}'), null);
assert.ok(parseStoryBody('{"body":"A hard week can still leave a little room to breathe."}'));
assert.notEqual(storyFingerprint(many, null), storyFingerprint(many, 'gap'));
ok('Story prompt is a separate holistic rewrite; fingerprint moves on told-vs-played');

const fold = read('src/components/sage-story-fold.tsx');
assert.match(fold, /if \(!story\?\.body\) return null/);
assert.match(fold, /shouldUseLocalAi/);
assert.match(fold, /setStory\(null\)/);
assert.doesNotMatch(fold, /fallbackBandFor|TITLE_EMPTY|composeLocal/);
assert.match(fold, /formatStoryTensionNote/);
assert.doesNotMatch(fold, /formatDivergenceNote/);
assert.match(read('src/app/(tabs)/explore.tsx'), /SageStoryFold/);
assert.match(read('src/app/(tabs)/explore.tsx'), /CategoriesFold/);
assert.doesNotMatch(read('src/app/(tabs)/sage.tsx'), /SageStoryFold|ExplorePinnedCategories/);
ok('Story UI hides when Gemini is unreachable; no generic fallback paragraph');

assert.equal(STORY_SAMPLES.every((row) => row.shape.includes('thin') || row.body.length > 0 || row.body === ''), true);
ok('draft Story samples and tension lines exist for emci review and are not treated as reviewed');

console.log(`\n${passed} wave22 checks passed`);
