/**
 * Multi-call chunked generation (§3 of the trait-system redesign plan).
 * Run: npm run check:chunked-generate
 */
import assert from 'node:assert/strict';

import {
  CHUNK_SIZE,
  MAX_SHORTFALL_RETRIES,
  chunkAxisCounts,
  fillAxisCountsChunked,
  isNearDuplicate,
} from '../src/lib/questions/chunked-generate';
import type { QuestionDraft } from '../src/lib/questions/types';
import type { TraitAxis } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

// --- chunkAxisCounts -------------------------------------------------------
{
  const chunks = chunkAxisCounts({ conscientiousness: 3, extraversion: 3, openness: 3 });
  const total = chunks.reduce((sum, c) => sum + Object.values(c).reduce((a, b) => a + (b ?? 0), 0), 0);
  assert.equal(total, 9);
  for (const c of chunks) {
    const n = Object.values(c).reduce((a, b) => a + (b ?? 0), 0);
    assert.ok(n <= CHUNK_SIZE, `every chunk must be <= CHUNK_SIZE (${CHUNK_SIZE})`);
  }
  ok('chunkAxisCounts: preserves total count, no chunk exceeds CHUNK_SIZE');
}
{
  const chunks = chunkAxisCounts({});
  assert.deepEqual(chunks, [], 'an empty axisCounts map produces no chunks');
  ok('chunkAxisCounts: empty input produces no chunks');
}
{
  // A 25-question tiered round splits into exactly 5 chunks of 5.
  const axisCounts: Partial<Record<TraitAxis, number>> = {
    conscientiousness: 3, extraversion: 3, openness: 3, agreeableness: 2,
    conflict_assertiveness: 2, relatedness: 2, steadiness: 1, attachment_anxiety: 1,
    attachment_avoidance: 1, conflict_cooperativeness: 1, autonomy: 1, competence: 1,
    growth_mindset: 1, locus_of_control: 1, self_efficacy: 1, playfulness: 1,
  };
  const chunks = chunkAxisCounts(axisCounts);
  assert.equal(chunks.length, 5, 'a 25-question round is exactly 5 chunks of 5');
  ok('chunkAxisCounts: a 25-question tiered round produces exactly 5 chunks');
}

// --- isNearDuplicate --------------------------------------------------------
{
  assert.equal(isNearDuplicate('Did you skip breakfast today?', ['Did you skip breakfast today?']), true);
  assert.equal(isNearDuplicate('Did you skip breakfast today?', ['did you SKIP breakfast today??']), true, 'case/punctuation-insensitive');
  assert.equal(isNearDuplicate('Did you skip breakfast today?', ['A totally different question.']), false);
  assert.equal(isNearDuplicate('', ['']), false, 'empty text never counts as a duplicate match');
  ok('isNearDuplicate: normalized exact-text match, case/punctuation-insensitive, empty-safe');
}

// --- fillAxisCountsChunked ---------------------------------------------------
function draftsFor(axisCounts: Partial<Record<TraitAxis, number>>, label: string): QuestionDraft[] {
  const out: QuestionDraft[] = [];
  for (const [axis, n] of Object.entries(axisCounts) as [TraitAxis, number][]) {
    for (let i = 0; i < (n ?? 0); i += 1) {
      out.push({ axis, prompt: `${label} ${axis} #${i}`, options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }] });
    }
  }
  return out;
}

async function run() {
  {
    // Happy path: every chunk succeeds fully in one call each — no retries needed.
    let generateCalls = 0;
    const saved: QuestionDraft[] = [];
    const result = await fillAxisCountsChunked(
      { conscientiousness: 3, extraversion: 3, openness: 3 },
      [],
      {
        buildPrompt: (axisCounts) => JSON.stringify(axisCounts),
        generateBatch: async (_prompt, count) => {
          generateCalls += 1;
          const axisCounts = JSON.parse(_prompt) as Partial<Record<TraitAxis, number>>;
          const drafts = draftsFor(axisCounts, `call${generateCalls}`);
          assert.equal(drafts.length, count, 'requested count matches what was actually asked for');
          return drafts;
        },
        saveItems: async (drafts) => {
          saved.push(...drafts);
        },
      },
    );
    assert.equal(result.length, 9);
    assert.equal(saved.length, 9, 'every draft saved immediately');
    assert.ok(generateCalls <= 2, 'a 9-question plan fits in at most 2 chunks (5+4)');
    ok('fillAxisCountsChunked: happy path fills the whole plan across <=CHUNK_SIZE calls, saves immediately');
  }
  {
    // Shortfall retry: first call for a chunk returns fewer than requested;
    // only the remainder is retried, not the whole chunk.
    let call = 0;
    const requestedCounts: number[] = [];
    const result = await fillAxisCountsChunked(
      { conscientiousness: 3, extraversion: 2 },
      [],
      {
        buildPrompt: (axisCounts, count) => JSON.stringify({ axisCounts, count }),
        generateBatch: async (prompt, count) => {
          call += 1;
          requestedCounts.push(count);
          const { axisCounts } = JSON.parse(prompt) as { axisCounts: Partial<Record<TraitAxis, number>> };
          const all = draftsFor(axisCounts, `call${call}`);
          // First attempt for this chunk returns only half; the shortfall
          // must be requested again with a SMALLER count, not the full 5.
          return call === 1 ? all.slice(0, 2) : all;
        },
        saveItems: async () => {},
      },
    );
    assert.equal(result.length, 5, 'eventually fills the whole 5-question plan across the retry');
    assert.ok(call >= 2, 'shortfall triggered at least one retry');
    assert.ok(requestedCounts[1]! < requestedCounts[0]!, 'the retry asks only for the shortfall, not the full chunk again');
    ok('fillAxisCountsChunked: a short chunk result triggers a shortfall-only retry, not a full chunk re-request');
  }
  {
    // Retry budget is bounded: a chunk that always comes back empty gives up
    // after MAX_SHORTFALL_RETRIES rather than looping forever.
    let calls = 0;
    const result = await fillAxisCountsChunked(
      { conscientiousness: 3 },
      [],
      {
        buildPrompt: () => 'p',
        generateBatch: async () => {
          calls += 1;
          return null;
        },
        saveItems: async () => {
          throw new Error('must not be called — nothing to save');
        },
      },
    );
    assert.equal(result.length, 0);
    assert.equal(calls, MAX_SHORTFALL_RETRIES + 1, 'exactly one initial attempt plus the retry budget, then it stops');
    ok('fillAxisCountsChunked: a chunk that never returns anything gives up after MAX_SHORTFALL_RETRIES, does not loop forever');
  }
  {
    // Near-duplicates against the recent-text window are filtered and
    // trigger a shortfall retry, and the exclusion list grows within the call.
    let call = 0;
    const promptsSeen: string[] = [];
    const result = await fillAxisCountsChunked(
      { openness: 2 },
      ['An already-asked question about openness.'],
      {
        buildPrompt: (_axisCounts, _count, excludeText) => {
          promptsSeen.push(JSON.stringify(excludeText));
          return 'p';
        },
        generateBatch: async () => {
          call += 1;
          return call === 1
            ? [
                { axis: 'openness', prompt: 'An already-asked question about openness.', options: [] }, // duplicate, filtered
                { axis: 'openness', prompt: 'A genuinely new one.', options: [] },
              ]
            : [{ axis: 'openness', prompt: 'A second genuinely new one.', options: [] }];
        },
        saveItems: async () => {},
      },
    );
    assert.equal(result.length, 2, 'the duplicate is filtered out, only the 2 genuine questions are kept');
    assert.ok(promptsSeen[1]!.includes('A genuinely new one.'), 'the retry prompt excludes what the first call already saved, not just prior history');
    ok('fillAxisCountsChunked: near-duplicates against the recent-text window are filtered and retried, exclusion list grows within the call');
  }
  {
    // A single call returning two near-identical drafts must not let both
    // through just because neither is in the recent-text window yet.
    const result = await fillAxisCountsChunked(
      { openness: 2 },
      [],
      {
        buildPrompt: () => 'p',
        generateBatch: async () => [
          { axis: 'openness', prompt: 'Did you skip breakfast today?', options: [] },
          { axis: 'openness', prompt: 'did you SKIP breakfast today??', options: [] }, // intra-batch near-duplicate
        ],
        saveItems: async () => {},
      },
    );
    assert.equal(result.length, 1, 'an intra-batch near-duplicate is filtered even though it is not yet in excludeText');
    ok('fillAxisCountsChunked: intra-batch near-duplicates are filtered, not just cross-call ones');
  }
  {
    // A wrong-axis draft (outside `remaining`'s allowed axes) is dropped.
    const result = await fillAxisCountsChunked(
      { openness: 1 },
      [],
      {
        buildPrompt: () => 'p',
        generateBatch: async () => [
          { axis: 'steadiness', prompt: 'Wrong axis, must be dropped.', options: [] },
          { axis: 'openness', prompt: 'Right axis.', options: [] },
        ],
        saveItems: async () => {},
      },
    );
    assert.equal(result.length, 1);
    assert.equal(result[0]!.axis, 'openness', 'a draft on an axis outside the requested plan is dropped');
    ok('fillAxisCountsChunked: a draft on an axis not in the current chunk plan is dropped');
  }
  {
    // Over-delivery: a call returning MORE drafts for an axis than was
    // actually requested must not let the total saved exceed the plan.
    const saved: QuestionDraft[] = [];
    const result = await fillAxisCountsChunked(
      { openness: 2 },
      [],
      {
        buildPrompt: () => 'p',
        generateBatch: async () => [
          { axis: 'openness', prompt: 'One.', options: [] },
          { axis: 'openness', prompt: 'Two.', options: [] },
          { axis: 'openness', prompt: 'Three (over-delivered).', options: [] },
        ],
        saveItems: async (drafts) => {
          saved.push(...drafts);
        },
      },
    );
    assert.equal(result.length, 2, 'over-delivery beyond the requested count is capped, not saved in full');
    assert.equal(saved.length, 2, 'saveItems never receives more than the plan asked for');
    ok('fillAxisCountsChunked: a call over-delivering on one axis is capped at the requested count');
  }

  console.log(`\n${passed} chunked-generate checks passed`);
}

void run();
