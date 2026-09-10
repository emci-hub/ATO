/**
 * reroll: the ATO tokens reroll orchestration — reroll.ts pairs each
 * spendAtoTokens*Reroll call with its effect (legend: generate + save a
 * fresh legend_generations row for the live archetype code, core loop
 * redesign §4; question/category: swap content via the
 * reroll_question_item/reroll_category_batch_item RPCs, T-04 core loop
 * redesign §5). Run: npm run check:reroll
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const rerollSrc = readFileSync(resolve(__dirname, '../src/lib/questions/reroll.ts'), 'utf8');

assert.match(rerollSrc, /export async function rerollLegend\(/);
assert.match(rerollSrc, /export async function rerollQuestionItem\(/);
assert.match(rerollSrc, /export async function rerollCategoryItem\(/);
ok('reroll.ts exports rerollLegend / rerollQuestionItem / rerollCategoryItem');

assert.match(rerollSrc, /trySpend\(spendAtoTokensLegendReroll\)/);
assert.match(rerollSrc, /trySpend\(\(\) => spendAtoTokensQuestionReroll\(item\.id\)\)/);
assert.match(rerollSrc, /trySpend\(\(\) => spendAtoTokensCategoryReroll\(categoryId\)\)/);
ok('each reroll function calls the matching spendAtoTokens*Reroll for its own surface, not another surface\'s');

// spend RPCs raise (not return {ok:false}) on insufficient balance — trySpend
// must catch that specific errcode so the UI's "not enough tokens" copy is
// reachable instead of an uncaught throw (found in review).
assert.match(rerollSrc, /async function trySpend\(/);
assert.match(rerollSrc, /code === 'P0040'/);
ok('trySpend catches the insufficient-balance exception (errcode P0040) rather than letting it throw uncaught');

// Legends 64-archetype rewrite (core loop redesign §4): rerollLegend now
// takes the live archetype code and does its own generate-then-spend-then-
// save, rather than taking a precomputed old/new variant pair (the old
// figure-catalog system's shape). Order matters here even more than for
// question/category reroll — it must generate BEFORE spending, and only
// persist the new story AFTER the spend actually succeeds, otherwise a
// quota-exhausted or failed generation could still cost the token, or a
// failed spend could still leave a story saved for free.
assert.match(
  rerollSrc,
  /export async function rerollLegend\(archetypeCode: string\): Promise<LegendRerollResult>/,
);
const legendFnStart = rerollSrc.indexOf('export async function rerollLegend');
const legendFnBody = rerollSrc.slice(legendFnStart, rerollSrc.indexOf('\n}', legendFnStart));
const legendGenerateIdx = legendFnBody.indexOf('generateLegendStory');
const legendSpendIdx = legendFnBody.indexOf('spendAtoTokensLegendReroll');
const legendSaveIdx = legendFnBody.indexOf('saveGeneration');
assert.notEqual(legendGenerateIdx, -1, 'rerollLegend must call generateLegendStory');
assert.notEqual(legendSpendIdx, -1, 'rerollLegend must call spendAtoTokensLegendReroll');
assert.notEqual(legendSaveIdx, -1, 'rerollLegend must call saveGeneration');
assert.ok(
  legendGenerateIdx < legendSpendIdx,
  'rerollLegend must generate the replacement story before spending',
);
assert.ok(
  legendSpendIdx < legendSaveIdx,
  'rerollLegend must only persist the new story after the spend actually succeeds',
);
ok('rerollLegend generates the story before spending, and only saves it after a successful spend');

// Order: whatever can fail (bank candidate lookup, AI generation) must run
// BEFORE the spend call, so a reroll that can't happen is never charged.
const questionFnStart = rerollSrc.indexOf('export async function rerollQuestionItem');
const questionFnBody = rerollSrc.slice(questionFnStart, rerollSrc.indexOf('\n}', questionFnStart));
assert.ok(
  questionFnBody.indexOf('fetchBankCandidates') < questionFnBody.indexOf('spendAtoTokensQuestionReroll'),
  'rerollQuestionItem must check for a bank candidate before spending',
);
// The precheck must exclude bank items already used elsewhere in the same
// pack, matching the effect RPC's own exclusion — checking only the
// permanent per-user exclusions let a sparse axis spend the token and then
// have the RPC find nothing (found in review).
assert.match(questionFnBody, /fetchPackBankItemIds\(item\.packId\)/);
assert.match(questionFnBody, /!packBankIds\.has\(candidate\.id\)/);
ok('rerollQuestionItem\'s precheck excludes bank items already used elsewhere in the same pack, mirroring the effect RPC');

const categoryFnStart = rerollSrc.indexOf('export async function rerollCategoryItem');
const categoryFnBody = rerollSrc.slice(categoryFnStart, rerollSrc.indexOf('\n}', categoryFnStart));
assert.ok(
  categoryFnBody.indexOf('generateQuestionBatch') < categoryFnBody.indexOf('spendAtoTokensCategoryReroll'),
  'rerollCategoryItem must generate the replacement before spending',
);
ok('rerollCategoryItem generates the replacement question before spending');

assert.match(rerollSrc, /supabase\.rpc\('reroll_question_item', \{ p_item_id: item\.id \}\)/);
assert.match(
  rerollSrc,
  /supabase\.rpc\('reroll_category_batch_item', \{\s*\n\s*p_item_id: item\.id,\s*\n\s*p_prompt: draft\.prompt,\s*\n\s*p_options: draft\.options,\s*\n\s*\}\)/,
);
ok('the two effect RPCs are called with the correct argument shapes');

for (const name of ['wave53_reroll_rpcs', 'wave54_reroll_rpcs_fixes']) {
  const src = readFileSync(resolve(__dirname, `../supabase/migrations/${name}.sql`), 'utf8');
  assert.match(src, /create or replace function public\.reroll_question_item\(p_item_id uuid\)/);
  assert.match(
    src,
    /create or replace function public\.reroll_category_batch_item\(\s*\n\s*p_item_id uuid,\s*\n\s*p_prompt text,\s*\n\s*p_options jsonb\s*\n\)/,
  );
  assert.match(src, /security definer/);
  assert.match(src, /if v_answered is not null then\s*\n\s*raise exception 'already answered'/);
}
ok('both migrations define reroll_question_item/reroll_category_batch_item as security definer and reject already-answered rows');

const wave53Src = readFileSync(resolve(__dirname, '../supabase/migrations/wave53_reroll_rpcs.sql'), 'utf8');
assert.match(wave53Src, /revoke all on function public\.reroll_question_item\(uuid\) from public, anon;/);
assert.match(
  wave53Src,
  /revoke all on function public\.reroll_category_batch_item\(uuid, text, jsonb\) from public, anon;/,
);
assert.match(wave53Src, /insert into public\.question_bank_reroll_exclusions/);
ok('wave53 grants execute to authenticated only and permanently excludes the old bank item via question_bank_reroll_exclusions');

const wave54Src = readFileSync(
  resolve(__dirname, '../supabase/migrations/wave54_reroll_rpcs_fixes.sql'),
  'utf8',
);
assert.match(wave54Src, /from public\.question_items\s*\n\s*where id = p_item_id and user_id = uid\s*\n\s*for update;/);
assert.match(
  wave54Src,
  /from public\.category_question_items\s*\n\s*where id = p_item_id and user_id = uid\s*\n\s*for update;/,
);
ok('wave54 adds `for update` row locking to both RPCs\' ownership/answered check, closing the concurrent-reroll race found in review');

// LegendCard must NOT call rerollLegend itself — legends.tsx owns the live
// archetype-code computation (currentCode()) and passes the result down as
// a plain injected callback, same separation of concerns as the old system.
const legendCardSrc = readFileSync(resolve(__dirname, '../src/components/legend-card.tsx'), 'utf8');
assert.doesNotMatch(legendCardSrc, /rerollLegend\(/, 'LegendCard must not call rerollLegend directly — legends.tsx owns the archetype-code computation');
assert.match(legendCardSrc, /onReroll\?:\s*\(\)\s*=>\s*Promise<LegendRerollOutcome>/);
ok('LegendCard delegates reroll to an injected onReroll callback rather than calling rerollLegend itself');

const legendsScreenSrc = readFileSync(resolve(__dirname, '../src/app/(tabs)/legends.tsx'), 'utf8');
assert.match(legendsScreenSrc, /rerollLegend\(code\)/);
const rerollHandlerStart = legendsScreenSrc.indexOf('async function handleReroll');
const rerollHandlerBody = legendsScreenSrc.slice(rerollHandlerStart, legendsScreenSrc.indexOf('\n  }', rerollHandlerStart));
assert.match(
  rerollHandlerBody,
  /currentCode\(\)/,
  'legends.tsx must reroll using the LIVE archetype code (currentCode()), never a stale stored one',
);
ok('legends.tsx rerolls using the current archetype code, delegating all spend/generate ordering to rerollLegend');

const questionsFoldSrc = readFileSync(resolve(__dirname, '../src/components/questions-fold.tsx'), 'utf8');
assert.match(questionsFoldSrc, /rerollQuestionItem\(/);
assert.match(questionsFoldSrc, /rerollCategoryItem\(/);
assert.match(questionsFoldSrc, /ATO_TOKEN_PRICE\.question_reroll/);
assert.match(questionsFoldSrc, /ATO_TOKEN_PRICE\.category_reroll/);
ok('questions-fold.tsx wires reroll actions for both surfaces and gates on ATO_TOKEN_PRICE, not a hardcoded number');

// A successful reroll must refresh `me` so the ATO balance the button gates
// on next isn't stale (found in review) — both OngoingRoundFold and
// CategoryBatchFold's reroll() call onUpdated() right after the local
// pack/batch state patch, same as every answer path in this file already
// does.
const ongoingRerollStart = questionsFoldSrc.indexOf('async function reroll(item: QuestionItemRow)');
const ongoingRerollBody = questionsFoldSrc.slice(ongoingRerollStart, questionsFoldSrc.indexOf('\n  }', ongoingRerollStart));
assert.match(ongoingRerollBody, /await onUpdated\(\);/);
const categoryRerollStart = questionsFoldSrc.indexOf("async function reroll(item: CategoryBatchState['items'][number])");
const categoryRerollBody = questionsFoldSrc.slice(categoryRerollStart, questionsFoldSrc.indexOf('\n  }', categoryRerollStart));
assert.match(categoryRerollBody, /await onUpdated\(\);/);
ok('both question and category reroll refresh `me` (onUpdated) after a successful swap');

const legendsScreenSrc2 = readFileSync(resolve(__dirname, '../src/app/(tabs)/legends.tsx'), 'utf8');
assert.match(legendsScreenSrc2, /void refresh\(\)\.catch/);
ok('legends.tsx refreshes `me` after a successful legend reroll too');

console.log(`\n${passed} reroll checks passed`);
