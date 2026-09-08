/**
 * "5 questions per category" core logic. Run: npm run check:category-batch
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
  assert.equal(CATEGORY_BATCH_SIZE, 5);

  // --- categoryBatchAxisPlan --------------------------------------------
  {
    // No lagging axes anywhere: plan is 5 slots, all from the category's
    // own axes, round-robin, in CategoryDef.axes order.
    const allSettled: TraitTrack[] = TRAIT_AXES.map((axis) => trackWithCount(axis, 5));
    const def = getCategoryDefs().find((row) => row.axes.length >= 2)!;
    const plan = categoryBatchAxisPlan(def.id, allSettled, NOW);
    assert.equal(plan.length, CATEGORY_BATCH_SIZE);
    for (const axis of plan) assert.ok(def.axes.includes(axis), `${axis} should be one of ${def.id}'s own axes`);
    ok('no lagging axes: full 5-slot plan stays within the category\'s own axes');
  }
  {
    // Every axis outside the category is lagging (answerCount 0 everywhere
    // else): filler is capped at half the batch (2 of 5, floored), never
    // all 5 — the category never loses its own identity entirely.
    const def = getCategoryDefs()[0]!;
    const noTracks: TraitTrack[] = [];
    const plan = categoryBatchAxisPlan(def.id, noTracks, NOW);
    assert.equal(plan.length, CATEGORY_BATCH_SIZE);
    const fillerCount = plan.filter((axis) => !def.axes.includes(axis)).length;
    assert.equal(fillerCount, 2, 'filler capped at half the batch, floored (2 of 5)');
    const normalCount = plan.filter((axis) => def.axes.includes(axis)).length;
    assert.equal(normalCount, 3);
    ok('every other axis lagging: filler capped at floor(5/2)=2, never crowds out the category entirely');
  }
  {
    // Exactly one lagging axis outside the category: filler is exactly 1
    // slot (min(lagging.length, 2) = 1), the rest stay on the category's
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
      items: Array.from({ length: 4 }, (_, i) => ({
        id: `i${i}`,
        axis: 'steadiness',
        prompt: `q${i}`,
        options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
        answeredOption: 0,
      })),
    };
    const progress = categoryBatchProgressFrom('cat_steadiness', batch);
    assert.equal(progress.locked, false, '4/5 items must not lock');
    assert.equal(progress.answeredCount, 4);
    ok('4 of 5 items present and answered: not locked (needs all 5 present)');
  }
  {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: `i${i}`,
      axis: 'steadiness' as TraitAxis,
      prompt: `q${i}`,
      options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
      answeredOption: i < 4 ? 0 : null,
    }));
    const batch: CategoryBatchState = { id: 'b1', categoryId: 'cat_steadiness', finalizedAt: null, items };
    const progress = categoryBatchProgressFrom('cat_steadiness', batch);
    assert.equal(progress.locked, false, '5 present but only 4 answered must not lock');
    ok('all 5 present but only 4 answered: not locked');

    items[4]!.answeredOption = 1;
    const lockedProgress = categoryBatchProgressFrom('cat_steadiness', batch);
    assert.equal(lockedProgress.locked, true);
    ok('all 5 present and all 5 answered: locked');
  }
  {
    // allCategoryBatchesLocked requires every real category def to report
    // locked — a subset, even if every entry in it is locked, is not enough.
    const defs = getCategoryDefs();
    const lockedItems = Array.from({ length: 5 }, (_, i) => ({
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
      count: 5,
      axisCounts: { openness: 3, steadiness: 2 },
      excludeText: ['Did you skip breakfast today?'],
    });
    assert.match(batchPrompt, /Return exactly 5 questions\./);
    assert.match(batchPrompt, /openness x3/);
    assert.match(batchPrompt, /steadiness x2/);
    assert.match(batchPrompt, /ALREADY ASKED/);
    assert.match(batchPrompt, /Did you skip breakfast today\?/);
    assert.doesNotMatch(batchPrompt, /extraversion x/, 'axes outside axisCounts must not appear in the AXES section');
    ok('buildQuestionsPrompt with axisCounts/excludeText: axis-restricted, exclusion list present');
  }

  // --- composeCategoryBatch: single call, no chunking/resume -------------
  {
    const def = getCategoryDefs().find((row) => row.axes.length >= 2)!;
    const tracks: TraitTrack[] = TRAIT_AXES.map((axis) => trackWithCount(axis, 5));
    const plan = categoryBatchAxisPlan(def.id, tracks, NOW);
    const allowed = new Set(plan);

    let generateCalls = 0;
    let requestedCount = 0;
    let savedCount = 0;
    const batch = await composeCategoryBatch(
      def.id,
      tracks,
      { name: 'Ari', talk_style: 'even', voice_preset: 'default' },
      {
        fetchAskedTexts: async () => ['An old already-asked question.'],
        generateBatch: async (prompt, count) => {
          generateCalls += 1;
          requestedCount = count;
          assert.match(prompt, /An old already-asked question\./, 'history exclusion must reach the single call');
          return plan.map((axis, i) => ({
            axis,
            prompt: `Question ${i} about ${axis}`,
            options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
          }));
        },
        saveItems: async (categoryId, drafts) => {
          assert.equal(categoryId, def.id);
          savedCount = drafts.length;
          return {
            id: 'b1',
            categoryId: def.id,
            finalizedAt: null,
            items: drafts.map((d, i) => ({
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

    assert.equal(generateCalls, 1, 'exactly one generation call — no chunking, no retry loop');
    assert.equal(requestedCount, CATEGORY_BATCH_SIZE);
    assert.equal(savedCount, CATEGORY_BATCH_SIZE);
    assert.equal(batch.items.length, CATEGORY_BATCH_SIZE);
    for (const item of batch.items) assert.ok(allowed.has(item.axis), `${item.axis} must be one of the plan's axes`);
    ok('composeCategoryBatch: one generation call covers the whole 5-question batch, history exclusion applied');
  }
  {
    // A generation call returning fewer than 5 (and nothing filtered out by
    // axis membership) still saves whatever came back — no retry, no throw
    // — since chunking/retry-for-remainder was deliberately removed.
    const def = getCategoryDefs()[0]!;
    const tracks: TraitTrack[] = TRAIT_AXES.map((axis) => trackWithCount(axis, 5));
    const plan = categoryBatchAxisPlan(def.id, tracks, NOW);
    const batch = await composeCategoryBatch(
      def.id,
      tracks,
      { name: 'Ari', talk_style: 'even', voice_preset: 'default' },
      {
        fetchAskedTexts: async () => [],
        generateBatch: async () => [
          { axis: plan[0]!, prompt: 'Only one came back.', options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }] },
        ],
        saveItems: async (categoryId, drafts) => ({
          id: 'b1',
          categoryId,
          finalizedAt: null,
          items: drafts.map((d, i) => ({ id: `i${i}`, axis: d.axis, prompt: d.prompt, options: d.options, answeredOption: null })),
        }),
      },
      NOW,
    );
    assert.equal(batch.items.length, 1, 'a short single-call result is saved as-is, not retried');
    ok('composeCategoryBatch: a short result from the one call is saved as-is, no retry attempted');
  }
  {
    // Generation returning nothing usable throws (nothing to save).
    const def = getCategoryDefs()[0]!;
    const tracks: TraitTrack[] = TRAIT_AXES.map((axis) => trackWithCount(axis, 5));
    await assert.rejects(
      composeCategoryBatch(
        def.id,
        tracks,
        { name: 'Ari', talk_style: 'even', voice_preset: 'default' },
        { fetchAskedTexts: async () => [], generateBatch: async () => null, saveItems: async () => { throw new Error('must not be called'); } },
        NOW,
      ),
    );
    ok('composeCategoryBatch: generation returning nothing throws rather than saving an empty batch');
  }

  console.log(`\n${passed} category-batch checks passed`);
}

void main();
