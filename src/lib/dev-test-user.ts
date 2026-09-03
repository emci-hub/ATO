/**
 * 4 Legends-archetype presets for the fixed dev-test account, pre-launch
 * (PRE_LAUNCH_DEV) only.
 *
 * The dev-test user is a REAL Supabase auth + me row provisioned by
 * supabase/migrations/wave31_dev_test_user.sql (email ato-dev@example.com,
 * handle @atodev, auth id a70d3e0e-4c00-4a1e-8c0d-00000000d3e0).
 *
 * There is no client-side sign-in for this account anymore — no hardcoded
 * password, no auto-login. Sign in the normal way (Apple / OTP / a password
 * set in Settings) and, while already signed in as @atodev, this module lets
 * that session swap its trait profile between the 4 seeded Legends
 * archetypes (matching logic: src/lib/legends/match.ts). The account has no
 * special grants (not root, not founder, no dev-lab capabilities).
 *
 * Preset vectors are hand-set so each hits >=2/3 poles of exactly one of the
 * four legend-linked archetypes (Archetypes: Architect = C/autonomy/LOC high,
 * Front-Liner = E/openness/SE high, Watcher = E low/openness high/assertiveness
 * low, Commander = C/assertiveness/competence high). Values use the app's band
 * cutoffs: high >= 0.67, low <= 0.33, mid misses. scripts/dev-test-user-check
 * asserts these stay single-match if a combo ever changes.
 *
 * Presets are written DIRECTLY to the me trait columns (with self_settings
 * source tokens) rather than through updateTraits's EWMA pipeline: that
 * pipeline blends each write toward prior answers, so a second preset switch
 * would land between the poles and never match. A dev persona switch is an
 * exact rewrite by design; history/tracks stay out of it.
 */

import { supabase } from '@/lib/supabase';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';

export const DEV_TEST_HANDLE = 'atodev';
export const DEV_TEST_USER_ID = 'a70d3e0e-4c00-4a1e-8c0d-00000000d3e0';

export type DevArchetypePresetId = 'architect' | 'front_liner' | 'watcher' | 'commander';

export interface DevArchetypePreset {
  id: DevArchetypePresetId;
  /** Legend the linked archetype unlocks (the card you should see). */
  legendName: string;
  archetypeId: string;
  values: Record<TraitAxis, number>;
}

export const DEV_ARCHETYPE_PRESETS: readonly DevArchetypePreset[] = [
  {
    id: 'architect',
    legendName: 'Da Vinci',
    archetypeId: 'arch_the_architect',
    values: {
      openness: 0.45,
      conscientiousness: 0.8,
      extraversion: 0.35,
      agreeableness: 0.55,
      steadiness: 0.6,
      attachment_anxiety: 0.3,
      attachment_avoidance: 0.45,
      conflict_assertiveness: 0.35,
      conflict_cooperativeness: 0.55,
      autonomy: 0.85,
      competence: 0.5,
      relatedness: 0.45,
      growth_mindset: 0.6,
      locus_of_control: 0.85,
      self_efficacy: 0.55,
      playfulness: 0.5,
    },
  },
  {
    id: 'front_liner',
    legendName: 'Alexander the Great',
    archetypeId: 'arch_the_front_liner',
    values: {
      openness: 0.8,
      conscientiousness: 0.5,
      extraversion: 0.8,
      agreeableness: 0.5,
      steadiness: 0.45,
      attachment_anxiety: 0.35,
      attachment_avoidance: 0.45,
      conflict_assertiveness: 0.5,
      conflict_cooperativeness: 0.55,
      autonomy: 0.45,
      competence: 0.6,
      relatedness: 0.5,
      growth_mindset: 0.6,
      locus_of_control: 0.45,
      self_efficacy: 0.8,
      playfulness: 0.5,
    },
  },
  {
    id: 'watcher',
    legendName: 'Confucius',
    archetypeId: 'arch_the_watcher',
    values: {
      openness: 0.8,
      conscientiousness: 0.45,
      extraversion: 0.2,
      agreeableness: 0.5,
      steadiness: 0.5,
      attachment_anxiety: 0.55,
      attachment_avoidance: 0.45,
      conflict_assertiveness: 0.25,
      conflict_cooperativeness: 0.6,
      autonomy: 0.45,
      competence: 0.5,
      relatedness: 0.45,
      growth_mindset: 0.5,
      locus_of_control: 0.5,
      self_efficacy: 0.55,
      playfulness: 0.4,
    },
  },
  {
    id: 'commander',
    legendName: 'Athena',
    archetypeId: 'arch_the_commander',
    values: {
      openness: 0.5,
      conscientiousness: 0.8,
      extraversion: 0.55,
      agreeableness: 0.45,
      steadiness: 0.6,
      attachment_anxiety: 0.4,
      attachment_avoidance: 0.45,
      conflict_assertiveness: 0.8,
      conflict_cooperativeness: 0.4,
      autonomy: 0.55,
      competence: 0.8,
      relatedness: 0.45,
      growth_mindset: 0.6,
      locus_of_control: 0.55,
      self_efficacy: 0.6,
      playfulness: 0.45,
    },
  },
];

export function devPresetById(
  id: DevArchetypePresetId,
): DevArchetypePreset | null {
  return DEV_ARCHETYPE_PRESETS.find((preset) => preset.id === id) ?? null;
}

/**
 * Switches the signed-in dev user's trait profile to an archetype preset and
 * clears their legend history so the matching legend can be shown again.
 * Refuses to run for anyone except the fixed dev-test user — a real account's
 * traits are never overwritten by this tool.
 *
 * Writes every axis directly to the me row (source self_settings, touched now)
 * so the stored profile is exactly the preset — deliberately not the EWMA
 * updateTraits pipeline, which would blend consecutive switches toward mid
 * band and break the match (see the module header).
 */
export async function applyDevArchetypePreset(
  presetId: DevArchetypePresetId,
): Promise<void> {
  if (!PRE_LAUNCH_DEV) throw new Error('Dev archetype presets are pre-launch only');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== DEV_TEST_USER_ID) {
    throw new Error('Dev archetype presets only apply to the fixed dev-test user');
  }

  const preset = devPresetById(presetId);
  if (!preset) throw new Error(`Unknown dev archetype preset: ${presetId}`);

  const nowIso = new Date().toISOString();
  const traitSources: Record<string, string> = {};
  const traitTouchedAt: Record<string, string> = {};
  for (const axis of TRAIT_AXES) {
    traitSources[axis] = 'self_settings';
    traitTouchedAt[axis] = nowIso;
  }

  const { error } = await supabase
    .from('me')
    .update({
      ...preset.values,
      trait_sources: traitSources,
      trait_touched_at: traitTouchedAt,
    })
    .eq('id', user.id);
  if (error) throw error;

  // Reset "already seen" so the same legend re-appears for the next test.
  // wave31 added the owner-scoped delete policy that makes this allowed.
  const { error: historyError } = await supabase
    .from('user_legend_history')
    .delete()
    .eq('user_id', user.id);
  if (historyError) throw historyError;
}
