/**
 * Dev-test identity, archetype presets, and intake-stage seeding.
 * Run: npm run check:dev-test-user
 *
 * Static gate for the pre-launch Legends persona-switch system:
 *   - identity constants match the provisioning migration (wave31) exactly
 *   - there is no client-side sign-in for this account (see check:dev-unlock
 *     for the password-gated replacement) — applyDevArchetypePreset only
 *     acts on an already-signed-in session and is identity-guarded
 *   - each of the 4 presets (values parsed from dev-test-user.ts) resolves,
 *     under classify.ts's straight midpoint split, to exactly its stated
 *     64-archetype code (core loop redesign §4) — so applying a preset makes
 *     Legends compute that preset's code and no other
 *
 *   - the intake-stage presets (dev test seeding) plan exactly N answers
 *     across the real 50-question bank and land on the correct side of the
 *     Sage (25) and Legends (50) thresholds, checked against the live
 *     predicates rather than a mirror
 *
 * Midpoint split mirrors src/lib/legends64/classify.ts's midpointHighLow
 * (>= 0.5 is high, everything else is low, no mid band — unlike the old
 * 0.67/0.33-banded matcher this replaced, every value resolves to a pole).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DEV_INTAKE_PRESET_SOURCE,
  DEV_INTAKE_PRESET_VALUES,
  DEV_INTAKE_STAGES,
  SCENARIO_PHASE_ANSWERS,
  devIntakeAnswerPlan,
  devIntakeStageById,
  devIntakeTracks,
} from '../src/lib/dev-intake-stages';
import { bankQuestionCount, bankTotalProgress } from '../src/lib/questions/local';
import {
  LEGENDS_UNLOCK_THRESHOLD,
  SAGE_UNLOCK_THRESHOLD,
  legendsUnlocked,
  sageUnlocked,
} from '../src/lib/questions/progressive-unlock';
import { DIRECT_TRAIT_SOURCES } from '../src/lib/traits';
import { SCENARIO_QUESTIONS } from '../src/lib/vibe-check';
import type { TraitTrack } from '../src/lib/trait-stability';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  \u2713 ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const TRAIT_AXES = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'steadiness',
  'attachment_anxiety',
  'attachment_avoidance',
  'conflict_assertiveness',
  'conflict_cooperativeness',
  'autonomy',
  'competence',
  'relatedness',
  'growth_mindset',
  'locus_of_control',
  'self_efficacy',
  'playfulness',
];

/** Preset id -> the classify.ts archetypeCode its values must resolve to. */
const PRESET_CODES: Record<string, string> = {
  architect: 'HLL-HLL',
  front_liner: 'HHH-HHH',
  watcher: 'LLH-HLL',
  commander: 'HHH-LHL',
};

/** Mirror of src/lib/legends64/classify.ts's CORE_AXES/MODIFIER_AXES order. */
const CORE_AXES = ['conscientiousness', 'extraversion', 'openness'];
const MODIFIER_AXES = ['agreeableness', 'conflict_assertiveness', 'relatedness'];

/** Mirror of src/lib/legends64/classify.ts's midpointHighLow. */
function midpointHighLow(value: number | null | undefined): 'H' | 'L' {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.5 ? 'H' : 'L';
}

/** Mirror of src/lib/legends64/classify.ts's archetypeCode. */
function archetypeCodeFrom(values: Record<string, number | null | undefined>): string {
  const core = CORE_AXES.map((axis) => midpointHighLow(values[axis])).join('');
  const modifier = MODIFIER_AXES.map((axis) => midpointHighLow(values[axis])).join('');
  return `${core}-${modifier}`;
}

/**
 * Parses each preset's 16 values out of dev-test-user.ts. Each preset is a
 * `id: 'name',` header followed by a 6-space-indented `axis: 0.xx,` block.
 */
function parsePresets(source: string): Map<string, Record<string, number>> {
  const presets = new Map<string, Record<string, number>>();
  let lastId = '';
  let current: Record<string, number> | null = null;
  for (const line of source.split(/\r?\n/)) {
    const presetId = /^    id: '([a-z_]+)',$/.exec(line);
    if (presetId) {
      if (current) presets.set(lastId, current);
      lastId = presetId[1];
      current = {};
      continue;
    }
    if (!current) continue;
    const axis = /^\s{6}([a-z_]+): ([\d.]+),$/.exec(line);
    if (axis) current[axis[1]] = Number(axis[2]);
  }
  if (current) presets.set(lastId, current);
  return presets;
}

function esc(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main() {
  const moduleSrc = read('src/lib/dev-test-user.ts');
  const sessionSrc = read('src/hooks/use-session.ts');
  const legendsSrc = read('src/app/(tabs)/legends.tsx');
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

  // Presets refuse to run for any real account.
  assert.match(moduleSrc, /export async function applyDevArchetypePreset\(/);
  assert.match(moduleSrc, /if \(!PRE_LAUNCH_DEV\) throw new Error/);
  assert.match(moduleSrc, /user\.id !== DEV_TEST_USER_ID/);
  assert.match(moduleSrc, /\.from\('me'\)[\s\S]*?\.update\([\s\S]*?\.\.\.preset\.values[\s\S]*?trait_sources: traitSources[\s\S]*?trait_touched_at: traitTouchedAt/);
  assert.match(moduleSrc, /traitSources\[axis\] = 'self_settings'/);
  assert.doesNotMatch(moduleSrc, /from '@\/lib\/me'/);
  ok('applyDevArchetypePreset guards PRE_LAUNCH_DEV + the dev user id, writes me directly');

  // Legends-tab strip only renders for the dev user, and under __DEV__.
  assert.match(legendsSrc, /DevTestPresetStrip/);
  assert.match(legendsSrc, /if \(!PRE_LAUNCH_DEV \|\| !isDevUser\) return null/);
  assert.match(legendsSrc, /DEV_TEST_USER_ID/);
  assert.match(legendsSrc, /applyDevArchetypePreset/);
  ok('Legends tab shows the preset strip only for the dev user (pre-launch)');

  // 4 presets, each with all 16 axes filled, each declaring its target code.
  const presets = parsePresets(moduleSrc);
  assert.equal(presets.size, 4, 'expected exactly 4 presets');
  for (const [presetId, values] of presets) {
    assert.ok(PRESET_CODES[presetId], `unknown preset id ${presetId}`);
    for (const axis of TRAIT_AXES) {
      assert.ok(values[axis] !== undefined, `${presetId} missing axis ${axis}`);
    }
    assert.equal(Object.keys(values).length, TRAIT_AXES.length);
  }
  ok('4 presets parsed, all 16 axes set on each');

  // Each preset's `code` field must appear verbatim in the source, and its
  // values (run back through the same midpoint split classify.ts uses) must
  // actually resolve to that code — this is what catches a values edit that
  // silently drifts the resulting archetype away from what the preset claims.
  for (const [presetId, values] of presets) {
    const expected = PRESET_CODES[presetId];
    assert.match(moduleSrc, new RegExp(`id: '${esc(presetId)}',\\s*\\n\\s*code: '${esc(expected)}',`));
    const resolved = archetypeCodeFrom(values);
    assert.equal(resolved, expected, `${presetId}'s values resolve to ${resolved}, not its stated code ${expected}`);
  }
  const allCodes = new Set(Object.values(PRESET_CODES));
  assert.equal(allCodes.size, 4, 'all 4 presets must target distinct archetype codes');
  ok('each preset\'s values resolve to its stated archetypeCode under classify.ts\'s midpoint split, and all 4 codes are distinct');

  // Thin-profile preset — no code concept applies here; thinness is decided
  // purely by settledCount/isThinProfile (trait-stability.ts), not by
  // whether some archetype "matched" (the 64-archetype system always
  // resolves to exactly one code, so there is no miss case to reach).
  assert.match(moduleSrc, /export async function applyDevThinProfilePreset/);
  const thinBody = moduleSrc.slice(moduleSrc.indexOf('export async function applyDevThinProfilePreset'));
  assert.match(thinBody, /PRE_LAUNCH_DEV/, 'thin preset must keep the pre-launch guard');
  assert.match(thinBody, /DEV_TEST_USER_ID/, 'thin preset must refuse non-dev-test users');
  ok('thin-profile preset carries both guards (pre-launch + dev-test user only)');

  // Thin is two facts: me axes null (nothing matches) and tracks unsettled.
  assert.match(thinBody, /clearedValues\[axis\] = null/);
  assert.match(thinBody, /upsertTraitTracks/);
  assert.match(thinBody, /THIN_PRESET_ANSWER_COUNT/);
  // devTracks(null, ...) is what clears the values; a preset vector here would
  // leave matchable poles behind and the gate would never fire.
  assert.match(thinBody, /devTracks\(\s*null,/);
  ok('thin preset nulls every me axis and writes unsettled trait_tracks rows');

  // wave20 revokes delete on trait_tracks from authenticated — rows must be
  // overwritten in place, never deleted, or the preset 403s at runtime.
  const wave20 = read('supabase/migrations/wave20_trait_tracks_titles.sql');
  assert.match(wave20, /revoke delete on public\.trait_tracks/);
  const thinDeletes = thinBody.match(/\.from\('trait_tracks'\)[\s\S]{0,80}?\.delete\(\)/);
  assert.equal(thinDeletes, null, 'thin preset must not delete trait_tracks (delete is revoked)');
  ok('thin preset upserts trait_tracks instead of deleting (wave20 revokes delete)');

  // The floor is what makes answer_count 0 read as unsettled. If the floor ever
  // drops to 0, the preset silently stops producing a thin profile.
  const stabilitySrc = read('src/lib/trait-stability.ts');
  const floor = Number(/STABILITY_FLOOR_N = (\d+)/.exec(stabilitySrc)?.[1]);
  const titleMin = Number(/TITLE_STABLE_MIN = ([\d.]+)/.exec(stabilitySrc)?.[1]);
  const thinCount = Number(/THIN_PRESET_ANSWER_COUNT = (\d+)/.exec(moduleSrc)?.[1]);
  assert.ok(Number.isFinite(floor) && Number.isFinite(thinCount), 'could not read floor/thin count');
  assert.ok(
    thinCount < floor,
    `thin answer_count ${thinCount} must stay under STABILITY_FLOOR_N ${floor}`,
  );
  ok(`thin answer_count (${thinCount}) stays under the stability floor (${floor})`);

  // Behavioral: the thin preset leaves every me axis null. Unlike the old
  // 0.67/0.33-banded matcher (which treated a null axis as a miss, so a
  // thin profile matched nothing), classify.ts's straight midpoint split has
  // no miss case — an unset axis just resolves to 'L' — so this only
  // confirms that stays true and doesn't throw, not that "nothing matches"
  // (there is no such state in the 64-archetype system).
  const classifySrc = read('src/lib/legends64/classify.ts');
  assert.match(classifySrc, /typeof value === 'number' && Number\.isFinite\(value\) && value >= 0\.5 \? 'H' : 'L'/);
  assert.equal(midpointHighLow(null), 'L');
  assert.equal(midpointHighLow(undefined), 'L');
  ok('classify.ts resolves an unset axis to L deterministically, same as this check\'s own mirror');

  // Reversibility: the archetype presets must ALSO write settled tracks, or a
  // single thin tap leaves the dev user permanently unsettled for Categories /
  // Title / Story, which all read settled tracks rather than the me row.
  const archBody = moduleSrc.slice(
    moduleSrc.indexOf('export async function applyDevArchetypePreset'),
    moduleSrc.indexOf('export async function applyDevThinProfilePreset'),
  );
  assert.match(archBody, /upsertTraitTracks/, 'archetype preset must restore tracks');
  const archCount = Number(/ARCHETYPE_PRESET_ANSWER_COUNT = STABILITY_FLOOR_N/.test(moduleSrc)
    ? floor
    : NaN);
  const archStability = Number(/ARCHETYPE_PRESET_STABILITY = ([\d.]+)/.exec(moduleSrc)?.[1]);
  assert.ok(
    archCount >= floor,
    `archetype answer_count ${archCount} must reach STABILITY_FLOOR_N ${floor}`,
  );
  assert.ok(
    archStability >= titleMin,
    `archetype stability ${archStability} must clear TITLE_STABLE_MIN ${titleMin}`,
  );
  ok(`archetype presets restore settled tracks (n=${archCount}, stability=${archStability}) — thin is reversible`);

  // The strip must actually expose it, or there is no way to reach the state.
  assert.match(legendsSrc, /applyDevThinProfilePreset/);
  assert.match(legendsSrc, /Thin profile/);
  ok('Legends dev strip exposes the thin-profile preset');

  /* -------------------------------------------------------------------------
   * Intake-stage presets (dev test seeding).
   *
   * Unlike the archetype block above, these assertions run the REAL functions
   * (dev-intake-stages.ts is deliberately supabase-free so it can be imported
   * here) against the REAL unlock predicates — so a bank edit that changes an
   * axis's question count, or a threshold change, fails here rather than
   * silently seeding a preset onto the wrong side of a boundary.
   * ---------------------------------------------------------------------- */
  const stagesSrc = read('src/lib/dev-intake-stages.ts');

  assert.equal(DEV_INTAKE_STAGES.length, 5, 'expected exactly 5 intake stages');
  const stageIds = DEV_INTAKE_STAGES.map((row) => row.stage);
  assert.deepEqual(stageIds, [
    'fresh',
    'scenarios-only',
    'sage-boundary',
    'pre-legends',
    'legends',
  ]);
  for (const axis of TRAIT_AXES) {
    assert.ok(
      typeof (DEV_INTAKE_PRESET_VALUES as Record<string, number>)[axis] === 'number',
      `intake preset values missing axis ${axis}`,
    );
  }
  assert.equal(Object.keys(DEV_INTAKE_PRESET_VALUES).length, TRAIT_AXES.length);
  ok('5 intake stages in flow order, preset vector covers all 16 axes');

  // The optional phase is 8 two-axis scenarios writing self_scenario, which
  // trackKindForSource routes to the REPORT track — so it leaves 16 answers
  // on the counter, not 0. Seeding 0 would test a state no user can reach.
  const traitsSrc = read('src/lib/traits.ts');
  const stabilitySrcForScenario = read('src/lib/trait-stability.ts');
  assert.equal(Number(/OPTIONAL_INTAKE_TOTAL = (\d+)/.exec(traitsSrc)?.[1]) * 2, SCENARIO_PHASE_ANSWERS);
  assert.match(stabilitySrcForScenario, /source === 'self_game' \? 'game' : 'report'/);
  // Each of the 8 scenarios covers 2 axes and no axis twice — that is what
  // makes "one answer on every axis" true, and 16 the right number.
  const scenarioAxes = SCENARIO_QUESTIONS.flatMap((row) => [...row.axes]);
  assert.equal(scenarioAxes.length, SCENARIO_PHASE_ANSWERS);
  assert.equal(new Set(scenarioAxes).size, SCENARIO_PHASE_ANSWERS, 'an axis is covered twice');
  assert.equal(devIntakeStageById('scenarios-only')?.answered, SCENARIO_PHASE_ANSWERS);
  assert.ok(SCENARIO_PHASE_ANSWERS < SAGE_UNLOCK_THRESHOLD, 'scenarios alone must not unlock Sage');
  ok(`scenarios-only seeds ${SCENARIO_PHASE_ANSWERS}/50 — what a real scenario pass leaves — and stays under the Sage threshold`);

  // The scenario phase must lock its axes against later inferred writes, or
  // the "scenarios-only" state does not actually reproduce what the optional
  // phase leaves behind.
  assert.ok(
    (DIRECT_TRAIT_SOURCES as readonly string[]).includes(DEV_INTAKE_PRESET_SOURCE),
    `${DEV_INTAKE_PRESET_SOURCE} must be a DIRECT trait source`,
  );
  ok(`intake preset source (${DEV_INTAKE_PRESET_SOURCE}) is a direct, sticky source`);

  /**
  * Calls the REAL writer the preset uses, so a regression that wrote the
  * plan to the wrong track or halved the counts fails here rather than
  * passing against a check-local copy of the same logic.
  */
  function tracksFromPlan(plan: Record<string, number>): TraitTrack[] {
    return devIntakeTracks(null, plan as never, "2026-01-01T00:00:00.000Z");
  }
  // Every plan must respect each axis's real bank size and sum to the target.
  const bankTotal = bankTotalProgress([]).total;
  assert.equal(bankTotal, 50, 'bank total must be 50 — thresholds are written against it');
  for (let n = 0; n <= bankTotal; n++) {
    const plan = devIntakeAnswerPlan(n);
    let sum = 0;
    for (const axis of TRAIT_AXES) {
      const count = plan[axis as keyof typeof plan];
      assert.ok(count >= 0, `${axis} plan went negative at n=${n}`);
      assert.ok(
        count <= bankQuestionCount([axis as never]),
        `${axis} plan ${count} exceeds its bank size at n=${n}`,
      );
      sum += count;
    }
    assert.equal(sum, n, `plan for ${n} sums to ${sum}`);
    // The live predicate must agree with the plan, not just the arithmetic.
    assert.equal(bankTotalProgress(tracksFromPlan(plan)).answered, n);
  }
  ok('devIntakeAnswerPlan sums to the target and stays inside every axis cap for 0..50');

  assert.throws(
    () => devIntakeAnswerPlan(bankTotal + 1),
    /Cannot plan/,
    'a plan bigger than the bank must throw, not clamp',
  );
  ok('devIntakeAnswerPlan refuses a total the bank cannot hold');

  // The values branch of the writer — used by 4 of the 5 stages — must put
  // each axis's own value on both of its rows, and the clearing branch must
  // fall back to the mid carrier the NOT NULL column needs.
  const filled = devIntakeTracks(
    DEV_INTAKE_PRESET_VALUES,
    devIntakeAnswerPlan(SCENARIO_PHASE_ANSWERS),
    '2026-01-01T00:00:00.000Z',
  );
  assert.equal(filled.length, TRAIT_AXES.length * 2);
  for (const row of filled) {
    assert.equal(
      row.value,
      (DEV_INTAKE_PRESET_VALUES as Record<string, number>)[row.axis],
      `${row.axis}/${row.track} carries the wrong value`,
    );
  }
  assert.ok(
    devIntakeTracks(null, devIntakeAnswerPlan(0), '2026-01-01T00:00:00.000Z').every(
      (row) => row.value === 0.5 && row.answerCount === 0,
    ),
    'the clearing branch must write the mid carrier at answer_count 0',
  );
  ok('devIntakeTracks maps each axis to its own value, and clears to the mid carrier');

  // The boundaries emci actually tests: 24/25 for Sage, 49/50 for Legends.
  const expectations: [number, boolean, boolean][] = [
    [0, false, false],
    [SAGE_UNLOCK_THRESHOLD - 1, false, false],
    [SAGE_UNLOCK_THRESHOLD, true, false],
    [LEGENDS_UNLOCK_THRESHOLD - 1, true, false],
    [LEGENDS_UNLOCK_THRESHOLD, true, true],
  ];
  for (const [answered, sage, legends] of expectations) {
    const tracks = tracksFromPlan(devIntakeAnswerPlan(answered));
    assert.equal(sageUnlocked(tracks), sage, `sageUnlocked at ${answered}`);
    assert.equal(legendsUnlocked(tracks), legends, `legendsUnlocked at ${answered}`);
  }
  ok('24 does not unlock Sage, 25 does; 49 does not unlock Legends, 50 does');

  // Each stage's declared `answered` must land on the side of the boundary its
  // label claims — this is what stops a renamed/retargeted stage lying.
  const stageUnlocks: Record<string, [boolean, boolean]> = {
    fresh: [false, false],
    'scenarios-only': [false, false],
    'sage-boundary': [true, false],
    'pre-legends': [true, false],
    legends: [true, true],
  };
  for (const stage of DEV_INTAKE_STAGES) {
    const tracks = tracksFromPlan(devIntakeAnswerPlan(stage.answered));
    const [sage, legends] = stageUnlocks[stage.stage];
    assert.equal(sageUnlocked(tracks), sage, `${stage.stage} Sage state`);
    assert.equal(legendsUnlocked(tracks), legends, `${stage.stage} Legends state`);
    assert.equal(
      devIntakeStageById(stage.stage)?.answered,
      stage.answered,
      `${stage.stage} lookup`,
    );
  }
  // Only 'fresh' wipes the profile; the rest differ by answer count alone.
  assert.deepEqual(
    DEV_INTAKE_STAGES.filter((row) => row.clearsProfile).map((row) => row.stage),
    ['fresh'],
  );
  ok('every stage lands on the Sage/Legends side its label claims; only fresh clears the profile');

  // Same guards as the archetype presets, and the same no-delete rule.
  const intakeStart = moduleSrc.indexOf('export async function applyDevIntakeStagePreset');
  assert.ok(intakeStart >= 0, 'applyDevIntakeStagePreset must exist');
  const intakeBody = moduleSrc.slice(intakeStart);
  assert.match(intakeBody, /if \(!PRE_LAUNCH_DEV\) throw new Error/);
  assert.match(intakeBody, /user\.id !== DEV_TEST_USER_ID/);
  assert.match(intakeBody, /upsertTraitTracks/);
  assert.equal(
    intakeBody.match(/\.from\('trait_tracks'\)[\s\S]{0,80}?\.delete\(\)/),
    null,
    'intake preset must not delete trait_tracks (delete is revoked)',
  );
  assert.equal(
    intakeBody.match(/\.from\('me'\)[\s\S]{0,120}?\.delete\(\)/),
    null,
    'intake preset must never delete the me row',
  );
  assert.match(intakeBody, /celebrated_milestone_ids = \[\]/);
  ok('applyDevIntakeStagePreset carries both guards, upserts tracks, deletes nothing, and resets milestone celebrations on fresh');

  // The pure module must stay importable by this check — no supabase client.
  assert.doesNotMatch(stagesSrc, /from '@\/lib\/supabase'/);
  ok('dev-intake-stages stays supabase-free so these assertions run the real functions');

  // The Dev Lab surface is gated twice: pre-launch, and the dev-test user.
  const hubSrc = read('src/app/dev-lab.tsx');
  assert.match(hubSrc, /function IntakeStagePresets\(\)/);
  assert.match(hubSrc, /if \(!PRE_LAUNCH_DEV \|\| !isDevUser\) return null/);
  assert.match(hubSrc, /me\.id === DEV_TEST_USER_ID/);
  assert.match(hubSrc, /applyDevIntakeStagePreset/);
  ok('Dev Lab intake-stage panel is gated on PRE_LAUNCH_DEV and the dev-test user id');

  /* -------------------------------------------------------------------------
   * Reset to fresh signup (wave66) — deletes the me row, unlike every
   * intake-stage preset above.
   * ---------------------------------------------------------------------- */
  const wave66 = read('supabase/migrations/wave66_dev_test_user_reset.sql');

  // The RPC is hard-gated to the real dev-test id, not a parameter — parsed
  // independently from wave66 and from dev-test-user.ts so an edit to either
  // literal alone breaks this, not just a copy-pasted match.
  const resetFnId = /v_dev_id constant uuid := '([0-9a-f-]{36})'/.exec(wave66)?.[1];
  const devTestUserIdForReset = /export const DEV_TEST_USER_ID = '([0-9a-f-]{36})';/.exec(
    moduleSrc,
  )?.[1];
  assert.ok(resetFnId, 'could not parse v_dev_id out of wave66');
  assert.ok(devTestUserIdForReset, 'could not parse DEV_TEST_USER_ID out of dev-test-user.ts');
  assert.equal(resetFnId, devTestUserIdForReset, 'wave66 must gate on the real dev-test user id');
  assert.match(wave66, /if auth\.uid\(\) is distinct from v_dev_id then/);
  assert.match(wave66, /raise exception/);
  ok('reset_dev_test_user is hard-gated to the real dev-test user id via auth.uid(), not a parameter');

  // Must never delete auth.users — only data scoped to this user. And must
  // delete the me row itself (the whole point — unlike the intake presets).
  assert.doesNotMatch(wave66, /delete from auth\.users/);
  assert.match(wave66, /delete from public\.me where id = v_dev_id;/);
  ok('wave66 deletes the me row but never touches auth.users');

  // Execute is restricted to authenticated (the signed-in client calls it
  // directly via .rpc), never left open to anon.
  assert.match(wave66, /revoke execute on function public\.reset_dev_test_user\(\) from public, anon;/);
  assert.match(wave66, /grant execute on function public\.reset_dev_test_user\(\) to authenticated;/);
  ok('reset_dev_test_user execute grant excludes anon');

  // Client wrapper: same two guards as every other dev-test-user action,
  // calls the RPC, never writes to `me`/`trait_tracks` directly (the RPC is
  // the only path since the client has no delete grant on either).
  const resetFnStart = moduleSrc.indexOf('export async function resetDevTestUserToFreshSignup');
  assert.ok(resetFnStart >= 0, 'resetDevTestUserToFreshSignup must exist');
  const resetFnBody = moduleSrc.slice(resetFnStart);
  assert.match(resetFnBody, /if \(!PRE_LAUNCH_DEV\) throw new Error/);
  assert.match(resetFnBody, /user\.id !== DEV_TEST_USER_ID/);
  assert.match(resetFnBody, /supabase\.rpc\('reset_dev_test_user'\)/);
  ok('resetDevTestUserToFreshSignup carries both guards and calls the RPC, not a direct table write');

  // Dev Lab button: gated the same way, requires typing the handle to
  // confirm (destructive), and calls the wrapper above.
  assert.match(hubSrc, /function ResetToFreshSignup\(\)/);
  const resetPanelStart = hubSrc.indexOf('function ResetToFreshSignup');
  const resetPanelEnd = hubSrc.indexOf('\nfunction HandleCollisionCheck');
  const resetPanelScoped = hubSrc.slice(resetPanelStart, resetPanelEnd > 0 ? resetPanelEnd : undefined);
  assert.match(resetPanelScoped, /if \(!PRE_LAUNCH_DEV \|\| !isDevUser\) return null/);
  assert.match(resetPanelScoped, /confirm !== DEV_TEST_HANDLE/);
  assert.match(resetPanelScoped, /resetDevTestUserToFreshSignup\(\)/);
  ok('Reset-to-fresh-signup panel is gated on PRE_LAUNCH_DEV/dev-test-user and requires typing the handle to confirm');

  /* -------------------------------------------------------------------------
   * Preset 6 — handle-collision account (wave65).
   * ---------------------------------------------------------------------- */
  const wave65 = read('supabase/migrations/wave65_dev_collision_account.sql');
  // Anchored to the stale-email guard's "id <>" clause specifically, not
  // "the first 36-char quoted string in the file" — a reordering (e.g. the
  // zero-uuid instance_id ending up first) could otherwise silently become
  // what this matches instead.
  const collisionId = /id <> '([0-9a-f-]{36})'/.exec(wave65)?.[1];
  const realDevTestUserId = /export const DEV_TEST_USER_ID = '([0-9a-f-]{36})';/.exec(
    moduleSrc,
  )?.[1];

  // Migration's id is distinct from the real dev-test user's (parsed from
  // each source, not two copy-pasted literals — a future id edit on either
  // side would actually be caught), and the handle constant the client
  // checks against matches what the migration writes.
  assert.ok(collisionId, 'could not parse an id out of wave65');
  assert.ok(realDevTestUserId, 'could not parse DEV_TEST_USER_ID out of dev-test-user.ts');
  assert.notEqual(collisionId, realDevTestUserId);
  assert.match(moduleSrc, /export const DEV_COLLISION_HANDLE = 'atodev2';/);
  assert.match(wave65, /'atodev2'/);
  ok('handle-collision account id is distinct from @atodev, and the client handle constant matches wave65');

  // Never sign-in-able: no password, no identities row — unlike wave31's
  // real dev-test account, which sets both. Scoped to the INSERT statement
  // itself (not the whole file) so the header comment can still explain why
  // in prose without tripping the assertion on its own words.
  const collisionInsertStart = wave65.indexOf('insert into auth.users');
  const collisionInsertEnd = wave65.indexOf('commit;');
  assert.ok(collisionInsertStart >= 0, 'wave65 must insert into auth.users');
  assert.ok(collisionInsertEnd > collisionInsertStart, 'wave65 must end with commit;');
  const collisionInsert = wave65.slice(collisionInsertStart, collisionInsertEnd);
  assert.doesNotMatch(collisionInsert, /encrypted_password/);
  assert.doesNotMatch(collisionInsert, /auth\.identities/);
  ok('collision account has no password and no identities row — cannot be signed in to');

  // Hidden, so it actually exercises the wave64 bug (a taken handle behind a
  // visible=false row used to read as free).
  assert.match(
    wave65,
    /\(id, name, handle, timezone, born_on, visible\)[\s\S]{0,200}?false\)/,
  );
  ok('collision account me row is inserted with visible = false');

  // Idempotent, same shape as wave31 — including the stale-email guard,
  // which on conflict (id) alone does not cover (a prior row at this email
  // under a different id would fail the insert rather than converge).
  assert.match(wave65, /on conflict \(id\) do update/);
  assert.match(wave65, /delete from auth\.users\s*\nwhere email = 'ato-dev-collision@example\.com'\s*\n\s*and id <> '[0-9a-f-]{36}';/);
  ok('wave65 is idempotent (on conflict do update, plus a stale-email guard, like wave31)');

  // The check button is read-only: it must call the RPC and never write to
  // `me` or any other table.
  assert.match(hubSrc, /function HandleCollisionCheck\(\)/);
  const collisionBody = hubSrc.slice(hubSrc.indexOf('function HandleCollisionCheck'));
  const collisionBodyEnd = collisionBody.indexOf('\nfunction ResetAiConsent');
  const collisionScoped = collisionBody.slice(0, collisionBodyEnd > 0 ? collisionBodyEnd : undefined);
  assert.match(collisionScoped, /if \(!PRE_LAUNCH_DEV \|\| !isDevUser\) return null/);
  // Calls the production client path (the same function onboarding's account
  // step calls), not the bare RPC — so this proves the real call site stays
  // fixed, not just the function underneath it.
  assert.match(collisionScoped, /checkHandleAvailable\(DEV_COLLISION_HANDLE\)/);
  assert.match(hubSrc, /import \{ checkHandleAvailable \} from '@\/lib\/me';/);
  assert.match(collisionScoped, /DEV_COLLISION_HANDLE/);
  assert.doesNotMatch(collisionScoped, /\.update\(/);
  assert.doesNotMatch(collisionScoped, /\.insert\(/);
  assert.doesNotMatch(collisionScoped, /\.delete\(/);
  assert.doesNotMatch(collisionScoped, /\.upsert\(/);
  ok('handle-collision check is gated the same as the intake panel and writes nothing');

  console.log(`\n${passed}/${passed} dev-test-user checks passed.`);
}

try {
  main();
} catch (error) {
  console.error('\nFAILED:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
