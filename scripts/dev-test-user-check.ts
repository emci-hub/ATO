/**
 * Dev-test identity + archetype presets.
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
 * Midpoint split mirrors src/lib/legends64/classify.ts's midpointHighLow
 * (>= 0.5 is high, everything else is low, no mid band — unlike the old
 * 0.67/0.33-banded matcher this replaced, every value resolves to a pole).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

  console.log(`\n${passed}/${passed} dev-test-user checks passed.`);
}

try {
  main();
} catch (error) {
  console.error('\nFAILED:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
