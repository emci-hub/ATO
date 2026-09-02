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
import { QUESTIONS_BATCH_SIZE, QUESTIONS_CALL_TYPE } from '../src/lib/questions/types';
import type { QuestionDraft } from '../src/lib/questions/types';
import { emptySageKnowsState } from '../src/lib/sage-knows';
import { emptyTraitState, mergeTraitWrite } from '../src/lib/traits';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';
import { PHRASE_FLAG_TYPE } from '../src/lib/voice/phrase-guard';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

assert.equal(QUESTIONS_BATCH_SIZE, 5);
assert.equal(QUESTIONS_CALL_TYPE, 'questions');
assert.equal(QUESTIONS_BANK.length, 16);
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

const rotated = composeLocalQuestionBatch(['openness', 'relatedness', 'growth_mindset']);
assert.equal(rotated[0]?.axis, 'attachment_avoidance');
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
const questionsScreen = read('src/app/questions.tsx');
assert.doesNotMatch(home, /QuestionsFold/);
assert.doesNotMatch(you, /QuestionsFold/);
assert.doesNotMatch(sage, /QuestionsFold/);
assert.match(questionsScreen, /QuestionsFold/);
assert.match(you, /\/questions/);
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

console.log(`\n${passed} question checks passed`);
}

void main();
