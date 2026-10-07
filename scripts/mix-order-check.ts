/**
 * Mix and match (emci 2026-10-05). Run: npm run check:mix-order
 *
 * Pins: same seed = same order (Back, page turns, restarts); different people
 * = different orders; a trait never twice on one page where the list allows
 * it; option display order round-trips to the ORIGINAL index the server
 * reads (options->index); every option stays reachable; the middle option
 * stays in the middle; the pager saves the original index.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { QUESTIONS_BANK } from '../src/lib/questions/bank';
import {
  displayToOriginal,
  MIX_PAGE_SIZE,
  mixRows,
  mixSeed,
  optionDisplayOrder,
  originalToDisplay,
} from '../src/lib/questions/mix-order';
import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

// Intake set 1 as the pager gets it: one row per trait.
const set1 = TRAIT_AXES.map((axis) => ({ key: `${axis}-0`, axis }));
// A round: 16 rows, up to 3 per trait (allocateRound's cap).
const roundAxes: TraitAxis[] = ['openness', 'openness', 'openness', 'steadiness', 'steadiness', 'steadiness', 'autonomy', 'autonomy', 'relatedness', 'relatedness', 'competence', 'playfulness', 'growth_mindset', 'locus_of_control', 'self_efficacy', 'extraversion'];
const round = roundAxes.map((axis, i) => ({ key: `item-${i}-${axis}`, axis }));

const users = Array.from({ length: 12 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);

// Same seed, same order — however the caller orders the input.
for (const rows of [set1, round]) {
  const seed = mixSeed(users[0]!, 'set1');
  const a = mixRows(rows, seed).map((r) => r.key);
  const b = mixRows([...rows].reverse(), seed).map((r) => r.key);
  assert.deepEqual(a, b, 'stable for a seed, independent of input order');
  assert.deepEqual([...a].sort(), rows.map((r) => r.key).sort(), 'no row lost or doubled');
}
ok('same seed = same order (Back, page turns, restarts), no row lost or doubled');

// Different people (and different sets) see different orders.
const orders = new Set(users.map((u) => mixRows(set1, mixSeed(u, 'set1')).map((r) => r.key).join(',')));
assert.ok(orders.size >= users.length - 1, `different users get different orders (${orders.size} of ${users.length})`);
assert.notDeepEqual(
  mixRows(set1, mixSeed(users[0]!, 'set1')).map((r) => r.key),
  mixRows(set1, mixSeed(users[0]!, 'set2')).map((r) => r.key),
  'a new set is a new order',
);
const firstOnPage1 = new Set(users.map((u) => mixRows(set1, mixSeed(u, 'set1'))[0]!.axis));
assert.ok(firstOnPage1.size >= 6, 'question 1 is not the same trait for everyone');
ok('different people get different orders; question 1 is not the same for everyone');

// Trait spacing.
for (const u of users) {
  const mixed = mixRows(round, mixSeed(u, 'round:abc'));
  for (let p = 0; p < mixed.length; p += MIX_PAGE_SIZE) {
    const page = mixed.slice(p, p + MIX_PAGE_SIZE).map((r) => r.axis);
    assert.equal(new Set(page).size, page.length, `no trait twice on one page (${u}, page ${p / MIX_PAGE_SIZE + 1}: ${page.join(', ')})`);
  }
  for (let i = 1; i < mixed.length; i += 1) assert.notEqual(mixed[i]!.axis, mixed[i - 1]!.axis, 'never twice in a row');
}
// When the list cannot avoid it (one trait only), nothing breaks.
const oneTrait = [0, 1, 2].map((i) => ({ key: `k${i}`, axis: 'openness' as TraitAxis }));
assert.equal(mixRows(oneTrait, 'x').length, 3);
ok('a round never puts a trait twice on one page or twice in a row; an unavoidable repeat still works');

// Options: display <-> original round-trips; every option reachable; middle stays middle.
let reversed = 0;
for (const u of users) {
  for (const q of QUESTIONS_BANK) {
    const seed = mixSeed(u, 'set1');
    const key = `${q.axis}-x`;
    const order = optionDisplayOrder(seed, key, q.options.length);
    assert.deepEqual([...order].sort(), q.options.map((_, i) => i), 'every option reachable exactly once');
    for (let d = 0; d < order.length; d += 1) {
      assert.equal(originalToDisplay(order, displayToOriginal(order, d)), d, 'display -> original -> display');
    }
    for (let o = 0; o < order.length; o += 1) {
      assert.equal(displayToOriginal(order, originalToDisplay(order, o)), o, 'original -> display -> original');
    }
    if (q.options.length === 3) assert.equal(order[1], 1, 'the middle option stays in the middle');
    assert.deepEqual(optionDisplayOrder(seed, key, q.options.length), order, 'stable per person per question');
    if (order[0] !== 0) reversed += 1;
  }
}
const share = reversed / (users.length * QUESTIONS_BANK.length);
assert.ok(share > 0.3 && share < 0.7, `about half the questions show reversed (${share.toFixed(2)})`);
ok('option order round-trips to the original index, every option reachable, middle stays middle, ~half reversed');

// The pager saves the ORIGINAL index and both pagers pass a per-person seed.
const pager = readFileSync(resolve(__dirname, '../src/components/paged-questions.tsx'), 'utf8').replace(/\r\n/g, '\n');
assert.match(pager, /const optIndex = displayToOriginal\(order, displayIndex\);\n\s+const option = row\.draft\.options\[optIndex\]!;/);
assert.match(pager, /setPendingByRow\(\(prev\) => \(\{\n\s+\.\.\.prev,\n\s+\[row\.key\]: \{ draft: row\.draft, option, optIndex \},/);
assert.match(pager, /const PAGE_SIZE = 4;/, 'PAGE_SIZE stays 4');
assert.match(pager, /\(pickedByRow\[row\.key\] \?\? row\.answeredIndex \?\? -1\) === optIndex/, 'stamps compare in original index');
const fold = readFileSync(resolve(__dirname, '../src/components/questions-fold.tsx'), 'utf8');
assert.match(fold, /mixSeed=\{mixSeed\(me\.id, `bank:\$\{pack\.id\}`\)\}/);
ok('the pager taps, stamps and saves in the original index; every bank set is seeded per person');

console.log(`\n${passed} mix-order checks passed`);
