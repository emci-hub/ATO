/**
 * The fixed question bank (wave85, emci 2026-10-06). Run: npm run check:question-bank
 *
 * 1. The bank: 400 active = 25 x 16, stable ids, tags, balance, voice gate;
 *    retired rows (wave100) kept with their original text, each replaced by
 *    one new id with the same trait, setting, direction and values.
 * 2. The intake inside it: slots 1-3 are today's 48, word for word.
 * 3. The server copy: wave85b is exactly the generator's output.
 * 4. Serving: 16 per set, one per trait, no repeats, 25 sets, then done.
 * 5. Stages, firm, retest picks.
 * 6. Retest replaces answers and really moves the trait.
 * 7. Start Fresh: snapshot first, hard delete after, hold to confirm.
 * 8. The premium gate is present and off. "This isn't me" is a flag only.
 * 9. No runtime AI and no user text anywhere in the question path.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { QUESTIONS_BANK } from '../src/lib/questions/bank';
import {
  BANK_BY_TRAIT,
  BANK_PER_TRAIT,
  BANK_ROWS_BY_TRAIT,
  BANK_SETTINGS,
  QUESTION_BANK,
  QUESTION_BANK_ALL,
  RETIRED_BANK_QUESTIONS,
  bankQuestionById,
  type BankQuestion,
} from '../src/lib/questions/bank/index';
import {
  BANK_SET_COUNT,
  answeredOnTrait,
  bankProgressFrom,
  isTraitFirm,
  pickBankSet,
  changeRecommendations,
  stageFor,
} from '../src/lib/questions/bank-sets';
import { PREMIUM_BANK_PRICE, isPremiumGated } from '../src/lib/questions/premium-gate';
import { generatedQuestionFailure } from '../src/lib/questions/question-voice';
import { applyEwmaAnswer, replayTraitAnswers, type TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';

import {
  WAVE85B_ROWS,
  WAVE99_IDS,
  WAVE99_SCENARIO_HELD,
  WAVE100_NEW_ROWS,
  WAVE100_RETIRED_ROWS,
  legacyPromptsFor,
  wave100RowsSql,
  wave85SeedSql,
  wave99WordingSql,
} from './gen-wave85-bank';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

// 1. The bank -----------------------------------------------------------------
// 400 ACTIVE (served) + every retired row kept forever with its original text.
assert.equal(QUESTION_BANK.length, 400, '400 active questions');
assert.equal(new Set(QUESTION_BANK.map((q) => q.id)).size, 400, 'ids unique');
assert.equal(QUESTION_BANK_ALL.length, 400 + RETIRED_BANK_QUESTIONS.length, '400 active + the retired rows, nothing else');
assert.equal(new Set(QUESTION_BANK_ALL.map((q) => q.id)).size, QUESTION_BANK_ALL.length, 'ids unique across active and retired');
assert.ok(QUESTION_BANK.every((q) => !q.retired), 'QUESTION_BANK holds active rows only');
for (const axis of TRAIT_AXES) {
  const all = BANK_ROWS_BY_TRAIT[axis];
  all.forEach((row, i) => {
    assert.equal(row.axis, axis);
    // Ids are never renumbered, reused or dropped: 01, 02 … in file order, retired rows in place.
    assert.equal(row.id, `${axis}_${String(i + 1).padStart(2, '0')}`, `${axis}: ids run 01..${all.length} in file order`);
    assert.ok(row.options.length === 2 || row.options.length === 3, `${row.id}: 2-3 options`);
    const values = row.options.map((o) => o.value).sort().join(',');
    assert.ok(values === '0.2,0.5,0.8' || values === '0.2,0.8', `${row.id}: values ${values}`);
    assert.ok(BANK_SETTINGS.includes(row.setting), `${row.id}: setting`);
  });
  const rows = BANK_BY_TRAIT[axis];
  assert.equal(rows.length, BANK_PER_TRAIT, `${axis}: 25 active`);
  for (const setting of BANK_SETTINGS) {
    assert.ok(rows.filter((r) => r.setting === setting).length >= 2, `${axis}: at least two ${setting} questions`);
  }
  assert.ok(rows.filter((r) => r.unflattering === 'high').length >= 4, `${axis}: some questions where high is the less flattering answer`);
  assert.ok(rows.filter((r) => r.unflattering === 'low').length >= 4, `${axis}: some where low is`);
  const threeOpt = rows.filter((r) => r.options.length === 3);
  for (const pos of [0, 1, 2]) {
    assert.ok(
      threeOpt.filter((r) => r.options.findIndex((o) => o.value === 0.8) === pos).length >= 3,
      `${axis}: the high option sits in position ${pos + 1} at least 3 times`,
    );
  }
}
ok('400 active questions: 25 per trait, ids <trait>_01.. in order (retired rows kept in place), 2-3 options at 0.2/0.5/0.8, every setting twice, both sides unflattering, high option position varies');

// Retired rows (wave100, emci 2026-10-20): each is replaced by exactly one NEW
// id in the same trait, with the same setting, direction (which end is less
// flattering), value scheme and high-option position, so balance never shifts.
const highAt = (row: BankQuestion) => row.options.findIndex((o) => o.value === 0.8);
const valueScheme = (row: BankQuestion) => row.options.map((o) => o.value).sort().join(',');
const replacements = new Set<string>();
for (const row of RETIRED_BANK_QUESTIONS) {
  const next = bankQuestionById(row.retired!.replacedBy);
  assert.ok(next, `${row.id}: replacement ${row.retired!.replacedBy} exists`);
  assert.ok(!next.retired, `${row.id}: replacement is active`);
  assert.equal(next.axis, row.axis, `${row.id}: replacement keeps the trait`);
  assert.equal(next.setting, row.setting, `${row.id}: replacement keeps the setting`);
  assert.equal(next.unflattering, row.unflattering, `${row.id}: replacement keeps the direction`);
  assert.equal(valueScheme(next), valueScheme(row), `${row.id}: replacement keeps the value scheme`);
  assert.equal(highAt(next), highAt(row), `${row.id}: replacement keeps the high option position`);
  assert.ok(Number(next.id.slice(-2)) > 25, `${row.id}: replacement is a new id, never a reused one`);
  assert.ok(!row.intakeSlot, `${row.id}: intake questions are never retired`);
  assert.ok(!replacements.has(next.id), `${next.id} replaces only one row`);
  replacements.add(next.id);
}
assert.deepEqual(
  [...replacements].sort(),
  QUESTION_BANK_ALL.filter((q) => Number(q.id.slice(-2)) > 25).map((q) => q.id).sort(),
  'every id after 25 is the replacement of a retired row',
);
ok(`${RETIRED_BANK_QUESTIONS.length} retired rows, each replaced by one new id with the same trait, setting, direction, values and high-option position`);

const allPrompts = QUESTION_BANK_ALL.map((q) => q.prompt);
assert.equal(new Set(allPrompts).size, QUESTION_BANK_ALL.length, 'no prompt twice, retired rows included (a new scene never repeats the old stem)');
for (const row of QUESTION_BANK) {
  const others = BANK_BY_TRAIT[row.axis].map((q) => q.prompt).filter((p) => p !== row.prompt);
  assert.equal(generatedQuestionFailure(row, others), null, `${row.id} fails the voice gate`);
}
for (const row of RETIRED_BANK_QUESTIONS) {
  assert.equal(generatedQuestionFailure(row), null, `${row.id} (retired) fails the voice gate`);
}
ok('every question passes the voice gate (no "you are", jargon, loaded option, missing end, near-repeat within its trait)');

// 2. The intake inside the bank -----------------------------------------------
for (const axis of TRAIT_AXES) {
  const intake = QUESTIONS_BANK.filter((d) => d.axis === axis);
  for (const slot of [1, 2, 3] as const) {
    const rows = BANK_BY_TRAIT[axis].filter((r) => r.intakeSlot === slot);
    assert.equal(rows.length, 1, `${axis}: one intake slot ${slot}`);
    const draft = intake[slot - 1]!;
    assert.equal(rows[0]!.prompt, draft.prompt, `${axis} slot ${slot}: same words as the approved intake`);
    assert.deepEqual(rows[0]!.options, draft.options, `${axis} slot ${slot}: same options, same order`);
    assert.ok(legacyPromptsFor(rows[0]!).includes(draft.prompt), `${axis} slot ${slot}: its old answers count`);
  }
}
ok("intake slots 1-3 are today's approved 48, word for word, and carry their old wordings so earlier answers count");

// 3. The server copy -------------------------------------------------------------
const seed = read('supabase/migrations/wave85b_question_bank_seed.sql');
// wave85b is frozen as applied (2026-10-06). Every line matches the generator
// except the rows wave99 rewords, and those must really differ (a listed id
// that never changed, or a changed id that is not listed, both fail).
const seedLines = seed.split('\n');
const genLines = wave85SeedSql().replace(/\r\n/g, '\n').split('\n');
assert.equal(seedLines.length, genLines.length, 'wave85b has the generator shape (re-run the generator, never hand-edit)');
const rowIdOf = (line: string) => line.match(/^  \('([a-z_]+_\d\d)', /)?.[1] ?? null;
// wave85b is applied: pin its exact bytes (line endings normalised) so no edit, to any row, goes unnoticed.
const WAVE85B_SHA256 = '89288808fe4c15ac3d883efa0c71eb24a999698744c1fbe7540b5c2c39ef28d8';
assert.equal(
  createHash('sha256').update(seed).digest('hex'),
  WAVE85B_SHA256,
  'wave85b is applied to the live project and must never change: put new wording in a new migration (WAVE99_IDS)',
);
// Everything except the prompt and option label text of a row line.
const rowShape = (line: string) => {
  const m = line.match(/^  \('([a-z_]+_\d\d)', '([a-z_]+)', '([a-z_]+)', '([a-z_]+)', (null|\d+), '.*', '(\[\{.*\}\])'::jsonb/);
  assert.ok(m, `cannot parse row: ${line.slice(0, 60)}`);
  const options = JSON.parse(m[6]!.replace(/''/g, "'")) as { value: number }[];
  return { id: m[1], axis: m[2], setting: m[3], unflattering: m[4], intakeSlot: m[5], values: options.map((o) => o.value) };
};
const wave99Lines = new Map<string, string>();
for (const line of read('supabase/migrations/wave99_question_wording.sql').split('\n')) {
  const id = rowIdOf(line);
  if (id) wave99Lines.set(id, line);
}
assert.deepEqual([...wave99Lines.keys()].sort(), [...WAVE99_IDS].sort(), 'wave99 rewrites exactly the WAVE99 ids');
const drifted: string[] = [];
genLines.forEach((line, i) => {
  const id = rowIdOf(line);
  assert.equal(rowIdOf(seedLines[i]!), id, `wave85b line ${i + 1}: same row order as the generator`);
  if (id && WAVE99_IDS.includes(id)) {
    assert.notEqual(seedLines[i], line, `${id} is in WAVE99_IDS but its wording never changed`);
    drifted.push(id);
    const was = rowShape(seedLines[i]!);
    assert.deepEqual(rowShape(line), was, `${id}: only wording may change (id, trait, setting, unflattering, intake slot, option values and order stay as in wave85b)`);
    assert.deepEqual(rowShape(wave99Lines.get(id)!), was, `${id}: wave99 changes only wording against wave85b`);
  } else {
    assert.equal(seedLines[i], line, `wave85b line ${i + 1}${id ? ` (${id})` : ''} drifted from the code: reword it in a new migration (WAVE99_IDS), never edit wave85b`);
  }
});
assert.deepEqual([...drifted].sort(), [...WAVE99_IDS].sort(), 'every WAVE99 id is a real bank row');
assert.match(seed, /on conflict \(id\) do update/);
assert.doesNotMatch(seed, /\bdelete\s+from\b|\btruncate\b|trait_answers|trait_tracks/i, 'the seed touches no answer');
const wave99 = read('supabase/migrations/wave99_question_wording.sql');
assert.equal(wave99, wave99WordingSql().replace(/\r\n/g, '\n'), 'wave99 matches gen-wave85-bank.ts --wave99 (re-run the generator, never hand-edit)');
assert.match(wave99, /on conflict \(id\) do update/);
assert.doesNotMatch(wave99, /\bdelete\s+from\b|\btruncate\b|trait_answers|trait_tracks/i, 'the wording migration touches no answer');
assert.ok(WAVE99_IDS.every((id) => !bankQuestionById(id)?.intakeSlot), 'wave99 rewords no approved intake question');
// SCENARIO changes (a new situation, or options that now mean something else)
// are never written in place: existing answers must keep showing the question
// they answered (emci 2026-10-19). Since wave100 they are retired (text kept,
// never served) and their new scene is a new id.
assert.equal(new Set(WAVE99_SCENARIO_HELD).size, WAVE99_SCENARIO_HELD.length, 'held ids are unique');
for (const id of WAVE99_SCENARIO_HELD) {
  assert.ok(bankQuestionById(id), `${id}: a real bank row`);
  assert.ok(bankQuestionById(id)!.retired, `${id}: a held SCENARIO row is retired in wave100`);
  assert.ok(!WAVE99_IDS.includes(id), `${id} is a SCENARIO change: never reword it in place (WAVE99_IDS)`);
  assert.ok(!wave99Lines.has(id), `${id}: wave99 must not touch a held SCENARIO row`);
  const i = genLines.findIndex((line) => rowIdOf(line) === id);
  assert.equal(genLines[i], seedLines[i], `${id}: keeps its original wave85b question and options word for word`);
}
// Every retired row keeps its wave85b text word for word (the loop above
// already compares every non-WAVE99 line; a retired row may never be a WAVE99 one).
for (const row of RETIRED_BANK_QUESTIONS) {
  assert.ok(!WAVE99_IDS.includes(row.id), `${row.id}: a retired row is never reworded`);
  assert.ok(WAVE85B_ROWS.includes(row), `${row.id}: retired rows are wave85b rows`);
}
assert.equal(WAVE85B_ROWS.length, 400, 'wave85b holds ids 01-25 of every trait');
// The retire list is pinned: the 15 held SCENARIO rows plus the privacy audit
// (emci 2026-10-20: keeping accounts private, money separate, work and friends
// apart, or meeting someone from online in public is not emotional distance).
const PRIVACY_RETIRED = ['attachment_avoidance_16', 'attachment_avoidance_24', 'attachment_avoidance_25', 'relatedness_15'];
assert.deepEqual(
  RETIRED_BANK_QUESTIONS.map((q) => q.id).sort(),
  [...WAVE99_SCENARIO_HELD, ...PRIVACY_RETIRED].sort(),
  'retired = the held SCENARIO rows + the privacy-audit rows',
);
// Location sharing is a privacy boundary, not distance (emci 2026-10-19). The
// only bank row about it is the original attachment_avoidance_09, now retired;
// no active row may score sharing locations.
const mentionsLocation = (q: BankQuestion) =>
  /\blocations?\b|find my|track(ing)? (me|you|your)|where you are/i.test([q.prompt, ...q.options.map((o) => o.text)].join(' '));
assert.deepEqual(QUESTION_BANK_ALL.filter(mentionsLocation).map((q) => q.id), ['attachment_avoidance_09'], 'only the retired original mentions location sharing');
assert.deepEqual(QUESTION_BANK.filter(mentionsLocation).map((q) => q.id), [], 'no active question mentions location sharing');
// No active answer is a privacy, money or safety boundary (it would score that
// boundary as distance, or as less need for people).
const BOUNDARY_OPTION = /\b(private|privacy|separate|apart|password|passcode|somewhere public|in public|joint account)\b/i;
const boundaryRows = QUESTION_BANK.filter((q) => q.options.some((o) => BOUNDARY_OPTION.test(o.text))).map((q) => q.id);
assert.deepEqual(boundaryRows, [], `no active option is a privacy/safety boundary: ${boundaryRows.join(', ')}`);
ok('wave85b is unchanged as applied except the rows wave99 rewords; wave99 is exactly the generator output for those rows; SCENARIO and privacy rows are retired with their original question; no active location-sharing or boundary answer');

// wave100b: the new rows and the retirements, generated.
const wave100b = read('supabase/migrations/wave100b_question_retire_rows.sql');
assert.equal(wave100b, wave100RowsSql().replace(/\r\n/g, '\n'), 'wave100b matches gen-wave85-bank.ts --wave100 (re-run the generator, never hand-edit)');
const wave100bInserted = wave100b.split('\n').map(rowIdOf).filter((id): id is string => id !== null);
assert.deepEqual(wave100bInserted, WAVE100_NEW_ROWS.map((q) => q.id), 'wave100b inserts exactly the new ids');
assert.ok(wave100bInserted.every((id) => Number(id.slice(-2)) > 25), 'wave100b never rewrites a wave85b row');
for (const row of WAVE100_RETIRED_ROWS) {
  assert.ok(wave100b.includes(`'${row.id}'`), `wave100b retires ${row.id}`);
}
assert.match(wave100b, /update public\.question_bank\n   set retired_at = now\(\), updated_at = now\(\)\n where retired_at is null\n   and id in \(/);
assert.match(wave100b, /raise exception 'wave100b: each trait needs 25 active questions, got %'/, 'the file rolls back unless every trait has 25 active');
assert.doesNotMatch(wave100b, /\bdelete\s+from\b|\btruncate\b|trait_answers|trait_tracks|set prompt|set options/i, 'wave100b deletes nothing, touches no answer and rewords no row');
ok(`wave100b is the generator output: ${WAVE100_NEW_ROWS.length} new ids inserted, ${WAVE100_RETIRED_ROWS.length} rows retired, nothing deleted or reworded, 25 active per trait enforced`);
const sql = read('supabase/migrations/wave85_fixed_question_bank.sql');
assert.match(sql, /^-- APPLIED 2026-10-06 to the live project/m, 'records that it is applied');
assert.match(sql, /create table if not exists public\.question_bank \(\n  id text primary key/, 'the bank is its own table keyed by id');
assert.match(sql, /revoke all on table public\.question_bank from public, anon, authenticated;/, 'no client reads or writes the bank');
assert.doesNotMatch(sql, /delete from public\.question_bank\b/, 'nothing deletes bank rows');
ok('the server bank is generated from the trait files, upserts on id, touches no answer, and is closed to clients');

// The server validates question + option and scores from its own copy.
const answerFn = sql.slice(sql.indexOf('create or replace function public.answer_bank_item'), sql.indexOf('-- 9. Retest'));
assert.match(answerFn, /select \* into q from public\.question_bank where id = it\.bank_question_id;/);
assert.match(answerFn, /v_opt := q\.options -> p_option_index;/, 'the value comes from question_bank, not the phone');
assert.match(answerFn, /raise exception 'invalid option'/);
assert.match(answerFn, /perform public\._trait_write\(uid, q\.axis, 'self_situation', v_value, 'answer'\);/, 'a normal answer scores through the wave79 core');
assert.match(sql, /create unique index if not exists trait_answers_bank_once\n  on public\.trait_answers \(user_id, question_key\) where kind = 'bank';/, 'one answer per bank question per person');
assert.ok(answerFn.indexOf('perform 1 from public.me where id = uid for update;') < answerFn.indexOf('select * into it from public.question_items'), 'me is locked before the item (no deadlock with start_fresh)');
const roundFn = sql.slice(sql.indexOf('create or replace function public.answer_round_item'), sql.indexOf('-- 14. Start over'));
assert.match(roundFn, /bank_question_id is not null\) then\n    return public\.answer_bank_item\(p_item_id, p_option_index\);/, 'an old bundle answering a bank item goes through answer_bank_item');
ok('answer_bank_item checks the item, the question and the option, and scores with the server value; old bundles cannot double-score a bank item');

// 4. Serving ------------------------------------------------------------------------
const serveFn = sql.slice(sql.indexOf('create or replace function public.serve_bank_set()'), sql.indexOf('-- 7. Recomputing'));
// The live definition after wave100 keeps every serving rule below.
const serveFn100 = read('supabase/migrations/wave100_question_retire.sql');
const serve100 = serveFn100.slice(serveFn100.indexOf('create or replace function public.serve_bank_set()'), serveFn100.indexOf('-- 5. Pre-launch test tool'));
for (const fn of [serveFn, serve100]) {
  assert.match(fn, /select distinct on \(b\.axis\) b\.id, b\.axis, b\.prompt, b\.options/, 'one per trait');
  assert.match(fn, /where b\.id not in \(select question_id from ans\)/, 'only unanswered');
  assert.match(fn, /order by b\.axis, random\(\)/, 'a random pick within each trait');
  assert.match(fn, /\) pick\n    order by random\(\)/, 'random order across traits');
  assert.match(fn, /v_kind := case when v_set <= 3 or v_fresh then 'bank_set' else 'ongoing_round' end;/);
  assert.doesNotMatch(fn, /cooldown|interval/i, 'no cooldown');
  assert.match(fn, /if idx < 16 then\n    for r in[\s\S]*?limit 16 - idx/, 'an uneven account still gets 16');
  assert.match(fn, /if idx = 0 then\n    raise exception 'question bank is empty'/);
  assert.match(fn, /if idx < 16 then\n    update public\.question_packs set kind = 'bank_set' where id = v_pack;/);
}
assert.equal((serve100.match(/b\.retired_at is null/g) ?? []).length, 2, 'wave100 serves only active rows, in both passes');
assert.match(serveFn, /select distinct on \(b\.axis\) b\.id, b\.axis, b\.prompt, b\.options/, 'one per trait');
assert.match(serveFn, /where b\.id not in \(select question_id from ans\)/, 'only unanswered');
assert.match(serveFn, /order by b\.axis, random\(\)/, 'a random pick within each trait');
assert.match(serveFn, /\) pick\n    order by random\(\)/, 'random order across traits');
assert.match(serveFn, /insert into public\.question_items \(pack_id, user_id, sort_index, axis, prompt, options, bank_question_id\)/);
assert.match(serveFn, /v_kind := case when v_set <= 3 or v_fresh then 'bank_set' else 'ongoing_round' end;/, 'sets 4-25 pay like rounds; intake and post-fresh sets do not');
assert.doesNotMatch(serveFn, /cooldown|interval/i, 'no cooldown');

let seededRandom = 42;
const rng = () => {
  seededRandom = (seededRandom * 1103515245 + 12345) % 2147483648;
  return seededRandom / 2147483648;
};
const answered = new Set<string>();
for (let set = 1; set <= BANK_SET_COUNT; set += 1) {
  const progress = bankProgressFrom([...answered]);
  assert.equal(progress.currentSet, set, `set ${set} is next`);
  const picks = pickBankSet(answered, rng);
  assert.equal(picks.length, 16, `set ${set}: 16 questions`);
  assert.equal(new Set(picks.map((q) => q.axis)).size, 16, `set ${set}: one per trait`);
  for (const q of picks) {
    assert.ok(!answered.has(q.id), `set ${set}: ${q.id} repeated`);
    answered.add(q.id);
  }
}
assert.equal(answered.size, 400);
assert.equal(pickBankSet(answered, rng).length, 0, 'nothing left after 25 sets');
assert.equal(bankProgressFrom([...answered]).stage, 'complete');
assert.equal(bankProgressFrom([...answered]).currentSet, null);
// Different people get different orders.
const a = pickBankSet(new Set(), () => 0.1).map((q) => q.id).join();
const b = pickBankSet(new Set(), () => 0.9).map((q) => q.id).join();
assert.notEqual(a, b, 'the pick is random, not fixed');
assert.match(serveFn, /if idx < 16 then\n    for r in[\s\S]*?limit 16 - idx/, 'an uneven account still gets 16 (a second question from traits that have them)');
assert.match(serveFn, /if idx = 0 then\n    raise exception 'question bank is empty'/, 'an empty bank never makes an empty set');
assert.match(serveFn, /if idx < 16 then\n    update public\.question_packs set kind = 'bank_set' where id = v_pack;/, 'a short set never poses as a paying round');
assert.ok([...answered].every((id) => !bankQuestionById(id)!.retired), 'a fresh account is never served a retired question');
ok('25 sets of 16, one per trait, random, no repeats; all 400 answered after set 25 and nothing more is served');

// 4b. Retiring never moves anyone's progress (wave100) -------------------------------
// The phone counts like the server: answered on a trait = min(active rows,
// every row answered on it, retired included).
const originalIds = (axis: TraitAxis, upTo: number) =>
  BANK_ROWS_BY_TRAIT[axis].filter((q) => Number(q.id.slice(-2)) <= upTo).map((q) => q.id);
// Someone who finished all 25 sets before wave100 (their answers include the retired rows).
const finishedBefore = TRAIT_AXES.flatMap((axis) => originalIds(axis, 25));
assert.equal(bankProgressFrom(finishedBefore).stage, 'complete', 'a finished bank stays finished');
assert.equal(bankProgressFrom(finishedBefore).completedSets, 25);
assert.equal(pickBankSet(new Set(finishedBefore), rng).length, 0, 'and nothing new is served to them');
// Someone mid-way (sets 1-10 under the old ids, so some retired answers among them).
const midway = new Set(TRAIT_AXES.flatMap((axis) => originalIds(axis, 10)));
assert.ok(RETIRED_BANK_QUESTIONS.some((q) => midway.has(q.id)), 'the test account answered retired questions');
assert.equal(bankProgressFrom([...midway]).completedSets, 10, 'retired answers still count: progress does not go back');
let extraSets = 0;
while (bankProgressFrom([...midway]).currentSet !== null) {
  const picks = pickBankSet(midway, rng);
  assert.equal(picks.length, 16, 'a full set every time');
  for (const q of picks) {
    assert.ok(!q.retired, `${q.id}: a retired question is never served`);
    assert.ok(!midway.has(q.id), `${q.id} repeated`);
    midway.add(q.id);
  }
  extraSets += 1;
  assert.ok(extraSets <= 15, 'never more sets than they had left');
}
assert.equal(extraSets, 15, '15 sets left after set 10, retirement or not: progress does not go forward either');
for (const axis of TRAIT_AXES) {
  const onTrait = BANK_ROWS_BY_TRAIT[axis].filter((q) => midway.has(q.id)).length;
  assert.equal(onTrait, 25, `${axis}: exactly 25 answers in the end, never 26`);
  assert.equal(answeredOnTrait(axis, midway), 25);
}
ok('retiring keeps progress where it was: a finished bank stays finished, a half-done one has the same sets left, retired answers count, nothing past 25 per trait');

// 4c. The server side of retiring (wave100) -------------------------------------------
// Every function wave100 replaces is its current definition word for word,
// plus only the retired filter; grants are the same as live.
const wave100 = read('supabase/migrations/wave100_question_retire.sql');
const wave86sql = read('supabase/migrations/wave86_change_answers_history.sql');
const fnOf = (text: string, sig: string) => {
  const start = text.indexOf(`create or replace function public.${sig}`);
  assert.ok(start >= 0, `${sig} is defined`);
  const end = text.indexOf('\n$$;\n', start);
  return text.slice(start, end + 4);
};
const grantsOf = (text: string, name: string) =>
  text.split('\n').filter((line) => /^(revoke|grant) /.test(line) && line.includes(`function public.${name}(`)).join('\n');
const applyEdits = (text: string, edits: readonly (readonly [string, string])[], name: string) =>
  edits.reduce((acc, [from, to]) => {
    assert.ok(acc.includes(from), `${name}: the source still has the text wave100 replaces`);
    return acc.replace(from, to);
  }, text);
const WAVE100_COPIES: readonly { name: string; sig: string; source: string; edits: readonly (readonly [string, string])[] }[] = [
  {
    name: '_bank_all_done',
    sig: '_bank_all_done(p_uid uuid)',
    source: sql,
    edits: [
      ['  with ans as (select question_id from public._bank_answered_ids(p_uid))\n', ''],
      [
        'select 1 from public.question_bank b where b.id not in (select question_id from ans)',
        'select 1 from public._bank_trait_progress(p_uid) p where p.answered_n < p.active_n',
      ],
    ],
  },
  {
    name: 'serve_bank_set',
    sig: 'serve_bank_set()',
    source: sql,
    edits: [
      [
        `  select coalesce(min(n), 0) into v_done
    from (select b.axis, count(a.question_id) as n
            from (select distinct axis from public.question_bank) b
            left join public._bank_answered_ids(uid) a on a.axis = b.axis
           group by b.axis) x;`,
        `  select coalesce(min(p.answered_n), 0) into v_done
    from public._bank_trait_progress(uid) p
   where p.active_n > 0;`,
      ],
      [
        `    with ans as (select question_id from public._bank_answered_ids(uid))
    select pick.* from (
      select distinct on (b.axis) b.id, b.axis, b.prompt, b.options
        from public.question_bank b
       where b.id not in (select question_id from ans)
       order by b.axis, random()`,
        `    with ans as (select question_id from public._bank_answered_ids(uid)),
         open_axes as (select p.axis from public._bank_trait_progress(uid) p where p.answered_n < p.active_n)
    select pick.* from (
      select distinct on (b.axis) b.id, b.axis, b.prompt, b.options
        from public.question_bank b
       where b.id not in (select question_id from ans)
         and b.retired_at is null
         and b.axis in (select o.axis from open_axes o)
       order by b.axis, random()`,
      ],
      [
        `  -- (claim_ongoing_round_complete needs 16).
  if idx < 16 then
    for r in
      with ans as (select question_id from public._bank_answered_ids(uid))
      select b.id, b.axis, b.prompt, b.options
        from public.question_bank b
       where b.id not in (select question_id from ans)
         and b.id not in (select i.bank_question_id from public.question_items i
                           where i.pack_id = v_pack and i.bank_question_id is not null)
       order by random()
       limit 16 - idx`,
        `  -- (claim_ongoing_round_complete needs 16).
  -- wave100: a trait never gets more than it still needs (room = what it
  -- needs minus the one the first pass already took), so a retired answer
  -- can never push a trait past its active count.
  if idx < 16 then
    for r in
      with ans as (select question_id from public._bank_answered_ids(uid)),
           room as (select p.axis, p.active_n - p.answered_n - 1 as n
                      from public._bank_trait_progress(uid) p where p.answered_n < p.active_n)
      select x.id, x.axis, x.prompt, x.options from (
        select b.id, b.axis, b.prompt, b.options, rm.n,
               row_number() over (partition by b.axis order by random()) as rn
          from public.question_bank b
          join room rm on rm.axis = b.axis
         where b.id not in (select question_id from ans)
           and b.retired_at is null
           and b.id not in (select i.bank_question_id from public.question_items i
                             where i.pack_id = v_pack and i.bank_question_id is not null)
      ) x
       where x.rn <= x.n
       order by random()
       limit 16 - idx`,
      ],
    ],
  },
  {
    name: 'dev_fill_bank',
    sig: 'dev_fill_bank()',
    source: sql,
    edits: [
      [
        `    with ans as (select question_id from public._bank_answered_ids(uid))
    select b.id, b.axis, b.options from public.question_bank b
     where b.id not in (select question_id from ans)
     order by b.id`,
        `    with ans as (select question_id from public._bank_answered_ids(uid)),
         room as (select p.axis, p.active_n - p.answered_n as n
                    from public._bank_trait_progress(uid) p where p.answered_n < p.active_n)
    select x.id, x.axis, x.options from (
      select b.id, b.axis, b.options, rm.n,
             row_number() over (partition by b.axis order by b.id) as rn
        from public.question_bank b
        join room rm on rm.axis = b.axis
       where b.id not in (select question_id from ans)
         and b.retired_at is null
    ) x
     where x.rn <= x.n
     order by x.id`,
      ],
    ],
  },
  {
    name: 'change_bank_answer',
    sig: 'change_bank_answer(p_session uuid, p_question_id text, p_option_index int)',
    source: wave86sql,
    edits: [
      [
        `    raise exception 'unknown question' using errcode = '22023';
  end if;
`,
        `    raise exception 'unknown question' using errcode = '22023';
  end if;
  -- wave100: a retired question keeps the answer it was given; it is never re-asked.
  if q.retired_at is not null then
    raise exception 'retired question' using errcode = 'P0001';
  end if;
`,
      ],
    ],
  },
  {
    name: 'serve_bank_retest',
    sig: 'serve_bank_retest(p_axis text, p_count int)',
    source: sql,
    edits: [['     where b.axis = p_axis\n', '     where b.axis = p_axis\n       and b.retired_at is null\n']],
  },
];
for (const copy of WAVE100_COPIES) {
  assert.equal(
    fnOf(wave100, copy.sig),
    applyEdits(fnOf(copy.source, copy.sig), copy.edits, copy.name),
    `${copy.name}: wave100 is its current definition word for word plus the retired filter`,
  );
}
assert.equal(grantsOf(wave100, 'serve_bank_set'), grantsOf(sql, 'serve_bank_set'), 'serve_bank_set: same grants');
assert.equal(grantsOf(wave100, '_bank_all_done'), grantsOf(sql, '_bank_all_done'), '_bank_all_done: same grants');
assert.equal(grantsOf(wave100, 'dev_fill_bank'), grantsOf(sql, 'dev_fill_bank'), 'dev_fill_bank: same grants');
assert.equal(grantsOf(wave100, 'change_bank_answer'), grantsOf(wave86sql, 'change_bank_answer'), 'change_bank_answer: same grants');
assert.equal(
  grantsOf(wave100, 'serve_bank_retest'),
  'revoke all on function public.serve_bank_retest(text, int) from public, anon;\nrevoke execute on function public.serve_bank_retest(text, int) from authenticated;',
  'serve_bank_retest stays closed to clients, as wave86 left it',
);
assert.match(wave100, /alter table public\.question_bank add column if not exists retired_at timestamptz;/);
assert.match(
  fnOf(wave100, '_bank_trait_progress(p_uid uuid)'),
  /least\(count\(\*\) filter \(where b\.retired_at is null\), count\(a\.question_id\)\)::int\n    from public\.question_bank b\n    left join public\._bank_answered_ids\(p_uid\) a on a\.question_id = b\.id/,
  'answered = every answered row (retired included), capped at the active count',
);
assert.match(wave100, /revoke all on function public\._bank_trait_progress\(uuid\) from public, anon, authenticated;/, 'the helper is server-only');
// Left alone on purpose: answered ids include retired rows, and an item served
// before retirement still scores from its own row.
for (const name of ['_bank_answered_ids', 'bank_answered', 'answer_bank_item', 'answer_round_item', 'start_fresh', 'set_trait_flag']) {
  assert.ok(!wave100.includes(`create or replace function public.${name}(`), `wave100 leaves ${name} as it is`);
}
assert.doesNotMatch(wave100, /delete\s+from\s+public\.question_bank\b|\btruncate\b|\bdrop\s+(table|column|function)\b/i, 'wave100 deletes no bank row and drops nothing');
assert.equal((wave100.match(/delete\s+from/gi) ?? []).length, 1, "the only delete is change_bank_answer's own replace, copied from wave86");
assert.doesNotMatch(wave100, /^-- APPLIED/m, 'wave100 is not applied yet');
// The Change answers screen keeps retired answers visible, read-only.
const finishFold = read('src/components/bank-finish-fold.tsx');
assert.match(finishFold, /BANK_ROWS_BY_TRAIT\[axis\]\.filter\(\(q\) => progress\.answeredIds\.has\(q\.id\)\)/, 'answered retired questions stay in the list');
assert.match(finishFold, /disabled=\{busy \|\| isRetired\}/, 'and cannot be changed (the current answer of a live question stays tappable: it is the selected look and a no-op)');
ok('wave100: retired_at added; serve_bank_set, _bank_all_done, dev_fill_bank, change_bank_answer and serve_bank_retest are their current definitions plus only the retired filter, same grants; answered ids, answering and Start Fresh untouched');

// 5. Stages, firm, retest picks -------------------------------------------------------
assert.equal(stageFor(0), 'first_read');
assert.equal(stageFor(2), 'first_read');
assert.equal(stageFor(3), 'full_profile');
assert.equal(stageFor(7), 'full_profile');
assert.equal(stageFor(8), 'bonus');
assert.equal(stageFor(24), 'bonus');
assert.equal(stageFor(25, false), 'complete');
// An uneven account (some traits ahead): sets done = the slowest trait.
const uneven = bankProgressFrom([...BANK_BY_TRAIT.openness.slice(0, 6).map((q) => q.id), ...TRAIT_AXES.filter((x) => x !== 'openness').flatMap((x) => BANK_BY_TRAIT[x].slice(0, 2).map((q) => q.id))]);
assert.equal(uneven.completedSets, 2);
assert.equal(uneven.currentSet, 3);
assert.equal(uneven.answeredByAxis.openness, 6);
ok('stages: sets 1-3 first read, 4-8 full profile, 9-25 bonus; sets done = the slowest trait');

const now = new Date('2026-10-06T12:00:00Z');
const iso = now.toISOString();
const fold = (samples: number[]): TraitTrack => replayTraitAnswers('openness', samples, iso)!;
assert.equal(isTraitFirm(fold([0.8, 0.8, 0.8, 0.8, 0.8]), now), false, '5 answers is not firm yet');
assert.equal(isTraitFirm(fold([0.8, 0.8, 0.8, 0.8, 0.8, 0.8]), now), true, '6 agreeing answers is firm');
assert.equal(isTraitFirm(fold([0.8, 0.2, 0.8, 0.2, 0.8, 0.2]), now), false, '6 answers that pull both ways is not');
ok('"Firm" appears at about 6 consistent answers and not for mixed ones');

const tracks: TraitTrack[] = [
  fold([0.8, 0.2, 0.8, 0.2, 0.8, 0.2]), // mixed openness
  { ...fold([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]), axis: 'playfulness' }, // firm but in the middle
  { ...fold([0.8, 0.8, 0.8, 0.8, 0.8, 0.8]), axis: 'autonomy' }, // firm, clear
];
const recs = changeRecommendations(tracks, new Set<TraitAxis>(['autonomy']), now);
assert.equal(recs[0]!.axis, 'autonomy', '"This isn\'t me" puts a trait first, even a firm one');
assert.equal(recs[0]!.reason, 'flagged');
assert.ok(recs.some((r) => r.axis === 'openness' && r.reason === 'mixed'));
assert.ok(recs.some((r) => r.axis === 'playfulness' && r.reason === 'near_middle'));
ok('Change answers order: flagged first, then mixed, low confidence, near the middle');

// 6. Retest replaces ------------------------------------------------------------------
const replayFn = sql.slice(sql.indexOf('create or replace function public._trait_replay'), sql.indexOf('-- 8. Answering a bank item'));
assert.match(replayFn, /public\.trait_ewma_step\(s\.value::float8, s\.stability::float8, s\.answer_count, a\.value, 'answer'\)/, 'same EWMA step as _trait_write');
assert.match(replayFn, /order by created_at, id/);
assert.match(answerFn, /if v_kind = 'bank_retest' then\n[\s\S]*?delete from public\.trait_answers[\s\S]*?insert into public\.trait_answers[\s\S]*?perform public\._trait_replay\(uid, q\.axis, v_unlogged\);/, 'retest: delete old, log new, recompute');
assert.match(answerFn, /select greatest\(0, coalesce\(\(select answer_count from public\.trait_tracks[\s\S]*?into v_unlogged;\n    delete from public\.trait_answers/, 'answers the log never saw are counted before the delete');
assert.match(replayFn, /v_n := v_n \+ greatest\(0, coalesce\(p_unlogged, 0\)\);/, 'and kept in the recomputed count, so a retest never reopens the bank');
const retestFn = sql.slice(sql.indexOf('create or replace function public.serve_bank_retest'), sql.indexOf('-- 10. "This isn'));
assert.match(retestFn, /join public\._bank_answered_ids\(uid\) a on a\.question_id = b\.id/, 'a retest only re-asks questions they answered');
assert.match(retestFn, /p_count < 5 or p_count > 25/);
assert.match(retestFn, /if not public\._bank_all_done\(uid\) then/, 'retest opens after all 25 sets');

// TS mirror: six answers at 0.8, then a retest replaces five of them with 0.2.
const before = fold([0.8, 0.8, 0.8, 0.8, 0.8, 0.8]);
const after = fold([0.8, 0.2, 0.2, 0.2, 0.2, 0.2]);
assert.ok(before.value > 0.75);
assert.ok(after.value < 0.4, `the trait really moves (${after.value.toFixed(2)})`);
assert.equal(after.answerCount, before.answerCount, 'replacing never inflates the count');
// The replay is exactly the live answer path folded in order.
let live: TraitTrack | null = null;
for (const v of [0.8, 0.2, 0.5, 0.8]) live = applyEwmaAnswer(live, 'openness', 'report', v, iso);
assert.deepEqual(fold([0.8, 0.2, 0.5, 0.8]), { ...live!, lastDepthAt: null });
ok('retest: new answers replace old ones (server deletes, logs, recomputes with the same step) and the trait moves');

// 7. Start Fresh ----------------------------------------------------------------------
const freshFn = sql.slice(sql.indexOf('create or replace function public.start_fresh()'), sql.indexOf('-- 12. Pre-launch test tool'));
const snapAt = freshFn.indexOf('insert into public.trait_profile_snapshots');
assert.ok(snapAt > 0 && snapAt < freshFn.indexOf('delete from public.trait_answers'), 'the snapshot is saved before anything is deleted');
for (const table of ['trait_answers', 'trait_tracks', 'trait_history', 'trait_flags']) {
  assert.match(freshFn, new RegExp(`delete from public\\.${table} where user_id = uid`), `wipes ${table}`);
}
assert.match(freshFn, /delete from public\.trait_tracks where user_id = uid and track = 'report';/, 'the gut-call game track stays');
assert.doesNotMatch(freshFn, /ato_token|tokens\s*=/, 'Start Fresh never touches tokens');
assert.match(freshFn, /openness = null,/);
assert.match(freshFn, /if not public\._bank_all_done\(uid\) then/);
const finish = read('src/components/bank-finish-fold.tsx');
const freshButton = finish.slice(finish.lastIndexOf('<Pressable', finish.indexOf('Hold to start fresh')), finish.indexOf('Hold to start fresh'));
assert.match(freshButton, /delayLongPress=\{START_FRESH_HOLD_MS\}/);
assert.match(freshButton, /onLongPress=\{\(\) => void doStartFresh\(\)\}/);
assert.doesNotMatch(freshButton, /onPress=/, 'a tap can never start fresh');
assert.match(finish, /const START_FRESH_HOLD_MS = 2500;/);
const startOver = sql.slice(sql.indexOf('create or replace function public.start_over_my_test_data()'), sql.indexOf('-- 15. No more runtime AI'));
for (const table of ['trait_answers', 'trait_flags', 'trait_profile_snapshots']) {
  assert.match(startOver, new RegExp(`delete from public\\.${table} where user_id = uid;`), `Start over clears ${table}`);
}
assert.match(startOver, /if not public\.is_root\(\) then/);
const devFill = sql.slice(sql.indexOf('create or replace function public.dev_fill_bank()'), sql.indexOf('-- 13. Old bundles'));
assert.match(devFill, /if not public\.is_root\(\) then/, 'dev_fill_bank is root only');
assert.match(devFill, /v_mode is distinct from 'invite_only'/, 'and pre-launch only');
ok('Start Fresh: snapshot first, then hard delete of answers, scores, history and flags; tokens untouched; hold 2.5s to confirm; Start over and the dev fill know the new tables and are root only');

// 8. Premium gate, flag ---------------------------------------------------------------
assert.deepEqual(PREMIUM_BANK_PRICE, { change_answers: null, start_fresh: null }, 'free for now');
assert.equal(isPremiumGated('change_answers'), false);
assert.equal(isPremiumGated('start_fresh'), false);
assert.match(sql, /create or replace function public\._bank_premium_price\(p_action text\)[\s\S]*?select null::int where p_action in \('retest', 'start_fresh'\);/);
assert.match(retestFn, /v_price := public\._bank_premium_price\('retest'\);/);
assert.match(freshFn, /v_price := public\._bank_premium_price\('start_fresh'\);/);
assert.match(finish, /isPremiumGated\('change_answers'\)/);
assert.match(finish, /isPremiumGated\('start_fresh'\)/);
ok('one premium gate, client and server, asked by Change answers (retest in wave85) and Start Fresh, and off');

const flagFn = sql.slice(sql.indexOf('create or replace function public.set_trait_flag'), sql.indexOf('-- 11. Start Fresh'));
assert.doesNotMatch(flagFn, /_trait_write|trait_tracks|trait_answers|question_items/, '"This isn\'t me" writes only the flag');
assert.doesNotMatch(serveFn, /trait_flags/, 'and never changes which questions a set serves');
const profile = read('src/components/full-profile-fold.tsx');
assert.match(profile, /setTraitFlag\(axis, on\)/);
ok('"This isn\'t me" is a flag only: no question, no trait write');

// 9. No runtime AI, no user text --------------------------------------------------------
for (const gone of [
  'src/lib/questions/generate.ts',
  'src/lib/questions/prompt.ts',
  'src/lib/questions/context.ts',
  'src/lib/questions/ongoing-round.ts',
  'src/lib/questions/run-ongoing-round.ts',
  'src/lib/questions/chunked-generate.ts',
  'src/lib/questions/prewarm.ts',
  'src/lib/questions/run-prewarm.ts',
  'src/lib/questions/bank-pool.ts',
  'src/lib/questions/question-lab.ts',
]) {
  assert.ok(!existsSync(resolve(__dirname, '..', gone)), `${gone} stays deleted`);
}
const questionPath = ['src/components/questions-fold.tsx', 'src/components/bank-finish-fold.tsx', 'src/lib/questions/bank-sets.ts']
  .map(read)
  .join('\n');
assert.doesNotMatch(questionPath, /generateText|\bfacts\b|sage_knows|me\.name/, 'nothing a person typed reaches a question');
assert.match(serveFn, /returns uuid/);
assert.match(sql, /create or replace function public\.serve_bank_set\(\)\n/, 'serving takes no input at all');
assert.match(sql, /revoke execute on function public\.insert_bank_pool_items\(jsonb\) from authenticated;/);
assert.match(sql, /revoke execute on function public\.insert_ongoing_round_pack\(jsonb\) from authenticated;/);
assert.ok(bankQuestionById('openness_01'));
ok('no AI question code left, no user text in the question path, shared-pool and phone-built round writes revoked');

console.log(`\n${passed} question-bank checks passed`);
