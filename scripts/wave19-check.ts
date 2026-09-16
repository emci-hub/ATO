/**
 * Wave 19: trait history, IQ sweep, standalone ranking/scenario, tokens,
 * 2-letter codes, Sage thin/divergence. Run: npm run check:wave19
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AXIS_CODE_ORDER, AXIS_CODES, axisForCode, codeForAxis } from '../src/lib/axis-codes';
import { depthKindFor } from '../src/lib/depth-dive';
import {
  answeredAxisCount,
  answeredAxisLabel,
  traitValuesFromPartial,
} from '../src/lib/full-profile';
import {
  EXTRA_AXES,
  TRAIT_AXES,
  emptyTraitState,
  emptyTraitValues,
  mergeTraitWrite,
  type TraitAxis,
} from '../src/lib/traits';
import { applyEwmaAnswer, emptyTrack, type TraitTrack } from '../src/lib/trait-stability';
import {
  forcedPickForAxis,
  rankingPromptForAxis,
  applyForcedPickWrite,
  RANKING_ROUNDS,
} from '../src/lib/ranking';
import {
  SCENARIO_DECK,
  SCENARIO_DECK_MORE,
  scenarioForAxis,
  applyScenarioWrite,
} from '../src/lib/scenario';
import { QUESTIONS_BANK } from '../src/lib/questions/bank';
import { AXIS_TIER_COUNTS } from '../src/lib/questions/tiered-axis-plan';
import { composeLocalQuestionBatch } from '../src/lib/questions/local';
import { QUESTIONS_BATCH_SIZE } from '../src/lib/questions/types';
import { parseQuestionBatch, parseQuestionSweep } from '../src/lib/questions/parse';
import {
  axisVariant,
  bankByAxis,
  bankDraftFor,
  bankLeadDrafts,
} from '../src/lib/questions/local';
import {
  TRAIT_SHIFT_LABEL,
  TRAIT_UNDO_MS,
  divergingAxes,
  formatDivergenceNote,
  historyDiff,
  shiftCopyClean,
  shiftLine,
} from '../src/lib/trait-history';
import {
  TOKEN_EARN,
  TOKEN_LABEL,
  TOKEN_LEDE,
  TOKEN_PRICE,
  tokenCopyClean,
} from '../src/lib/tokens';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';
import { buildQuestionsPrompt } from '../src/lib/questions/prompt';
import { preferFreshAxes } from '../src/lib/questions/rotation';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

// --- codes ----------------------------------------------------------------
assert.equal(AXIS_CODE_ORDER.length, TRAIT_AXES.length);
assert.equal(Object.keys(AXIS_CODES).length, TRAIT_AXES.length);
for (const axis of TRAIT_AXES) {
  const code = codeForAxis(axis);
  assert.equal(code.length, 2);
  assert.equal(axisForCode(code), axis);
}
assert.equal(codeForAxis('openness'), 'OP');
assert.equal(codeForAxis('self_efficacy'), 'SE');
ok('every axis has a unique 2-letter code');

// --- history --------------------------------------------------------------
assert.ok(TRAIT_UNDO_MS >= 5000 && TRAIT_UNDO_MS <= 10000);
assert.equal(TRAIT_SHIFT_LABEL, 'How this has shifted');
assert.equal(shiftCopyClean(), true);
assert.doesNotMatch(TRAIT_SHIFT_LABEL, /correct|mistake|error|wrong/i);
const prev = emptyTraitState();
const next = mergeTraitWrite(prev, { autonomy: 0.8 }, 'self_tap', ['autonomy']);
const diff = historyDiff(prev, next);
assert.equal(diff.length, 1);
assert.equal(diff[0]?.axis, 'autonomy');
assert.equal(diff[0]?.source, 'self_tap');
const same = historyDiff(next, next);
assert.equal(same.length, 0);
const line = shiftLine('autonomy', null, 0.8, '2026-08-31T12:00:00.000Z', 'UTC');
assert.match(line, /First reading/);
assert.equal(containsFrameworkTerm(line), false);
ok('history diff skips no-ops; shift copy is growth language');

const diverged = divergingAxes([
  {
    id: '1',
    axis: 'autonomy',
    value: 0.8,
    source: 'self_situation',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: '2',
    axis: 'autonomy',
    value: 0.2,
    source: 'self_game',
    createdAt: '2026-08-02T00:00:00.000Z',
  },
]);
assert.equal(diverged.length, 1);
assert.ok(formatDivergenceNote(diverged)?.includes('gut-call'));
ok('divergence notes self-report vs gut-call without overwriting');

// --- IQ bank ---------------------------------------------------------------
// Bank is 50 questions total, per-axis count varying by tier (trait-system
// redesign §2/§3 — no longer a flat 3). bankByAxis keeps ALL of them (it
// used to drop every draft after the first, which made variants 2+ dead
// content).
assert.equal(QUESTIONS_BANK.length, 50);
const grouped = bankByAxis();
assert.equal(grouped.size, TRAIT_AXES.length);
for (const axis of TRAIT_AXES) {
  assert.equal(grouped.get(axis)?.length, AXIS_TIER_COUNTS[axis] * 2, `${axis} keeps all ${AXIS_TIER_COUNTS[axis] * 2} drafts`);
}
assert.equal(
  [...grouped.values()].reduce((n, list) => n + list.length, 0),
  QUESTIONS_BANK.length,
  'bankByAxis drops nothing',
);

// bankDraftFor wraps, so any index is safe, and variant 0 is the locked
// draft. openness is a tier-2 axis with 6 drafts now (was 3) — variant 6
// wraps back to 0, not variant 3.
const lead = bankDraftFor('openness');
assert.equal(lead?.prompt, QUESTIONS_BANK.find((row) => row.axis === 'openness')?.prompt);
assert.deepEqual(bankDraftFor('openness', 6), lead, 'variant wraps at the group length');
assert.notDeepEqual(bankDraftFor('openness', 1), lead, 'variant 1 is a different draft');
// Returned drafts are copies — a caller mutating options must not edit the bank.
const mutable = bankDraftFor('openness');
mutable!.options[0]!.value = 0.123;
assert.notEqual(bankDraftFor('openness')?.options[0]?.value, 0.123);
assert.equal(bankLeadDrafts().length, TRAIT_AXES.length);

// --- variant selection is driven by each axis's own answerCount -----------
// Build a track with an exact answerCount on one axis, everything else empty.
function trackWithCount(axis: TraitAxis, answerCount: number): TraitTrack {
  const nowIso = '2026-08-31T12:00:00.000Z';
  // Exactly `answerCount` applications — applyEwmaAnswer(null, ...) is itself
  // the FIRST answer, so seeding outside the loop would be off by one.
  let row: TraitTrack | null = null;
  for (let n = 0; n < answerCount; n += 1) {
    row = applyEwmaAnswer(row, axis, 'report', 0.6, nowIso);
  }
  const out = row ?? emptyTrack(axis, 'report');
  assert.equal(out.answerCount, answerCount, 'fixture must have the exact answer count');
  return out;
}

assert.equal(axisVariant([], 'openness'), 0, 'no track reads as zero answers');
assert.equal(axisVariant([trackWithCount('openness', 2)], 'openness'), 2);
// Gut-call must never advance the question: settled ignores it, so this must too.
const gameOnly = { ...trackWithCount('openness', 2), track: 'game' as const };
assert.equal(axisVariant([gameOnly], 'openness'), 0, 'game track never advances the variant');

// The 5-item rotation must still return 5 DISTINCT axes now that the bank has
// three drafts per axis — feeding all of them to preferFreshAxes would spend
// slots on duplicates it then drops.
const batchV1 = composeLocalQuestionBatch();
assert.equal(batchV1.length, QUESTIONS_BATCH_SIZE);
assert.equal(new Set(batchV1.map((row) => row.axis)).size, QUESTIONS_BATCH_SIZE);
// Same axes, advanced draft on the answered one only.
const batchV2 = composeLocalQuestionBatch([], [], [trackWithCount(batchV1[0]!.axis, 1)]);
assert.equal(batchV2.length, QUESTIONS_BATCH_SIZE);
assert.deepEqual(batchV2.map((row) => row.axis), batchV1.map((row) => row.axis));
assert.notEqual(batchV2[0]?.prompt, batchV1[0]?.prompt, 'answered axis advances');
assert.deepEqual(
  batchV2.slice(1).map((row) => row.prompt),
  batchV1.slice(1).map((row) => row.prompt),
  'unanswered axes are unchanged',
);

// The wiring: QuestionsFold must actually pass tracks, or none of this ships.
// The route.ts half of this assertion went with the deleted Infinite Questions
// feed (2026-09-16); the screen-level wiring below is what still ships.
assert.match(read('src/app/(tabs)/intake-sweep.tsx'), /tracks=\{tracks\}/);
// An answer must refresh tracks, not just `me` — otherwise the count that
// picks the next draft never moves and the same question comes back.
assert.match(read('src/app/(tabs)/intake-sweep.tsx'), /onUpdated=\{refreshAfterAnswer\}/);
const local5 = composeLocalQuestionBatch();
assert.equal(local5.length, 5);
assert.equal(local5[0]?.axis, 'openness');
const rotated = preferFreshAxes(
  QUESTIONS_BANK.map((row) => ({
    axis: row.axis,
    prompt: row.prompt,
    options: row.options.map((opt) => ({ ...opt })),
  })),
  [],
);
assert.equal(rotated.length, 5);
ok('fallback bank covers all axes; 5-item rotation still returns 5 starting at openness');

const parsed5 = parseQuestionBatch(
  JSON.stringify({
    questions: TRAIT_AXES.map((axis) => ({
      axis,
      prompt: 'A plain moment.',
      options: [
        { text: 'One', value: 0.8 },
        { text: 'Two', value: 0.2 },
      ],
    })),
  }),
);
assert.equal(parsed5.length, 5);
const parsed15 = parseQuestionSweep(
  JSON.stringify({
    questions: TRAIT_AXES.map((axis) => ({
      axis,
      prompt: 'A plain moment.',
      options: [
        { text: 'One', value: 0.8 },
        { text: 'Two', value: 0.2 },
      ],
    })),
  }),
);
assert.equal(parsed15.length, TRAIT_AXES.length);
ok('batch parser still caps at 5; sweep parser keeps all axes, one per axis');

const qPrompt = buildQuestionsPrompt({
  me: { name: 'Riley', talk_style: 'even', voice_preset: 'close_friend' },
  grounding: { kind: 'none', detail: null },
});
assert.match(qPrompt, /Return exactly 5 questions/);
assert.doesNotMatch(qPrompt, /exactly 15/);
ok('existing IQ prompt is still a 5-item rotating batch');

// --- ranking standalone ---------------------------------------------------
for (const axis of EXTRA_AXES) {
  assert.ok(RANKING_ROUNDS[axis].length >= 4);
  assert.ok(forcedPickForAxis(axis));
  assert.ok(rankingPromptForAxis(axis, 'seed'));
}
const pick = forcedPickForAxis('autonomy');
assert.ok(pick);
const high = applyForcedPickWrite(emptyTraitState(), 'autonomy', 'high');
assert.equal(high.sources.autonomy, 'self_tap');
assert.equal(high.values.autonomy, 0.8);
ok('forced ranking works standalone for all six thin axes');

// --- scenarios ------------------------------------------------------------
for (const axis of EXTRA_AXES) {
  assert.ok(SCENARIO_DECK[axis]);
  assert.ok(SCENARIO_DECK_MORE[axis]);
  const a = scenarioForAxis(axis, false);
  const b = scenarioForAxis(axis, true);
  assert.ok(a && b);
  assert.notEqual(a.def.setup, b.def.setup);
  const copy = `${a.def.setup} ${a.def.high.label} ${b.def.setup}`;
  assert.equal(containsFrameworkTerm(copy), false, copy);
  const written = applyScenarioWrite(emptyTraitState(), axis, 'high');
  assert.equal(written.sources[axis], 'self_game');
}
const sticky = mergeTraitWrite(emptyTraitState(), { autonomy: 0.8 }, 'self_tap', ['autonomy']);
const blocked = applyScenarioWrite(sticky, 'autonomy', 'low');
assert.equal(blocked.values.autonomy, 0.8);
assert.equal(blocked.sources.autonomy, 'self_tap');
assert.equal(historyDiff(sticky, blocked).length, 0);
ok('gut-call covers all six thin axes, including a second stem, still self_game');
ok('depth spend skips a gut-call that cannot overwrite a told answer');

// --- depth mapping --------------------------------------------------------
assert.equal(depthKindFor('openness'), 'ranking');
assert.equal(depthKindFor('autonomy'), 'scenario');
assert.equal(depthKindFor('self_efficacy'), 'scenario');
ok('token depth uses ranking vs EXTRA_AXES membership, not a frozen nine/six count');

// --- tokens ---------------------------------------------------------------
assert.ok(TOKEN_EARN.check_in > 0);
assert.ok(TOKEN_EARN.game_round > 0);
assert.ok(TOKEN_EARN.trickle > 0);
assert.equal(TOKEN_PRICE.sage_insight, 8);
assert.equal(TOKEN_PRICE.profile_depth, 12);
assert.equal(tokenCopyClean(), true);
assert.doesNotMatch(TOKEN_LABEL, /purchase|buy|paywall/i);
assert.doesNotMatch(TOKEN_LEDE, /purchase|paywall/i);
ok('tokens are earned only, never zero, fixed spend prices');

const sql = read('supabase/migrations/wave19_trait_history_tokens.sql');
assert.match(sql, /create table public.trait_history/);
assert.match(sql, /references auth.users \(id\) on delete cascade/);
assert.match(sql, /trait_history_select_own/);
assert.match(sql, /auth.uid\(\) = user_id/);
assert.match(sql, /create table public.token_events/);
assert.match(sql, /token_events.*on delete cascade/s);
assert.match(sql, /earn_tokens/);
assert.match(sql, /spend_tokens/);
assert.match(sql, /tokens are earned only/);
ok('schema: history + token ledger cascade with auth.users; RLS is own-row');

// wave38 widens the trait_history.source CHECK to include self_scenario (a
// direct client source added after wave19) — without it, every scenario-answer
// history insert aborts on the CHECK and is silently swallowed by the client
// catch, so scenario answers never reach the timeline.
const wave38 = read('supabase/migrations/wave38_trait_history_self_scenario.sql');
assert.match(wave38, /drop constraint if exists trait_history_source_known/);
assert.match(wave38, /add constraint trait_history_source_known/);
assert.match(wave38, /'self_scenario'/);
for (const src of [
  'self_slider',
  'self_tap',
  'self_confirm',
  'self_settings',
  'self_grid',
  'self_situation',
  'self_game',
] as const) {
  assert.match(wave38, new RegExp(`'${src}'`), `wave38 must retain ${src}`);
}
ok('wave38 widens trait_history.source CHECK to self_scenario without dropping any prior source');

// --- Sage thin + no Home/crisis/widget -----------------------------------
// The Talk prompt builder went with the voice provider lane (2026-09-14), so
// its thin-profile honesty and divergence-note assertions have nothing to run
// against. The same thin-profile gate on the surviving surface is still
// asserted, and Talk should re-earn these when it is rebuilt.
assert.match(read('src/lib/sage-insight.ts'), /isThinProfile/);
assert.doesNotMatch(read('src/lib/sage-insight.ts'), /settled < 6/);
ok('the surviving insight surface keeps the thin-profile gate');

const home = read('src/app/(tabs)/index.tsx');
const crisis = read('src/components/crisis-card.tsx');
const widget = read('targets/widget/widgets.swift');
// `IntakeSweep` ("A faster pass") was removed entirely 2026-09-15, not just
// unmounted here — this file no longer references it anywhere, so those
// alternatives were dropped from the patterns below.
assert.doesNotMatch(home, /trait_history|spendTokens|TOKEN_PRICE/);
assert.doesNotMatch(crisis, /token|trait_history/);
assert.doesNotMatch(widget, /token|trait_history/);
assert.match(read('src/app/(tabs)/explore.tsx'), /settledAxisLabel/);
// SageInsightSpend's Explore call site is parked (Isolation Plan Card 5,
// 2026-09-15) — inverted per the Card 2/3 "invert, don't delete" convention.
assert.doesNotMatch(read('src/app/(tabs)/explore.tsx'), /SageInsightSpend/);
assert.match(read('src/components/axis-taps.tsx'), /TRAIT_UNDO/);
assert.match(read('src/lib/me.ts'), /insertTraitHistory/);
assert.match(read('src/lib/me.ts'), /recordStandaloneRanking/);
assert.match(read('src/lib/me.ts'), /recordStandaloneScenario/);
assert.match(read('src/lib/me.ts'), /recordForcedPick/);
ok('Home, crisis card, and widget stay untouched; Sage gets progress');

assert.equal(answeredAxisLabel(traitValuesFromPartial({})), `0 of ${TRAIT_AXES.length} answered`);
assert.equal(answeredAxisCount(traitValuesFromPartial({ autonomy: 0.8 })), 1);

const meSrc = read('src/lib/me.ts');
assert.match(meSrc, /persistMergedTraits/);
// The sweep ("A faster pass", 2026-09-15) and the Infinite Questions router
// that this used to check against it (2026-09-16) are both gone entirely.
assert.ok(
  !existsSync(resolve(__dirname, '..', 'src/lib/questions/route.ts')),
  'src/lib/questions/route.ts must stay deleted',
);
ok('both the sweep path and the Infinite Questions router stay deleted');

console.log(`\n${passed} wave19 checks passed`);
