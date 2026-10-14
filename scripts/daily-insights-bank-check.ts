/**
 * Daily insights banks — copy rules, counts, coverage, tone mix, zero AI.
 * Run: npm run check:daily-insights-bank
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { CATEGORY_DEFS } from '../src/lib/categories';
import {
  CONFLICT_BANK,
  DAILY_INSIGHTS_BANK_VERSION,
  DAILY_INSIGHTS_PROVISIONAL_CATEGORIES,
  DAILY_INSIGHTS_SHOW_PROVISIONAL,
  INSIGHT_LINE_MAX_WORDS,
  INSIGHT_SUB_MAX_WORDS,
  SUPERPOWER_BANK,
  TRY_TODAY_BANK,
  WHY_LINE_MAX_WORDS,
  duplicateSentences,
  mixedApostrophes,
  titleViolation,
  validateInsightLine,
  whyLineFor,
} from '../src/lib/daily-insights';
import { STORY_MAP_CATEGORY_LEAN_TODO } from '../src/lib/story-v3/lean-phrases';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:daily-insights-bank'], 'tsx ./scripts/daily-insights-bank-check.ts');
ok('wired as check:daily-insights-bank');

assert.equal(DAILY_INSIGHTS_BANK_VERSION, 1);
assert.equal(DAILY_INSIGHTS_SHOW_PROVISIONAL, false);
assert.equal(DAILY_INSIGHTS_PROVISIONAL_CATEGORIES, STORY_MAP_CATEGORY_LEAN_TODO);
ok('bank version 1, provisional flag off, provisional list reused from story-v3');

function clean(label: string, text: string, maxWords: number | null) {
  const hits = validateInsightLine(text, { maxWords });
  assert.deepEqual(hits, [], `${label}: ${hits.join(', ')} — "${text}"`);
}

// --- the validator itself catches what it should ----------------------------
assert.ok(validateInsightLine('Text her back.', { maxWords: 20 }).includes('gendered word'));
assert.ok(validateInsightLine('Ask the guy at work.', { maxWords: 20 }).includes('gendered word'));
assert.ok(validateInsightLine('Your attachment style shows.', { maxWords: 20 }).includes('framework term'));
assert.ok(validateInsightLine('You are gifted.', { maxWords: 20 }).includes('ability claim'));
assert.ok(validateInsightLine('Book a therapy slot.', { maxWords: 20 }).includes('clinical word'));
assert.ok(validateInsightLine('Laugh till you die.', { maxWords: 20 }).includes('banned dark word'));
assert.ok(validateInsightLine('Text your ex.', { maxWords: 20 }).includes('safety word'));
assert.ok(validateInsightLine('Go! Now!', { maxWords: 20 }).includes('more than one exclamation mark'));
assert.ok(validateInsightLine('one two three four five six', { maxWords: 5 })[0]?.startsWith('over 5 words'));
assert.deepEqual(validateInsightLine('Deadlines make you better.', { maxWords: 20 }), []);
ok('validator flags gender / framework / ability / clinical / dark / safety / ! / length');

// --- Phase 1: Try this today -------------------------------------------------
assert.equal(TRY_TODAY_BANK.length, 44);
const ids = new Set(TRY_TODAY_BANK.map((row) => row.id));
assert.equal(ids.size, 44, 'try-today ids are unique');
for (const def of CATEGORY_DEFS) {
  for (const lean of ['high', 'low'] as const) {
    for (const mode of ['strength', 'stretch'] as const) {
      const hits = TRY_TODAY_BANK.filter(
        (row) => row.categoryId === def.id && row.lean === lean && row.mode === mode,
      );
      assert.equal(hits.length, 1, `${def.id}.${lean}.${mode} needs exactly one line`);
      assert.equal(hits[0]!.id, `${def.id}.${lean}.${mode}`);
    }
  }
}
ok('44 lines: exactly one per category × lean × mode, ids match');

for (const row of TRY_TODAY_BANK) {
  clean(row.id, row.text, INSIGHT_LINE_MAX_WORDS);
  assert.equal(row.setting, 'any', `${row.id} setting`);
  const shouldBeProvisional = STORY_MAP_CATEGORY_LEAN_TODO.includes(row.categoryId);
  assert.equal(!!row.provisional, shouldBeProvisional, `${row.id} provisional flag`);
}
ok('every try-today line passes the copy rules; map-category lines are provisional');

const light = TRY_TODAY_BANK.filter((row) => row.tone === 'light').length;
const dark = TRY_TODAY_BANK.filter((row) => row.tone === 'dark').length;
assert.ok(light / TRY_TODAY_BANK.length >= 0.3, `light ${light}/44 under 30%`);
assert.ok(dark / TRY_TODAY_BANK.length >= 0.1, `dark ${dark}/44 under 10%`);
ok(`tone mix: ${light} light, ${dark} dark of 44 (≥30% / ≥10%)`);

for (const def of CATEGORY_DEFS) {
  for (const lean of ['high', 'low'] as const) {
    clean(`why ${def.id}.${lean}`, whyLineFor(def.id, lean), WHY_LINE_MAX_WORDS);
  }
}
ok('every "Why you" line passes the rules (cap 22 words)');

// --- Phase 2: Superpower / Kryptonite ---------------------------------------
const bars = CATEGORY_DEFS.filter((def) => def.shape === 'bar');
assert.equal(bars.length, 8);
assert.equal(SUPERPOWER_BANK.length, 16);
for (const def of bars) {
  for (const kind of ['superpower', 'kryptonite'] as const) {
    const hits = SUPERPOWER_BANK.filter((row) => row.categoryId === def.id && row.kind === kind);
    assert.equal(hits.length, 1, `${def.id} ${kind}`);
  }
}
for (const row of SUPERPOWER_BANK) {
  const def = CATEGORY_DEFS.find((d) => d.id === row.categoryId);
  assert.equal(def?.shape, 'bar', `${row.categoryId} is not a bar`);
  assert.ok(!row.provisional, `${row.categoryId} superpower row must not be provisional`);
  const label = `${row.categoryId}.${row.kind}`;
  clean(`${label} text`, row.text, INSIGHT_LINE_MAX_WORDS);
  clean(`${label} tip`, row.tip, INSIGHT_SUB_MAX_WORDS);
  clean(`${label} title`, row.title, null);
  assert.equal(titleViolation(row.title), null, `${label} title: ${titleViolation(row.title)}`);
}
ok('16 rows: both kinds for each of the 8 bars, no map category, all rules pass');

// --- Phase 3: Conflict style -------------------------------------------------
assert.equal(CONFLICT_BANK.length, 5);
assert.deepEqual(
  [...new Set(CONFLICT_BANK.map((row) => row.id))].sort(),
  ['deal_maker', 'peacekeeper', 'quiet_exit', 'straight_shooter', 'team_fixer'],
);
for (const row of CONFLICT_BANK) {
  clean(`${row.id} text`, row.text, INSIGHT_LINE_MAX_WORDS);
  clean(`${row.id} strength`, row.strength, INSIGHT_SUB_MAX_WORDS);
  clean(`${row.id} watchOut`, row.watchOut, INSIGHT_SUB_MAX_WORDS);
  clean(`${row.id} tryLine`, row.tryLine, INSIGHT_SUB_MAX_WORDS);
  clean(`${row.id} title`, row.title, null);
  assert.equal(titleViolation(row.title), null, `${row.id} title: ${titleViolation(row.title)}`);
}
ok('5 conflict styles, one per id, every field passes the rules');

// --- no repeated tag phrase, one apostrophe style per bank -------------------
const banks: Record<string, string[]> = {
  'try-today': TRY_TODAY_BANK.map((row) => row.text),
  superpower: SUPERPOWER_BANK.flatMap((row) => [row.title, row.text, row.tip]),
  conflict: CONFLICT_BANK.flatMap((row) => [row.title, row.text, row.strength, row.watchOut, row.tryLine]),
};
for (const [name, texts] of Object.entries(banks)) {
  assert.deepEqual(duplicateSentences(texts), [], `${name} repeats a sentence`);
  assert.equal(mixedApostrophes(texts), false, `${name} mixes apostrophe styles`);
}
ok('no 2+ word sentence repeats inside a bank; one apostrophe style per bank');

// --- zero runtime AI in the new folders --------------------------------------
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const scanned = [
  ...walk(resolve(root, 'src/lib/daily-insights')),
  ...walk(resolve(root, 'src/components/daily-insights')),
  resolve(root, 'src/hooks/use-try-today.ts'),
];
const FORBIDDEN: { name: string; re: RegExp }[] = [
  { name: 'fetch(', re: /\bfetch\(/ },
  { name: 'supabase.functions', re: /supabase\.functions/ },
  { name: 'supabase import', re: /from '@\/lib\/supabase'/ },
  { name: 'ai-library import', re: /ai-library/ },
  { name: 'generateText', re: /\bgenerateText\b/ },
  { name: 'vendor name', re: /\b(openai|anthropic|xai)\b/i },
];
for (const file of scanned) {
  const src = readFileSync(file, 'utf8');
  for (const rule of FORBIDDEN) {
    assert.ok(!rule.re.test(src), `${file} contains ${rule.name}`);
  }
}
ok(`${scanned.length} daily-insights files: no fetch, Supabase, AI library or vendor names`);

console.log(`\n${passed} daily-insights-bank checks passed`);
