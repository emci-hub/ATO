/**
 * wave47: reveal_roll_item must refuse to charge for a not-ready item
 * (trait-system redesign §7). Run: npm run check:wave47
 *
 * Schema-only check (source assertions) — wave46 is already applied live;
 * this migration redefines one function on top of it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const sql = read('supabase/migrations/wave47_reveal_requires_ready.sql');

assert.match(sql, /create or replace function public\.reveal_roll_item\(p_item_id uuid\)/);
assert.match(
  sql,
  /if coalesce\(\(v_result->>'ready'\)::boolean, false\) is not true then\s*\n\s*return jsonb_build_object\('ok', false, 'reason', 'not_ready', 'type', v_type\);/,
  'reveal_roll_item must refuse to charge (return ok:false, not raise) when the stored result is not ready — a missing ready key must default to false, not silently pass',
);
ok('reveal_roll_item refuses to charge for a not-ready item, defaulting a missing ready key to false');

// The refusal check must happen BEFORE the price/balance/spend logic, or a
// not-ready item could still be charged for.
const readyCheckIdx = sql.indexOf("reason', 'not_ready'");
const priceIdx = sql.indexOf('v_price := case v_type');
const spendIdx = sql.indexOf("'roll_reveal', today");
assert.ok(readyCheckIdx > -1 && priceIdx > readyCheckIdx && spendIdx > priceIdx, 'the not-ready refusal must happen before pricing and before any spend');
ok('the not-ready refusal happens before pricing/spend, not after');

// Everything else about the function must be unchanged from wave46: same
// lock key, same row lock, same already-revealed no-op, same prices.
assert.match(sql, /pg_advisory_xact_lock\(hashtext\('tokens:' \|\| uid::text\)\)/);
assert.match(sql, /where id = p_item_id and user_id = uid\s*\n\s*for update/);
assert.match(sql, /if v_revealed_at is not null then\s*\n\s*return jsonb_build_object\('ok', true, 'already', true/);
assert.match(sql, /v_price := case v_type when 'legend' then 5 else 1 end/);
ok('lock key, row lock, already-revealed no-op, and prices are all unchanged from wave46');

// No grant/revoke statements here — create or replace on the same
// signature keeps wave46's existing grants; re-stating them would be
// harmless but is unnecessary noise, so their absence is expected, not a
// gap. Confirm the signature really is identical (same arg list), which is
// what makes that true.
assert.doesNotMatch(sql, /grant execute|revoke all/, 'no grant/revoke expected — create or replace on the unchanged (uuid) signature preserves wave46\'s existing grants');
ok('no redundant grant/revoke statements — relies on create or replace preserving wave46\'s grants for the unchanged (uuid) signature');

console.log(`\n${passed} wave47 checks passed`);
