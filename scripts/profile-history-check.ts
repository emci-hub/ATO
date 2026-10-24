/**
 * Change answers + Undo, monthly profile history, profile cards (wave86,
 * emci 2026-10-06). Run: npm run check:profile-history
 *
 * 1. The type code and the "meaningful change" rule match the server's.
 * 2. A snapshot row stays light (~1-2 KB).
 * 3. The monthly job: once a month, only on a meaningful change, never deletes.
 * 4. Change answers: old answers kept for Undo; Undo puts them back.
 * 5. Start Fresh keeps or wipes the cards; a wipe keeps the no-payout marker.
 * 6. Retest is retired; nothing here touches tokens or calls AI.
 * 7. The card: real Divecore sprites, 16 bars, compare arrows, Reduce Motion.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { archetypeCode, CORE_AXES, MODIFIER_AXES, POLE_COMBOS, THIRD_AXES, thirdCode } from '../src/lib/legends64/classify';
import {
  CARD_HEROES,
  cardBars,
  cardName,
  cardStrengthWeakness,
  compareProfiles,
  currentProfileCard,
  heroForCode,
  orderForCompare,
  parseSnapshot,
  profileChanged,
  profileCode,
  type ProfileSnapshot,
  type ProfileValues,
} from '../src/lib/profile-history';
import { QUESTIONS_BANK, PROMPT_REWORDS } from '../src/lib/questions/bank';
import { QUESTION_BANK } from '../src/lib/questions/bank/index';
import { priorAnswersFrom } from '../src/lib/questions/bank-sets';
import { AXIS_TINT, characterFromTracks, characterPublicLine, MAX_TIPS, TIP_BAND } from '../src/lib/profile-character';
import { PREMIUM_BANK_PRICE } from '../src/lib/questions/premium-gate';
import type { TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
const sql = read('supabase/migrations/wave86_change_answers_history.sql');
const fn = (name: string) => {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `${name} is defined`);
  return sql.slice(start, sql.indexOf('\n$$;', start));
};

// 1. Type code + meaningful change ------------------------------------------------
let seed = 7;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const randomValues = (): ProfileValues => Object.fromEntries(TRAIT_AXES.map((a) => [a, Math.round(rnd() * 100) / 100]));
for (let i = 0; i < 200; i += 1) {
  const v = randomValues();
  assert.equal(profileCode(v), `${archetypeCode(v)}-${thirdCode(v)}`, 'card code = the Legends code + third letters');
}
assert.equal(profileCode({}), 'LLL-LLL-LLL', 'an unanswered trait reads low, as classify.ts does');
const codeFn = fn('_profile_code');
const axisList = [...CORE_AXES, ...MODIFIER_AXES, ...THIRD_AXES].map((a) => `'${a}'`).join(', ');
assert.ok(codeFn.replace(/\s+/g, ' ').includes(axisList), 'the SQL code reads the same 9 axes in the same order');
assert.match(codeFn, />= 0\.5 then 'H' else 'L'/);
ok('the type code is classify.ts\'s letters, client and server, in the same order');

const base = (values: ProfileValues): ProfileSnapshot => currentProfileCard(values, 400, '2026-10-01T00:00:00Z');
const v0: ProfileValues = Object.fromEntries(TRAIT_AXES.map((a) => [a, 0.7]));
assert.equal(profileChanged(base(v0), base({ ...v0, autonomy: 0.75 })), false, 'a 0.05 move is not worth a card');
assert.equal(profileChanged(base(v0), base({ ...v0, autonomy: 0.8 })), true, 'a 0.1 move is');
assert.equal(profileChanged(base({ ...v0, autonomy: 0.52 }), base({ ...v0, autonomy: 0.48 })), true, 'a pole flip is, however small');
assert.equal(profileChanged(base({ ...v0, autonomy: null }), base(v0)), true, 'a trait appearing is');
assert.equal(profileChanged(null, base(v0)), true, 'the first card always saves');
assert.equal(profileChanged(base(v0), base(v0)), false, 'same profile: skip');
const changedFn = fn('_profile_changed');
assert.match(changedFn, /coalesce\(p_old ->> 'code', ''\) is distinct from coalesce\(p_new ->> 'code', ''\)/, 'a type/name change counts');
assert.match(changedFn, /\(d\.a >= 0\.5\) <> \(d\.b >= 0\.5\) or abs\(d\.b - d\.a\) >= 0\.1/, 'a pole flip or a 0.1 move counts');
assert.match(changedFn, /\(d\.a is null\) <> \(d\.b is null\)/);
ok('a card is kept only on a pole flip, a 0.1 move, a trait appearing, or a new type — same rule both sides');

// 2. Row size ------------------------------------------------------------------------
const payload = {
  values: Object.fromEntries(TRAIT_AXES.map((a) => [a, 0.537])),
  sources: Object.fromEntries(TRAIT_AXES.map((a) => [a, 'self_situation'])),
  tracks: Object.fromEntries(TRAIT_AXES.map((a) => [a, [0.88, 25]])),
  flags: ['autonomy', 'playfulness'],
  answers: 400,
  code: 'HHL-LHL-HHH',
};
const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
assert.ok(bytes < 2048, `a full snapshot payload is ${bytes} bytes`);
const payloadFn = fn('_profile_payload');
for (const key of Object.keys(payload)) assert.match(payloadFn, new RegExp(`'${key}', `), `the server payload has ${key}`);
assert.match(payloadFn, /jsonb_object_agg\(t\.axis, jsonb_build_array\(round\(t\.stability::numeric, 2\), t\.answer_count\)\)/, 'tracks are [stability, count] pairs');
console.log(`    (worst-case snapshot payload: ${bytes} bytes)`);
ok(`a snapshot row stays light: ${bytes} bytes of profile JSON at most`);

// 3. Monthly job ------------------------------------------------------------------------
const monthly = fn('snapshot_profiles_monthly');
assert.match(monthly, /s\.reason = 'monthly' and s\.created_at >= v_month_start\) then\n      continue;/, 'one monthly card per person per month');
assert.match(monthly, /where s\.user_id = u\.user_id and s\.profile <> '\{\}'::jsonb\n     order by s\.created_at desc/, 'compared with the newest real card (any reason)');
assert.match(monthly, /if public\._profile_changed\(v_old, v_new\) then\n      insert into public\.trait_profile_snapshots \(user_id, reason, profile\)\n        values \(u\.user_id, 'monthly', v_new\);/);
assert.doesNotMatch(monthly, /\bdelete\b/i, 'history is never auto-deleted');
assert.match(sql, /perform cron\.schedule\(\n    'profile-history-monthly',\n    '7 3 1 \* \*',\n    \$job\$select public\.snapshot_profiles_monthly\(\);\$job\$\n  \);/, 'pg_cron on the 1st, the dev-trace-expire pattern');
assert.match(sql, /revoke all on function public\.snapshot_profiles_monthly\(\) from public, anon, authenticated;/, 'only the scheduler runs it');
assert.match(sql, /check \(reason in \('start_fresh', 'change_answers', 'monthly'\)\)/);
ok('monthly job: once a month, only on a meaningful change, compared with the newest card, never deletes, not callable by clients');

// 4. Change answers + Undo -----------------------------------------------------------------
const change = fn('change_bank_answer');
assert.match(change, /if v_session is null then\n    if not public\._bank_all_done\(uid\) then/, 'the first change opens only after all 25 sets');
assert.match(change, /public\._bank_premium_price\('change_answers'\) is not null/, 'asks the premium gate');
assert.match(change, /elsif not public\._change_session_ok\(uid, v_session\) then/, 'later changes need the open session');
assert.ok(
  change.indexOf("values (uid, 'change_answers', public._profile_payload(uid))") < change.indexOf('delete from public.trait_answers'),
  'the Undo point is saved before the first change, in the same transaction',
);
assert.match(change, /return jsonb_build_object\('session', v_session\);/);
assert.doesNotMatch(sql, /function public\.begin_change_session/, 'no separate begin call that could leave a stray card');
assert.match(change, /only an answered question can be changed/);
assert.match(change, /v_opt := q\.options -> p_option_index;/, 'value from the bank, not the phone');
assert.ok(change.indexOf('into v_old') < change.indexOf('delete from public.trait_answers'), 'old answers are kept before they are deleted');
assert.match(change, /perform public\._trait_replay\(uid, q\.axis, v_unlogged\);/, 'same replace + replay as wave85 retest');
assert.match(change, /insert into public\.trait_answer_changes \(user_id, snapshot_id, axis, question_id, old_rows\)/);
const undo = fn('undo_change_session');
assert.match(undo, /order by created_at desc, id desc/, 'newest change first, so a question changed twice lands on its pre-session answer');
assert.match(undo, /insert into public\.trait_answers \(id, user_id, kind, question_key, axis, option_index, value, created_at\)/, 'old answers come back as they were');
assert.match(undo, /v_track := v_snap -> 'tracks' -> ax;/, 'touched traits restored from the snapshot');
const sessionOk = fn('_change_session_ok');
assert.match(sessionOk, /s\.reason = 'change_answers'\n\s+order by s\.created_at desc, s\.id desc\n\s+limit 1\)/, 'only the newest session can change or undo');
assert.match(sessionOk, /f\.reason = 'start_fresh'/, 'a Start Fresh closes the session (Undo never revives wiped answers)');
assert.match(sessionOk, /select coalesce\(\n    p_session is not null/, 'no session reads false, never NULL');
assert.match(sessionOk, /\),\n    false\);/);
assert.match(sessionOk, /where s\.id = p_session and s\.user_id = p_uid/, 'own rows only');
assert.match(undo, /where id = p_session and user_id = uid;\n\n  -- Answers back/, 'Undo reads only its own snapshot');
assert.match(undo, /delete from public\.trait_profile_snapshots where id = p_session and user_id = uid;/, 'and deletes only its own: the used Undo point is not left as a duplicate card');
const finish = read('src/components/bank-finish-fold.tsx');
assert.match(finish, /await changeBankAnswer\(session, questionId, optionIndex\)/, 'the first change of a visit (session null) opens the session');
for (const guard of [
  /const id = preview \? \(session \?\? 'preview'\) : await changeBankAnswer/,
  /const n = preview \? changed : await undoChangeSession\(session\);/,
  /if \(preview\) \{\n      setNote\(`Lab: Start Fresh would run here/,
]) {
  assert.match(finish, guard, 'the lab preview never writes to the server');
}
assert.match(finish, /\[JSON\.stringify\(values\), snapshots/, 'the Now card follows the live values');
assert.match(finish, /if \(armed !== key\) \{\n      setArmed\(key\);\n      return;\n    \}/, 'a change takes two taps');
assert.match(finish, /if \(armed !== 'undo'\) \{\n      setArmed\('undo'\);\n      return;\n    \}/, 'Undo takes two taps');
// The previous answer opens selected (fix 2026-10-07): intake-era rows are
// keyed by prompt text and must map to their intake-slot bank question.
{
  const firstOpenness = QUESTIONS_BANK.find((d) => d.axis === 'openness')!;
  const oldWording = Object.entries(PROMPT_REWORDS).find(([, now]) => now === firstOpenness.prompt)?.[0];
  assert.ok(oldWording, 'openness slot 1 has a pre-wave84 wording to test');
  const fromIntake = priorAnswersFrom([{ kind: 'intake', question_key: firstOpenness.prompt, option_index: 2 }]);
  assert.equal(fromIntake.get('openness_01'), 2, 'an intake answer shows on its bank question');
  assert.equal(priorAnswersFrom([{ kind: 'intake', question_key: oldWording!, option_index: 1 }]).get('openness_01'), 1, 'and by its old wording');
  const both = priorAnswersFrom([
    { kind: 'bank', question_key: 'openness_01', option_index: 0 },
    { kind: 'intake', question_key: firstOpenness.prompt, option_index: 2 },
  ]);
  assert.equal(both.get('openness_01'), 0, 'a bank answer wins over an intake one');
  assert.equal(priorAnswersFrom([{ kind: 'intake', question_key: 'not a prompt', option_index: 0 }]).size, 0);
  assert.equal(priorAnswersFrom([{ kind: 'round', question_key: 'openness_04', option_index: 0 }]).size, 0, 'old round rows are not bank answers');
  const all48 = priorAnswersFrom(QUESTIONS_BANK.map((d) => ({ kind: 'intake', question_key: d.prompt, option_index: 0 })));
  assert.deepEqual([...all48.keys()].sort(), QUESTION_BANK.filter((q) => q.intakeSlot).map((q) => q.id).sort(), 'all 48 intake answers find their question');
}
assert.match(read('src/lib/questions/bank-sets-server.ts'), /\.select\('kind, question_key, option_index'\)\n\s+\.in\('kind', \['bank', 'intake'\]\)\n[\s\S]*?\.order\('created_at', \{ ascending: true \}\);/, 'previous answers read intake rows too, oldest first so the newest wins');
assert.match(finish, /if \(answers\.get\(questionId\) === optionIndex\) \{\n\s+setArmed\(null\);\n\s+return;\n\s+\}/, 'tapping the current answer does nothing');
assert.ok(
  finish.indexOf('if (answers.get(questionId) === optionIndex)') < finish.indexOf('await changeBankAnswer('),
  'and returns before any write or snapshot',
);
assert.match(finish, /isPrior && \{ backgroundColor: theme\.backgroundSelected, borderColor: theme\.accent, borderWidth: 2 \}/, 'the previous answer uses the normal selected style');
assert.match(finish, /accessibilityState=\{\{ selected: isPrior \}\}/);
assert.doesNotMatch(finish, /disabled=\{busy \|\| isPrior\}/, 'the selected answer is not greyed out');
assert.match(finish, /setAnswers\(\(prev\) => new Map\(prev\)\.set\(questionId, optionIndex\)\);/, 'the new answer shows selected after the change');
assert.match(finish, /const restore = originals\.current;\n\s+if \(preview\) \{\n\s+setAnswers\(\(prev\) => \{[\s\S]*?for \(const \[id, option\] of restore\)[\s\S]*?\}\);\n\s+\}\n\s+originals\.current = new Map\(\);\n\s+await load\(\);/, 'Undo shows the original answers again (lab restores from a copy taken before the ref is cleared; real reloads)');
ok('Change answers: previous answer opens selected (intake rows included), same option is a no-op, Undo point first, two taps, old answers logged, same replay; Undo restores newest-first and closes on Start Fresh');

// 5. Start Fresh keep / wipe -------------------------------------------------------------
const fresh = fn('start_fresh');
assert.match(sql, /create or replace function public\.start_fresh\(p_keep_history boolean default true\)/, 'keep is the default');
assert.match(sql, /drop function if exists public\.start_fresh\(\);/, 'no ambiguous overload left behind');
assert.match(fresh, /if coalesce\(p_keep_history, true\) then\n    insert into public\.trait_profile_snapshots \(user_id, reason, profile\)\n      values \(uid, 'start_fresh', public\._profile_payload\(uid\)\)/);
assert.match(fresh, /delete from public\.trait_profile_snapshots where user_id = uid;\n    insert into public\.trait_profile_snapshots \(user_id, reason, profile\)\n      values \(uid, 'start_fresh', '\{\}'::jsonb\)/, 'a wipe keeps one empty start_fresh marker (no re-earning after a reset)');
assert.doesNotMatch(fresh, /ato_token|tokens\s*=/, 'tokens untouched');
assert.equal(parseSnapshot('x', '2026-10-01', 'start_fresh', {}), null, 'the marker never shows as a card');
assert.match(finish, /const \[keepHistory, setKeepHistory\] = useState\(true\);/, 'the screen defaults to keep');
assert.match(finish, /await startFresh\(keepHistory\);/);
ok('Start Fresh asks keep (default) or wipe; a wipe leaves the payload-free marker the payout rule reads');

// 6. Retest retired, tokens, AI --------------------------------------------------------------
assert.match(sql, /revoke execute on function public\.serve_bank_retest\(text, int\) from authenticated;/);
assert.match(sql, /where i\.pack_id = p\.id and p\.kind = 'bank_retest'\n   and i\.answered_option is null and i\.skipped_at is null;/, 'open retest packs are closed');
assert.deepEqual(PREMIUM_BANK_PRICE, { change_answers: null, start_fresh: null }, 'premium gate still off');
const uiFiles = [
  'src/components/bank-finish-fold.tsx',
  'src/components/profile-card.tsx',
  'src/components/profile-binder.tsx',
  'src/lib/profile-history.ts',
  'src/lib/questions/bank-sets.ts',
  'src/lib/questions/bank-sets-server.ts',
].map(read).join('\n');
assert.doesNotMatch(uiFiles, /\bRetest\b|serveBankRetest|serve_bank_retest/, 'no Retest left in the app');
assert.doesNotMatch(uiFiles, /generateText|ai-generate/, 'no AI call for cards or history');
const sqlCode = sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
assert.doesNotMatch(sqlCode, /ato_token|claim_/, 'wave86 never touches tokens');
ok('Retest retired (grant revoked, open packs closed, no copy left); no tokens, no AI anywhere in this feature');

// 7. The card ---------------------------------------------------------------------------------
assert.equal(new Set(POLE_COMBOS.map((c) => heroForCode(`${c}-HHH-HHH`))).size, 8, 'each of the 8 types has its own hero');
assert.equal(heroForCode('HLH-LLL-LLL'), heroForCode('HLH-HHH-HHH'), 'the hero follows the core letters only');
const card = read('src/components/profile-card.tsx');
const heroPaths = [...card.matchAll(/require\('@\/(assets\/play\/avatars\/dungeon-legends\/[^']+)'\)/g)].map((m) => m[1]!);
assert.equal(heroPaths.length, CARD_HEROES.length, 'one existing sprite per hero');
for (const p of heroPaths) assert.ok(existsSync(resolve(root, p)), `${p} exists (reused, not new art)`);
assert.match(card, /fontFamily: PIXEL_FONT\.label/, 'Departure Mono');
assert.match(card, /<PixelFrame\n      enter=\{!reduceMotion\}/, 'the entrance is skipped under Reduce Motion');
assert.equal(cardBars(v0).length, 16, '16 condensed bars');
assert.ok(cardName('HHH-HHH-HHH').length > 0 && cardName('HHH-HHH-HHH') !== 'Still forming', 'the type has a name');
assert.ok(cardStrengthWeakness({ ...v0, openness: 0.95 })?.strength.startsWith('Adventurous'), 'strength from the strongest lean');
{
  const sw = cardStrengthWeakness({ ...v0, openness: 0.95 });
  assert.ok(sw?.weakness && sw.step, 'a supported lean shows its real cost and one step (insight bank), not the opposite pole');
  assert.ok(!/less natural/i.test(sw!.weakness!), 'weakness is never the "other end"');
  assert.ok(sw!.weakness!.startsWith('You may'), 'a drawback is a possibility ("You may…"), never a verdict');
  const faint = cardStrengthWeakness({ ...Object.fromEntries(TRAIT_AXES.map((a) => [a, 0.5])), openness: 0.58 });
  assert.equal(faint?.weakness ?? null, null, 'a faint lean names no drawback (a strong trait alone does not prove it)');
  assert.equal(faint?.step ?? null, null, 'and offers no step');
}
assert.equal(cardStrengthWeakness(Object.fromEntries(TRAIT_AXES.map((a) => [a, 0.5]))), null, 'a flat profile claims no strength');
const older = { ...base(v0), id: 'a', createdAt: '2026-08-01T00:00:00Z' };
const newer = { ...base({ ...v0, openness: 0.9, autonomy: 0.5, playfulness: 0.72 }), id: 'b', createdAt: '2026-09-01T00:00:00Z' };
const [o, n] = orderForCompare(newer, older);
assert.equal(o.id, 'a', 'compare puts the older card first whichever is tapped first');
const rows = compareProfiles(o, n);
assert.equal(rows.find((r) => r.axis === 'openness')!.arrow, 'up');
assert.equal(rows.find((r) => r.axis === 'autonomy')!.arrow, 'down');
assert.equal(rows.find((r) => r.axis === 'playfulness')!.arrow, 'same', 'small moves draw no arrow');
assert.match(read('src/components/profile-binder.tsx'), /\[\.\.\.prev, id\]\.slice\(-2\)/, 'two cards at a time');
ok('the card: 8 real Divecore heroes by type, Departure Mono, 16 bars, strength/weakness, compare arrows, Reduce Motion respected');

// ---- the profile character (master-plan step 1) ----
{
  const mk = (vals: Record<string, number>, count = 3): TraitTrack[] =>
    TRAIT_AXES.map((axis) => ({
      axis,
      track: 'report' as const,
      value: vals[axis] ?? 0.5,
      stability: 0.8,
      answerCount: axis in vals ? count : 0,
      lastTouched: '2026-10-20T00:00:00Z',
      lastDepthAt: null,
    }));
  const all = Object.fromEntries(TRAIT_AXES.map((a, i) => [a, i % 2 ? 0.8 : 0.2]));
  const now = new Date('2026-10-20T00:00:00Z');

  // honest: under 3 answers never becomes a claim, never a stat value
  const early = characterFromTracks(mk({ openness: 0.9 }, 2), now);
  assert.equal(early.settledCount, 0, '2 answers per trait settles nothing');
  assert.ok(early.stats.every((s) => s.value == null && s.confidence === 'early'), 'under 3 answers = empty bar, "Still early"');
  assert.equal(early.strength, null, 'no strength is stated from unsettled traits');
  assert.equal(early.tips.length, 0, 'no "could grow into" from unsettled traits');
  const three = characterFromTracks(mk({ openness: 0.9 }, 3), now);
  assert.equal(three.settledCount, 1, 'exactly 3 answers settles a trait');
  assert.ok(three.strength?.startsWith('Adventurous'), 'strength comes only from settled traits');

  // unique from answers: name, hero, accents follow the answers; same answers = same character
  const a = characterFromTracks(mk(all), now);
  const b = characterFromTracks(mk({ ...all, openness: 0.1, extraversion: 0.9 }), now);
  assert.deepEqual(characterFromTracks(mk(all), now), a, 'deterministic: same answers, same character');
  assert.ok(a.name !== b.name || a.hero !== b.hero, 'different answers give a different character');
  assert.equal(a.stats.length, 16, 'all 16 stats listed');
  for (const hex of Object.values(AXIS_TINT)) assert.match(hex, /^#[0-9a-f]{6}$/, 'accent is a hex colour');
  assert.equal(new Set(Object.values(AXIS_TINT)).size, 16, 'each trait has its own accent');
  assert.equal(Object.keys(AXIS_TINT).length, 16);

  // could grow into: only near-the-line code axes with real answers, as a possibility
  const near = characterFromTracks(mk({ ...all, extraversion: 0.52 }), now);
  assert.ok(near.tips.some((t) => t.axis === 'extraversion'), 'a code axis within the band can tip');
  assert.ok(near.tips.length <= MAX_TIPS, 'at most two tips');
  assert.ok(near.evolveName && near.evolveLine.startsWith('If '), 'worded as a possibility ("If … tips")');
  assert.notEqual(near.evolveName, near.name, 'tipping changes the type');
  const inside = characterFromTracks(mk({ ...all, extraversion: 0.5 + TIP_BAND - 0.02 }), now);
  assert.ok(inside.tips.some((t) => t.axis === 'extraversion'), 'just inside the band can tip');
  const outside = characterFromTracks(mk({ ...all, extraversion: 0.5 + TIP_BAND + 0.02 }), now);
  assert.ok(!outside.tips.some((t) => t.axis === 'extraversion'), 'just outside the band is not near');
  const far = characterFromTracks(mk(all), now);
  assert.equal(far.evolveName, null, 'nothing near the line = no invented evolution');
  assert.ok(far.evolveLine.includes('Nothing is close'), 'and says so');
  assert.ok(!near.tips.some((t) => !['conscientiousness', 'extraversion', 'openness', 'agreeableness', 'conflict_assertiveness', 'relatedness', 'growth_mindset', 'steadiness', 'playfulness'].includes(t.axis)), 'tips only use the 9 code axes');

  // weakness per policy: possibility wording, only for a clear lean
  const faint = characterFromTracks(mk({ ...Object.fromEntries(TRAIT_AXES.map((x) => [x, 0.5])), openness: 0.58 }), now);
  assert.equal(faint.weakness, null, 'a faint lean names no drawback');
  const strong = characterFromTracks(mk({ ...Object.fromEntries(TRAIT_AXES.map((x) => [x, 0.5])), openness: 0.95 }), now);
  assert.ok(strong.weakness?.startsWith('You may'), 'a clear lean: the drawback is a possibility');

  // public line: strength only, never a private lean, never weakness/step
  const priv = { ...Object.fromEntries(TRAIT_AXES.map((x) => [x, 0.5])), attachment_anxiety: 0.98, steadiness: 0.05, openness: 0.7 };
  const pub = characterPublicLine(priv);
  assert.ok(pub && pub.startsWith('Adventurous'), 'private leans (attachment, low steadiness) are skipped for the next shareable one');
  assert.equal(characterPublicLine(Object.fromEntries(TRAIT_AXES.map((x) => [x, 0.5]))), null, 'a flat profile has no public line');
  assert.equal(characterPublicLine({ attachment_avoidance: 0.1 }), null, 'only a private lean = nothing public');
  assert.ok(!/cuts both ways|TRY/.test(pub ?? ''), 'a public line never carries the weakness or step');

  // wiring: shown after the 48 (not before), and not on top of the finished binder
  const fold = read('src/components/questions-fold.tsx');
  assert.match(fold, /fullProfileLocked && !loading && progress && progress\.stage !== 'complete' \? <ProfileCharacter/, 'character shows after the 48, before set 25');
  const comp = read('src/components/profile-character.tsx');
  assert.ok(!/import[^;]*characterPublicLine/.test(comp), 'the in-app component never uses the public line; a share surface must call characterPublicLine itself');
  assert.equal(early.name, 'Still forming', 'with any code axis unsettled the name is "Still forming", not a default-low type');  assert.match(comp, /<PixelFrame enter=\{!reduceMotion\}/, 'entrance skipped under Reduce Motion');
  assert.ok(!/fetch|supabase|rpc\(/i.test(read('src/lib/profile-character.ts')), 'pure: no network, no AI');
  ok('profile character: honest at 3+ answers, deterministic and unique by answers, near-line "could grow into" as a possibility, public line skips private leans and weakness');
}

console.log(`\n${passed} profile-history checks passed`);
