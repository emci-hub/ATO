/**
 * bank-pool-match.ts's pure matching logic (core loop redesign §2). Run:
 * npm run check:bank-pool
 *
 * Follow-up fix from T-03's review: `addToBankPool` (bank-pool.ts) matched
 * RPC result rows back to input drafts by prompt-text equality, which is
 * fragile (depends on `insert_bank_pool_items`'s server-side
 * `left(trim(...), 400)` being a no-op — true today only because
 * `parseQuestionDraft` already trims/caps, an invariant this code
 * shouldn't have to lean on). Fixed to match by array position instead,
 * split into its own file (no `@/lib/supabase` import) so it's
 * Node-testable — bank-pool.ts itself pulls in react-native transitively
 * and can't be imported by a plain tsx script.
 *
 * Review caught two real weaknesses in this check's own first draft, fixed
 * here: a "duplicate prompt" test whose expected ids were wrong (the RPC's
 * own `on conflict do update ... returning id` collapses duplicate prompts
 * to one shared id, not distinct ones), and a "server-side value
 * transform" test that was vacuous given `rows` is typed `{ id: string }[]`
 * with nothing else to transform — removed rather than kept as padding.
 */
import assert from 'node:assert/strict';

import { assignBankItemIdsByPosition } from '../src/lib/questions/bank-pool-match';
import type { QuestionDraft } from '../src/lib/questions/types';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function draft(prompt: string): QuestionDraft {
  return { axis: 'openness', prompt, options: [{ text: 'a', value: 0.5 }, { text: 'b', value: 0.5 }] };
}

// Basic 1:1 assignment by position.
{
  const drafts = [draft('one'), draft('two'), draft('three')];
  assignBankItemIdsByPosition(drafts, [{ id: 'id-0' }, { id: 'id-1' }, { id: 'id-2' }]);
  assert.equal(drafts[0].bankItemId, 'id-0');
  assert.equal(drafts[1].bankItemId, 'id-1');
  assert.equal(drafts[2].bankItemId, 'id-2');
  ok('assigns bankItemId by array position, in order');
}

// Duplicate prompt text within one batch: `insert_bank_pool_items`'s own
// `on conflict (prompt) do update ... returning id` means two identical
// prompts in the SAME call both resolve to the SAME row and the SAME id
// (the second insert conflicts with the first's row, not a distinct one) —
// so the correct, real-world result here is [id-a, id-a, id-c], not three
// distinct ids. This isn't a case the old Map-based design got wrong
// either (a Map lookup on identical prompt text would also correctly find
// that one shared id for both). What this test actually verifies:
// position-based matching passes the RPC's real (collapsed) dedup result
// straight through without re-deriving or second-guessing it — each
// draft's `bankItemId` reflects exactly the row at its own index, whatever
// that row's id happens to be, including a shared one.
{
  const drafts = [draft('same text'), draft('same text'), draft('different')];
  assignBankItemIdsByPosition(drafts, [{ id: 'id-a' }, { id: 'id-a' }, { id: 'id-c' }]);
  assert.equal(drafts[0].bankItemId, 'id-a');
  assert.equal(drafts[1].bankItemId, 'id-a');
  assert.equal(drafts[2].bankItemId, 'id-c');
  ok('duplicate prompt text resolving to the RPC\'s own shared row id is passed through correctly by position, not re-derived');
}

// Row count mismatch must throw, not silently under/over-assign.
{
  const drafts = [draft('one'), draft('two')];
  assert.throws(
    () => assignBankItemIdsByPosition(drafts, [{ id: 'id-0' }]),
    /returned 1 rows for 2 drafts/,
    'row-count mismatch must throw with a clear message, not silently leave bankItemId unset on some drafts',
  );
  ok('throws on a row-count mismatch instead of silently under-assigning');
}

// Empty input is a no-op, not an error.
{
  assignBankItemIdsByPosition([], []);
  ok('empty drafts/rows is a no-op');
}

console.log(`\n${passed} bank-pool checks passed`);
