/**
 * legend-candidates: AI-generated Legend candidate pipeline (wave55) —
 * generation, review-gate RPCs, dev-lab UI wiring. Run:
 * npm run check:legend-candidates
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseLegendCandidate } from '../src/lib/legends/parse';
import { buildLegendCandidatePrompt, energyLineName } from '../src/lib/legends/prompt';
import { LEGEND_GENERATION_META, AI_CALL_SITES } from '../src/lib/ai/call-sites';
import { canSeeHubSection } from '../src/lib/dev-access';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

// --- parse.ts ---------------------------------------------------------------

const validJson = JSON.stringify({
  canonical_slug: 'Marie Curie 1867',
  name: 'Marie Curie',
  era_title: 'Belle Époque Paris',
  type: 'historical',
  teaser: 'Handled radioactive material for years before anyone knew to worry.',
  // "Watcher Energy:" — no leading "The", matching every reference sample
  // and every shipped legend (wave28), NOT archetype_defs.formal_name's
  // stored form ("The Watcher"). This drove the review-round-2 bug: an
  // earlier version of this fixture used "The Watcher Energy:", which
  // masked a real mismatch between the prompt's instruction and its own
  // few-shot examples.
  full_story:
    'Handled radioactive material for years before anyone knew to worry. She carried vials of radium in her pockets, kept notebooks that are still too contaminated to read today.\n\nWatcher Energy: curiosity outweighs caution. The pull to keep investigating past the point of comfort isn\'t recklessness — it\'s the same drive that won her two Nobel Prizes.',
});
const parsed = parseLegendCandidate(validJson);
assert.ok(parsed, 'a well-formed candidate parses');
assert.equal(parsed?.canonicalSlug, 'marie-curie-1867', 'slugifies (lowercase, spaces to hyphens)');
assert.equal(parsed?.type, 'historical');
ok('parseLegendCandidate accepts a well-formed candidate and slugifies canonical_slug');

assert.equal(parseLegendCandidate('not json'), null);
assert.equal(parseLegendCandidate(JSON.stringify({ name: 'X' })), null, 'missing required fields rejected');
assert.equal(
  parseLegendCandidate(JSON.stringify({ ...JSON.parse(validJson), type: 'fictional' })),
  null,
  'invalid type rejected',
);
assert.equal(
  parseLegendCandidate(JSON.stringify({ ...JSON.parse(validJson), full_story: 'no energy line here' })),
  null,
  'full_story missing the required "Energy:" line is rejected',
);
ok('parseLegendCandidate rejects malformed JSON, missing fields, bad type, and a story missing the Energy: line');

assert.equal(energyLineName('The Watcher'), 'Watcher');
assert.equal(energyLineName('The Front-Liner'), 'Front-Liner');
assert.equal(energyLineName('Athena'), 'Athena', 'a formal_name with no leading "The" passes through unchanged');
ok('energyLineName strips a leading "The " (case-insensitive) and is a no-op otherwise — archetype_defs.formal_name always has it (wave26), but this must not assume so');

// The caller (generate.ts) must pass the TRIMMED name — this is the exact
// bug found in the second review round: an earlier version compared against
// the untrimmed formal_name ("The Watcher"), which no reference sample or
// shipped legend ever uses in the Energy line, so a genuinely correct
// response was rejected and a day's quota was burned for nothing.
assert.ok(
  parseLegendCandidate(validJson, energyLineName('The Watcher')) !== null,
  'a story whose Energy: line names the expected archetype (trimmed form) parses clean',
);
assert.equal(
  parseLegendCandidate(validJson, energyLineName('The Architect')),
  null,
  'a story whose Energy: line names a DIFFERENT archetype than requested is rejected',
);
assert.ok(
  parseLegendCandidate(validJson) !== null,
  'omitting expectedArchetypeName keeps the original permissive behavior',
);
ok('parseLegendCandidate\'s expectedArchetypeName guard rejects a mismatched archetype and stays permissive when omitted — tested against the trimmed form the app actually produces');

// --- prompt.ts ---------------------------------------------------------------

const prompt = buildLegendCandidatePrompt({ formalName: 'The Watcher', traitAxis: 'openness:high, extraversion:low' });
assert.match(prompt, /"Watcher Energy:" on its own line/, 'prompt instruction must use the TRIMMED name, matching its own few-shot examples');
assert.doesNotMatch(prompt, /"The Watcher Energy:" on its own line/, 'must never instruct the untrimmed form — that contradicts every reference example in the same prompt');
assert.match(prompt, /hard cap ~12 words/);
assert.match(prompt, /Da Vinci kept notebooks of unfinished machines/, 'reuses the approved reference sample verbatim, not a paraphrase');
assert.match(prompt, /never labels them/);
ok('buildLegendCandidatePrompt embeds the archetype name in the Energy-line rule and the four approved reference samples verbatim');

// --- call-sites.ts ------------------------------------------------------------

assert.equal(LEGEND_GENERATION_META.personalized, false);
assert.equal(LEGEND_GENERATION_META.cohortShareable, true);
assert.equal(LEGEND_GENERATION_META.bucketShareable, true);
assert.ok(AI_CALL_SITES.some((site) => site.meta === LEGEND_GENERATION_META));
ok('LEGEND_GENERATION_META is declared not-personalized (no user-specific input) and registered in AI_CALL_SITES');

const aiProviderCheckSrc = read('scripts/ai-provider-check.ts');
assert.match(aiProviderCheckSrc, /'src\/lib\/legends\/generate\.ts'/);
ok('generate.ts is registered in ai-provider-check.ts\'s METADATA_CALL_FILES allowlist');

const generateSrc = read('src/lib/legends/generate.ts');
assert.match(
  generateSrc,
  /parseLegendCandidate\(text, energyLineName\(archetype\.formalName\)\)/,
  'generate.ts must pass the TRIMMED archetype name to parseLegendCandidate, not the raw formal_name',
);
ok('generate.ts wires energyLineName between the archetype and the parser guard — source-locked so this can\'t silently regress again');

// --- migration ----------------------------------------------------------------

const migrationSrc = read('supabase/migrations/wave55_legend_candidates.sql');
assert.match(migrationSrc, /add column if not exists source text not null default 'authored'/);
assert.match(migrationSrc, /check \(source in \('authored', 'ai'\)\)/);
assert.match(migrationSrc, /create function public\.claim_legend_generation\(\)/);
assert.match(migrationSrc, /create function public\.insert_legend_candidate\(/);
assert.match(migrationSrc, /create function public\.approve_legend_variant\(p_variant_id uuid\)/);
assert.match(migrationSrc, /create function public\.reject_legend_variant\(p_variant_id uuid\)/);
ok('wave55 migration defines the source column and all four new RPCs');

// approve/reject must both be root-gated and never touch an already-approved row via reject.
const approveBody = migrationSrc.slice(
  migrationSrc.indexOf('create function public.approve_legend_variant'),
  migrationSrc.indexOf('$$;', migrationSrc.indexOf('create function public.approve_legend_variant')),
);
assert.match(approveBody, /perform public\.require_root\(\);/);
const rejectBody = migrationSrc.slice(
  migrationSrc.indexOf('create function public.reject_legend_variant'),
  migrationSrc.indexOf('$$;', migrationSrc.indexOf('create function public.reject_legend_variant')),
);
assert.match(rejectBody, /perform public\.require_root\(\);/);
assert.match(rejectBody, /where id = p_variant_id and fact_checked = false/, 'reject must never delete an already-approved (live) row');
ok('approve_legend_variant and reject_legend_variant are both root-gated; reject refuses to touch a live row');

// insert_legend_candidate must always force fact_checked=false and source='ai' — never take these from the caller.
const insertBody = migrationSrc.slice(
  migrationSrc.indexOf('create function public.insert_legend_candidate'),
  migrationSrc.indexOf('$$;', migrationSrc.indexOf('create function public.insert_legend_candidate')),
);
assert.match(insertBody, /false, 'ai'\)/, 'insert_legend_candidate hardcodes fact_checked=false, source=ai — never caller-supplied');
assert.doesNotMatch(insertBody, /p_figure->>'fact_checked'|p_variant->>'fact_checked'|p_variant->>'source'/, 'fact_checked/source must never be readable from caller input');
ok('insert_legend_candidate always forces fact_checked=false/source=ai — a candidate can never be inserted pre-approved');

for (const fn of [
  'revoke all on function public.claim_legend_generation() from public, anon;',
  "revoke all on function public.insert_legend_candidate(jsonb, jsonb, text) from public, anon;",
  'revoke all on function public.approve_legend_variant(uuid) from public, anon;',
  'revoke all on function public.reject_legend_variant(uuid) from public, anon;',
]) {
  assert.ok(migrationSrc.includes(fn), `missing revoke: ${fn}`);
}
ok('all four new RPCs revoke from public/anon (authenticated-only, matching this repo\'s RPC convention)');

// --- wave56 fix migration -------------------------------------------------------
// Found in review: wave55's insert_legend_candidate had no require_root() at all
// — any authenticated user could call it directly (bypassing the dev-lab UI) and
// plant an attacker-authored candidate into the root review queue. wave56 adds
// require_root() to it and to claim_legend_generation, and tightens approve to
// refuse an already-approved row (matching reject's existing guard).

const fixSrc = read('supabase/migrations/wave56_legend_candidates_fixes.sql');

const fixClaimBody = fixSrc.slice(
  fixSrc.indexOf('create or replace function public.claim_legend_generation'),
  fixSrc.indexOf('$$;', fixSrc.indexOf('create or replace function public.claim_legend_generation')),
);
assert.match(fixClaimBody, /perform public\.require_root\(\);/);

const fixInsertBody = fixSrc.slice(
  fixSrc.indexOf('create or replace function public.insert_legend_candidate'),
  fixSrc.indexOf('$$;', fixSrc.indexOf('create or replace function public.insert_legend_candidate')),
);
assert.match(fixInsertBody, /perform public\.require_root\(\);/, 'insert_legend_candidate must be root-gated — this is the critical fix');
assert.match(fixInsertBody, /false, 'ai'\)/, 'still hardcodes fact_checked=false/source=ai after the fix');

const fixApproveBody = fixSrc.slice(
  fixSrc.indexOf('create or replace function public.approve_legend_variant'),
  fixSrc.indexOf('$$;', fixSrc.indexOf('create or replace function public.approve_legend_variant')),
);
assert.match(fixApproveBody, /where id = p_variant_id and fact_checked = false/, 'approve must refuse to re-approve an already-approved row');
ok('wave56 adds require_root() to claim_legend_generation and insert_legend_candidate (closing the review-queue-poisoning bug), and tightens approve to refuse an already-approved row');

// --- client wiring --------------------------------------------------------------

const storeSrc = read('src/lib/legends/generate-store.ts');
assert.match(storeSrc, /supabase\.rpc\('claim_legend_generation'\)/);
assert.match(storeSrc, /supabase\.rpc\('insert_legend_candidate', \{/);
assert.match(storeSrc, /supabase\.rpc\('approve_legend_variant', \{ p_variant_id: variantId \}\)/);
assert.match(storeSrc, /supabase\.rpc\('reject_legend_variant', \{ p_variant_id: variantId \}\)/);
assert.match(storeSrc, /\.eq\('source', 'ai'\)/);
assert.match(storeSrc, /\.eq\('fact_checked', false\)/);
ok('generate-store.ts wraps all four RPCs and the pending-candidates fetch filters to source=ai/fact_checked=false');

const devAccessSrc = read('src/lib/dev-access.ts');
assert.match(devAccessSrc, /\| 'legends'/);
assert.equal(canSeeHubSection('legends', { isDev: true, isRoot: false, capabilities: [] }), false, '__DEV__ alone must not unlock the legends review section');
assert.equal(canSeeHubSection('legends', { isDev: false, isRoot: true, capabilities: [] }), true, 'root unlocks it');
ok('legends hub section is root-only, same as access/grants/profiles — not unlocked by __DEV__ alone');

const devLabSrc = read('src/app/dev-lab.tsx');
assert.match(devLabSrc, /function LegendCandidatesReview/);
assert.match(devLabSrc, /canSeeHubSection\('legends', gate\)/);
assert.match(devLabSrc, /claimLegendGeneration\(\)/);
assert.match(devLabSrc, /generateLegendCandidate\(/);
assert.match(devLabSrc, /insertLegendCandidate\(candidate, archetype\.id\)/);
assert.match(devLabSrc, /approveLegendVariant\(/);
assert.match(devLabSrc, /rejectLegendVariant\(/);
ok('dev-lab.tsx renders LegendCandidatesReview behind the legends hub-section gate and wires all four actions');

console.log(`\n${passed} legend-candidates checks passed`);
