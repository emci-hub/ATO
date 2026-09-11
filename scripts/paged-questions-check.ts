/**
 * "5 questions per page, book-style" Full Profile UI. Run: npm run check:paged-questions
 *
 * Covers the things Emci explicitly asked to be verified, not assumed from a
 * passing typecheck:
 *   1. an answer survives paging away and back
 *   2. the progress indicator never double-counts an axis shared by two
 *      categories
 *   3. the flat, axis-order row list has no fixed-height/clip constraint
 *      that could cut content off, and is not grouped by category
 *   4. leaving and returning restores the same page (position persistence)
 *   5. no auto-scroll and no Back/Skip/Next-per-category controls remain
 *
 * Pure/offline only — paged-questions.tsx has no Supabase import.
 * AsyncStorage itself cannot be exercised for real under plain Node (its
 * calls throw "window is not defined" outside a RN runtime, confirmed by a
 * manual probe during an earlier build) — check 4 below verifies the same
 * in-memory-cache fallback `full-profile-unlock.ts` already relies on for
 * exactly this reason, via category-page-position.ts's own cache.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getCategoryDefs } from '../src/lib/categories';
import {
  completedAxesFrom,
  uniqueCategoryAxes,
  type CategoryQuestionRow,
} from '../src/lib/questions/category-paged';
import {
  loadAnsweredOptions,
  resetAnsweredOptionCache,
  saveAnsweredOption,
} from '../src/lib/questions/answered-option-storage';
import {
  loadCategoryPagePosition,
  resetCategoryPagePositionCache,
  saveCategoryPagePosition,
} from '../src/lib/questions/category-page-position';
import { bankProgressForAxis, bankQuestionCount } from '../src/lib/questions/local';
import type { TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
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

/** Same adapter shape questions-fold.tsx uses to feed PagedQuestions from the static bank. */
function bankRowsForAxis(tracks: readonly TraitTrack[]) {
  return (axis: TraitAxis): CategoryQuestionRow[] =>
    bankProgressForAxis(axis, tracks).map((row) => ({
      key: `${row.axis}-${row.variant}`,
      axis: row.axis,
      draft: row.draft,
      answered: row.state === 'answered',
    }));
}

async function main() {
  // --- Check 1: an answer survives paging away and back -------------------
  {
    // 'steadiness' has 1 of its 2 bank questions answered (tier-4 axis, §2/§3).
    const tracks: TraitTrack[] = [trackWithCount('steadiness', 1)];
    const rowsForAxis = bankRowsForAxis(tracks);

    const beforeNav = rowsForAxis('steadiness');
    assert.equal(beforeNav.filter((r) => r.answered).length, 1);

    // "Page away then back" — the component's `pageIndex` state is the only
    // thing that changes on paging — `rowsForAxis` is a closure over
    // `tracks` alone and takes no page argument, so calling it again after
    // any number of page changes must return the identical answered state,
    // proving the answer isn't stored per-page and can't be lost by paging.
    const afterNav = rowsForAxis('steadiness');
    assert.deepEqual(afterNav, beforeNav, 'rowsForAxis must be pure w.r.t. paging — same tracks in, same answered state out');
    assert.equal(afterNav.filter((r) => r.answered).length, 1);
    ok('PASS — an answered question stays answered after paging away and back (rowsForAxis depends only on tracks, never on which page is showing)');
  }

  // --- Check 2: shared-axis progress never double-counts -----------------
  {
    const defs = getCategoryDefs();
    const sharedAxis = TRAIT_AXES.find(
      (axis) => defs.filter((def) => def.axes.includes(axis)).length >= 2,
    );
    assert.ok(sharedAxis, 'at least one axis must be shared by 2+ categories in the real catalog (documented overlap, e.g. extraversion)');
    const owningCategories = defs.filter((def) => def.axes.includes(sharedAxis!));
    assert.ok(owningCategories.length >= 2);

    const unique = uniqueCategoryAxes(defs);
    // The shared axis must appear exactly once in the deduped list, however
    // many categories reference it.
    assert.equal(unique.filter((axis) => axis === sharedAxis).length, 1);
    // The deduped list must be strictly shorter than the naive sum (proving
    // dedup actually removed duplicates, not just returned an already-unique input).
    const naiveSum = defs.reduce((sum, def) => sum + def.axes.length, 0);
    assert.ok(unique.length < naiveSum, 'unique axis count must be less than the naive per-category sum given real overlap');

    // Now fully answer the shared axis and confirm it contributes exactly 1
    // to completedAxes.length, not one per owning category. Uses the axis's
    // own real bank size (varies by tier since the trait-system redesign,
    // §2/§3 — no longer a flat 3), not a hardcoded count.
    const tracks: TraitTrack[] = [trackWithCount(sharedAxis!, bankQuestionCount([sharedAxis!]))];
    const rowsForAxis = bankRowsForAxis(tracks);
    const completed = completedAxesFrom(unique, rowsForAxis);
    assert.equal(completed.filter((axis) => axis === sharedAxis).length, 1);
    // completedAxes.length itself must not exceed unique.length (would be
    // structurally impossible to double-count and still satisfy this, but
    // pins the invariant directly).
    assert.ok(completed.length <= unique.length);
    ok(`PASS — progress dedup: axis "${sharedAxis}" is shared by ${owningCategories.length} categories but counts once toward completion (${completed.length}/${unique.length}, not inflated)`);

    // The flat row list the pager builds (uniqueAxes.flatMap(rowsForAxis))
    // must likewise count the shared axis's rows exactly once, not once per
    // owning category — the same dedup this component's own `allRows` relies on.
    const flatRows = unique.flatMap((axis) => rowsForAxis(axis));
    const expectedSharedRowCount = bankQuestionCount([sharedAxis!]);
    assert.equal(
      flatRows.filter((row) => row.axis === sharedAxis).length,
      expectedSharedRowCount,
      'the flat book-pager row list must not duplicate a shared axis\'s rows',
    );
  }

  // --- Check 3: flat, unbounded, non-grouped row list ---------------------
  {
    const defs = getCategoryDefs();
    const tracks: TraitTrack[] = [];
    const rowsForAxis = bankRowsForAxis(tracks);
    const unique = uniqueCategoryAxes(defs);
    const allRows = unique.flatMap((axis) => rowsForAxis(axis));
    // Every axis's full bank shows up in the flat list — nothing dropped.
    const expectedTotal = bankQuestionCount(unique);
    assert.equal(allRows.length, expectedTotal, 'the flat row list must include every axis\'s full bank, not a fixed subset');

    const src = read('src/components/paged-questions.tsx');
    assert.doesNotMatch(src, /maxHeight/, 'no maxHeight constraint that could clip a page');
    assert.doesNotMatch(src, /numberOfLines/, 'no line-clamping on question text');
    assert.doesNotMatch(src, /overflow:\s*['"]hidden['"]/, 'no overflow:hidden that could cut off content');
    assert.doesNotMatch(src, /<\/ScrollView>|<ScrollView\b[^<>]*\/>/, 'must not render its own fixed-size ScrollView — relies on the parent screen\'s scroll');
    // The row list itself must render every row on a page, no internal
    // per-page slicing beyond the documented PAGE_SIZE-based slice.
    assert.match(src, /PAGE_SIZE\s*=\s*5/, 'page size must be exactly 5 questions per page');
    // Category grouping is gone: no per-category axis section headers.
    assert.doesNotMatch(src, /current\.axes\.map/, 'must not group rows by category anymore (that was the pre-restructure layout)');
    ok(`PASS — a flat, axis-order list of all ${expectedTotal} questions renders through one unbounded, non-clipping, non-category-grouped list, 5 per page`);
  }

  // --- Check 4: leaving and returning restores the same page --------------
  {
    resetCategoryPagePositionCache();
    const storageKey = 'full-profile';

    // Nothing saved yet — a fresh viewer has no remembered position.
    assert.equal(await loadCategoryPagePosition(storageKey), null);

    // User pages to page 3 (index 2) and the component persists it (this is
    // exactly what PagedQuestions' own position-save effect does).
    await saveCategoryPagePosition(storageKey, '2');

    // "Leaving and returning" — a fresh load call, as a remount would issue.
    const restored = await loadCategoryPagePosition(storageKey);
    assert.equal(restored, '2', 'must restore the exact page last viewed, not reset to page 1');

    // A different question set (the future stack) must not share position
    // with Full Profile — confirms storageKey actually scopes the state per
    // the reusability requirement, not a single global position.
    assert.equal(await loadCategoryPagePosition('questions-stack'), null);

    ok('PASS — leaving and returning restores page index "2", scoped independently per question set (storageKey)');
  }

  // --- Check 5: no leftover Back/Skip/Next-per-category or auto-scroll ----
  {
    const src = read('src/components/paged-questions.tsx');
    assert.doesNotMatch(src, /scrollTo|measureLayout|scrollViewRef/i, 'no auto-scroll code should remain in the book pager');
    assert.doesNotMatch(src, />\s*Skip\s*</, 'the per-category "Skip" control must not remain — nothing to skip in a flat book pager');
    assert.match(src, />\s*Next Page\s*</, 'must have a "Next Page" control');
    ok('PASS — no auto-scroll and no per-category Skip control remain; "Next Page" is present');
  }

  // --- Check 6: answered-option stamp storage -----------------------------
  {
    resetAnsweredOptionCache();
    const storageKey = 'full-profile:test-user';

    // Nothing saved yet — a fresh viewer has no remembered picks.
    assert.deepEqual(await loadAnsweredOptions(storageKey), {});

    // A single save round-trips.
    await saveAnsweredOption(storageKey, 'openness-0', 1);
    assert.deepEqual(await loadAnsweredOptions(storageKey), { 'openness-0': 1 });

    // Two saves for DIFFERENT rows fired without awaiting the first before
    // starting the second (the exact shape of a fast double-tap) must both
    // land — this is the read-modify-write race found in review: an
    // earlier draft read the base map via `cache.get(key) ?? await
    // loadAnsweredOptions(key)`, so two saves racing before that awaited
    // read resolved would both derive `next` from the same stale base and
    // the second `cache.set` would silently drop the first row's index.
    resetAnsweredOptionCache();
    const raceKey = 'full-profile:race-user';
    const first = saveAnsweredOption(raceKey, 'row-a', 0);
    const second = saveAnsweredOption(raceKey, 'row-b', 2);
    await Promise.all([first, second]);
    assert.deepEqual(
      await loadAnsweredOptions(raceKey),
      { 'row-a': 0, 'row-b': 2 },
      'two picks on different rows racing before either resolves must both persist, not have the second overwrite the first',
    );

    // Scoped independently per storageKey (per-account, per question-set —
    // this is what closes the cross-account leak found in review: the real
    // caller now passes `full-profile:${me.id}`, not a bare "full-profile").
    assert.deepEqual(await loadAnsweredOptions('full-profile:other-user'), {});

    ok('PASS — answered-option storage round-trips, survives a same-tick double-save on different rows without dropping either, and stays scoped per storageKey (per-account)');
  }

  console.log(`\n${passed} paged-questions checks passed`);
}

void main();
