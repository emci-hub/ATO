/**
 * Forced-ranking sort. Run: npm run check:ranking
 *
 * One axis per round, 4–5 plain lines, self_tap write, soft-ask budget.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  RANKING_MAX_ITEMS,
  RANKING_MIN_ITEMS,
  RANKING_ROUNDS,
  applyRankingWrite,
  moveItem,
  pickRankingAxis,
  rankingWritePreview,
  resolveRanking,
  scoreRankingOrder,
  shuffleIds,
} from '../src/lib/ranking';
import {
  applyCompletenessWeek,
  applyGameInviteWeek,
  applyRankingWeek,
  applySageKnowsDismiss,
  emptySageKnowsState,
  sageKnowsWeekKey,
  youTabSoftAsk,
} from '../src/lib/sage-knows';
import {
  TRAIT_AXES,
  EXTRA_AXES,
  emptyTraitState,
  emptyTraitValues,
  mergeTraitWrite,
  type TraitValues,
} from '../src/lib/traits';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';
import { RANKING_LABEL, RANKING_LEDE, RANKING_SAVE } from '../src/lib/sage-copy';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const TZ = 'America/Denver';
const NOW = new Date('2026-08-28T18:00:00.000Z');
const WEEK = sageKnowsWeekKey('2026-08-28');

function gapValues(over: Partial<TraitValues> = {}): TraitValues {
  return { ...emptyTraitValues(), ...over };
}

function filled(): TraitValues {
  const values = emptyTraitValues();
  for (const axis of TRAIT_AXES) values[axis] = 0.8;
  values.attachment_anxiety = 0.2;
  return values;
}

for (const axis of TRAIT_AXES) {
  const round = RANKING_ROUNDS[axis];
  assert.ok(round.length >= RANKING_MIN_ITEMS && round.length <= RANKING_MAX_ITEMS);
  const loadings = round.map((item) => item.loading);
  assert.equal(loadings[0], 1);
  assert.equal(loadings[round.length - 1], 0);
  for (const item of round) {
    assert.equal(containsFrameworkTerm(item.text), false, item.text);
  }
}
ok('every axis has 4–5 plain behavioral lines and no framework terms');

const extra = RANKING_ROUNDS.extraversion;
const highFirst = extra.map((item) => item.id);
const lowFirst = [...highFirst].reverse();
assert.equal(scoreRankingOrder(extra, highFirst), 1);
assert.equal(scoreRankingOrder(extra, lowFirst), 0);
const mid = scoreRankingOrder(extra, moveItem(highFirst, 0, 4));
assert.ok(mid > 0 && mid < 1);
ok('rank order maps to a relative 0–1 signal on that axis');

const preview = rankingWritePreview('extraversion', highFirst);
assert.equal(preview, 1);
const written = applyRankingWrite(emptyTraitState(), 'extraversion', highFirst, NOW.toISOString());
assert.equal(written.values.extraversion, 1);
assert.equal(written.sources.extraversion, 'self_tap');
assert.ok(written.touched.extraversion);
ok('completed ranking writes the axis as self_tap (direct)');

const inferredFirst = mergeTraitWrite(
  emptyTraitState(),
  { extraversion: 0.2 },
  'self_game',
  ['extraversion'],
  '2026-07-01T00:00:00.000Z',
);
const overlay = applyRankingWrite(inferredFirst, 'extraversion', highFirst, NOW.toISOString());
assert.equal(overlay.values.extraversion, 1);
assert.equal(overlay.sources.extraversion, 'self_tap');
const sticky = mergeTraitWrite(overlay, { extraversion: 0.1 }, 'self_game', ['extraversion']);
assert.equal(sticky.values.extraversion, 1);
assert.equal(sticky.sources.extraversion, 'self_tap');
ok('self_tap is sticky; a later inferred write cannot overwrite it');

assert.equal(pickRankingAxis(gapValues(), null), 'openness');
assert.equal(pickRankingAxis(gapValues({ openness: 0.8 }), 'openness'), 'conscientiousness');
assert.equal(pickRankingAxis(filled(), null), null);
const extraOnly = emptyTraitValues();
for (const axis of TRAIT_AXES) {
  if (!(EXTRA_AXES as readonly string[]).includes(axis)) extraOnly[axis] = 0.8;
}
assert.equal(pickRankingAxis(extraOnly, null), null);
assert.equal(
  resolveRanking({
    values: extraOnly,
    knows: emptySageKnowsState(),
    now: NOW,
    timeZone: TZ,
  }),
  null,
);
ok('round prefers an unfilled axis; extra-only gaps yield so the swipe-deck can take that slot');

const shown = resolveRanking({
  values: gapValues(),
  knows: emptySageKnowsState(),
  now: NOW,
  timeZone: TZ,
});
assert.ok(shown);
assert.equal(shown.axis, 'openness');
assert.equal(shown.items.length, RANKING_ROUNDS.openness.length);
assert.equal(shown.order.length, shown.items.length);
ok('unfilled profile surfaces a ranking round');

assert.equal(
  resolveRanking({
    values: filled(),
    knows: emptySageKnowsState(),
    now: NOW,
    timeZone: TZ,
  }),
  null,
);
ok('yields when Does-Sage-know-you can have the Home/Sage slot (no null axes)');

const rankedWeek = applyRankingWeek(emptySageKnowsState(), 'openness', WEEK, 'answered');
assert.equal(
  resolveRanking({
    values: gapValues({ conscientiousness: null }),
    knows: rankedWeek,
    now: NOW,
    timeZone: TZ,
  }),
  null,
);
ok('a completed ranking claims the week so another optional-depth prompt cannot stack');

const dismissedKnows = applySageKnowsDismiss(emptySageKnowsState(), 'openness', WEEK);
assert.equal(
  resolveRanking({
    values: gapValues(),
    knows: dismissedKnows,
    now: NOW,
    timeZone: TZ,
  }),
  null,
);
const gameWeek = applyGameInviteWeek(emptySageKnowsState(), WEEK);
assert.equal(
  resolveRanking({
    values: gapValues(),
    knows: gameWeek,
    now: NOW,
    timeZone: TZ,
  }),
  null,
);
ok('yields if Does-Sage-know-you or a game invite already has this week');

const completeness = applyCompletenessWeek(emptySageKnowsState(), WEEK);
assert.equal(youTabSoftAsk(gapValues(), {}, '2026-08-28', TZ), 'completeness');
assert.equal(
  resolveRanking({
    values: gapValues(),
    knows: completeness,
    now: NOW,
    timeZone: TZ,
  }),
  null,
);
ok('yields if a completeness prompt already has the You-tab slot this week');

const shuffled = shuffleIds(
  RANKING_ROUNDS.openness.map((item) => item.id),
  `${WEEK}:openness`,
);
const again = shuffleIds(
  RANKING_ROUNDS.openness.map((item) => item.id),
  `${WEEK}:openness`,
);
assert.deepEqual(shuffled, again);
assert.notDeepEqual(shuffled, RANKING_ROUNDS.openness.map((item) => item.id));
ok('presentation shuffle is stable in a week, not a chance mechanic for the score');

assert.equal(RANKING_LABEL, 'Most me');
assert.match(RANKING_LEDE, /Drag/);
assert.equal(RANKING_SAVE, "That's me");

const card = read('src/components/ranking-card.tsx');
const meSrc = read('src/lib/me.ts');
const homeTab = read('src/app/(tabs)/index.tsx');
const sageTab = read('src/app/(tabs)/sage.tsx');
const youTab = read('src/app/(tabs)/you.tsx');
const talkSrc = read('src/lib/voice/talk.ts');
const themeLab = read('src/app/theme-lab.tsx');

assert.match(card, /Gesture|Pan/);
assert.match(card, /self_tap|recordRanking/);
assert.match(meSrc, /recordRanking/);
assert.match(meSrc, /self_tap/);
assert.match(homeTab, /RankingCard/);
assert.match(sageTab, /RankingCard/);
assert.match(youTab, /RankingCard/);
assert.doesNotMatch(talkSrc, /resolveRanking|RankingCard/);
assert.match(themeLab, /RankingCard/);
assert.match(themeLab, /forcePick/);
ok('drag surface lives on Home, Sage, and You; never inside Talk');

const logic = read('src/lib/ranking.ts');
assert.doesNotMatch(logic, /Math\.random|claimAiCall|gemini|self_game/);
assert.match(logic, /self_tap/);
ok('no chance mechanic, no model, write path is direct self_tap not inferred');

console.log(`\n${passed} ranking checks passed`);
