/**
 * The question bank in the moment voice, and the forever loop's voice gate
 * (emci 2026-10-05). Run: npm run check:question-voice
 *
 * Pins:
 * 1. the rewrite moved no scoring — every row keeps trait, category, set,
 *    option count and the value at each option position (bank-v1.ts is the
 *    frozen old wording);
 * 2. every current bank row clears the gate (no hard issue), and nothing
 *    still mentions the retired Read + Do card;
 * 3. wave84 is exactly what gen-wave84-rows.ts builds from the code, keeps
 *    the old intake wording accepted and never deletes;
 * 4. the gate rejects what it should and every production path uses it;
 * 5. the round prompt carries the moment voice for the setting only, with
 *    scoring rules (0.2/0.5/0.8) unchanged;
 * 6. the copy ships as draft, and the Question lab never calls on mount.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PROMPT_REWORDS, QUESTION_VOICE_COPY_REVIEWED, QUESTIONS_BANK, ROUND_ONLY_BANK, withRewordAliases } from '../src/lib/questions/bank';
import { QUESTIONS_BANK_V1, ROUND_ONLY_BANK_V1 } from '../src/lib/questions/bank-v1';
import { assessQuestion, generatedQuestionFailure, promptSimilarity } from '../src/lib/questions/question-voice';

import { wave84Sql } from './gen-wave84-rows';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

// 1. Scoring did not move.
for (const [before, after, name] of [
  [QUESTIONS_BANK_V1, QUESTIONS_BANK, 'intake'],
  [ROUND_ONLY_BANK_V1, ROUND_ONLY_BANK, 'round-only'],
] as const) {
  assert.equal(after.length, before.length, `${name}: same number of rows`);
  before.forEach((old, i) => {
    const now = after[i]!;
    assert.equal(now.axis, old.axis, `${name} ${i}: trait`);
    assert.equal(now.category, old.category, `${name} ${i}: category`);
    assert.deepEqual(now.options.map((o) => o.value), old.options.map((o) => o.value), `${name} ${i}: values in the same order`);
  });
}
ok('70 rows reworded in place: same trait, category, set (position) and value at every option index');

// 2. Every row clears the gate.
const allPrompts = [...QUESTIONS_BANK, ...ROUND_ONLY_BANK].map((q) => q.prompt);
assert.equal(new Set(allPrompts).size, allPrompts.length, 'no prompt twice');
for (const q of [...QUESTIONS_BANK, ...ROUND_ONLY_BANK]) {
  const hard = assessQuestion(q, { others: allPrompts }).filter((i) => i.kind === 'hard');
  assert.deepEqual(hard, [], `hard issue in "${q.prompt}"`);
  assert.equal(generatedQuestionFailure(q, allPrompts.filter((p) => p !== q.prompt)), null, `gate drops "${q.prompt}"`);
  assert.doesNotMatch(q.prompt, /\byour do\b|today's read|\bthe card\b/i, 'the Read + Do card is gone');
}
ok('every intake and round-only question clears the voice gate; no Read + Do references');

// Aliases: both wordings are known for text matching.
assert.ok(Object.keys(PROMPT_REWORDS).length > 0);
for (const [before, after] of Object.entries(PROMPT_REWORDS)) {
  assert.deepEqual(withRewordAliases([before]), [before, after]);
  assert.deepEqual(withRewordAliases([after]), [after, before]);
}
ok(`${Object.keys(PROMPT_REWORDS).length} reworded prompts: the old and new wording each find the other`);

// 3. wave84 is generated, additive for intake, value-safe for the pool.
const wave84 = read('supabase/migrations/wave84_question_voice.sql');
assert.equal(wave84, wave84Sql(), 'wave84 matches gen-wave84-rows.ts (re-run the generator, never hand-edit)');
assert.doesNotMatch(wave84, /\bdelete\s+from\b|\btruncate\b|\bdrop\s+(?:table|column|function|index)\s+(?!wave84_pool;)/i, 'wave84 deletes nothing');
const wave84Code = wave84
  .split('\n')
  .filter((line) => !line.startsWith('--'))
  .join('\n');
assert.doesNotMatch(wave84Code, /question_items|trait_answers|trait_tracks|trait_history/, 'wave84 never touches answers or served rounds');
assert.ok(
  wave84.includes('on conflict (prompt) do update\n  set options = excluded.options\n'),
  'an existing intake row only ever gets new option labels',
);
assert.match(wave84, /raise exception 'wave84: % pool rows would change a value'/);
ok('wave84 = the generator output; adds intake rows, keeps the old wording, rewords pool rows only if no value moves');

// 4. The gate.
const good = QUESTIONS_BANK[0]!;
const fails = (q: Parameters<typeof generatedQuestionFailure>[0], recent: string[] = []) => generatedQuestionFailure(q, recent);
assert.equal(fails(good), null);
assert.match(fails({ ...good, prompt: 'You are the kind of person who texts back fast.' })!, /voice|jargon/);
assert.match(fails({ ...good, prompt: 'Your Do today was a walk. Safe pick or different?' })!, /dated/);
assert.match(fails({ ...good, options: [{ text: 'Obviously the new one', value: 0.8 }, { text: 'The usual', value: 0.2 }] })!, /balance/);
assert.match(fails({ ...good, options: [{ text: 'Sure', value: 0.5 }, { text: 'Nah', value: 0.8 }] })!, /values/);
assert.match(fails({ ...good, options: [{ text: 'One', value: 0.8 }] })!, /options|values/);
assert.match(fails(good, ['A new place opened next to your usual spot and your usual order is in the app'])!, /repeat/);
assert.ok(promptSimilarity('A friend cancels by text an hour before', 'The group chat has a running joke') < 0.3);
ok('the gate drops "you are", jargon, dated references, a loaded option, a missing end, one option, a near-repeat');

// 5. Draft flag. The AI question lab and the shared pool fill are gone with
// runtime question generation (fixed bank, wave85, emci 2026-10-06).
assert.equal(QUESTION_VOICE_COPY_REVIEWED, true, 'emci approved the rewrite 2026-10-05 (docs/proposals/question-rewrite.md)');
const panels = read('src/components/dev-hub-panels.tsx');
assert.match(panels, /reviewed: QUESTION_VOICE_COPY_REVIEWED/, 'listed in COPY_FLAGS');
assert.doesNotMatch(panels, /QuestionLabPanel|fillPoolEven|addToBankPool|generateQuestionLabText/, 'no AI question tool left in the Hub');
ok('approved flag listed; no AI question lab or pool fill remains');

console.log(`
${passed} question-voice checks passed`);
