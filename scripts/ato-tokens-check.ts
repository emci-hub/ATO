/**
 * ato-tokens: client module for the ATO tokens currency (core loop redesign
 * §5, T-04). Run: npm run check:ato-tokens
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  AI_TOKEN_PRICE,
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

// wave92 (emci 2026-10-09): one AI view = AI_TOKEN_PRICE; check-in and a set of 16 are one view each,
// the 7th check-in two, the first 48 all three.
assert.deepEqual(ATO_TOKEN_EARN, { full_profile_complete: 15, ongoing_round_complete: 5, daily_checkin: 5, checkin_week_bonus: 10 });
assert.equal(AI_TOKEN_PRICE, 5);
assert.equal(ATO_TOKEN_EARN.daily_checkin, AI_TOKEN_PRICE, 'a check-in buys one AI view');
assert.equal(ATO_TOKEN_EARN.ongoing_round_complete, AI_TOKEN_PRICE, 'a set of 16 buys one AI view');
assert.equal(ATO_TOKEN_EARN.checkin_week_bonus, AI_TOKEN_PRICE * 2, 'the 7th check-in buys two');
assert.equal(ATO_TOKEN_EARN.full_profile_complete, AI_TOKEN_PRICE * 3, 'the first 48 buy one of each AI view');
assert.deepEqual(ATO_TOKEN_PRICE, { legend_reroll: 10, category_reroll: 1, question_reroll: 1 });
ok('earn/price constants match the plan exactly (wave92: 15 once, 5 per set, 5 check-in, 10 every 7th; AI 5; rerolls 10/1/1)');

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

// --- the two EARN sites are actually wired (2026-10-01) -----------------------
// Design: +21 for finishing the 50-question intake (once ever) and +21 per
// finished 25-question round (once per round). Both were priced correctly, but
// the intake one had NO caller, so it was never paid.
const src = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const foldSrc = src('src/components/questions-fold.tsx');
const wave51 = src('supabase/migrations/wave51_ato_tokens.sql');
const wave52 = src('supabase/migrations/wave52_ato_tokens_fixes.sql');

// 1) Intake: asked from the Questions screen once the profile is done.
assert.ok(serverSrc.includes('export function claimFullProfileCompleteQuiet('), 'a fire-and-forget intake claim exists');
assert.match(
  foldSrc,
  /if \(!fullProfileLocked \|\| intakeClaimAsked\.current\) return;\s*intakeClaimAsked\.current = true;\s*claimFullProfileCompleteQuiet\(/,
  'the intake +21 is claimed when the profile is done, once per mount',
);
assert.equal(foldSrc.split('claimFullProfileCompleteQuiet(').length - 1, 1, 'exactly one intake claim site');
// Paid once EVER: the server's unique index is the guarantee, not the client.
assert.ok((wave51 + wave52).includes('ato_token_events_full_profile_once'), 'the intake payout is unique per user on the server');
ok('EARN site 1: finishing the 50 claims +21 from the Questions screen; the server pays it once ever');

// 2) Round: claimed when the last of the 25 is answered, and retried on load.
assert.equal(
  foldSrc.split('claimOngoingRoundCompleteQuiet(').length - 1,
  2,
  'the round +21 is claimed in exactly two places: on the last answer, and as a retry on load',
);
assert.match(
  foldSrc,
  /if \(loaded && loaded\.kind === 'ongoing_round' && packDone\(loaded\)\) \{\s*claimOngoingRoundCompleteQuiet\(loaded\.id, \(\{ fresh \}\) => \{\s*if \(fresh\) void onUpdated\(\);/,
  'the retry on load only fires for a fully answered paying set (sets 4-25, kind ongoing_round)',
);
assert.match(foldSrc, /claimOngoingRoundCompleteQuiet\(\s*[\w.]+\.id\s*[,)]/, 'the claim passes the round id');
assert.ok(wave52.includes('claim_ongoing_round_complete'), 'the round claim RPC is defined');
// Paid once PER ROUND: two client calls for one round can never pay twice.
assert.match(wave51 + wave52, /unique index[^;]*\(user_id, pack_id\)/i, 'one payout per (user, round) on the server');
ok('EARN site 2: a finished round of 25 claims +21; the server pays once per round');

// The old "notes" currency no longer earns or spends anywhere a user can reach.
for (const rel of ['src/components/questions-fold.tsx', 'src/components/depth-dive.tsx', 'src/components/full-profile-fold.tsx', 'src/lib/me.ts']) {
  // Lookbehinds keep the NEW currency's own names (atoTokenBalanceOf, ATO_TOKEN_PRICE) out of the match.
  assert.doesNotMatch(
    src(rel),
    /earnTokensQuiet\(|spendTokens\(|(?<![A-Za-z_])tokenBalanceOf\(|(?<![A-Z_])TOKEN_PRICE\b/,
    `${rel} no longer touches the old notes currency`,
  );
}
assert.doesNotMatch(src('src/components/depth-dive.tsx'), /notes/i, 'Depth dive is free and says nothing about notes');
ok('the old notes currency is retired from live code; Depth dive is free');

// The balance is visible.
const cardSrc = src('src/components/ato-token-card.tsx');
assert.ok(cardSrc.includes('atoTokenBalanceOf(me)') && cardSrc.includes('fetchAtoTokenEvents(5)'), 'the card shows balance + recent history');
for (const reason of [...Object.keys(ATO_TOKEN_EARN), ...Object.keys(ATO_TOKEN_PRICE)]) {
  assert.ok(cardSrc.includes(`${reason}:`), `the history names ${reason} in plain words`);
}
ok('the token balance and recent history have a card (mounted on You — pinned by check:rebuilt)');

// Category reroll: FROZEN (emci 2026-10-07). The category card is stored copy
// now, so the control is gone from Explore; the spend RPC and its client stay
// so the reroll can return without a migration (check:reroll pins the flag).
const catSrc = src('src/components/categories-fold.tsx');
assert.doesNotMatch(catSrc, /spendCategoryReroll|CATEGORY_REWRITE_LABEL|loadCategory\(reading, true\)/, 'no category reroll on Explore');
const rerollSpendSrc = src('src/lib/category-statements/reroll-spend.ts');
assert.match(rerollSpendSrc, /export async function spendCategoryReroll\(/, 'the spend client is kept, not deleted');
ok('category reroll is frozen: no control on Explore, the spend client kept for later');

console.log(`\n${passed} ato-tokens checks passed`);
