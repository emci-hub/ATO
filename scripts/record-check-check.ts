/**
 * record_check honest-empty flag. Run: npx tsx scripts/record-check-check.ts
 *
 * A real card still requires non-empty Read/Do. p_no_card is the only way to
 * insert a Check with null Read/Do. That row still counts toward check_count.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { checkWasCut, hasSevenChecks } from '../src/lib/badges';
import { presenceTier } from '../src/lib/growth';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const sql = read('supabase/migrations/record_check_no_card.sql');
const checksLib = read('src/lib/checks.ts');
const home = read('src/app/(tabs)/index.tsx');
const growth = read('src/hooks/use-growth.ts');
const latestRpc = read('supabase/migrations/sage_nudge.sql');

assert.match(sql, /p_no_card boolean default false/);
assert.match(sql, /if coalesce\(p_no_card, false\) then/);
assert.match(sql, /v_read := null;/);
assert.match(sql, /v_do := null;/);
ok('new migration adds an explicit p_no_card flag that stores null Read/Do');

const noCardIf = sql.indexOf('if coalesce(p_no_card, false) then');
const noCardElse = sql.indexOf('else', noCardIf);
const sourceGuard = sql.indexOf('if p_source is null');
assert.ok(noCardIf >= 0 && noCardElse > noCardIf && sourceGuard > noCardElse);
const noCardBranch = sql.slice(noCardIf, noCardElse);
const normalBranch = sql.slice(noCardElse, sourceGuard);
assert.match(noCardBranch, /v_read := null;/);
assert.doesNotMatch(noCardBranch, /read_required|do_required/);
ok('honest-empty signal set and null read/do is the accepted write path');

assert.match(normalBranch, /raise exception 'read_required' using errcode = 'P0012'/);
assert.match(normalBranch, /raise exception 'do_required' using errcode = 'P0013'/);
assert.match(
  normalBranch,
  /if p_read_text is null or btrim\(p_read_text\) = '' then/,
);
assert.match(
  normalBranch,
  /if p_do_text is null or btrim\(p_do_text\) = '' then/,
);
ok('a normal Check with null or blank read/do is still rejected');

assert.match(latestRpc, /raise exception 'read_required'/);
assert.match(sql, /drop function if exists public\.record_check\(integer, date, text, text, text, text, text\)/);
ok('prior 7-arg record_check is dropped so the defaulted 8-arg function is the only overload');

assert.match(checksLib, /noCard\?: boolean/);
assert.match(checksLib, /p_no_card: noCard/);
assert.match(checksLib, /p_read_text: noCard \? null : input\.card\.read/);
assert.match(home, /commitLog\(status, todayOpen\.day, todayOpen\.ymd, \{ read: '', do: '' \}, 'bank', true\)/);
assert.match(home, /noCard,/);
ok('Home honest-empty Did/Skip passes noCard through recordCheck');

assert.match(growth, /setCheckCount\(checks\.length\)/);
assert.doesNotMatch(growth, /read_text/);
assert.equal(hasSevenChecks(6), false);
assert.equal(hasSevenChecks(7), true);
assert.equal(presenceTier(6), 1);
assert.equal(presenceTier(7), 2);
ok('check_count is all-time row count; a null-read Check is counted the same as a normal logged Check');

assert.equal(
  checkWasCut({ day: 4, status: 'done', logged_on: '2026-08-30', read_text: null }, {
    day: 3,
    status: 'done',
    logged_on: '2026-08-29',
    read_text: 'Ordinary day. Nothing to dramatize.',
  }),
  false,
);
assert.equal(
  checkWasCut({ day: 4, status: 'done', logged_on: '2026-08-30', read_text: null }, {
    day: 3,
    status: 'skipped',
    logged_on: '2026-08-29',
    read_text: 'Day skipped. Name the habit — not you.',
  }),
  true,
);
ok('null-read Check uses the same pruned-read cut inference as a normal logged Check');

console.log(`\nrecord-check-check: ${passed}/${passed} passed`);
