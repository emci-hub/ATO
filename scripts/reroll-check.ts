/**
 * reroll: the ATO tokens reroll orchestration (wave53/wave54, T-04 core loop
 * redesign §5) — reroll.ts pairs each spendAtoTokens*Reroll call with its
 * effect (legend: mark seen, driven by a locally-computed replacement in
 * legends.tsx; question/category: swap content via the
 * reroll_question_item/reroll_category_batch_item RPCs). Run:
 * npm run check:reroll
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

// rerollLegend takes the already-computed replacement id — it must not
// derive one itself (that would risk the "reroll swaps every shown card"
// bug found in review: every currently-shown card is already logged seen
// the moment it renders, so a full view re-derive after a reroll silently
// moves every figure's pick, not just the one paid for).
assert.match(
  rerollSrc,
  /export async function rerollLegend\(\s*\n\s*userId: string,\s*\n\s*timezone: string,\s*\n\s*oldVariantId: string,\s*\n\s*newVariantId: string,\s*\n\)/,
);
assert.match(rerollSrc, /logShownVariants\(userId, \[oldVariantId, newVariantId\], timezone\)/);
ok('rerollLegend takes a precomputed old/new variant pair rather than re-deriving the view itself');

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

// Both call sites must exist, and LegendCard must NOT call rerollLegend
// itself — legends.tsx owns the catalog (needed to find the replacement
// before spending) and passes the result down as a plain callback.
const legendCardSrc = readFileSync(resolve(__dirname, '../src/components/legend-card.tsx'), 'utf8');
assert.doesNotMatch(legendCardSrc, /rerollLegend\(/, 'LegendCard must not call rerollLegend directly — legends.tsx owns the catalog lookup');
assert.match(legendCardSrc, /onReroll\?:\s*\(\)\s*=>\s*Promise<LegendRerollOutcome>/);
ok('LegendCard delegates reroll to an injected onReroll callback rather than computing the replacement itself');

const legendsScreenSrc = readFileSync(resolve(__dirname, '../src/app/(tabs)/legends.tsx'), 'utf8');
assert.match(legendsScreenSrc, /bestVariantForFigure\(catalog, me, card\.variant\.figureId, exclude\)/);
assert.match(legendsScreenSrc, /rerollLegend\(me\.id, me\.timezone \|\| 'UTC', card\.variant\.id, replacement\.variant\.id\)/);
const rerollHandlerStart = legendsScreenSrc.indexOf('async function handleLegendReroll');
const rerollHandlerBody = legendsScreenSrc.slice(rerollHandlerStart, legendsScreenSrc.indexOf('\n  }', rerollHandlerStart));
assert.ok(
  rerollHandlerBody.indexOf('bestVariantForFigure') < rerollHandlerBody.indexOf('rerollLegend('),
  'legends.tsx must find a replacement locally before spending on a legend reroll',
);
ok('legends.tsx computes the replacement locally (no charge if none exists) before calling rerollLegend');

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
