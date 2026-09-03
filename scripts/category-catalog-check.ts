/**
 * Category catalog fetch (wave21/22 `category_defs` → client `CategoryDef`).
 * Run: npm run check:category-catalog
 *
 * Proves the DB-row transform reproduces the seeded fallback `CATEGORY_DEFS`
 * exactly, and that category readiness math (`minStable`, `texture`, map x/y
 * axis order) reads the FETCHED values — not the hardcoded consts — so a
 * hot-edited name/weight/minStable/texture in the Supabase table editor flows
 * through unchanged. Pure/offline (no network, no supabase import).
 */
import assert from 'node:assert/strict';

import {
  CATEGORY_DEFS,
  categoryById,
  categoryDefFromRow,
  categoriesFingerprint,
  getCategoryDefs,
  readCategory,
  setCategoryDefs,
  sortCategoryDefs,
  type CategoryDefRow,
} from '../src/lib/categories';
import { applyEwmaAnswer, type TraitTrack } from '../src/lib/trait-stability';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function stableReport(axis: TraitTrack['axis'], value: number): TraitTrack {
  const nowIso = '2026-08-31T12:00:00.000Z';
  let row = applyEwmaAnswer(null, axis, 'report', value, nowIso);
  row = applyEwmaAnswer(row, axis, 'report', value, nowIso);
  return applyEwmaAnswer(row, axis, 'report', value, nowIso);
}

/** The exact rows wave21 + wave22 seed into `category_defs`, as the client receives them. */
const SEED_ROWS: CategoryDefRow[] = [
  { id: 'cat_steadiness', name: 'Steadiness', shape: 'bar', axis_weights: { conscientiousness: 1, agreeableness: 1, steadiness: 1 }, min_axes_required_stable: 2, texture_axes: [] },
  { id: 'cat_openness', name: 'Openness to life', shape: 'bar', axis_weights: { openness: 1, extraversion: 1 }, min_axes_required_stable: 2, texture_axes: [] },
  { id: 'cat_drive', name: 'Drive', shape: 'bar', axis_weights: { autonomy: 1, competence: 1, relatedness: 1 }, min_axes_required_stable: 2, texture_axes: [] },
  { id: 'cat_agency', name: 'Agency', shape: 'bar', axis_weights: { growth_mindset: 1, locus_of_control: 1, self_efficacy: 1 }, min_axes_required_stable: 2, texture_axes: [] },
  { id: 'cat_social', name: 'Everyday social energy', shape: 'bar', axis_weights: { extraversion: 1, agreeableness: 1, playfulness: 1 }, min_axes_required_stable: 2, texture_axes: [] },
  { id: 'cat_communication', name: 'Communication', shape: 'bar', axis_weights: { conflict_assertiveness: 1, conflict_cooperativeness: 1 }, min_axes_required_stable: 2, texture_axes: [] },
  { id: 'cat_love', name: 'Love / closeness', shape: 'map', axis_weights: { attachment_anxiety: 1, attachment_avoidance: 1 }, min_axes_required_stable: 2, texture_axes: ['conflict_assertiveness', 'conflict_cooperativeness'] },
  { id: 'cat_independence', name: 'Independence & closeness', shape: 'map', axis_weights: { autonomy: 1, relatedness: 1 }, min_axes_required_stable: 2, texture_axes: [] },
  { id: 'cat_levity', name: 'Levity', shape: 'bar', axis_weights: { playfulness: 1, conflict_assertiveness: 1, conflict_cooperativeness: 1 }, min_axes_required_stable: 2, texture_axes: [] },
];

const byId = (id: string) => SEED_ROWS.find((row) => row.id === id)!;

// 1. The transform reproduces the seeded fallback exactly, order included.
assert.equal(SEED_ROWS.length, CATEGORY_DEFS.length);
for (const row of SEED_ROWS) {
  assert.deepEqual(categoryDefFromRow(row), CATEGORY_DEFS.find((def) => def.id === row.id));
}
assert.deepEqual(sortCategoryDefs(SEED_ROWS.map((row) => categoryDefFromRow(row)!)), CATEGORY_DEFS);
ok('DB rows → CategoryDef reproduce the seeded fallback exactly (incl. curated order)');

// 2. minStable is read from the table (`min_axes_required_stable`), not a const.
const socialTwo = [stableReport('extraversion', 0.8), stableReport('agreeableness', 0.7)];
const socialThree = [...socialTwo, stableReport('playfulness', 0.6)];
const socialMin3 = categoryDefFromRow({ ...byId('cat_social'), min_axes_required_stable: 3 })!;
assert.equal(socialMin3.minStable, 3);
assert.equal(readCategory(categoryDefFromRow(byId('cat_social'))!, socialTwo).ready, true);
assert.equal(readCategory(socialMin3, socialTwo).ready, false);
assert.equal(readCategory(socialMin3, socialThree).ready, true);
ok('readiness math reads the fetched minStable (2 stable axes ready at min 2, not at min 3)');

// 3. texture_axes → texture, with invalid axes filtered. Never part of the math.
const textured = categoryDefFromRow({ ...byId('cat_steadiness'), texture_axes: ['conflict_assertiveness', 'bogus_axis'] })!;
assert.deepEqual([...textured.texture], ['conflict_assertiveness']);
const loveDef = categoryDefFromRow(byId('cat_love'))!;
assert.deepEqual([...loveDef.axes], ['attachment_anxiety', 'attachment_avoidance']);
assert.deepEqual([...loveDef.texture], ['conflict_assertiveness', 'conflict_cooperativeness']);
assert.equal(loveDef.shape, 'map');
ok('texture_axes and map x/y axis order map identically off the fetched row');

// 4. A hot-edited name flows through untouched.
assert.equal(categoryDefFromRow({ ...byId('cat_steadiness'), name: 'Stillness' })!.name, 'Stillness');
ok('a renamed category in the table reaches the client without a rebuild');

// 5. Malformed rows are dropped rather than corrupting the catalog.
assert.equal(categoryDefFromRow({ ...byId('cat_steadiness'), name: '   ' }), null);
assert.equal(categoryDefFromRow({ ...byId('cat_steadiness'), axis_weights: {} }), null);
assert.equal(categoryDefFromRow({ ...byId('cat_steadiness'), axis_weights: { bogus_axis: 1 } }), null);
ok('unusable rows (blank name, no valid axes) are dropped');

// 6. Live catalog: set → get round-trips, empty set is a no-op, fingerprint stays stable.
const tracks = SEED_ROWS.flatMap((row) =>
  Object.keys(row.axis_weights ?? {}).map((axis) => stableReport(axis as TraitTrack['axis'], 0.6)),
);
const fpBefore = categoriesFingerprint(tracks);
setCategoryDefs(sortCategoryDefs(SEED_ROWS.map((row) => categoryDefFromRow(row)!)));
assert.deepEqual(getCategoryDefs(), CATEGORY_DEFS);
assert.equal(categoriesFingerprint(tracks), fpBefore);
assert.equal(categoryById('cat_levity')!.name, 'Levity');
setCategoryDefs([]);
assert.equal(getCategoryDefs().length, CATEGORY_DEFS.length);
ok('active catalog replaces the fallback after a fetch; empty fetch keeps the fallback; fingerprint unchanged');

console.log(`\n${passed} category-catalog checks passed`);
