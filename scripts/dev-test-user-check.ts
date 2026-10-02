/**
 * Dev-test identity, the "Jump this account" stages, and "Start over".
 * Run: npm run check:dev-test-user
 *
 *   - identity constants match the provisioning migration (wave31) exactly
 *   - there is no client-side sign-in for the dev-test account
 *   - the jump stages (lib/dev-intake-stages.ts) are FAITHFUL: they write the
 *     source a real answer writes, and track rows equal to the real scoring
 *     function run N times — checked by running the real functions, so a bank
 *     or scoring edit fails here instead of seeding a state no user can reach
 *   - "Start over" is one server function (wave76): root only, own account
 *     only, keeps the profile and the token balance
 *   - the dev-test account's own sign-up-form reset (wave66) is unchanged
 *
 * REMOVED 2026-10-01 with the code they covered: the four Legends archetype
 * presets, the thin-profile preset, the "scenarios only" and Sage/Legends
 * boundary stages, the three overlapping resets, and the handle-collision
 * button (the wave65 migration itself is still checked below).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DEV_INTAKE_PRESET_SOURCE,
  DEV_INTAKE_PRESET_VALUES,
  DEV_INTAKE_STAGES,
  devBankSize,
  devHistoryRows,
  devIntakeAnswerPlan,
  devIntakeStageById,
  devIntakeTracks,
  devPlanTotal,
  devStageMatching,
  planAfterRoundOne,
  planAllSettled,
} from '../src/lib/dev-intake-stages';
import { isFullProfileDone } from '../src/lib/full-profile-gate';
import { bankQuestionCount, bankTotalProgress } from '../src/lib/questions/local';
import { roundAxisCounts } from '../src/lib/questions/tiered-axis-plan';
import { storyReady } from '../src/lib/sage-story';
import {
  STABILITY_FLOOR_N,
  applyEwmaAnswer,
  isProfileSettled,
  settledAxisCount,
  shouldWriteReportTrack,
  trackFor,
  type TraitTrack,
} from '../src/lib/trait-stability';
import { DIRECT_TRAIT_SOURCES, TRAIT_AXES, type TraitAxis } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

function esc(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const AT = '2026-10-01T00:00:00.000Z';
const NOW = new Date(AT);

function main() {
  const moduleSrc = read('src/lib/dev-test-user.ts');
  const sessionSrc = read('src/hooks/use-session.ts');
  const migration = read('supabase/migrations/wave31_dev_test_user.sql');

  // Identity constants are single-sourced with the provisioning migration.
  for (const constant of [
    'ato-dev@example.com',
    'atodev',
    'a70d3e0e-4c00-4a1e-8c0d-00000000d3e0',
  ]) {
    assert.match(moduleSrc, new RegExp(esc(constant)));
    assert.match(migration, new RegExp(esc(constant)));
  }
  ok('dev-test-user constants match the wave31 migration');

  // The hardcoded password/account sign-in path is gone entirely — no
  // credential, no auto-login, no manual "Sign in as dev user" button.
  assert.doesNotMatch(moduleSrc, /DEV_TEST_EMAIL/);
  assert.doesNotMatch(moduleSrc, /DEV_TEST_PASSWORD/);
  assert.doesNotMatch(moduleSrc, /devTestAutoSignIn/);
  assert.doesNotMatch(moduleSrc, /isDevTestEmail/);
  assert.doesNotMatch(moduleSrc, /signInWithPassword/);
  assert.doesNotMatch(sessionSrc, /devTestAutoSignIn/);
  assert.doesNotMatch(sessionSrc, /dev-test-user/);
  const loginSrc = read('src/app/auth/login.tsx');
  assert.doesNotMatch(loginSrc, /devTestAutoSignIn/);
  assert.doesNotMatch(loginSrc, /Sign in as dev user/);
  assert.doesNotMatch(loginSrc, /dev-test-user/);
  ok('no hardcoded dev-test password/account or auto-login remains anywhere in the client');

  // The earlier ad-hoc account is removed by the migration with an audit row.
  assert.match(migration, /delete from auth\.users/);
  assert.match(migration, /ddd90aae-2f0f-4507-a160-423b9223d83b/);
  assert.match(migration, /account_deletions/);
  ok('migration removes the old legends-dev account with an audit row');

  // Dead preset code stays gone: Legends is a placeholder and nothing called it.
  assert.doesNotMatch(moduleSrc, /applyDevArchetypePreset|applyDevThinProfilePreset|DEV_ARCHETYPE_PRESETS/);
  assert.doesNotMatch(moduleSrc, /resetMyTestData|rpc\('reset_my_test_data'\)/, 'the old full clear is replaced by Start over');
  ok('archetype / thin presets and the old full-clear call are removed');

  /* -------------------------------------------------------------------------
   * Jump stages. These run the REAL functions against the REAL predicates.
   * ---------------------------------------------------------------------- */
  const stagesSrc = read('src/lib/dev-intake-stages.ts');
  const bankTotal = bankTotalProgress([]).total;
  assert.equal(bankTotal, 50, 'bank total must be 50 — the stages are written against it');
  assert.equal(devBankSize(), bankTotal);

  assert.deepEqual(
    DEV_INTAKE_STAGES.map((row) => row.stage),
    ['one-short', 'intake-done', 'round-one-done', 'all-settled'],
  );
  for (const axis of TRAIT_AXES) {
    assert.ok(typeof DEV_INTAKE_PRESET_VALUES[axis] === 'number', `preset values missing axis ${axis}`);
  }
  assert.equal(Object.keys(DEV_INTAKE_PRESET_VALUES).length, TRAIT_AXES.length);
  for (const stage of DEV_INTAKE_STAGES) {
    assert.equal(devIntakeStageById(stage.stage), stage, `${stage.stage} lookup`);
    assert.doesNotMatch(`${stage.label} ${stage.hint}`, /Sage|Legend/, `${stage.stage} names a placeholder feature`);
  }
  ok('4 jump stages in flow order, preset vector covers all 16 axes, no Sage/Legends wording');

  // The source must be what a real answer writes, and must NOT be direct: a
  // direct source makes every later real answer count-only (me.ts
  // collectAnswers), so scores never move again and no trait can settle.
  assert.equal(DEV_INTAKE_PRESET_SOURCE, 'self_situation');
  assert.ok(
    !(DIRECT_TRAIT_SOURCES as readonly string[]).includes(DEV_INTAKE_PRESET_SOURCE),
    'the jump source must be an inferred source',
  );
  assert.equal(
    shouldWriteReportTrack(DEV_INTAKE_PRESET_SOURCE, 'self_situation'),
    true,
    'a real question answer after a jump must still blend into the score',
  );
  assert.equal(shouldWriteReportTrack('self_scenario', 'self_situation'), false, 'the old direct source froze the axis');
  ok('jumps write self_situation, so a real answer afterwards still moves the score');

  // Every bank-sized plan respects each axis's real bank size and sums to the target.
  const tracksOf = (plan: Record<TraitAxis, number>) => devIntakeTracks(DEV_INTAKE_PRESET_VALUES, plan, AT);
  for (let n = 0; n <= bankTotal; n++) {
    const plan = devIntakeAnswerPlan(n);
    for (const axis of TRAIT_AXES) {
      assert.ok(plan[axis] >= 0 && plan[axis] <= bankQuestionCount([axis]), `${axis} plan out of range at n=${n}`);
    }
    assert.equal(devPlanTotal(plan), n, `plan for ${n} sums to ${devPlanTotal(plan)}`);
    // The live predicate must agree with the plan, not just the arithmetic.
    assert.equal(bankTotalProgress(tracksOf(plan)).answered, n);
  }
  assert.throws(() => devIntakeAnswerPlan(bankTotal + 1), /Cannot plan/, 'a plan bigger than the bank must throw, not clamp');
  ok('devIntakeAnswerPlan sums to the target inside every axis cap for 0..50, and refuses 51');

  // FAITHFUL TRACKS: each row equals the real scoring function run N times.
  for (const stage of DEV_INTAKE_STAGES) {
    const plan = stage.plan();
    const rows = tracksOf(plan);
    assert.equal(rows.length, TRAIT_AXES.length * 2);
    for (const axis of TRAIT_AXES) {
      let real: TraitTrack | null = null;
      for (let i = 0; i < plan[axis]; i += 1) {
        real = applyEwmaAnswer(real, axis, 'report', DEV_INTAKE_PRESET_VALUES[axis], AT);
      }
      const row = trackFor(rows, axis, 'report');
      assert.ok(row && real, `${stage.stage}/${axis} has no row`);
      assert.equal(row.answerCount, real.answerCount, `${stage.stage}/${axis} count`);
      assert.equal(row.stability, real.stability, `${stage.stage}/${axis} stability is not what real answers produce`);
      assert.equal(row.value, real.value, `${stage.stage}/${axis} value`);
      assert.equal(trackFor(rows, axis, 'game')?.answerCount, plan[axis], `${stage.stage}/${axis} game track`);
    }
  }
  assert.doesNotMatch(stagesSrc, /DEV_INTAKE_PRESET_STABILITY/, 'no hand-set stability — it over-read 2-answer axes');
  assert.ok(
    devIntakeTracks(null, devIntakeAnswerPlan(0), AT).every((row) => row.value === 0.5 && row.answerCount === 0),
    'the clearing branch writes the mid carrier at answer_count 0',
  );
  ok('every stage writes exactly what applyEwmaAnswer produces for that many agreeing answers');

  // What each stage means to the app, read through the real predicates.
  const at = (id: Parameters<typeof devIntakeStageById>[0]) => tracksOf(devIntakeStageById(id)!.plan());
  const oneShort = at('one-short');
  assert.equal(bankTotalProgress(oneShort).answered, bankTotal - 1);
  assert.equal(isFullProfileDone(oneShort, true), false, 'one short must still be locked');

  const done = at('intake-done');
  assert.equal(bankTotalProgress(done).answered, bankTotal);
  assert.equal(isFullProfileDone(done, true), true, 'the 50 unlock Home / Explore / Next 25');
  assert.equal(settledAxisCount(done, NOW), 6, 'six traits settle inside the 50');
  assert.equal(storyReady(done, NOW), false, 'Story is not ready at 50 — it belongs to the next round');

  const roundOne = planAfterRoundOne();
  const intakePlan = devIntakeAnswerPlan(bankTotal);
  const realRound = roundAxisCounts(tracksOf(intakePlan));
  for (const axis of TRAIT_AXES) {
    assert.equal(roundOne[axis], intakePlan[axis] + (realRound[axis] ?? 0), `${axis}: round 1 must be the round the app would compose`);
  }
  assert.equal(devPlanTotal(roundOne), bankTotal + 25);
  const afterRound = at('round-one-done');
  assert.equal(isFullProfileDone(afterRound, true), true);
  assert.equal(isProfileSettled(afterRound, NOW), true, 'every trait settles in round 1');
  assert.equal(storyReady(afterRound, NOW), true, 'Story is ready after round 1');

  const settledPlan = planAllSettled();
  assert.ok(TRAIT_AXES.every((axis) => settledPlan[axis] >= STABILITY_FLOOR_N));
  assert.ok(TRAIT_AXES.some((axis) => settledPlan[axis] === STABILITY_FLOOR_N), 'the minimum: some trait sits exactly on the floor');
  assert.equal(settledAxisCount(at('all-settled'), NOW), TRAIT_AXES.length);
  ok('one short is locked; the 50 unlock with 6 settled and no Story; round 1 and all-settled read 16 of 16');

  // "You are here": each stage matches itself and nothing else; a real profile matches none.
  for (const stage of DEV_INTAKE_STAGES) {
    assert.equal(devStageMatching(tracksOf(stage.plan())), stage.stage);
  }
  assert.equal(devStageMatching([]), null);
  assert.equal(devStageMatching(tracksOf(devIntakeAnswerPlan(12))), null);
  ok('devStageMatching marks exactly the stage the account sits on');

  // Answer history: the first +21 needs 50 self_situation rows (wave52).
  const wave52 = read('supabase/migrations/wave52_ato_tokens_fixes.sql');
  assert.match(wave52, /source = 'self_situation'[\s\S]{0,80}if v_answer_count < 50 then/);
  const history = devHistoryRows(intakePlan, 999);
  assert.equal(history.length, bankTotal, 'a finished intake stands for 50 history rows');
  assert.ok(history.every((row) => row.source === 'self_situation'));
  for (const axis of TRAIT_AXES) {
    assert.equal(history.filter((row) => row.axis === axis).length, intakePlan[axis]);
  }
  assert.equal(devHistoryRows(intakePlan, 7).length, 7, 'only the shortfall is written');
  assert.equal(devHistoryRows(intakePlan, 0).length, 0);
  ok('devHistoryRows yields one self_situation row per planned answer, capped at the shortfall');

  // The pure module must stay importable by this check — no supabase client.
  assert.doesNotMatch(stagesSrc, /from '@\/lib\/supabase'/);
  ok('dev-intake-stages stays supabase-free so these assertions run the real functions');

  /* -------------------------------------------------------------------------
   * The write side.
   * ---------------------------------------------------------------------- */
  const jumpStart = moduleSrc.indexOf('export async function applyDevIntakeStagePreset');
  const resetStart = moduleSrc.indexOf('export async function resetDevTestUserToFreshSignup');
  assert.ok(jumpStart >= 0 && resetStart > jumpStart, 'could not isolate applyDevIntakeStagePreset');
  const jumpBody = moduleSrc.slice(jumpStart, resetStart);
  assert.match(jumpBody, /if \(!PRE_LAUNCH_DEV\) throw new Error/);
  assert.doesNotMatch(jumpBody, /user\.id !== DEV_TEST_USER_ID/, 'jumps work on the signed-in account (emci, 2026-10-01)');
  assert.match(jumpBody, /if \(!user\) throw new Error/, 'it still needs a signed-in account');
  assert.match(jumpBody, /\.from\('me'\)\.update\(patch\)\.eq\('id', user\.id\)/, 'own row only');
  assert.match(jumpBody, /upsertTraitTracks/);
  assert.match(jumpBody, /if \(options\.topUpHistory\) await topUpAnswerHistory\(user\.id, plan\);/, 'history is only written where Start over can undo it');
  assert.match(jumpBody, /\} finally \{\s*await afterAccountRewrite\(\);\s*\}/, 'the cleanup runs even when a later write throws');
  assert.match(jumpBody, /celebrated_milestone_ids = \[\]/, 'so the after-50 reveal shows again');
  assert.equal(jumpBody.match(/\.delete\(\)/), null, 'a jump deletes nothing (the client has no delete on these tables)');
  const topUp = moduleSrc.slice(moduleSrc.indexOf('async function topUpAnswerHistory'), moduleSrc.indexOf('async function afterAccountRewrite'));
  assert.match(topUp, /const missing = target - \(count \?\? 0\);\s*if \(missing <= 0\) return;/, 'idempotent: only the shortfall, so repeated jumps do not pile rows up');
  const after = moduleSrc.slice(moduleSrc.indexOf('async function afterAccountRewrite'), jumpStart);
  assert.match(after, /clearLocalQuestionState\(options\)/);
  assert.match(after, /bumpAccountDataEpoch\(\)/);
  ok('applyDevIntakeStagePreset: pre-launch, own account, upserts, tops history up once, clears stale device state');

  // The narrow local clear removes question stamps, not the whole account's device data.
  const localSrc = read('src/lib/local-account-data.ts');
  const narrow = localSrc.slice(localSrc.indexOf('export async function clearLocalQuestionState'), localSrc.indexOf('export async function clearLocalAccountData'));
  assert.match(narrow, /QUESTION_STATE_PREFIXES\.some\(\(prefix\) => key\.startsWith\(prefix\)\)/);
  const prefixes = /QUESTION_STATE_PREFIXES: readonly string\[\] = \[([^\]]+)\]/.exec(localSrc)?.[1] ?? '';
  assert.deepEqual(
    [...prefixes.matchAll(/'([^']+)'/g)].map((m) => m[1]),
    ['ato.questions.answeredOption.', 'ato.questions.categoryPage.'],
    'exactly the stamps and positions — not all of ato.questions.*',
  );
  assert.ok(
    read('src/lib/questions/run-prewarm.ts').includes('ato.questions.prewarm-at'),
    'the prewarm cooldown shares the ato.questions. namespace, which is why the clear lists prefixes',
  );
  assert.doesNotMatch(narrow, /cancelAllScheduledPush/, 'a jump must not cancel the account\'s pushes');
  assert.match(read('src/lib/questions/answered-option-storage.ts'), /const KEY_PREFIX = 'ato\.questions\.answeredOption\.'/);
  assert.match(read('src/lib/questions/category-page-position.ts'), /const KEY_PREFIX = 'ato\.questions\.categoryPage\.'/);
  ok('clearLocalQuestionState removes the answer stamps and page positions only, and leaves the prewarm cooldown');

  // Mounted screens reload when the account is rewritten under them.
  const questionsTab = read('src/app/(tabs)/intake-sweep.tsx');
  assert.match(questionsTab, /const dataEpoch = useAccountDataEpoch\(\);/);
  assert.match(questionsTab, /key=\{dataEpoch\}/, 'the fold remounts, dropping its round and stamps');
  assert.match(read('src/app/(tabs)/explore.tsx'), /\}, \[userId, me, dataEpoch\]\);/);
  const catFold = read('src/components/categories-fold.tsx');
  assert.match(catFold, /\}, \[me\.id, me\.updated_at, dataEpoch\]\);/);
  assert.match(catFold, /\}, \[loadStatements, dataEpoch\]\);/);
  ok('Questions, Explore and the categories card reload when the account-data epoch moves');

  /* -------------------------------------------------------------------------
   * The Hub panels.
   * ---------------------------------------------------------------------- */
  const hubSrc = read('src/app/dev-lab.tsx');
  const jumpPanel = hubSrc.slice(hubSrc.indexOf('function JumpThisAccount()'), hubSrc.indexOf('function StartOver()'));
  assert.ok(jumpPanel.length > 0, 'JumpThisAccount panel not found');
  assert.match(jumpPanel, /if \(!PRE_LAUNCH_DEV \|\| !me\) return null/);
  assert.match(jumpPanel, /if \(!twoTap\.confirm\(stage\)\) return;/, 'every jump takes a second tap, on every account');
  assert.match(jumpPanel, /applyDevIntakeStagePreset\(stage, \{ topUpHistory: devAccess\.isRoot \}\)/);
  assert.doesNotMatch(jumpPanel, /isDevTestAccount/, 'no account skips the confirm any more');
  assert.match(jumpPanel, /Pick ONE to jump this account to/);
  assert.match(jumpPanel, /You are here: \{progress\.answered\} of \{progress\.total\} answered/);
  assert.match(jumpPanel, /selected=\{here === stage\.stage\}/, 'the matching stage is highlighted');
  assert.doesNotMatch(jumpPanel, /sageUnlocked|legendsUnlocked|Sage|Legends/);
  ok('Jump panel: reads as a menu, shows "You are here", highlights the match, two taps always');

  const startPanel = hubSrc.slice(hubSrc.indexOf('function StartOver()'), hubSrc.indexOf('function ResetToFreshSignup()'));
  assert.ok(startPanel.length > 0, 'StartOver panel not found');
  assert.match(startPanel, /if \(!twoTap\.confirm\('start-over'\)\) return;/);
  assert.match(startPanel, /\{devAccess\.isRoot \? \(/, 'the button shows for root only');
  assert.match(startPanel, /startOverMyTestData\(\)/);
  assert.doesNotMatch(hubSrc, /Clear all my questions|Fresh signup|resetMyTestData/, 'the overlapping resets are gone from the Hub');
  ok('Start over panel: root-only button, two taps, one reset left in the Hub');

  /* -------------------------------------------------------------------------
   * Start over on the server (wave76).
   * ---------------------------------------------------------------------- */
  const startFn = moduleSrc.slice(moduleSrc.indexOf('export async function startOverMyTestData'));
  assert.match(startFn, /if \(!PRE_LAUNCH_DEV\) throw new Error/);
  assert.match(startFn, /supabase\.rpc\('start_over_my_test_data'\)/, 'no account id is passed — the server uses the caller');
  assert.match(startFn, /afterAccountRewrite\(\{ alsoInsight: true \}\)/);
  const wave76 = read('supabase/migrations/wave76_start_over_my_test_data.sql');
  const fnBody = wave76.slice(wave76.indexOf('create or replace function'), wave76.indexOf('revoke all on function'));
  assert.match(fnBody, /if not public\.is_root\(\) then/, 'server: root only');
  assert.match(fnBody, /uid uuid := auth\.uid\(\)/, 'server: the caller\'s own account');
  assert.match(fnBody, /v_mode is distinct from 'invite_only'/, 'server: refuses once sign-up is public');
  assert.doesNotMatch(fnBody, /delete from public\.(ai_usage|checks|crisis_flags|me)\b/, 'server: leaves AI usage, Checks, safety rows and the profile alone');
  // The whole point of wave76 over wave75: the balance survives.
  assert.doesNotMatch(fnBody, /ato_tokens\s*=|\btokens\s*=/, 'server: the token balances are never written');
  assert.doesNotMatch(fnBody, /allow_ato_token_write|allow_token_write/, 'server: the balance write switches are not opened');
  assert.match(fnBody, /delete from public\.ato_token_events\s+where user_id = uid and reason = 'full_profile_complete';/, 'only the once-ever intake record is cleared');
  assert.doesNotMatch(fnBody, /delete from public\.token_events/);
  for (const table of ['question_items', 'question_packs', 'trait_history', 'trait_tracks', 'daily_insights', 'category_statements']) {
    assert.match(fnBody, new RegExp(`delete from public\\.${table} where user_id = uid;`), `server: clears ${table}`);
  }
  assert.match(wave76, /revoke all on function public\.start_over_my_test_data\(\) from public, anon;/);
  assert.match(wave52, /foreign key \(pack_id\) references public\.question_packs\(id\) on delete cascade/, 'round token records go with their rounds');
  ok('wave76: root + own account + invite-only, clears answers and the intake token record, never touches the balance');

  /* -------------------------------------------------------------------------
   * Re-run the sign-up form (wave66) — deletes the me row; dev-test user only.
   * ---------------------------------------------------------------------- */
  const wave66 = read('supabase/migrations/wave66_dev_test_user_reset.sql');
  const resetFnId = /v_dev_id constant uuid := '([0-9a-f-]{36})'/.exec(wave66)?.[1];
  const devTestUserId = /export const DEV_TEST_USER_ID = '([0-9a-f-]{36})';/.exec(moduleSrc)?.[1];
  assert.ok(resetFnId, 'could not parse v_dev_id out of wave66');
  assert.ok(devTestUserId, 'could not parse DEV_TEST_USER_ID out of dev-test-user.ts');
  assert.equal(resetFnId, devTestUserId, 'wave66 must gate on the real dev-test user id');
  assert.match(wave66, /if auth\.uid\(\) is distinct from v_dev_id then/);
  assert.match(wave66, /raise exception/);
  ok('reset_dev_test_user is hard-gated to the real dev-test user id via auth.uid(), not a parameter');

  assert.doesNotMatch(wave66, /delete from auth\.users/);
  assert.match(wave66, /delete from public\.me where id = v_dev_id;/);
  ok('wave66 deletes the me row but never touches auth.users');

  assert.match(wave66, /revoke execute on function public\.reset_dev_test_user\(\) from public, anon;/);
  assert.match(wave66, /grant execute on function public\.reset_dev_test_user\(\) to authenticated;/);
  ok('reset_dev_test_user execute grant excludes anon');

  const resetFnBody = moduleSrc.slice(resetStart, moduleSrc.indexOf('export const START_OVER_NOT_APPLIED'));
  assert.match(resetFnBody, /if \(!PRE_LAUNCH_DEV\) throw new Error/);
  assert.match(resetFnBody, /user\.id !== DEV_TEST_USER_ID/);
  assert.match(resetFnBody, /supabase\.rpc\('reset_dev_test_user'\)/);
  ok('resetDevTestUserToFreshSignup carries both guards and calls the RPC, not a direct table write');

  const resetPanel = hubSrc.slice(hubSrc.indexOf('function ResetToFreshSignup()'), hubSrc.indexOf('function ResetAiConsent()'));
  assert.ok(resetPanel.length > 0, 'ResetToFreshSignup panel not found');
  assert.match(resetPanel, /if \(!PRE_LAUNCH_DEV \|\| !isDevUser\) return null/);
  assert.match(resetPanel, /confirm !== DEV_TEST_HANDLE/);
  assert.match(resetPanel, /resetDevTestUserToFreshSignup\(\)/);
  ok('the sign-up-form reset is gated on PRE_LAUNCH_DEV + the dev-test user and needs the handle typed');

  /* -------------------------------------------------------------------------
   * The handle-collision account (wave65). The Hub button that poked it is
   * gone; the migration that provisions the hidden account is still pinned.
   * ---------------------------------------------------------------------- */
  const wave65 = read('supabase/migrations/wave65_dev_collision_account.sql');
  const collisionId = /id <> '([0-9a-f-]{36})'/.exec(wave65)?.[1];
  assert.ok(collisionId, 'could not parse an id out of wave65');
  assert.notEqual(collisionId, devTestUserId);
  assert.match(wave65, /'atodev2'/);
  const collisionInsertStart = wave65.indexOf('insert into auth.users');
  const collisionInsertEnd = wave65.indexOf('commit;');
  assert.ok(collisionInsertStart >= 0 && collisionInsertEnd > collisionInsertStart);
  const collisionInsert = wave65.slice(collisionInsertStart, collisionInsertEnd);
  assert.doesNotMatch(collisionInsert, /encrypted_password/);
  assert.doesNotMatch(collisionInsert, /auth\.identities/);
  assert.match(wave65, /\(id, name, handle, timezone, born_on, visible\)[\s\S]{0,200}?false\)/);
  assert.match(wave65, /on conflict \(id\) do update/);
  ok('wave65 collision account: distinct id, hidden, cannot be signed in to, idempotent');

  console.log(`\n${passed}/${passed} dev-test-user checks passed.`);
}

try {
  main();
} catch (error) {
  console.error('\nFAILED:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
