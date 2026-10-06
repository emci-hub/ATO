/**
 * The fixed question bank (wave85, emci 2026-10-06). Run: npm run check:question-bank
 *
 * 1. The bank: 400 = 25 x 16, stable ids, tags, balance, voice gate.
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
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { QUESTIONS_BANK } from '../src/lib/questions/bank';
import {
  BANK_BY_TRAIT,
  BANK_PER_TRAIT,
  BANK_SETTINGS,
  QUESTION_BANK,
  bankQuestionById,
} from '../src/lib/questions/bank/index';
import {
  BANK_SET_COUNT,
  bankProgressFrom,
  isTraitFirm,
  pickBankSet,
  retestRecommendations,
  retestSizes,
  stageFor,
} from '../src/lib/questions/bank-sets';
import { PREMIUM_BANK_PRICE, isPremiumGated } from '../src/lib/questions/premium-gate';
import { generatedQuestionFailure } from '../src/lib/questions/question-voice';
import { applyEwmaAnswer, replayTraitAnswers, type TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';

import { legacyPromptsFor, wave85SeedSql } from './gen-wave85-bank';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

// 1. The bank -----------------------------------------------------------------
assert.equal(QUESTION_BANK.length, 400);
assert.equal(new Set(QUESTION_BANK.map((q) => q.id)).size, 400, 'ids unique');
for (const axis of TRAIT_AXES) {
  const rows = BANK_BY_TRAIT[axis];
  assert.equal(rows.length, BANK_PER_TRAIT, `${axis}: 25`);
  rows.forEach((row, i) => {
    assert.equal(row.axis, axis);
    assert.equal(row.id, `${axis}_${String(i + 1).padStart(2, '0')}`, `${axis}: ids run 01-25 in file order`);
    assert.ok(row.options.length === 2 || row.options.length === 3, `${row.id}: 2-3 options`);
    const values = row.options.map((o) => o.value).sort().join(',');
    assert.ok(values === '0.2,0.5,0.8' || values === '0.2,0.8', `${row.id}: values ${values}`);
    assert.ok(BANK_SETTINGS.includes(row.setting), `${row.id}: setting`);
  });
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
ok('400 questions: 25 per trait, ids <trait>_01..25, 2-3 options at 0.2/0.5/0.8, every setting twice, both sides unflattering, high option position varies');

const allPrompts = QUESTION_BANK.map((q) => q.prompt);
assert.equal(new Set(allPrompts).size, 400, 'no prompt twice');
for (const row of QUESTION_BANK) {
  const others = BANK_BY_TRAIT[row.axis].map((q) => q.prompt).filter((p) => p !== row.prompt);
  assert.equal(generatedQuestionFailure(row, others), null, `${row.id} fails the voice gate`);
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
assert.equal(seed, wave85SeedSql().replace(/\r\n/g, '\n'), 'wave85b matches gen-wave85-bank.ts (re-run the generator, never hand-edit)');
assert.match(seed, /on conflict \(id\) do update/);
assert.doesNotMatch(seed, /\bdelete\s+from\b|\btruncate\b|trait_answers|trait_tracks/i, 'the seed touches no answer');
const sql = read('supabase/migrations/wave85_fixed_question_bank.sql');
assert.match(sql, /^-- NOT APPLIED\./m, 'marked not applied until emci approves');
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
ok('25 sets of 16, one per trait, random, no repeats; all 400 answered after set 25 and nothing more is served');

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
const recs = retestRecommendations(tracks, new Set<TraitAxis>(['autonomy']), now);
assert.equal(recs[0]!.axis, 'autonomy', '"This isn\'t me" puts a trait first, even a firm one');
assert.equal(recs[0]!.reason, 'flagged');
assert.ok(recs.some((r) => r.axis === 'openness' && r.reason === 'mixed'));
assert.ok(recs.some((r) => r.axis === 'playfulness' && r.reason === 'near_middle'));
assert.deepEqual(retestSizes(25), [5, 10, 15, 20, 25]);
assert.deepEqual(retestSizes(7), [5, 7]);
assert.deepEqual(retestSizes(4), []);
ok('retest list: flagged first, then mixed, low confidence, near the middle; 5 up to what they answered');

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
const freshButton = finish.slice(finish.indexOf('Hold to start fresh') - 600, finish.indexOf('Hold to start fresh'));
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
assert.deepEqual(PREMIUM_BANK_PRICE, { retest: null, start_fresh: null }, 'free for now');
assert.equal(isPremiumGated('retest'), false);
assert.equal(isPremiumGated('start_fresh'), false);
assert.match(sql, /create or replace function public\._bank_premium_price\(p_action text\)[\s\S]*?select null::int where p_action in \('retest', 'start_fresh'\);/);
assert.match(retestFn, /v_price := public\._bank_premium_price\('retest'\);/);
assert.match(freshFn, /v_price := public\._bank_premium_price\('start_fresh'\);/);
assert.match(finish, /isPremiumGated\('retest'\)/);
assert.match(finish, /isPremiumGated\('start_fresh'\)/);
ok('one premium gate, client and server, asked by retest and Start Fresh, and off');

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
