/**
 * Roll composition + category-read prompt (trait-system redesign §7).
 * Run: npm run check:rolls-compose
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getCategoryDefs, readAllCategories, setCategoryDefs } from '../src/lib/categories';
import type { LegendCatalog, LegendVariant, ArchetypeDef } from '../src/lib/legends/store';
import { composeRoll, rollEligible, type RollComposeDeps } from '../src/lib/rolls/compose';
import { buildCategoryReadPrompt, parseCategoryReadBody } from '../src/lib/rolls/category-read';
import type { TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const NOW = new Date('2026-09-08T12:00:00.000Z');

function settledTrack(axis: TraitTrack['axis'], value: number, stability = 0.9): TraitTrack {
  return { axis, track: 'report', value, stability, answerCount: 5, lastTouched: NOW.toISOString(), lastDepthAt: null };
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
    // No legend catalog at all: legend item reports matched:false, every
    // category still gets its own slot (ready, since tracks are fully
    // settled), exactly 13 items total.
    let generateCalls = 0;
    const deps: RollComposeDeps = {
      fetchLegendCatalog: async () => ({ variants: [], archetypes: new Map() }) as LegendCatalog,
      fetchSeenVariantIds: async () => new Set(),
      generateRollText: async () => {
        generateCalls += 1;
        return '{"body":"A grounded, low-key kind of week."}';
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
    assert.deepEqual(items[0]!.result, { ready: false, matched: false }, 'no catalog: legend item reports ready:false/matched:false, not an error');
    assert.equal(generateCalls, 12, 'one generateRollText call per ready category (11) plus one for the ready-profile story');
    assert.ok(Object.keys(snapshot).length > 0, 'snapshot captures the answered axes');
    ok('composeRoll: exactly 13 items with the correct type/category mix; no legend catalog degrades to matched:false, not a failure');
  }

  {
    // Some categories unready: those get {ready:false} WITHOUT spending a
    // generateRollText call, but still occupy their slot (still 11 total).
    let generateCalls = 0;
    const thinTracks: TraitTrack[] = []; // nothing settled anywhere
    const deps: RollComposeDeps = {
      fetchLegendCatalog: async () => ({ variants: [], archetypes: new Map() }) as LegendCatalog,
      fetchSeenVariantIds: async () => new Set(),
      generateRollText: async () => {
        generateCalls += 1;
        return '{"body":"x"}';
      },
    };
    const { items } = await composeRoll(thinTracks, {}, deps);
    const categoryItems = items.filter((i) => i.type === 'category');
    assert.equal(categoryItems.length, 11, 'unready categories still occupy their slot');
    assert.ok(categoryItems.every((i) => (i.result as { ready: boolean }).ready === false), 'every category reads not-ready with no settled axes');
    const storyItem = items.find((i) => i.type === 'story')!;
    assert.deepEqual(storyItem.result, { ready: false }, 'a thin profile\'s story also reads not-ready');
    assert.equal(generateCalls, 0, 'no AI call spent at all on a thin profile — every category is unready AND storyReady(tracks) is false, so even the story generation is skipped, matching the existing Story surface\'s own gate');
    ok('composeRoll: on a thin profile, every category AND the story get a placeholder without spending any AI call, but every item still fills its slot');
  }

  {
    // A generation failure (null) for one item degrades that item to
    // not-ready without failing the whole roll.
    let call = 0;
    const deps: RollComposeDeps = {
      fetchLegendCatalog: async () => ({ variants: [], archetypes: new Map() }) as LegendCatalog,
      fetchSeenVariantIds: async () => new Set(),
      generateRollText: async () => {
        call += 1;
        return call === 1 ? null : '{"body":"fine"}'; // first ready category's generation fails
      },
    };
    const { items } = await composeRoll(fullyReadyTracks(), {}, deps);
    assert.equal(items.length, 13, 'a single generation failure must not shrink or fail the whole roll');
    const firstCategory = items.find((i) => i.type === 'category')!;
    assert.deepEqual(firstCategory.result, { ready: false }, 'the failed item reads not-ready, same as an unready category');
    ok('composeRoll: a single failed generation degrades only that item, never the whole roll');
  }

  {
    // A real legend match: one variant whose archetype matches 2/2 poles
    // must be picked (cards[0], already ranked by buildLegendView) and
    // included with matched:true.
    const archetype: ArchetypeDef = {
      id: 'arch1',
      formalName: 'The Formal Name',
      slangName: 'The Slang Name',
      animeFlavorTag: 'tag',
      traitAxis: 'openness:high, autonomy:high',
      throwbackVoice: null,
      partyBuild: null,
    };
    const variant: LegendVariant = {
      id: 'v1',
      figureId: 'f1',
      canonicalSlug: 'figure-one',
      variantKey: 'v1',
      name: 'Figure One',
      eraTitle: 'era',
      type: 'archetype' as LegendVariant['type'],
      teaser: 'teaser',
      fullStory: 'story',
      factChecked: true,
      archetypeIds: ['arch1'],
    } as LegendVariant;
    const catalog: LegendCatalog = { variants: [variant], archetypes: new Map([['arch1', archetype]]) };
    const deps: RollComposeDeps = {
      fetchLegendCatalog: async () => catalog,
      fetchSeenVariantIds: async () => new Set(),
      generateRollText: async () => '{"body":"fine"}',
    };
    const { items } = await composeRoll(fullyReadyTracks(), { openness: 0.9, autonomy: 0.9 }, deps);
    const legendItem = items[0]!;
    const result = legendItem.result as { ready: boolean; matched: boolean; variant?: { id: string } };
    assert.equal(result.ready, true, 'a matched legend must read ready:true too (unified shape all item types share)');
    assert.equal(result.matched, true, 'a genuinely matching archetype must be picked, not left as matched:false');
    assert.equal(result.variant?.id, 'v1');
    ok('composeRoll: a real matching legend candidate (buildLegendView\'s top-ranked card) is picked and stored, with the unified ready field set');
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
      fetchLegendCatalog: async () => ({ variants: [], archetypes: new Map() }) as LegendCatalog,
      fetchSeenVariantIds: async () => new Set(),
      generateRollText: async () => '{"body":"x"}',
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
