/**
 * Wave 22: Explore category combine, Levity, The Story.
 * Run: npm run check:wave22
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
import { repeatsPinnedCategories } from '../src/lib/explore/combine';
import {
  STORY_LABEL,
  formatStoryTensionNote,
  storyFingerprint,
  storyNamesACategory,
  storyReady,
} from '../src/lib/sage-story';
import { isThinProfile, settledCount, applyEwmaAnswer, type TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES } from '../src/lib/traits';

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

// PART 1 (Dawn read-category selection) removed 2026-09-14 with the card lane.
// dawn-category.ts still exists only because voice/providers/prompt.ts — a Talk
// dependency — imports it; nothing reachable calls the card prompt any more.

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
assert.equal(CATEGORY_COPY_REVIEWED, true); // emci approved 2026-10-02
assert.equal(CATEGORY_BAND_COPY_REVIEWED, true);
assert.equal(CONCEPT_COPY_REVIEWED, true);
assert.equal(conceptCopyClean(), true);
assert.equal(categoryBandCopyClean(), true);
assert.ok(CATEGORY_CONCEPTS.cat_levity.length > 0);
ok('Levity is a bar of playfulness + conflict axes; same stability floor; copy flagged unreviewed');

console.log('PART 4 — The Story');
assert.equal(STORY_LABEL, 'The Story');
// The old AI Story (prompt, answer parser, samples, STORY_COPY_REVIEWED) was removed in roadmap A5; the
// told-vs-played note the template card still shows is pinned here (pass: plain wording, fail: a verdict).
const tensionNote = formatStoryTensionNote([{ axis: 'extraversion', report: 0.8, game: 0.2 } as never]);
assert.ok(tensionNote, 'a note for a real told-vs-played gap');
assert.doesNotMatch(tensionNote!, /leaving visible|not a verdict|on paper|told us|gut-call/i);
assert.match(tensionNote!, /Maybe you're just different depending on the moment/);
assert.equal(formatStoryTensionNote([]), null, 'fail case: no gap, no note');
assert.equal(storyNamesACategory('Openness to life showed up this week.'), true);
assert.equal(storyNamesACategory('A hard talk can still have a bit of air in it.'), false);
const thinTracks = [stableReport('openness', 0.5)];
assert.equal(isThinProfile(settledCount(thinTracks)), true);
assert.equal(storyReady(thinTracks), false);
// A just-finished 48 (3 answers per trait, mixed answers, low stability) is
// story-ready: the full-profile signal, not the stability sum (2026-10-06).
const justFinished = TRAIT_AXES.map((axis, i) => ({
  axis,
  track: 'report' as const,
  value: 0.55,
  stability: i % 2 ? 0.09 : 0.3,
  answerCount: 3,
  lastTouched: new Date().toISOString(),
  lastDepthAt: null,
}));
assert.equal(isThinProfile(settledCount(justFinished)), true, 'the sum alone still reads thin');
assert.equal(storyReady(justFinished), true, 'a finished intake is enough for Story');
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
// The AI Story prompt and answer parser are gone (roadmap A5). The fingerprint still moves on told-vs-played.
assert.notEqual(storyFingerprint(many, null), storyFingerprint(many, 'gap'));
assert.equal(storyFingerprint(many, 'gap'), storyFingerprint(many, 'gap'), 'same input, same fingerprint');
const storySrc = read('src/lib/sage-story.ts').replace(/\/\*[\s\S]*?\*\//g, ''); // code only: the header comment names what was removed
assert.doesNotMatch(storySrc, /Write as Sage|buildStoryPrompt|parseStoryBody|parseStoryAnswer|STORY_COPY_REVIEWED|generateText/);
ok('the Story fingerprint moves on told-vs-played; no AI Story prompt or parser remains');

const fold = read('src/components/insights/insights-story-card.tsx');
/**
 * REPINNED (ISOLATION_PLAN §7 Card B, 2026-09-15): the fold is now tap-only.
 * The old shape — generate from a `useEffect`, `if (!story?.body) return null`
 * as the silent fallback, `setStory(null)` for every failure — is gone: it
 * spent a model call on every cold open of Home once the profile looked ready,
 * and it never checked AI consent. The invariants those assertions protected
 * are re-pinned here against the new shape.
 */
// Insights (2026-10-14): the Story is a template-only card. No model, no
// local-AI switch, no crisis gate (the crisis system was removed).
assert.doesNotMatch(fold, /shouldUseLocalAi|generateText|claimStoryGenerate/);
assert.doesNotMatch(fold, /fallbackBandFor|TITLE_EMPTY|composeLocal/);
assert.match(fold, /formatStoryTensionNote/);
assert.doesNotMatch(fold, /formatDivergenceNote/);
assert.doesNotMatch(fold, /crisis/i);
// The locked state is the SHARED gate, not Story's own settledness.
assert.match(fold, /!unlocked \? \(/);
assert.match(fold, /FULL_PROFILE_LOCKED_COPY/);
assert.doesNotMatch(fold, /PROFILE_LOCKED_CTA/);
// Nothing is picked without a press, and an unready profile says so.
assert.doesNotMatch(fold, /void run\(\)/);
assert.match(fold, /void loadStory\(\)/);
assert.match(fold, /STORY_NOT_READY_COPY/);
ok('Story is tap-only and template-only: the shared gate locks it, Load picks a template');

// §9 (2026-09-08): Story moved from Explore to Home; 2026-10-14 it moved on to
// Insights as a template-only card. Home and Explore carry no Story.
assert.match(read('src/app/(tabs)/insights.tsx'), /<InsightsStoryCard/);
assert.doesNotMatch(read('src/app/(tabs)/index.tsx'), /SageStoryFold|InsightsStoryCard/);
// Categories is back inline on Explore, standalone route retired
// (2026-09-14, T-E1) — reverses the 2026-09-12 judgment-pass.md §4A split.
assert.match(read('src/app/(tabs)/explore.tsx'), /CategoriesFold/);
assert.doesNotMatch(read('src/app/(tabs)/explore.tsx'), /'\/categories'/);
assert.ok(
  !existsSync('src/app/(tabs)/categories.tsx'),
  'the /categories route must stay deleted — Categories lives inline on Explore',
);
assert.doesNotMatch(read('src/app/(tabs)/explore.tsx'), /SageStoryFold/);
assert.ok(!existsSync('src/app/(tabs)/sage.tsx'), 'the Sage tab is gone');
ok('no generic fallback paragraph; the Story lives on Insights, not Home or Explore');

console.log(`\n${passed} wave22 checks passed`);
