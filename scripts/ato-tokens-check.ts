/**
 * ato-tokens: client module for the ATO tokens currency (core loop redesign
 * §5, T-04). Run: npm run check:ato-tokens
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ATO_TOKEN_EARN,
  ATO_TOKEN_PRICE,
  atoPriceLine,
  atoTokenBalanceOf,
  atoTokenCopyClean,
  parseAtoTokenResult,
} from '../src/lib/ato-tokens';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

assert.deepEqual(ATO_TOKEN_EARN, { full_profile_complete: 21, ongoing_round_complete: 21 });
assert.deepEqual(ATO_TOKEN_PRICE, { legend_reroll: 10, category_reroll: 1, question_reroll: 1 });
ok('earn/price constants match the finalized plan exactly (21/21 earn, 10/1/1 spend)');

assert.equal(atoTokenBalanceOf({ ato_tokens: 42 }), 42);
assert.equal(atoTokenBalanceOf({ ato_tokens: -3 }), 0, 'negative/invalid never displays as a negative balance');
assert.equal(atoTokenBalanceOf({ ato_tokens: null }), 0);
assert.equal(atoTokenBalanceOf({}), 0);
ok('atoTokenBalanceOf is defensive against null/negative/missing, same shape as tokenBalanceOf');

assert.equal(atoPriceLine('legend_reroll'), '10 ATO tokens');
assert.equal(atoPriceLine('category_reroll'), '1 ATO token');
assert.equal(atoPriceLine('question_reroll'), '1 ATO token');
ok('atoPriceLine pluralizes correctly at the boundary (1 vs 10)');

assert.deepEqual(
  parseAtoTokenResult({ ok: true, already: false, balance: 21, delta: 21, reason: 'full_profile_complete' }),
  { ok: true, already: false, balance: 21, delta: 21, reason: 'full_profile_complete', price: undefined },
);
assert.deepEqual(
  parseAtoTokenResult({ ok: false, already: true, balance: 5, delta: 0, reason: 'legend_reroll', price: 10 }),
  { ok: false, already: true, balance: 5, delta: 0, reason: 'legend_reroll', price: 10 },
);
assert.deepEqual(parseAtoTokenResult(null), { ok: false, balance: 0, reason: 'empty' });
assert.deepEqual(parseAtoTokenResult(undefined), { ok: false, balance: 0, reason: 'empty' });
ok('parseAtoTokenResult reads every RPC response shape (earn/claim and spend, including a capped-out "already" spend) and degrades safely on empty data');

assert.ok(atoTokenCopyClean(), 'ATO tokens copy must stay framework-term-free, same guard every other user-facing string in this repo goes through');
ok('atoTokenCopyClean passes the shared jargon guard');

// Never share a reason string with the Notes economy's TOKEN_EARN/TOKEN_PRICE,
// and tokens.ts must never reference the separate ATO tokens module.
const tokensSrc = readFileSync(resolve(__dirname, '../src/lib/tokens.ts'), 'utf8');
for (const reason of [...Object.keys(ATO_TOKEN_EARN), ...Object.keys(ATO_TOKEN_PRICE)]) {
  assert.doesNotMatch(tokensSrc, new RegExp(`\\b${reason}\\b`), `tokens.ts (Notes) must not use the ATO-tokens-only reason "${reason}"`);
}
assert.doesNotMatch(tokensSrc, /ato_tokens|ATO_TOKEN_/, 'tokens.ts (Notes) must never reference the separate ATO tokens module — confirms the two currencies stay fully decoupled');
ok('tokens.ts (Notes economy) has zero references to ato_tokens/ATO_TOKEN_*/ATO-only reasons — the two currencies are decoupled, not just documented as such');

const serverSrc = readFileSync(resolve(__dirname, '../src/lib/ato-tokens-server.ts'), 'utf8');
assert.match(serverSrc, /supabase\.rpc\('claim_full_profile_complete'\)/);
assert.match(serverSrc, /supabase\.rpc\('claim_ongoing_round_complete', \{\s*\n\s*p_pack_id: packId,\s*\n\s*\}\)/);
assert.match(serverSrc, /supabase\.rpc\('spend_ato_tokens_legend_reroll'\)/);
assert.match(serverSrc, /supabase\.rpc\('spend_ato_tokens_category_reroll', \{\s*\n\s*p_category_id: categoryId,\s*\n\s*\}\)/);
assert.match(serverSrc, /supabase\.rpc\('spend_ato_tokens_question_reroll', \{\s*\n\s*p_question_item_id: questionItemId,\s*\n\s*\}\)/);
ok('ato-tokens-server.ts wraps all 5 RPCs with the correct names and argument shapes');

console.log(`\n${passed} ato-tokens checks passed`);
