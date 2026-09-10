/**
 * Roll composition + category-read prompt (trait-system redesign §7).
 * Run: npm run check:rolls-compose
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getCategoryDefs, readAllCategories, setCategoryDefs } from '../src/lib/categories';
import { composeRoll, rollEligible, type RollComposeDeps } from '../src/lib/rolls/compose';
import { buildCategoryReadPrompt, parseCategoryReadBody } from '../src/lib/rolls/category-read';
import type { TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES } from '../src/lib/traits';

/** Satisfies both parseCategoryReadBody ({body}) and parseLegendStoryBody ({story}) from one mocked response, since composeRoll now routes both through the same injected generateRollText. */
const MOCK_RESPONSE = '{"body":"A grounded, low-key kind of week.","story":"A grounded, low-key kind of week."}';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const NOW = new Date('2026-09-08T12:00:00.000Z');

// answerCount 20 (not just STABILITY_FLOOR_N's 3) so bankTotalProgress credits
// every axis at its full per-axis bank size regardless of tier — fullyReadyTracks()
// must clear LEGENDS_UNLOCK_THRESHOLD (50) for the legend-generation tests below to
// exercise the real "unlocked" path, not just the "settled enough for a category
// read" path (verified directly: answerCount 5 landed at 47/50, just under).
function settledTrack(axis: TraitTrack['axis'], value: number, stability = 0.9): TraitTrack {
  return { axis, track: 'report', value, stability, answerCount: 20, lastTouched: NOW.toISOString(), lastDepthAt: null };
}

// --- rollEligible ------------------------------------------------------------
assert.equal(rollEligible([], null, NOW), true, 'no snapshot yet: always eligible (first-ever roll)');
{
  const snapshot = { openness: { value: 0.3, stability: 0.95 } };
  const smallDrift: TraitTrack[] = [settledTrack('openness', 0.32, 0.95)];
  const bigChange: TraitTrack[] = [settledTrack('openness', 0.68, 0.95)];
  assert.equal(rollEligible(smallDrift, snapshot, NOW), false, 'a small drift must not warrant a new roll');
  assert.equal(rollEligible(bigChange, snapshot, NOW), true, 'a real sustained change must warrant a new roll');
}
ok('rollEligible: first-ever always eligible, otherwise delegates correctly to RCI (drift no, real change yes)');

{
  // Found in review: rollEligible's docstring claimed "the caller (Edge
  // Function) checks this BEFORE calling claim_roll()," which was false —
  // no such Edge Function exists, and the real caller (run.ts) is client
  // code. Must be corrected to honestly describe the gap, not just moved.
  const composeSrc = readFileSync(resolve(__dirname, '../src/lib/rolls/compose.ts'), 'utf8');
  assert.doesNotMatch(composeSrc, /the caller \(Edge\s*\n?\s*\* Function\) checks this BEFORE calling claim_roll/, 'the false Edge Function enforcement claim must be gone from compose.ts, not just run.ts');
  assert.match(composeSrc, /NOT independently server-enforced today/, 'rollEligible\'s own docstring must honestly flag the gap, consistent with run.ts\'s corrected docstring');
  ok('compose.ts\'s rollEligible docstring no longer makes the false Edge-Function-enforcement claim');
}

// --- buildCategoryReadPrompt / parseCategoryReadBody -----------------------
{
  const readyDef = getCategoryDefs()[0]!;
  const tracks = readyDef.axes.map((axis) => settledTrack(axis, 0.7));
  const reading = readAllCategories(tracks).find((row) => row.def.id === readyDef.id)!;
  assert.equal(reading.ready, true, 'fixture must actually be ready, or this proves nothing');
  const prompt = buildCategoryReadPrompt(reading);
  assert.match(prompt, new RegExp(readyDef.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'the category name must appear in its own prompt — this is the one rule Story does NOT allow');
  assert.match(prompt, /Respond with JSON only/);
  ok('buildCategoryReadPrompt: names the category (unlike Story), grounds in the real reading');
}
{
  const parsed = parseCategoryReadBody('{"body":"A steady week, mostly on your own terms."}');
  assert.equal(parsed, 'A steady week, mostly on your own terms.');
  assert.equal(parseCategoryReadBody('not json'), null);
  assert.equal(parseCategoryReadBody('{"body":""}'), null, 'an empty body parses to null, not an empty-string read');
  const jargon = parseCategoryReadBody('{"body":"You have a fixed mindset about this, like an INTJ."}');
  assert.equal(jargon, null, 'framework-fence terms must be rejected the same as everywhere else');
  ok('parseCategoryReadBody: parses a real body, rejects malformed/empty/framework-term responses');
}

// --- composeRoll -------------------------------------------------------------
function fullyReadyTracks(): TraitTrack[] {
  return TRAIT_AXES.map((axis) => settledTrack(axis, 0.7));
}

async function run() {
  {
    // Legends 64-archetype rewrite (core loop redesign §4, T-15): the legend
    // item now generates a real story through the same injected
    // generateRollText every other item uses — every category still gets
    // its own slot (ready, since tracks are fully settled), exactly 13
    // items total, 13 generation calls (1 legend + 11 categories + 1 story).
    let generateCalls = 0;
    const deps: RollComposeDeps = {
      generateRollText: async () => {
        generateCalls += 1;
        return MOCK_RESPONSE;
      },
    };
    const { items, snapshot } = await composeRoll(fullyReadyTracks(), {}, deps);
    assert.equal(items.length, 13, 'exactly 13 items: 1 legend + 11 categories + 1 story');
    assert.equal(items.filter((i) => i.type === 'legend').length, 1);
    assert.equal(items.filter((i) => i.type === 'story').length, 1);
    const categoryItems = items.filter((i) => i.type === 'category');
    assert.equal(categoryItems.length, 11);
    assert.deepEqual(
      new Set(categoryItems.map((i) => i.categoryId)),
      new Set(getCategoryDefs().map((d) => d.id)),
      'category items cover exactly the real category catalog, no duplicates, none missing',
    );
    const legendItem = items[0]!;
    const legendResult = legendItem.result as { ready: boolean; matched: boolean; archetypeCode?: string; story?: string };
    assert.equal(legendResult.ready, true, 'a successful generation makes the legend item ready:true');
    assert.equal(legendResult.matched, true, 'a successful generation makes the legend item matched:true');
    assert.match(legendResult.archetypeCode ?? '', /^[HL]{3}-[HL]{3}$/, 'archetypeCode is a real classify.ts code, not a placeholder');
    assert.equal(legendResult.story, 'A grounded, low-key kind of week.');
    assert.equal(generateCalls, 13, 'one generateRollText call for the legend, one per ready category (11), and one for the ready-profile story');
    assert.ok(Object.keys(snapshot).length > 0, 'snapshot captures the answered axes');
    ok('composeRoll: exactly 13 items with the correct type/category mix; the legend item generates a real story through the same injected deps as every other item');
  }

  {
    // Some categories unready: those get {ready:false} WITHOUT spending a
    // generateRollText call, but still occupy their slot (still 11 total).
    // The legend item IS gated (legendsUnlocked, same threshold the
    // standalone Legends screen itself uses) — a thin profile is nowhere
    // near that threshold, so the legend also stays a placeholder, same as
    // categories/story. An earlier draft had the legend generate
    // unconditionally on any profile depth; caught in review as spending a
    // real AI call on a meaningless all-default 'LLL-LLL' read, unlike the
    // categories/story it sits next to, which both deliberately skip
    // exactly this case.
    let generateCalls = 0;
    const thinTracks: TraitTrack[] = []; // nothing settled anywhere
    const deps: RollComposeDeps = {
      generateRollText: async () => {
        generateCalls += 1;
        return MOCK_RESPONSE;
      },
    };
    const { items } = await composeRoll(thinTracks, {}, deps);
    const categoryItems = items.filter((i) => i.type === 'category');
    assert.equal(categoryItems.length, 11, 'unready categories still occupy their slot');
    assert.ok(categoryItems.every((i) => (i.result as { ready: boolean }).ready === false), 'every category reads not-ready with no settled axes');
    const storyItem = items.find((i) => i.type === 'story')!;
    assert.deepEqual(storyItem.result, { ready: false }, 'a thin profile\'s story also reads not-ready');
    const legendItem = items.find((i) => i.type === 'legend')!;
    assert.deepEqual(legendItem.result, { ready: false, matched: false }, 'a thin profile is nowhere near legendsUnlocked, so the legend item stays a placeholder too, same as every other item on this profile');
    assert.equal(generateCalls, 0, 'no AI call spent at all on a thin profile — legend is below legendsUnlocked, every category is unready, and storyReady(tracks) is false, so every generation is skipped');
    ok('composeRoll: on a thin profile, the legend AND every category AND the story get a placeholder without spending any AI call, but every item still fills its slot');
  }

  {
    // A generation failure (null) for one item degrades that item to
    // not-ready without failing the whole roll. The legend item generates
    // FIRST in composeRoll's item order, so the first mocked failure hits
    // the legend, not a category.
    let call = 0;
    const deps: RollComposeDeps = {
      generateRollText: async () => {
        call += 1;
        return call === 1 ? null : MOCK_RESPONSE; // legend's generation fails, everything after succeeds
      },
    };
    const { items } = await composeRoll(fullyReadyTracks(), {}, deps);
    assert.equal(items.length, 13, 'a single generation failure must not shrink or fail the whole roll');
    const legendItem = items.find((i) => i.type === 'legend')!;
    assert.deepEqual(legendItem.result, { ready: false, matched: false }, 'the failed legend generation degrades to not-matched, same shape as before any code existed');
    const categoryItems = items.filter((i) => i.type === 'category');
    assert.ok(categoryItems.every((i) => (i.result as { ready: boolean }).ready === true), 'every category still generates successfully — one failed item never blocks the rest');
    ok('composeRoll: a single failed generation (the legend, first in item order) degrades only that item, never the whole roll');
  }

  {
    // The category-count/dedupe guard must be REAL, not a tautology — a
    // first version compared getCategoryDefs().length against itself via
    // the same synchronous call and could never fire. Prove it actually
    // catches a live-catalog drift by temporarily swapping in a
    // wrong-count catalog via the real setCategoryDefs (the same function
    // a live category_defs table fetch uses).
    const realDefs = getCategoryDefs();
    const deps: RollComposeDeps = {
      generateRollText: async () => MOCK_RESPONSE,
    };
    try {
      setCategoryDefs([realDefs[0]!, realDefs[1]!]); // only 2, not 11
      await assert.rejects(
        composeRoll(fullyReadyTracks(), {}, deps),
        /expected 11 categories/,
        'a live catalog with the wrong category count must throw, not silently produce a malformed payload store_roll would then reject',
      );
    } finally {
      setCategoryDefs(realDefs); // restore — this module-level catalog is shared by every other check that imports categories.ts
    }
    ok('composeRoll: the category-count guard actually fires on a real live-catalog drift, not a tautology');
  }

  console.log(`\n${passed} roll-composition checks passed`);
}

void run();
