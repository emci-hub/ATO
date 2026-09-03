/**
 * Wave 21: Playfulness, categories, Home 2-slot teaser, Circle share.
 * Run: npm run check:wave21
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AXIS_POLES, POLE_COPY_REVIEWED, poleCopyClean } from '../src/lib/axis-poles';
import {
  CATEGORY_BAND_COPY_REVIEWED,
  categoryBandCopyClean,
  fallbackForReading,
} from '../src/lib/category-bands';
import {
  CATEGORY_COPY_REVIEWED,
  CATEGORY_DEFS,
  allCategoriesReady,
  categoriesFingerprint,
  dailyTeaserRoll,
  pickTeaserCategory,
  readCategory,
  readAllCategories,
} from '../src/lib/categories';
import { CONCEPT_COPY_REVIEWED, AXIS_CONCEPTS, CATEGORY_CONCEPTS, conceptCopyClean } from '../src/lib/concept-explainers';
import { DEPTH_AXES, depthKindFor } from '../src/lib/depth-dive';
import { QUESTIONS_BANK } from '../src/lib/questions/bank';
import { RANKING_ROUNDS } from '../src/lib/ranking';
import { SCENARIO_DECK } from '../src/lib/scenario';
import { TITLE_COPY_REVIEWED, combinedFingerprint, parseCombinedBody, titleCopyClean } from '../src/lib/sage-title';
import { canShowCategoryTeaser } from '../src/lib/today-slot';
import { EXTRA_AXES, TRAIT_AXES } from '../src/lib/traits';
import { applyEwmaAnswer, type TraitTrack } from '../src/lib/trait-stability';

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
  row = applyEwmaAnswer(row, axis, 'report', value, nowIso);
  return row;
}

assert.ok((TRAIT_AXES as readonly string[]).includes('playfulness'));
assert.ok((EXTRA_AXES as readonly string[]).includes('playfulness'));
assert.equal(DEPTH_AXES.length, TRAIT_AXES.length);
assert.equal(depthKindFor('playfulness'), 'scenario');
assert.ok(RANKING_ROUNDS.playfulness.length >= 5);
assert.equal(SCENARIO_DECK.playfulness.axis, 'playfulness');
assert.ok(QUESTIONS_BANK.some((row) => row.axis === 'playfulness'));
assert.equal(AXIS_POLES.playfulness.low.length > 0, true);
assert.equal(POLE_COPY_REVIEWED, false);
ok('playfulness is the 16th axis: schema list, IQ, ranking, gut-call, depth, poles');

assert.equal(CATEGORY_DEFS.length, 9);
assert.equal(CATEGORY_DEFS.filter((row) => row.shape === 'map').length, 2);
const love = CATEGORY_DEFS.find((row) => row.id === 'cat_love')!;
assert.deepEqual([...love.axes], ['attachment_anxiety', 'attachment_avoidance']);
assert.deepEqual([...love.texture], ['conflict_assertiveness', 'conflict_cooperativeness']);
const levity = CATEGORY_DEFS.find((row) => row.id === 'cat_levity')!;
assert.equal(levity.shape, 'bar');
assert.deepEqual([...levity.axes], ['playfulness', 'conflict_assertiveness', 'conflict_cooperativeness']);
ok('nine category defs; love map keeps conflict as texture; Levity is a bar');

const social = CATEGORY_DEFS.find((row) => row.id === 'cat_social')!;
const gameOnly: TraitTrack[] = [
  {
    axis: 'extraversion',
    track: 'game',
    value: 0.9,
    stability: 1,
    answerCount: 5,
    lastTouched: '2026-08-31T12:00:00.000Z',
    lastDepthAt: null,
  },
  {
    axis: 'agreeableness',
    track: 'game',
    value: 0.9,
    stability: 1,
    answerCount: 5,
    lastTouched: '2026-08-31T12:00:00.000Z',
    lastDepthAt: null,
  },
  {
    axis: 'playfulness',
    track: 'game',
    value: 0.9,
    stability: 1,
    answerCount: 5,
    lastTouched: '2026-08-31T12:00:00.000Z',
    lastDepthAt: null,
  },
];
assert.equal(readCategory(social, gameOnly).ready, false);
const reportSocial = [
  stableReport('extraversion', 0.8),
  stableReport('agreeableness', 0.7),
  stableReport('playfulness', 0.6),
];
assert.equal(readCategory(social, reportSocial).ready, true);
ok('categories read the report track only — gut-call never enters the math');

const lovePartial = [stableReport('attachment_anxiety', 0.8)];
assert.equal(readCategory(love, lovePartial).ready, false);
assert.equal(readCategory(love, lovePartial).map, null);
const loveBoth = [stableReport('attachment_anxiety', 0.8), stableReport('attachment_avoidance', 0.2)];
const loveReady = readCategory(love, loveBoth);
assert.equal(loveReady.ready, true);
assert.ok(loveReady.map);
ok('maps require BOTH axes independently past the stability floor');

const fp1 = categoriesFingerprint(reportSocial);
const fp2 = categoriesFingerprint(reportSocial);
assert.equal(fp1, fp2);
const combined1 = combinedFingerprint(reportSocial);
const combined2 = combinedFingerprint(reportSocial);
assert.equal(combined1, combined2);
ok('confirm-upgrade cannot change category fingerprint: same numbers, same hash');

assert.equal(allCategoriesReady(reportSocial), false);
ok('full picture stays locked until all live categories are ready');

assert.equal(canShowCategoryTeaser('crisis'), false);
assert.equal(canShowCategoryTeaser('missed_check'), false);
assert.equal(canShowCategoryTeaser('none'), true);
const rollA = dailyTeaserRoll('user:2026-08-31:teaser');
const rollB = dailyTeaserRoll('user:2026-08-31:teaser');
assert.equal(rollA, rollB);
const ready = readAllCategories(reportSocial).filter((row) => row.ready);
const pick = pickTeaserCategory(ready, ['playfulness'], 0.1);
assert.equal(pick, 'cat_social');
ok('teaser roll is stable per seed; hidden on crisis and missed-check');

assert.equal(TITLE_COPY_REVIEWED, false);
assert.equal(CATEGORY_COPY_REVIEWED, false);
assert.equal(CATEGORY_BAND_COPY_REVIEWED, false);
assert.equal(CONCEPT_COPY_REVIEWED, false);
assert.equal(poleCopyClean(), true);
assert.equal(titleCopyClean(), true);
assert.equal(categoryBandCopyClean(), true);
assert.equal(conceptCopyClean(), true);
assert.equal(Object.keys(AXIS_CONCEPTS).length, TRAIT_AXES.length);
assert.equal(Object.keys(CATEGORY_CONCEPTS).length, CATEGORY_DEFS.length);
assert.ok(fallbackForReading(loveReady).length > 0);
ok(`${TRAIT_AXES.length + CATEGORY_DEFS.length} concept explainers + poles + bands flagged unreviewed and fence-clean`);

assert.equal(parseCombinedBody('{"title":"INTJ Visionary","lede":"You are an INTJ."}'), null);
const parsed = parseCombinedBody(
  '{"title":"Quiet follow-through","lede":"Keeps the plan.","categories":{"cat_social":{"line":"Makes the room happen.","full":"Would rather text people and keep it a little light."}}}',
);
assert.equal(parsed?.title, 'Quiet follow-through');
assert.equal(parsed?.categories.cat_social?.line, 'Makes the room happen.');
ok('combined parser keeps title+category copy and rejects type-branding');

const sql = read('supabase/migrations/wave21_playfulness_categories.sql');
assert.match(sql, /playfulness/);
assert.match(sql, /category_defs/);
assert.match(sql, /category_share/);
assert.match(sql, /close_friends_share/);
assert.match(sql, /categories_share_allowed/);
assert.match(sql, /peer_category_pack/);
assert.match(sql, /category_share_status/);
assert.match(sql, /user_id <> peer_id/);
ok('schema: playfulness + category catalog + dual-consent share');

const titleRpc = read('supabase/migrations/wave20_trait_tracks_titles.sql');
assert.match(titleRpc, /claim_title_generate/);
assert.match(titleRpc, /does not increment Talk calls/);
assert.doesNotMatch(titleRpc, /calls = calls \+ 1/);
ok('title/category gen still uses claim_title_generate — does not increment Talk calls');

const home = read('src/app/(tabs)/index.tsx');
const crisis = read('src/components/crisis-card.tsx');
const widget = read('targets/widget/widgets.swift');
const checkSwift = widget;
assert.match(home, /CategoryTeaser/);
assert.match(home, /canShowCategoryTeaser/);
assert.doesNotMatch(home, /FullProfileFold/);
assert.doesNotMatch(crisis, /CategoryTeaser|FullProfileFold|playfulness/);
assert.doesNotMatch(checkSwift, /CategoryTeaser|FullProfileFold/);
ok('Home teaser is gated; crisis card and widget stay untouched');

const exploreTab = read('src/app/(tabs)/explore.tsx');
assert.match(exploreTab, /CategoriesFold/);
assert.match(exploreTab, /FullProfileFold/);
const circle = read('src/app/(tabs)/circle.tsx');
assert.match(circle, /setCategoryShare/);
assert.match(circle, /close_friends_share|setCloseFriendsShare/);
assert.match(circle, /CategoryCompareRow/);
assert.doesNotMatch(circle, /FullProfileFold/);
ok('Explore has Categories next to Full Profile; Circle compare is separate from Full Profile');

const box8 = read('docs/ATO_DEVICE_TESTS.md');
assert.match(box8, /two-slot|2-slot|second slot|category teaser/i);
assert.match(box8, /deliberate|reversal/i);
ok('Box 8 documents the Home two-slot override');

const badgeUi = read('src/components/check-milestone-badge.tsx');
assert.match(badgeUi, /full-picture/);
assert.match(badgeUi, /capstone/);
ok('full-picture capstone is visually distinct from per-axis chips');

console.log(`\n${passed} wave21 checks passed`);
