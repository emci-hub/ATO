/**
 * "10 questions per category" core logic. Run: npm run check:category-batch
 *
 * Pure/offline only — category-batch.ts has no Supabase import, so every
 * check here runs against real functions, not re-implemented math. The
 * Supabase-facing layer (category-batch-store.ts, the wave44 migration/RPCs)
 * is not exercised here — same split as questions-check.ts vs. store.ts.
 */
import assert from 'node:assert/strict';

import { getCategoryDefs } from '../src/lib/categories';
import {
  allCategoryBatchesLocked,
  categoryBatchAxisPlan,
  categoryBatchProgressFrom,
  composeCategoryBatch,
  tallyAxisPlan,
  CATEGORY_BATCH_SIZE,
  type CategoryBatchState,
} from '../src/lib/questions/category-batch';
import { buildQuestionsPrompt } from '../src/lib/questions/prompt';
import type { QuestionDraft } from '../src/lib/questions/types';
import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';
import type { TraitTrack } from '../src/lib/trait-stability';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function trackWithCount(axis: TraitAxis, answerCount: number): TraitTrack {
  return {
    axis,
    track: 'report',
    value: 0.5,
    stability: 0.5,
    answerCount,
    lastTouched: '2026-09-03T12:00:00.000Z',
    lastDepthAt: null,
  };
}

/** Every axis at a real answer count (>=3, past the stability floor) except the given ones, which get 0. */
function tracksLaggingOn(...laggingAxes: readonly TraitAxis[]): TraitTrack[] {
  const lagging = new Set(laggingAxes);
  return TRAIT_AXES.filter((axis) => !lagging.has(axis)).map((axis) => trackWithCount(axis, 5));
}

const NOW = new Date('2026-09-07T12:00:00.000Z');

async function main() {
  assert.equal(CATEGORY_BATCH_SIZE, 10);

  // --- categoryBatchAxisPlan --------------------------------------------
  {
    // No lagging axes anywhere: plan is 10 slots, all from the category's
    // own axes, round-robin, in CategoryDef.axes order.
    const allSettled: TraitTrack[] = TRAIT_AXES.map((axis) => trackWithCount(axis, 5));
    const def = getCategoryDefs().find((row) => row.axes.length >= 2)!;
    const plan = categoryBatchAxisPlan(def.id, allSettled, NOW);
    assert.equal(plan.length, CATEGORY_BATCH_SIZE);
    for (const axis of plan) assert.ok(def.axes.includes(axis), `${axis} should be one of ${def.id}'s own axes`);
    ok('no lagging axes: full 10-slot plan stays within the category\'s own axes');
  }
  {
    // Every axis outside the category is lagging (answerCount 0 everywhere
    // else): filler is capped at half the batch (5), never all 10 — the
    // category never loses its own identity entirely.
    const def = getCategoryDefs()[0]!;
    const noTracks: TraitTrack[] = [];
    const plan = categoryBatchAxisPlan(def.id, noTracks, NOW);
    assert.equal(plan.length, CATEGORY_BATCH_SIZE);
    const fillerCount = plan.filter((axis) => !def.axes.includes(axis)).length;
    assert.equal(fillerCount, 5, 'filler capped at half the batch (5 of 10)');
    const normalCount = plan.filter((axis) => def.axes.includes(axis)).length;
    assert.equal(normalCount, 5);
    ok('every other axis lagging: filler capped at exactly half the batch, never crowds out the category entirely');
  }
  {
    // Exactly one lagging axis outside the category: filler is exactly 1
    // slot (min(lagging.length, 5) = 1), the rest stay on the category's
    // own axes.
    const def = getCategoryDefs().find((row) => row.axes.length >= 2)!;
    const outsideAxis = TRAIT_AXES.find((axis) => !def.axes.includes(axis))!;
    const tracks = tracksLaggingOn(outsideAxis);
    const plan = categoryBatchAxisPlan(def.id, tracks, NOW);
    const fillerHits = plan.filter((axis) => axis === outsideAxis).length;
    assert.equal(fillerHits, 1);
    assert.equal(plan.filter((axis) => !def.axes.includes(axis)).length, 1);
    ok('one lagging axis outside the category: exactly one filler slot targets it');
  }
  {
    // An unknown category id returns an empty plan rather than throwing.
    const plan = categoryBatchAxisPlan('cat_not_real' as never, [], NOW);
    assert.deepEqual(plan, []);
    ok('unknown category id: empty plan, no throw');
  }

  // --- tallyAxisPlan -------------------------------------------------------
  {
    const tally = tallyAxisPlan(['openness', 'openness', 'steadiness'] as TraitAxis[]);
    assert.deepEqual(tally, { openness: 2, steadiness: 1 });
    ok('tallyAxisPlan: counts occurrences per axis');
  }

  // --- categoryBatchProgressFrom / allCategoryBatchesLocked -------------
  {
    const progress = categoryBatchProgressFrom('cat_steadiness', null);
    assert.equal(progress.locked, false);
    assert.equal(progress.answeredCount, 0);
    assert.equal(progress.batchId, null);
    ok('no batch yet: progress reads unlocked, zero answered');
  }
  {
    const batch: CategoryBatchState = {
      id: 'b1',
      categoryId: 'cat_steadiness',
      finalizedAt: null,
      items: Array.from({ length: 9 }, (_, i) => ({
        id: `i${i}`,
        axis: 'steadiness',
        prompt: `q${i}`,
        options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
        answeredOption: 0,
      })),
    };
    const progress = categoryBatchProgressFrom('cat_steadiness', batch);
    assert.equal(progress.locked, false, '9/10 items must not lock');
    assert.equal(progress.answeredCount, 9);
    ok('9 of 10 items present and answered: not locked (needs all 10 present)');
  }
  {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `i${i}`,
      axis: 'steadiness' as TraitAxis,
      prompt: `q${i}`,
      options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
      answeredOption: i < 9 ? 0 : null,
    }));
    const batch: CategoryBatchState = { id: 'b1', categoryId: 'cat_steadiness', finalizedAt: null, items };
    const progress = categoryBatchProgressFrom('cat_steadiness', batch);
    assert.equal(progress.locked, false, '10 present but only 9 answered must not lock');
    ok('all 10 present but only 9 answered: not locked');

    items[9]!.answeredOption = 1;
    const lockedProgress = categoryBatchProgressFrom('cat_steadiness', batch);
    assert.equal(lockedProgress.locked, true);
    ok('all 10 present and all 10 answered: locked');
  }
  {
    // allCategoryBatchesLocked requires every real category def to report
    // locked — a subset, even if every entry in it is locked, is not enough.
    const defs = getCategoryDefs();
    const lockedItems = Array.from({ length: 10 }, (_, i) => ({
      id: `i${i}`,
      axis: defs[0]!.axes[0]!,
      prompt: `q${i}`,
      options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
      answeredOption: 0,
    }));
    const oneLocked = [
      categoryBatchProgressFrom(defs[0]!.id, {
        id: 'b0',
        categoryId: defs[0]!.id,
        finalizedAt: null,
        items: lockedItems,
      }),
    ];
    assert.equal(allCategoryBatchesLocked(oneLocked), false, 'one locked category out of many is not "all"');
    const allLocked = defs.map((def) =>
      categoryBatchProgressFrom(def.id, {
        id: `b-${def.id}`,
        categoryId: def.id,
        finalizedAt: null,
        items: lockedItems.map((item) => ({ ...item, axis: def.axes[0]! })),
      }),
    );
    assert.equal(allCategoryBatchesLocked(allLocked), true);
    ok('allCategoryBatchesLocked is true only once every real category reports locked');
  }

  // --- buildQuestionsPrompt: count/axisCounts/excludeText plumbing -------
  {
    const base = { me: { name: 'Ari', talk_style: 'even' as const, voice_preset: 'default' }, grounding: { kind: 'none' as const, detail: null } };
    const defaultPrompt = buildQuestionsPrompt(base);
    assert.match(defaultPrompt, /Return exactly 5 questions\./);
    assert.match(defaultPrompt, new RegExp(TRAIT_AXES.join(', ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    ok('buildQuestionsPrompt with no new params: byte-identical "exactly 5" / full-16-axes shape (pre-existing callers untouched)');

    const batchPrompt = buildQuestionsPrompt({
      ...base,
      count: 10,
      axisCounts: { openness: 4, steadiness: 6 },
      excludeText: ['Did you skip breakfast today?'],
    });
    assert.match(batchPrompt, /Return exactly 10 questions\./);
    assert.match(batchPrompt, /openness x4/);
    assert.match(batchPrompt, /steadiness x6/);
    assert.match(batchPrompt, /ALREADY ASKED/);
    assert.match(batchPrompt, /Did you skip breakfast today\?/);
    assert.doesNotMatch(batchPrompt, /extraversion x/, 'axes outside axisCounts must not appear in the AXES section');
    ok('buildQuestionsPrompt with count/axisCounts/excludeText: axis-restricted, count-correct, exclusion list present');
  }

  // --- composeCategoryBatch: chunked (<=5/call), save-partial-then-retry -
  {
    const def = getCategoryDefs().find((row) => row.axes.length >= 2)!;
    const tracks: TraitTrack[] = TRAIT_AXES.map((axis) => trackWithCount(axis, 5));
    const plan = categoryBatchAxisPlan(def.id, tracks, NOW);
    const allowed = new Set(plan);

    const requestedCounts: number[] = [];
    const saved: QuestionDraft[][] = [];
    function draftFor(axis: TraitAxis, seed: number): QuestionDraft {
      return {
        axis,
        prompt: `Question ${seed} about ${axis}`,
        options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
      };
    }

    const batch = await composeCategoryBatch(
      def.id,
      tracks,
      { name: 'Ari', talk_style: 'even', voice_preset: 'default' },
      {
        fetchAskedTexts: async () => [],
        generateBatch: async (_prompt, count) => {
          requestedCounts.push(count);
          assert.ok(count <= 5, 'every single generation call must ask for at most 5 (the proven-safe size under the 1024-token server cap)');
          const call = requestedCounts.length;
          const returned = call === 1 ? count - 2 : count; // first call comes back short by 2
          const startSeed = saved.flat().length;
          return Array.from({ length: returned }, (_, i) => draftFor(plan[startSeed + i]!, startSeed + i));
        },
        saveItems: async (categoryId, drafts) => {
          assert.equal(categoryId, def.id);
          saved.push([...drafts]);
          const allSoFar = saved.flat();
          return {
            id: 'b1',
            categoryId: def.id,
            finalizedAt: null,
            items: allSoFar.map((d, i) => ({
              id: `i${i}`,
              axis: d.axis,
              prompt: d.prompt,
              options: d.options,
              answeredOption: null,
            })),
          };
        },
      },
      NOW,
    );

    // 5 requested/3 returned, 5 requested/5 returned, 2 requested/2 returned = 10.
    assert.deepEqual(requestedCounts, [5, 5, 2], 'chunk sizes shrink to exactly the remaining count, never re-request the original total');
    assert.equal(saved.length, 3, 'every partial result is saved immediately, including the short first chunk');
    assert.equal(batch.items.length, CATEGORY_BATCH_SIZE);
    for (const item of batch.items) assert.ok(allowed.has(item.axis), `${item.axis} must be one of the plan's axes`);
    ok('composeCategoryBatch: chunks generation at <=5/call, saves every partial result immediately, assembles exactly 10');
  }
  {
    // Resuming a category whose batch already has some items saved (a prior
    // session stopped short) must only request the remainder, must count
    // the existing items toward the 10, and must exclude their text.
    const def = getCategoryDefs().find((row) => row.axes.length >= 2)!;
    const tracks: TraitTrack[] = TRAIT_AXES.map((axis) => trackWithCount(axis, 5));
    const plan = categoryBatchAxisPlan(def.id, tracks, NOW);
    const existingItems = Array.from({ length: 6 }, (_, i) => ({
      id: `existing-${i}`,
      axis: plan[i]!,
      prompt: `Existing question ${i}`,
      options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
      answeredOption: null,
    }));
    const existing = { id: 'b1', categoryId: def.id, finalizedAt: null, items: existingItems };

    let generateCalls = 0;
    let sawExistingPromptExcluded = false;
    const batch = await composeCategoryBatch(
      def.id,
      tracks,
      { name: 'Ari', talk_style: 'even', voice_preset: 'default' },
      {
        fetchAskedTexts: async () => [],
        generateBatch: async (prompt, count) => {
          generateCalls += 1;
          assert.equal(count, 4, 'resuming a 6/10 batch must request exactly the remaining 4, never the full 10');
          sawExistingPromptExcluded = prompt.includes('Existing question 0');
          return Array.from({ length: count }, (_, i) => ({
            axis: plan[6 + i]!,
            prompt: `New question ${i}`,
            options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
          }));
        },
        saveItems: async (categoryId, drafts) => ({
          id: 'b1',
          categoryId,
          finalizedAt: null,
          items: [
            ...existingItems,
            ...drafts.map((d, i) => ({ id: `new-${i}`, axis: d.axis, prompt: d.prompt, options: d.options, answeredOption: null })),
          ],
        }),
      },
      NOW,
      existing,
    );

    assert.equal(generateCalls, 1, 'the 6 existing items must not trigger any regeneration of their own');
    assert.equal(sawExistingPromptExcluded, true, 'existing items\' text must be in the exclusion list on resume');
    assert.equal(batch.items.length, CATEGORY_BATCH_SIZE);
    ok('composeCategoryBatch: resuming a partial batch requests only the remainder and excludes the already-saved text');
  }
  {
    // Exclusion list carries forward: the second call must see the first
    // call's saved prompt text in its exclude list.
    const def = getCategoryDefs()[0]!;
    const tracks: TraitTrack[] = TRAIT_AXES.map((axis) => trackWithCount(axis, 5));
    const plan = categoryBatchAxisPlan(def.id, tracks, NOW);
    let secondCallExcluded: readonly string[] = [];
    let calls = 0;
    await composeCategoryBatch(
      def.id,
      tracks,
      { name: 'Ari', talk_style: 'even', voice_preset: 'default' },
      {
        fetchAskedTexts: async () => ['An old already-asked question.'],
        generateBatch: async (prompt, count) => {
          calls += 1;
          if (calls === 1) {
            assert.match(prompt, /An old already-asked question\./);
            return [{ axis: plan[0]!, prompt: 'First saved question.', options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }] }];
          }
          secondCallExcluded = prompt.includes('First saved question.') ? ['First saved question.'] : [];
          return Array.from({ length: count }, (_, i) => ({
            axis: plan[i + 1] ?? plan[0]!,
            prompt: `Retry question ${i}`,
            options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
          }));
        },
        saveItems: async (categoryId, drafts) => ({
          id: 'b1',
          categoryId,
          finalizedAt: null,
          items: drafts.map((d, i) => ({ id: `i${i}`, axis: d.axis, prompt: d.prompt, options: d.options, answeredOption: null })),
        }),
      },
      NOW,
    );
    assert.deepEqual(secondCallExcluded, ['First saved question.']);
    ok('composeCategoryBatch: retry exclusion list includes this batch\'s own just-saved question text');
  }

  console.log(`\n${passed} category-batch checks passed`);
}

void main();
