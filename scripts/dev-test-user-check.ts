/**
 * Dev-test identity + archetype presets.
 * Run: npm run check:dev-test-user
 *
 * Static gate for the __DEV__ dev-testing system:
 *   - identity constants match the provisioning migration (wave31) exactly
 *   - every entry point is __DEV__-gated and identity-guarded
 *   - each of the 4 presets (values parsed from dev-test-user.ts) lands
 *     >=2/3 poles of exactly one legend-linked archetype — so switching the
 *     preset shows that legend's card and no other seeded legend's card
 *
 * Band cutoffs mirror src/lib/traits.ts traitBand (high >= 0.67, low <= 0.33);
 * combos mirror the live archetype_defs rows seeded in wave26.
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

const COMBO_BY_ARCHETYPE: Record<string, string> = {
  arch_the_architect: 'conscientiousness:high, autonomy:high, locus_of_control:high',
  arch_the_front_liner: 'extraversion:high, openness:high, self_efficacy:high',
  arch_the_watcher: 'extraversion:low, openness:high, conflict_assertiveness:low',
  arch_the_commander: 'conscientiousness:high, conflict_assertiveness:high, competence:high',
};

/** Preset id -> (linked archetype, legend slug seeded in wave28). */
const LINKED: Record<string, { archetypeId: string; slug: string }> = {
  architect: { archetypeId: 'arch_the_architect', slug: 'leonardo-da-vinci-1452' },
  front_liner: { archetypeId: 'arch_the_front_liner', slug: 'alexander-the-great-356bc' },
  watcher: { archetypeId: 'arch_the_watcher', slug: 'confucius-551bc' },
  commander: { archetypeId: 'arch_the_commander', slug: 'athena-greek-mythology' },
};

/** Mirror of src/lib/traits.ts traitBand. */
function band(value: number): 'low' | 'mid' | 'high' {
  if (value <= 0.33) return 'low';
  if (value >= 0.67) return 'high';
  return 'mid';
}

function parseCombo(combo: string): { axis: string; band: 'high' | 'low' }[] {
  return combo
    .split(',')
    .map((token) => token.trim())
    .map((token) => {
      const [axis, pole] = token.split(':');
      return { axis: axis.trim(), band: pole.trim() as 'high' | 'low' };
    });
}

function hits(combo: string, values: Record<string, number>): number {
  let count = 0;
  for (const pole of parseCombo(combo)) {
    const value = values[pole.axis];
    if (typeof value === 'number' && band(value) === pole.band) count += 1;
  }
  return count;
}

/**
 * Parses each preset's 16 values out of dev-test-user.ts. Each preset is a
 * `id: 'name',` header followed by a 6-space-indented `axis: 0.xx,` block.
 */
function parsePresets(source: string): Map<string, Record<string, number>> {
  const presets = new Map<string, Record<string, number>>();
  let lastId = '';
  let current: Record<string, number> | null = null;
  for (const line of source.split('\n')) {
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
  const wave26 = read('supabase/migrations/wave26_legends_archetypes_content.sql');
  const wave28 = read('supabase/migrations/wave28_legends_approved_seed.sql');

  // Identity constants are single-sourced with the provisioning migration.
  for (const constant of [
    'ato-dev@example.com',
    'atodev',
    'a70d3e0e-4c00-4a1e-8c0d-00000000d3e0',
    'ATO-dev-user-2026',
  ]) {
    assert.match(moduleSrc, new RegExp(esc(constant)));
    assert.match(migration, new RegExp(esc(constant)));
  }
  ok('dev-test-user constants match the wave31 migration');

  // The earlier ad-hoc account is removed by the migration with an audit row.
  assert.match(migration, /delete from auth\.users/);
  assert.match(migration, /ddd90aae-2f0f-4507-a160-423b9223d83b/);
  assert.match(migration, /account_deletions/);
  ok('migration removes the old legends-dev account with an audit row');

  // Legend-history reset needs the owner-delete policy the migration adds.
  assert.match(migration, /user_legend_history_delete_own/);
  assert.match(migration, /for delete using \(auth\.uid\(\) = user_id\)/);
  assert.match(migration, /grant delete on public\.user_legend_history to authenticated/);
  ok('migration grants owner-scoped delete on user_legend_history');

  // Auto-login only from use-session, cold start, __DEV__ only.
  assert.match(sessionSrc, /devTestAutoSignIn/);
  assert.match(sessionSrc, /if \(!data\.session && __DEV__\)/);
  assert.match(moduleSrc, /export async function devTestAutoSignIn\(\)/);
  assert.match(moduleSrc, /if \(!__DEV__\) return false/);
  assert.match(moduleSrc, /signInWithPassword/);
  assert.match(moduleSrc, /export const DEV_TEST_PASSWORD/);
  ok('auto sign-in is __DEV__-gated and only fires with no cached session');

  // Presets refuse to run for any real account.
  assert.match(moduleSrc, /export async function applyDevArchetypePreset\(/);
  assert.match(moduleSrc, /if \(!__DEV__\) throw new Error/);
  assert.match(moduleSrc, /user\.id !== DEV_TEST_USER_ID/);
  assert.match(moduleSrc, /\.from\('user_legend_history'\)[\s\S]*?\.delete\(\)[\s\S]*?\.eq\('user_id', user\.id\)/);
  assert.match(moduleSrc, /\.from\('me'\)[\s\S]*?\.update\([\s\S]*?\.\.\.preset\.values[\s\S]*?trait_sources: traitSources[\s\S]*?trait_touched_at: traitTouchedAt/);
  assert.match(moduleSrc, /traitSources\[axis\] = 'self_settings'/);
  assert.doesNotMatch(moduleSrc, /from '@\/lib\/me'/);
  ok('applyDevArchetypePreset guards __DEV__ + the dev user id, writes me directly, then clears seen history');

  // Legends-tab strip only renders for the dev user, and under __DEV__.
  assert.match(legendsSrc, /DevTestPresetStrip/);
  assert.match(legendsSrc, /if \(!__DEV__ \|\| !isDevUser\) return null/);
  assert.match(legendsSrc, /DEV_TEST_USER_ID/);
  assert.match(legendsSrc, /applyDevArchetypePreset/);
  ok('Legends tab shows the preset strip only for the dev user in __DEV__');

  // 4 presets, each with all 16 axes filled.
  const presets = parsePresets(moduleSrc);
  assert.equal(presets.size, 4, 'expected exactly 4 presets');
  for (const [presetId, values] of presets) {
    assert.ok(LINKED[presetId], `unknown preset id ${presetId}`);
    for (const axis of TRAIT_AXES) {
      assert.ok(values[axis] !== undefined, `${presetId} missing axis ${axis}`);
    }
    assert.equal(Object.keys(values).length, TRAIT_AXES.length);
  }
  ok('4 presets parsed, all 16 axes set on each');

  // Combo source of truth lives in wave26; legend links in wave28.
  for (const { archetypeId } of Object.values(LINKED)) {
    assert.match(wave26, new RegExp(esc(COMBO_BY_ARCHETYPE[archetypeId])));
    assert.match(wave26, new RegExp(esc(archetypeId)));
  }
  for (const { slug, archetypeId } of Object.values(LINKED)) {
    assert.match(wave28, new RegExp(`${esc(slug)}[^)]*${esc(archetypeId)}`));
  }
  ok('preset target combos exist in wave26 and are legend-linked in wave28');

  // Math: each preset hits its own archetype and no other legend-linked one.
  for (const [presetId, values] of presets) {
    const target = LINKED[presetId].archetypeId;
    for (const [archetypeId, combo] of Object.entries(COMBO_BY_ARCHETYPE)) {
      const count = hits(combo, values);
      if (archetypeId === target) {
        assert.ok(count >= 2, `${presetId} should match ${archetypeId}, got ${count} hits`);
      } else {
        assert.ok(count <= 1, `${presetId} must not match ${archetypeId}, got ${count} hits`);
      }
    }
  }
  ok('each preset matches exactly its own legend-linked archetype (>=2/3 poles, others <2)');

  console.log(`\n${passed}/${passed} dev-test-user checks passed.`);
}

try {
  main();
} catch (error) {
  console.error('\nFAILED:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
