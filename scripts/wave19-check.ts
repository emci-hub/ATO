/**
 * Wave 19: trait history, IQ sweep, standalone ranking/scenario, tokens,
 * 2-letter codes, Sage thin/divergence. Run: npm run check:wave19
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
} from '../src/lib/traits';
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
import { composeLocalQuestionBatch } from '../src/lib/questions/local';
import { QUESTIONS_BATCH_SIZE } from '../src/lib/questions/types';
import { parseQuestionBatch, parseQuestionSweep } from '../src/lib/questions/parse';
import {
  INTAKE_SWEEP_COPY_REVIEWED,
  QUESTIONS_SWEEP_SIZE,
  bankByAxis,
  bankDraftFor,
  bankLeadDrafts,
  composeLocalSweep,
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
import { buildTalkPrompt } from '../src/lib/voice/providers/prompt';
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

// --- IQ sweep -------------------------------------------------------------
assert.equal(QUESTIONS_SWEEP_SIZE, TRAIT_AXES.length);
assert.equal(INTAKE_SWEEP_COPY_REVIEWED, false);
// Bank is 3 drafts per axis. bankByAxis keeps ALL of them (it used to drop
// every draft after the first, which made variants 2 and 3 dead content).
assert.equal(QUESTIONS_BANK.length, TRAIT_AXES.length * 3);
const grouped = bankByAxis();
assert.equal(grouped.size, TRAIT_AXES.length);
for (const axis of TRAIT_AXES) {
  assert.equal(grouped.get(axis)?.length, 3, `${axis} keeps all 3 drafts`);
}
assert.equal(
  [...grouped.values()].reduce((n, list) => n + list.length, 0),
  QUESTIONS_BANK.length,
  'bankByAxis drops nothing',
);

// bankDraftFor wraps, so any index is safe, and variant 0 is the locked draft.
const lead = bankDraftFor('openness');
assert.equal(lead?.prompt, QUESTIONS_BANK.find((row) => row.axis === 'openness')?.prompt);
assert.deepEqual(bankDraftFor('openness', 3), lead, 'variant wraps at the group length');
assert.notDeepEqual(bankDraftFor('openness', 1), lead, 'variant 1 is a different draft');
// Returned drafts are copies — a caller mutating options must not edit the bank.
const mutable = bankDraftFor('openness');
mutable!.options[0]!.value = 0.123;
assert.notEqual(bankDraftFor('openness')?.options[0]?.value, 0.123);
assert.equal(bankLeadDrafts().length, TRAIT_AXES.length);

// A non-zero variant still yields one guard-clean item per axis, in order.
const sweepV2 = composeLocalSweep(1);
assert.equal(sweepV2.length, TRAIT_AXES.length);
assert.deepEqual(sweepV2.map((row) => row.axis), [...TRAIT_AXES]);
assert.notDeepEqual(sweepV2.map((row) => row.prompt), composeLocalSweep().map((row) => row.prompt));

// The 5-item rotation must still return 5 DISTINCT axes now that the bank has
// three drafts per axis — feeding all of them to preferFreshAxes would spend
// slots on duplicates it then drops.
const batchV1 = composeLocalQuestionBatch();
assert.equal(batchV1.length, QUESTIONS_BATCH_SIZE);
assert.equal(new Set(batchV1.map((row) => row.axis)).size, QUESTIONS_BATCH_SIZE);
const batchV2 = composeLocalQuestionBatch([], [], 1);
assert.equal(batchV2.length, QUESTIONS_BATCH_SIZE);
assert.deepEqual(batchV2.map((row) => row.axis), batchV1.map((row) => row.axis));
assert.notDeepEqual(batchV2.map((row) => row.prompt), batchV1.map((row) => row.prompt));
const sweep = composeLocalSweep();
assert.equal(sweep.length, TRAIT_AXES.length);
assert.deepEqual(sweep.map((row) => row.axis), [...TRAIT_AXES]);
for (const draft of sweep) {
  assert.ok(draft.options.length >= 2 && draft.options.length <= 3);
  assert.equal(containsFrameworkTerm(draft.prompt), false, draft.prompt);
  for (const option of draft.options) {
    assert.equal(containsFrameworkTerm(option.text), false, option.text);
  }
}
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
assert.doesNotMatch(read('src/lib/questions/sweep.ts'), /generateText/);
assert.match(read('src/lib/questions/sweep.ts'), /composeLocalSweep/);
ok('existing IQ prompt is still a 5-item rotating batch; the sweep is bank-only with no prompt');

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
const talk = buildTalkPrompt({
  me: {
    name: 'Riley',
    show_up: 'steady',
    talk_style: 'even',
    knocks_you_off: 'late nights',
    morning_cue: 'coffee',
  },
  message: 'How am I doing?',
  day: 3,
  history: [],
  answeredCount: 2,
});
assert.match(read('src/lib/voice/providers/prompt.ts'), /isThinProfile/);
assert.doesNotMatch(read('src/lib/voice/providers/prompt.ts'), /answered < 6/);
assert.match(read('src/lib/sage-insight.ts'), /isThinProfile/);
assert.doesNotMatch(read('src/lib/sage-insight.ts'), /settled < 6/);
const talkFull = buildTalkPrompt({
  me: {
    name: 'Riley',
    show_up: 'steady',
    talk_style: 'even',
    knocks_you_off: 'late nights',
    morning_cue: 'coffee',
  },
  message: 'How am I doing?',
  day: 3,
  history: [],
  answeredCount: 12,
  divergenceNote: 'What they told us and a gut-call they played don\'t quite match.',
});
assert.match(talkFull, new RegExp(`12 of ${TRAIT_AXES.length} settled`));
assert.match(talkFull, /TENSION/);
const talkBoundary = buildTalkPrompt({
  me: {
    name: 'Riley',
    show_up: 'steady',
    talk_style: 'even',
    knocks_you_off: 'late nights',
    morning_cue: 'coffee',
  },
  message: 'How am I doing?',
  day: 3,
  history: [],
  answeredCount: 6,
});
assert.match(talkBoundary, /PROFILE DEPTH: still thin/);
ok('Talk prompt gets thin-profile honesty and optional divergence');

const home = read('src/app/(tabs)/index.tsx');
const crisis = read('src/components/crisis-card.tsx');
const widget = read('targets/widget/widgets.swift');
assert.doesNotMatch(home, /IntakeSweep|trait_history|spendTokens|TOKEN_PRICE/);
assert.doesNotMatch(crisis, /token|IntakeSweep|trait_history/);
assert.doesNotMatch(widget, /token|IntakeSweep|trait_history/);
assert.match(read('src/app/(tabs)/explore.tsx'), /settledAxisLabel/);
assert.match(read('src/app/(tabs)/explore.tsx'), /SageInsightSpend/);
assert.match(read('src/components/axis-taps.tsx'), /TRAIT_UNDO/);
assert.match(read('src/lib/me.ts'), /insertTraitHistory/);
assert.match(read('src/lib/me.ts'), /recordStandaloneRanking/);
assert.match(read('src/lib/me.ts'), /recordStandaloneScenario/);
assert.match(read('src/lib/me.ts'), /recordForcedPick/);
ok('Home, crisis card, and widget stay untouched; Sage gets progress + insight spend');

assert.equal(answeredAxisLabel(traitValuesFromPartial({})), `0 of ${TRAIT_AXES.length} answered`);
assert.equal(answeredAxisCount(traitValuesFromPartial({ autonomy: 0.8 })), 1);

const meSrc = read('src/lib/me.ts');
assert.match(meSrc, /persistMergedTraits/);
assert.doesNotMatch(read('src/lib/questions/route.ts'), /routeQuestionSweep/);
ok('sweep is a separate path; existing routeQuestions rotation is unchanged');

console.log(`\n${passed} wave19 checks passed`);
