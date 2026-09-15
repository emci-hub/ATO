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
assert.equal(CATEGORY_COPY_REVIEWED, false);
assert.equal(CATEGORY_BAND_COPY_REVIEWED, false);
assert.equal(CONCEPT_COPY_REVIEWED, true);
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
/**
 * REPINNED (ISOLATION_PLAN §7 Card B, 2026-09-15): the fold is now tap-only.
 * The old shape — generate from a `useEffect`, `if (!story?.body) return null`
 * as the silent fallback, `setStory(null)` for every failure — is gone: it
 * spent a model call on every cold open of Home once the profile looked ready,
 * and it never checked AI consent. The invariants those assertions protected
 * are re-pinned here against the new shape.
 */
assert.match(fold, /shouldUseLocalAi/);
assert.doesNotMatch(fold, /fallbackBandFor|TITLE_EMPTY|composeLocal/);
assert.match(fold, /formatStoryTensionNote/);
assert.doesNotMatch(fold, /formatDivergenceNote/);
// Crisis still hides Story entirely, and must do so before anything else.
const crisisIdx = fold.indexOf('if (crisisToday) return null;');
const lockedIdx = fold.indexOf('if (!unlocked) {');
assert.ok(crisisIdx > -1, 'crisis must still hide Story outright');
assert.ok(lockedIdx > crisisIdx, 'the locked state must come after the crisis guard, never instead of it');
// The locked state is the SHARED gate now, not Story's own settledness.
assert.match(fold, /FULL_PROFILE_LOCKED_COPY/);
assert.doesNotMatch(fold, /PROFILE_LOCKED_CTA/);
// Nothing generates without a press, and an unready profile costs nothing.
assert.doesNotMatch(fold, /void run\(\)/);
assert.match(fold, /void loadStory\(\)/);
assert.match(fold, /STORY_NOT_READY_COPY/);
ok('Story is tap-only: crisis hides it, the shared gate locks it, and Load is the only thing that can spend a call');

// §9 (2026-09-08): Story moved from Explore to Home, directly below the
// daily check-in card — the assertion below moved with it. Explore no
// longer imports SageStoryFold.
assert.match(read('src/app/(tabs)/index.tsx'), /SageStoryFold/);
// Categories is back inline on Explore, standalone route retired
// (2026-09-14, T-E1) — reverses the 2026-09-12 judgment-pass.md §4A split.
assert.match(read('src/app/(tabs)/explore.tsx'), /CategoriesFold/);
assert.doesNotMatch(read('src/app/(tabs)/explore.tsx'), /'\/categories'/);
assert.ok(
  !existsSync('src/app/(tabs)/categories.tsx'),
  'the /categories route must stay deleted — Categories lives inline on Explore',
);
assert.doesNotMatch(read('src/app/(tabs)/explore.tsx'), /SageStoryFold/);
assert.doesNotMatch(read('src/app/(tabs)/sage.tsx'), /SageStoryFold|ExplorePinnedCategories/);
ok('Story UI hides when Gemini is unreachable; no generic fallback paragraph; Story now lives on Home (§9), not Explore');

assert.equal(STORY_SAMPLES.every((row) => row.shape.includes('thin') || row.body.length > 0 || row.body === ''), true);
ok('draft Story samples and tension lines exist for emci review and are not treated as reviewed');

console.log(`\n${passed} wave22 checks passed`);
