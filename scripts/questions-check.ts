/**
 * Infinite Questions core. Run: npm run check:questions
 *
 * Cached batches of 5, self_situation damped write, own regen quota tag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { QUESTIONS_BANK, QUESTIONS_FEW_SHOTS } from '../src/lib/questions/bank';
import { pickQuestionGrounding } from '../src/lib/questions/context';
import {
  QUESTIONS_CHECKPOINT,
  QUESTIONS_KEEP_GOING,
  QUESTIONS_LABEL,
  QUESTIONS_SKIP_REST,
  QUESTIONS_SKIP_THIS,
} from '../src/lib/questions/copy';
import { questionDraftGuardHit } from '../src/lib/questions/guards';
import {
  deferredUnansweredAxes,
  mergedDeferral,
  normalizeDeferredAxes,
} from '../src/lib/questions/deferral';
import { composeLocalQuestionBatch } from '../src/lib/questions/local';
import { parseQuestionBatch } from '../src/lib/questions/parse';
import { buildQuestionsPrompt } from '../src/lib/questions/prompt';
import { preferFreshAxes, recentAskedAxes } from '../src/lib/questions/rotation';
import { nextUnansweredItem, routeQuestions } from '../src/lib/questions/route';
import { routeQuestionSweep } from '../src/lib/questions/sweep';
import { QUESTIONS_BATCH_SIZE, QUESTIONS_CALL_TYPE } from '../src/lib/questions/types';
import type { QuestionDraft } from '../src/lib/questions/types';
import { emptySageKnowsState } from '../src/lib/sage-knows';
import type { TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES, emptyTraitState, mergeTraitWrite, type TraitAxis } from '../src/lib/traits';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';
import { PHRASE_FLAG_TYPE } from '../src/lib/voice/phrase-guard';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

/** Report tracks with >=1 answer on every axis — a "complete" profile. */
function completeTracks(): TraitTrack[] {
  return TRAIT_AXES.map((axis) => ({
    axis,
    track: 'report' as const,
    value: 0.5,
    stability: 0.5,
    answerCount: 1,
    lastTouched: '2026-09-03T12:00:00.000Z',
    lastDepthAt: null,
  }));
}

/** Complete except for the named axes, which have no row at all. */
function tracksMissing(...axes: readonly string[]): TraitTrack[] {
  return completeTracks().filter((row) => !axes.includes(row.axis));
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

assert.equal(QUESTIONS_BATCH_SIZE, 5);
assert.equal(QUESTIONS_CALL_TYPE, 'questions');
// Three drafts per axis, grouped, first-of-group is the locked few-shot one.
assert.equal(QUESTIONS_BANK.length, TRAIT_AXES.length * 3);
const bankPerAxis = new Map<string, number>();
for (const row of QUESTIONS_BANK) {
  bankPerAxis.set(row.axis, (bankPerAxis.get(row.axis) ?? 0) + 1);
}
for (const axis of TRAIT_AXES) {
  assert.equal(bankPerAxis.get(axis), 3, `${axis} needs exactly 3 bank drafts`);
}
// Axis groups are contiguous and in TRAIT_AXES order.
assert.deepEqual([...new Set(QUESTIONS_BANK.map((row) => row.axis))], [...TRAIT_AXES]);
// Every stem and option clears the full guard chain, and no prompt repeats.
const bankPrompts = QUESTIONS_BANK.map((row) => row.prompt);
assert.equal(new Set(bankPrompts).size, bankPrompts.length, 'no duplicate bank prompts');
for (const row of QUESTIONS_BANK) {
  assert.ok(row.options.length >= 2 && row.options.length <= 3, row.prompt);
  assert.ok(row.prompt.length <= 400, row.prompt);
  assert.equal(questionDraftGuardHit(row), null, row.prompt);
}
assert.match(QUESTIONS_FEW_SHOTS, /Your Do today was writing down one thing you're walking into/);
assert.match(QUESTIONS_FEW_SHOTS, /A friend cancels same-day, no real reason given/);
assert.match(QUESTIONS_FEW_SHOTS, /Everyone at the table already knows their order/);
ok('locked few-shot set is used verbatim');

const local = composeLocalQuestionBatch();
assert.equal(local.length, 5);
assert.equal(local[0]?.axis, 'openness');
for (const draft of local) {
  assert.ok(draft.options.length >= 2 && draft.options.length <= 3);
  assert.equal(containsFrameworkTerm(draft.prompt), false, draft.prompt);
  for (const option of draft.options) {
    assert.equal(containsFrameworkTerm(option.text), false, option.text);
  }
}
ok('local batch is 5 multiple-choice items with no framework terms');

const parsed = parseQuestionBatch(
  JSON.stringify({
    questions: [
      {
        axis: 'autonomy',
        prompt: 'You already picked the path this morning.',
        options: [
          { text: 'Mine', value: 0.8 },
          { text: 'Theirs', value: 0.2 },
        ],
      },
    ],
  }),
);
assert.equal(parsed[0]?.axis, 'autonomy');
ok('JSON batch parse keeps axis + option values');

const skippedOnly = pickQuestionGrounding(
  { sage_knows: emptySageKnowsState(), facts: [] },
  [{ day: 1, status: 'skipped', read: 'a skip read', do: 'a skip do' }],
);
assert.equal(skippedOnly.kind, 'none');
const fromDo = pickQuestionGrounding(
  { sage_knows: emptySageKnowsState(), facts: [] },
  [{ day: 1, status: 'done', do: 'Write one line.' }],
);
assert.equal(fromDo.kind, 'do');
assert.equal(fromDo.detail, 'Write one line.');
ok('grounding uses a done Do and never a skipped Check');

const first = mergeTraitWrite(emptyTraitState(), { relatedness: 0.8 }, 'self_situation', ['relatedness']);
assert.notEqual(first.values.relatedness, 0.8);
assert.equal(first.sources.relatedness, 'self_situation');
ok('answers reuse the damped self_situation mergeTraitWrite path');

const prompt = buildQuestionsPrompt({
  me: { name: 'Riley', talk_style: 'even', voice_preset: 'close_friend' },
  grounding: { kind: 'do', detail: 'Write one line.' },
});
assert.match(prompt, /LOCKED EXAMPLES/);
assert.match(prompt, /The different one, easily/);
assert.match(prompt, /Never ask for free text/);
assert.match(prompt, /Never a hypothetical/);
assert.match(prompt, /Never double-barrel/);
assert.match(prompt, /socially-desirable/);
assert.match(prompt, /Mix stakes/);
assert.match(prompt, /same sentence shape/);
assert.match(prompt, /you mentioned to Sage/);
assert.doesNotMatch(prompt, /TextInput/);
ok('prompt is multiple-choice, includes the locked few-shots');

const jargonOption: QuestionDraft = {
  axis: 'openness',
  prompt: 'You already picked the path this morning.',
  options: [
    { text: 'You are an introvert.', value: 0.2 },
    { text: 'The other way', value: 0.8 },
  ],
};
assert.equal(questionDraftGuardHit(jargonOption), 'introvert');
const phraseOption: QuestionDraft = {
  axis: 'relatedness',
  prompt: 'A friend cancels same-day.',
  options: [
    { text: "You're the type of person who needs a reason.", value: 0.8 },
    { text: "I'd let it go.", value: 0.2 },
  ],
};
assert.equal(questionDraftGuardHit(phraseOption), PHRASE_FLAG_TYPE);
const cleanDraft: QuestionDraft = {
  axis: 'autonomy',
  prompt: 'You already picked the path this morning.',
  options: [
    { text: 'Mine', value: 0.8 },
    { text: 'Theirs', value: 0.2 },
  ],
};
assert.equal(questionDraftGuardHit(cleanDraft), null);
ok('guards run on question text and every option');

const recentThree: TraitAxis[] = ['openness', 'relatedness', 'growth_mindset'];
const rotated = composeLocalQuestionBatch(recentThree);
// The bank is grouped by axis in TRAIT_AXES order, so the first axis not in
// the recent set leads. (It was 'attachment_avoidance' while the bank kept the
// old interleaved few-shot order; the rotation rule itself is unchanged.)
assert.equal(rotated[0]?.axis, 'conscientiousness');
for (const axis of recentThree) {
  assert.ok(!rotated.some((row) => row.axis === axis), `${axis} is skipped while recent`);
}
assert.ok(!preferFreshAxes(composeLocalQuestionBatch(), ['openness']).slice(0, 1).some((row) => row.axis === 'openness'));
ok('soft axis rotation prefers axes outside the last 2–3');

// --- Question deferral (intake skip -> rotating pool) ---------------------
assert.deepEqual(
  normalizeDeferredAxes(['openness', 'bogus', 'openness', 7, 'playfulness']),
  ['openness', 'playfulness'],
);
const deferredVals = emptyTraitState().values;
deferredVals.openness = 0.5;
assert.deepEqual(deferredUnansweredAxes(deferredVals, ['openness', 'playfulness']), ['playfulness']);
assert.deepEqual(
  mergedDeferral(['openness', 'autonomy'], { ...deferredVals }, ['autonomy', 'relatedness']),
  ['autonomy', 'relatedness'],
);
ok('deferral helpers validate axes, dedupe, and prune answered axes');

const priorityBatch = composeLocalQuestionBatch([], ['playfulness', 'autonomy']);
assert.equal(priorityBatch[0]?.axis, 'playfulness');
assert.equal(priorityBatch[1]?.axis, 'autonomy');
assert.equal(priorityBatch.length, 5);
const reordered = preferFreshAxes(
  [
    { axis: 'openness', prompt: 'p1', options: [{ text: 'a', value: 0.8 }, { text: 'b', value: 0.2 }] },
    { axis: 'playfulness', prompt: 'p2', options: [{ text: 'a', value: 0.8 }, { text: 'b', value: 0.2 }] },
    { axis: 'autonomy', prompt: 'p3', options: [{ text: 'a', value: 0.8 }, { text: 'b', value: 0.2 }] },
  ],
  [],
  ['autonomy', 'playfulness'],
);
assert.deepEqual(
  reordered.map((draft) => draft.axis),
  ['autonomy', 'playfulness', 'openness'],
);
const prompted = buildQuestionsPrompt({
  me: { name: 'Riley', talk_style: 'even', voice_preset: 'close_friend' },
  grounding: { kind: 'do', detail: 'Write one line.' },
  priorityAxes: ['playfulness', 'autonomy'],
});
assert.match(prompted, /PRIORITY AXES/);
assert.match(prompted, /playfulness, autonomy/);
assert.doesNotMatch(prompt, /PRIORITY AXES/);
const deferralMigration = read('supabase/migrations/wave30_question_deferral.sql');
assert.match(deferralMigration, /question_deferred jsonb not null default '\[\]'::jsonb/);
ok('deferred axes lead local + rotated batches and the prompt; wave29 migration exists');

async function main() {
const routed = await routeQuestions(
  {
    me: {
      name: 'Riley',
      timezone: 'UTC',
      talk_style: 'even',
      voice_preset: 'close_friend',
      sage_knows: emptySageKnowsState(),
      facts: [],
      ai_consent: true,
    },
    history: [],
    aiConsent: true,
  },
  { useLocal: true },
);
assert.ok(routed.item);
assert.equal(routed.pack?.items.length, 5);
assert.equal(nextUnansweredItem(routed.pack)?.id, routed.item?.id);
ok('opening with local deps serves a cached-shape batch of 5');

// A just-answered deferred axis (answered in the latest pack) must not be
// re-front-loaded by the regenerated batch even if the UI's priority list is
// one render stale.
const answeredPack = {
  id: 'yesterday',
  generatedOn: '2026-08-29',
  createdAt: '2026-08-29T12:00:00.000Z',
  items: [
    {
      id: 'old-a',
      packId: 'yesterday',
      sortIndex: 0,
      axis: 'openness' as const,
      prompt: 'One.',
      options: [
        { text: 'A', value: 0.8 },
        { text: 'B', value: 0.2 },
      ],
      answeredOption: 0,
      skippedAt: null,
    },
  ],
};
const afterAnswerRegen = await routeQuestions(
  {
    me: {
      name: 'Riley',
      timezone: 'UTC',
      talk_style: 'even',
      voice_preset: 'close_friend',
      sage_knows: emptySageKnowsState(),
      facts: [],
      ai_consent: true,
    },
    history: [],
    aiConsent: true,
    priorityAxes: ['openness', 'playfulness'],
    tracks: completeTracks(),
  },
  {
    useLocal: true,
    loadLatestPack: async () => answeredPack,
  },
);
assert.ok(afterAnswerRegen.pack);
assert.equal(afterAnswerRegen.pack.items[0]?.axis, 'playfulness');
assert.ok(!afterAnswerRegen.pack.items.some((item) => item.axis === 'openness'));
ok('answered deferred axis is dropped from the regen priority list');

let generateCalls = 0;
const dirtyThenClean = await routeQuestions(
  {
    me: {
      name: 'Riley',
      timezone: 'UTC',
      talk_style: 'even',
      voice_preset: 'close_friend',
      sage_knows: emptySageKnowsState(),
      facts: [],
      ai_consent: true,
    },
    history: [],
    aiConsent: true,
    tracks: completeTracks(),
  },
  {
    claimBatch: async () => ({ ok: true }),
    generateBatch: async () => {
      generateCalls += 1;
      if (generateCalls === 1) {
        return [jargonOption, phraseOption, ...composeLocalQuestionBatch().slice(0, 3)];
      }
      return composeLocalQuestionBatch();
    },
  },
);
assert.equal(generateCalls, 2);
assert.ok(dirtyThenClean.pack);
assert.equal(
  dirtyThenClean.pack.items.some((item) => questionDraftGuardHit(item) != null),
  false,
);
ok('guard failure retries once, then skips the dirty question');

// --- Profile-completeness gate -------------------------------------------
const gateMe = {
  name: 'Riley',
  timezone: 'UTC',
  talk_style: 'even' as const,
  voice_preset: 'close_friend',
  sage_knows: emptySageKnowsState(),
  facts: [],
  ai_consent: true,
};

// Incomplete profile: no model call, and no quota claim either.
let incompleteGenerate = 0;
let incompleteClaims = 0;
const incomplete = await routeQuestions(
  {
    me: gateMe,
    history: [],
    aiConsent: true,
    tracks: tracksMissing('playfulness', 'autonomy'),
  },
  {
    claimBatch: async () => {
      incompleteClaims += 1;
      return { ok: true };
    },
    generateBatch: async () => {
      incompleteGenerate += 1;
      return composeLocalQuestionBatch();
    },
  },
);
assert.equal(incompleteGenerate, 0);
assert.equal(incompleteClaims, 0);
assert.ok(incomplete.pack);
ok('incomplete profile never calls the model and never claims quota');

// ...and it leads with the axes that are actually unfilled, in TRAIT_AXES order
// (autonomy sits ahead of playfulness in that list).
assert.equal(incomplete.pack!.items[0]?.axis, 'autonomy');
assert.equal(incomplete.pack!.items[1]?.axis, 'playfulness');
ok('incomplete profile serves the unfilled axes first, from the static bank');

// Complete profile: the AI path is reachable exactly as before.
let completeGenerate = 0;
let completeClaims = 0;
await routeQuestions(
  { me: gateMe, history: [], aiConsent: true, tracks: completeTracks() },
  {
    claimBatch: async () => {
      completeClaims += 1;
      return { ok: true };
    },
    generateBatch: async () => {
      completeGenerate += 1;
      return composeLocalQuestionBatch();
    },
  },
);
assert.equal(completeGenerate, 1);
assert.equal(completeClaims, 1);
ok('complete profile reaches the model and claims quota as before');

// Consent and crisis still outrank the gate — a complete profile does not
// bypass them, and an incomplete one reports them rather than the bank.
assert.equal(
  (await routeQuestions({ me: gateMe, history: [], aiConsent: false, tracks: completeTracks() }, {}))
    .kind,
  'consent-denied',
);
assert.equal(
  (
    await routeQuestions(
      { me: gateMe, history: [], aiConsent: true, crisisToday: true, tracks: tracksMissing('playfulness') },
      {},
    )
  ).kind,
  'crisis',
);
ok('consent and crisis still precede the completeness gate');

// Missing tracks read as incomplete — the safe direction (no paid call).
let noTracksGenerate = 0;
await routeQuestions(
  { me: gateMe, history: [], aiConsent: true },
  {
    claimBatch: async () => ({ ok: true }),
    generateBatch: async () => {
      noTracksGenerate += 1;
      return composeLocalQuestionBatch();
    },
  },
);
assert.equal(noTracksGenerate, 0);
ok('absent tracks read as incomplete rather than opening the AI path');

const asked = recentAskedAxes({
  id: 'p',
  generatedOn: '2026-08-29',
  createdAt: '2026-08-29T12:00:00.000Z',
  items: [
    {
      id: 'a',
      packId: 'p',
      sortIndex: 0,
      axis: 'openness',
      prompt: 'One.',
      options: [
        { text: 'A', value: 0.8 },
        { text: 'B', value: 0.2 },
      ],
      answeredOption: 0,
      skippedAt: null,
    },
    {
      id: 'b',
      packId: 'p',
      sortIndex: 1,
      axis: 'relatedness',
      prompt: 'Two.',
      options: [
        { text: 'A', value: 0.8 },
        { text: 'B', value: 0.2 },
      ],
      answeredOption: null,
      skippedAt: '2026-08-29T12:01:00.000Z',
    },
  ],
});
assert.deepEqual(asked, ['openness', 'relatedness']);
ok('recent axes include answers and skips, not open items');

const sql = read('supabase/migrations/wave17_infinite_questions.sql');
assert.match(sql, /create table public.question_packs/);
assert.match(sql, /create table public.question_items/);
assert.match(sql, /claim_questions_batch/);
assert.match(sql, /by_type/);
assert.match(sql, /questions_daily_cap/);
assert.match(sql, /Does not increment Sage\/Explore calls/);
const skipSql = read('supabase/migrations/wave18_question_skip.sql');
assert.match(skipSql, /skipped_at/);
assert.match(skipSql, /skip_question_item/);
assert.match(skipSql, /skip_rest_question_pack/);
ok('schema has packs/items, a separate questions regen claim, and skip RPCs');

// wave21 must drop every legacy 15-axis check so the 16-axis
// `question_items_axis_known` (incl. playfulness) is the only authority.
const playfulness = read('supabase/migrations/wave21_playfulness_categories.sql');
assert.match(playfulness, /drop constraint %I/);
assert.match(playfulness, /question_items_axis_known check \(axis in \(/);
assert.match(playfulness, /'playfulness'/);
const wave27 = read('supabase/migrations/wave27_drop_stale_question_items_axis_check.sql');
assert.match(wave27, /drop constraint if exists question_items_axis_check/);
ok('no legacy 15-axis question_items check survives; wave27 drops any stale copy');

const home = read('src/app/(tabs)/index.tsx');
const you = read('src/app/(tabs)/you.tsx');
const sage = read('src/app/(tabs)/sage.tsx');
const questionsScreen = read('src/app/(tabs)/intake-sweep.tsx');
assert.doesNotMatch(home, /QuestionsFold/);
assert.doesNotMatch(you, /QuestionsFold/);
assert.doesNotMatch(sage, /QuestionsFold/);
assert.match(questionsScreen, /QuestionsFold/);
assert.doesNotMatch(you, /\/questions/);
assert.equal(QUESTIONS_LABEL, 'A few questions');
const fold = read('src/components/questions-fold.tsx');
assert.match(fold, /updateTraits/);
assert.match(fold, /self_situation/);
assert.doesNotMatch(fold, /TextInput/);
assert.match(fold, /claimQuestionsBatch/);
assert.match(fold, /QUESTIONS_SKIP_THIS/);
assert.match(fold, /QUESTIONS_SKIP_REST/);
assert.match(fold, /QUESTIONS_CHECKPOINT/);
assert.match(fold, /QUESTIONS_KEEP_GOING/);
assert.match(fold, /logJargonGuard/);
assert.match(fold, /logPhraseGuard/);
assert.equal(QUESTIONS_SKIP_THIS, 'Skip this one');
assert.equal(QUESTIONS_SKIP_REST, 'Skip the rest');
assert.equal(QUESTIONS_CHECKPOINT, "That's plenty for now — come back anytime");
assert.equal(QUESTIONS_KEEP_GOING, 'Keep going');
assert.match(read('src/components/explore-panel.tsx'), /claimAiCall\('explore'\)/);
ok('own screen from You; writes self_situation; Explore tagged separately');

// "A faster pass" sweep always serves the static bank now (no model call);
// it still gates consent → crisis first, and never claims quota.
const sweepMe = { name: 'Riley', talk_style: 'even' as const, voice_preset: 'close_friend' };
const sweepDenied = await routeQuestionSweep({ me: sweepMe, aiConsent: false });
assert.equal(sweepDenied.kind, 'consent-denied');
assert.equal(sweepDenied.drafts.length, 0);
const sweepPending = await routeQuestionSweep({ me: sweepMe });
assert.equal(sweepPending.kind, 'consent-pending');
const sweepCrisis = await routeQuestionSweep({ me: sweepMe, aiConsent: true, crisisToday: true });
assert.equal(sweepCrisis.kind, 'crisis');
assert.equal(sweepCrisis.drafts.length, 0);

let sweepClaimed = 0;
const sweepLocal = await routeQuestionSweep({
  me: sweepMe,
  aiConsent: true,
  claimBatch: async () => {
    sweepClaimed += 1;
    return { ok: true } as const;
  },
});
assert.equal(sweepLocal.kind, 'questions');
assert.equal(sweepLocal.drafts.length, 16);
assert.equal(sweepClaimed, 0);
ok('sweep gates consent → crisis, then always serves the static bank with no quota claim');

const sweepSrc = read('src/lib/questions/sweep.ts');
assert.match(sweepSrc, /aiConsent/);
assert.match(sweepSrc, /crisisToday/);
assert.match(sweepSrc, /composeLocalSweep/);
assert.doesNotMatch(read('src/components/intake-sweep.tsx'), /claimQuestionsBatch|QUESTIONS_EMPTY_QUOTA/);
assert.match(read('src/components/intake-sweep.tsx'), /QUESTIONS_EMPTY_CONSENT/);
assert.match(read('src/components/intake-sweep.tsx'), /crisisToday/);
assert.match(read('src/app/(tabs)/intake-sweep.tsx'), /crisisToday=\{crisisToday\}/);
ok('sweep wiring: component passes consent/crisis, tab passes crisisToday; no dead quota-claim wiring');

console.log(`\n${passed} question checks passed`);
}

void main();
