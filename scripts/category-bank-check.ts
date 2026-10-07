/**
 * Stored category cards (emci 2026-10-07).
 * Run: npm run check:category-bank
 *
 * Runs the REAL bank and the REAL picker (both pure), then source-text
 * assertions for the Explore wiring.
 *
 * The load-bearing assertions:
 * - every catalog category has every cell, and every part has three wordings;
 * - every string obeys the clear voice mechanically (`tipRuleViolation`);
 * - the tags never show a band word, a sentence, or an internal trait id;
 * - Explore renders the stored card with no model call and no DB write.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CATEGORY_BANK,
  CATEGORY_BANK_COPY_REVIEWED,
  bankForCategory,
  categoryTags,
  categoryTagsShareable,
  cellForReading,
  isoWeekIndex,
  pickCategoryCard,
  visibleStatementHistory,
} from '../src/lib/category-bank';
import { BAR_CELLS, CARD_PARTS, MAP_CELLS, type CardCell } from '../src/lib/category-bank/define';
import { CATEGORY_DEFS, readCategory, type CategoryReading } from '../src/lib/categories';
import type { TraitTrack } from '../src/lib/trait-stability';
import { traitBand, type TraitAxis } from '../src/lib/traits';
import { tipRuleViolation } from '../src/lib/voice/clear-voice';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const CHIP_MAX = 32;

// --- coverage --------------------------------------------------------------------
assert.equal(Object.keys(CATEGORY_BANK).length, CATEGORY_DEFS.length, 'one card bank per catalog category');
for (const def of CATEGORY_DEFS) {
  const bank = bankForCategory(def.id);
  assert.ok(bank, `${def.id} has a card bank`);
  assert.equal(bank.shape, def.shape, `${def.id}: bank shape matches the catalog`);
  const cells = bank.cells as Record<string, CardCell | undefined>;
  const want = def.shape === 'map' ? MAP_CELLS : BAR_CELLS;
  assert.deepEqual(Object.keys(cells).sort(), [...want].sort(), `${def.id}: exactly the ${def.shape} cells`);
  for (const cell of want) {
    for (const part of CARD_PARTS) {
      assert.equal(cells[cell]![part].length, 3, `${def.id}.${cell}.${part}: three wordings`);
    }
  }
  assert.ok(existsSync(resolve(root, `src/lib/category-bank/${def.id}.ts`)), `${def.id}: one file per category id`);
}
assert.equal(bankForCategory('cat_unknown'), null, 'an unknown catalog id has no card');
ok('every catalog category has its own file, every cell (low/mid/high or hh/hl/lh/ll), and 3 wordings per part');

// --- copy rules --------------------------------------------------------------------
const FIELD = { summary: 'summary', strength: 'strength', watchOut: 'watchOut', tryThis: 'tryThis' } as const;
const failures: string[] = [];
for (const [id, bank] of Object.entries(CATEGORY_BANK)) {
  for (const [cell, parts] of Object.entries(bank.cells as Record<string, CardCell>)) {
    for (const part of CARD_PARTS) {
      for (const text of parts[part]) {
        const why = tipRuleViolation(text, FIELD[part]);
        if (why) failures.push(`${id}.${cell}.${part}: ${why} — "${text}"`);
      }
    }
    for (const text of parts.watchOut) {
      if (!/^(Sometimes|Because)\b/.test(text)) failures.push(`${id}.${cell}.watchOut: opens "Sometimes…" or "Because…" — "${text}"`);
    }
  }
}
assert.deepEqual(failures, [], `clear-voice violations:\n${failures.join('\n')}`);
ok('every summary / strength / watch-out / try this passes tipRuleViolation; watch-outs read as the flip side');

// --- picking -----------------------------------------------------------------------
function track(axis: TraitAxis, value: number): TraitTrack {
  return {
    axis,
    track: 'report',
    value,
    stability: 1,
    answerCount: 6,
    lastTouched: '2026-10-01T00:00:00Z',
    lastDepthAt: null,
  } as TraitTrack;
}
const now = new Date('2026-10-07T12:00:00Z');
const tracks: TraitTrack[] = [
  track('competence', 0.8),
  track('growth_mindset', 0.7),
  track('steadiness', 0.5),
  track('attachment_anxiety', 0.8),
  track('attachment_avoidance', 0.2),
  track('autonomy', 0.5),
  track('relatedness', 0.3),
];
const resilience = CATEGORY_DEFS.find((d) => d.id === 'cat_resilience')!;
const love = CATEGORY_DEFS.find((d) => d.id === 'cat_love')!;
const resReading = readCategory(resilience, tracks, now);
const loveReading = readCategory(love, tracks, now);
if (resReading.ready) {
  assert.equal(cellForReading(resReading), traitBand(resReading.bar), 'bar cell comes from traitBand(reading.bar)');
}
const fakeBar: CategoryReading = { def: resilience, ready: true, bar: 0.8, map: null, stableAxes: [...resilience.axes], texture: [] };
const fakeMap: CategoryReading = { def: love, ready: true, bar: null, map: { x: 0.8, y: 0.2 }, stableAxes: [...love.axes], texture: [] };
assert.equal(cellForReading(fakeBar), 'high');
assert.equal(cellForReading({ ...fakeBar, bar: 0.2 }), 'low');
assert.equal(cellForReading(fakeMap), 'hl', 'map cell: x then y, in def.axes order, cut at 0.5');
assert.equal(cellForReading({ ...fakeMap, map: { x: 0.5, y: 0.5 } }), 'hh', '0.5 counts as high');
assert.equal(cellForReading({ ...fakeBar, ready: false }), null, 'a closed category has no card');
void loveReading;

const card = pickCategoryCard({ userId: 'u1', reading: fakeBar, ymd: '2026-10-07' });
assert.ok(card, 'a ready reading gets a card');
assert.deepEqual(card, pickCategoryCard({ userId: 'u1', reading: fakeBar, ymd: '2026-10-08' }), 'same week, same card');
assert.ok((CATEGORY_BANK.cat_resilience.cells as Record<string, CardCell>).high!.summary.includes(card.summary));
// The week index turns over on Monday.
assert.equal(isoWeekIndex('2026-10-05'), isoWeekIndex('2026-10-11'), 'Monday to Sunday is one week');
assert.equal(isoWeekIndex('2026-10-12'), isoWeekIndex('2026-10-05') + 1, 'the next Monday is the next week');
const nextWeek = pickCategoryCard({ userId: 'u1', reading: fakeBar, ymd: '2026-10-12' })!;
assert.notEqual(nextWeek.summary, card.summary, 'each part turns to its next wording every week');
assert.equal(
  pickCategoryCard({ userId: 'u1', reading: { ...fakeBar, def: { ...resilience, id: 'cat_new' as never } }, ymd: '2026-10-07' }),
  null,
  'an unknown catalog id renders no card',
);
ok('pickCategoryCard is pure: bar cells from traitBand, map cells from x/y ≥ 0.5, variant = (fnv1a(user|cat|cell|part) + week) % 3');

// --- tags ------------------------------------------------------------------------
assert.deepEqual(categoryTags(resilience, tracks), ['Confidence: Assured', 'Growth: Learning', 'Composure']);
assert.deepEqual(categoryTags(love, tracks), ['Reassurance: Watchful', 'Personal space: Close']);
assert.deepEqual(categoryTags({ axes: ['autonomy'] }, tracks), ['Independence']);
for (const def of CATEGORY_DEFS) {
  for (const value of [0.1, 0.5, 0.9]) {
    const tags = categoryTags(def, def.axes.map((axis) => track(axis, value)));
    assert.equal(tags.length, def.axes.length, `${def.id}: one chip per axis`);
    for (const tag of tags) {
      assert.ok(tag.length <= CHIP_MAX, `${def.id}: chip "${tag}" over ${CHIP_MAX}`);
      assert.doesNotMatch(tag, /_|\b(low|mid|high)\b|\./i, `${def.id}: "${tag}" shows no band word, id or sentence`);
    }
  }
}
assert.equal(categoryTagsShareable(love, tracks), false, 'closeness-and-worry tags never leave the app');
assert.equal(categoryTagsShareable(resilience, tracks), true);
assert.equal(categoryTagsShareable({ axes: ['competence'] }, [track('competence', 0.1)]), false, 'a struggle side stays private');
ok('tags: "Short: Pole" at low/high, the name alone in the middle; chips ≤ 32; private sides never shareable');

// --- history -----------------------------------------------------------------------
assert.deepEqual(visibleStatementHistory([{ id: 'a' }, { id: 'b' }]), [], 'old AI category cards are hidden');
const archive = read('src/components/category-statement-archive-fold.tsx');
assert.match(archive, /visibleStatementHistory\(/, 'the archive fold filters through visibleStatementHistory');
assert.doesNotMatch(archive, /\.delete\(|rpc\('delete/, 'a UI filter only, nothing is deleted');
ok('every old category_statements row is hidden from the archive (UI filter only)');

// --- Explore wiring ------------------------------------------------------------------
const fold = read('src/components/categories-fold.tsx');
assert.match(fold, /pickCategoryCard\(/, 'Explore renders the stored card');
assert.match(fold, /<TraitTagRow tags=\{categoryTags\(/, 'one chip row of trait tags on each card');
assert.doesNotMatch(
  fold,
  /\bgenerateText\b|generateCategoryStatements|saveCategoryStatements|fetchCurrentStatements|spendCategoryReroll|parseSageTitle/,
  'no model call, no DB write, no AI statement and no reroll on the category card',
);
assert.doesNotMatch(fold, /AiBadge/, 'stored copy never carries the AI pill');
ok('categories-fold renders the stored card with its tag row: no generation, no DB write, no reroll, no AI pill');

// --- copy-review flag: doc only, never on screen (emci 2026-10-07) ----------------------
assert.equal(CATEGORY_BANK_COPY_REVIEWED, false);
assert.ok(existsSync(resolve(root, 'docs/category-bank-review.md')), 'docs/category-bank-review.md exists');
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
}
for (const rel of [...sourceFiles('src/app'), ...sourceFiles('src/components')]) {
  assert.doesNotMatch(read(rel), /CATEGORY_BANK_COPY_REVIEWED/, `${rel}: the bank's review flag never renders`);
}
for (const rel of sourceFiles('src/lib/category-bank')) {
  assert.doesNotMatch(read(rel), /\bgenerateText\b|@\/lib\/ai\//, `${rel}: no model call in the bank`);
}
ok('CATEGORY_BANK_COPY_REVIEWED is false, has its review doc, no screen renders it, and the bank imports no AI');

console.log(`\n${passed} category-bank checks passed`);
