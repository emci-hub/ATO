/**
 * reroll: the ATO tokens reroll orchestration — reroll.ts pairs each
 * spendAtoTokens*Reroll call with its effect (legend: generate + save a
 * fresh legend_generations row for the live archetype code, core loop
 * redesign §4; question: swap content via the reroll_question_item RPC,
 * T-04 core loop redesign §5). Category reroll was removed with the rest of
 * the old Categorize Q&A system (core loop redesign §3, wave60/61) — a
 * reroll for the new category_statements system is separate, not-yet-built
 * scope. Run: npm run check:reroll
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

// reroll.ts (rerollLegend) and legends64/generate-story.ts were dead code (no callers) and are
// deleted (2026-10-20). The live legend reroll is identity-store.ts's spend; nothing may bring back
// a client-side model call for it.
const root = resolve(__dirname, '..');
for (const gone of ['src/lib/questions/reroll.ts', 'src/lib/legends64/generate-story.ts']) {
  assert.ok(!existsSync(resolve(root, gone)), gone + ' must stay deleted');
}
ok('reroll.ts and generate-story.ts (dead: no callers) stay deleted');

{
  const identitySrc = readFileSync(resolve(root, 'src/lib/legends64/identity-store.ts'), 'utf8');
  assert.match(identitySrc, /spendAtoTokensLegendReroll/, 'the live legend reroll still spends through identity-store');
  assert.doesNotMatch(identitySrc, /generateText|generateLegendStory|rerollLegend/, 'the live legend reroll makes no client model call');
  assert.doesNotMatch(identitySrc, /spendAtoTokensCategoryReroll|spendAtoTokensQuestionReroll/);
}
ok('the live legend reroll spends via identity-store with no client model call, and no category/question spend is wired in');

{
  const src = readFileSync(resolve(__dirname, '../supabase/migrations/wave53_reroll_rpcs.sql'), 'utf8');
  assert.match(src, /create or replace function public\.reroll_question_item\(p_item_id uuid\)/);
  assert.match(src, /security definer/);
}
ok('wave53 defines reroll_question_item as security definer');

const wave53Src = readFileSync(resolve(__dirname, '../supabase/migrations/wave53_reroll_rpcs.sql'), 'utf8');
assert.match(wave53Src, /revoke all on function public\.reroll_question_item\(uuid\) from public, anon;/);
assert.match(wave53Src, /insert into public\.question_bank_reroll_exclusions/);
ok('wave53 grants execute to authenticated only and permanently excludes the old bank item via question_bank_reroll_exclusions');

const wave54Src = readFileSync(
  resolve(__dirname, '../supabase/migrations/wave54_reroll_rpcs_fixes.sql'),
  'utf8',
);
assert.match(wave54Src, /from public\.question_items\s*\n\s*where id = p_item_id and user_id = uid\s*\n\s*for update;/);
ok('wave54 adds `for update` row locking to reroll_question_item\'s ownership/answered check, closing the concurrent-reroll race found in review');

// LegendCard must NOT call rerollLegend itself — parking-era note: LegendCard
// is unreached (Legends is whole-file parked, ISOLATION_PLAN Card 3), but the
// separation-of-concerns contract stays worth pinning for when it's rebuilt.
const legendCardSrc = readFileSync(resolve(__dirname, '../src/components/legend-card.tsx'), 'utf8');
assert.doesNotMatch(legendCardSrc, /rerollLegend\(/, 'LegendCard must not call rerollLegend directly — pre-parking, legends.tsx owned the archetype-code computation');
assert.match(legendCardSrc, /onReroll\?:\s*\(\)\s*=>\s*Promise<LegendRerollOutcome>/);
ok('LegendCard delegates reroll to an injected onReroll callback rather than calling rerollLegend itself');

// legends.tsx is parked (docs/ISOLATION_PLAN.md Card 3, 2026-09-15) — it no
// longer calls rerollLegend at all, per the "delete the call site, not the
// callee" rule. rerollLegend's own generate-then-spend-then-save ordering is
// still fully covered above via reroll.ts directly; this file's job was only
// ever to confirm the screen wired that logic in correctly, and the screen no
// longer exists in a form that can do so. rerollLegend now has zero client
// callers, same status record_check reached when the Check loop was parked.

const questionsFoldSrc = readFileSync(resolve(__dirname, '../src/components/questions-fold.tsx'), 'utf8');
assert.doesNotMatch(questionsFoldSrc, /rerollQuestionItem\(|rerollCategoryItem\(/, 'no reroll on the Questions screen: sets come from the fixed bank (wave85)');
ok('the Questions screen offers no reroll: there is no AI pool to swap from');

// REROLLS_FROZEN (emci 2026-10-07): the daily insight and the category cards are
// stored copy, so neither shows a reroll. The RPCs and client code stay.
{
  const flag = readFileSync(resolve(__dirname, '../src/lib/rerolls.ts'), 'utf8');
  assert.match(flag, /export const REROLLS_FROZEN = true;/);
  const home = readFileSync(resolve(__dirname, '../src/app/(tabs)/index.tsx'), 'utf8');
  const cats = readFileSync(resolve(__dirname, '../src/components/categories-fold.tsx'), 'utf8');
  for (const [name, src] of [['Home', home], ['categories-fold', cats]] as const) {
    assert.doesNotMatch(src, /[Rr]eroll\(|spendCategoryReroll|CATEGORY_REWRITE_LABEL|Reroll ·/, `${name} shows no reroll while REROLLS_FROZEN`);
  }
  assert.match(readFileSync(resolve(__dirname, '../src/lib/category-statements/reroll-spend.ts'), 'utf8'), /export async function spendCategoryReroll\(/);
  assert.ok(!existsSync(resolve(root, 'src/lib/questions/reroll.ts')));
}
ok('REROLLS_FROZEN: no reroll on the daily insight or the category cards; the spend code is kept');

console.log(`
${passed} reroll checks passed`);
