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
import { STABILITY_FLOOR_N, TITLE_STABLE_MIN, type TraitTrack } from '@/lib/trait-stability';
import { upsertTraitTracks } from '@/lib/trait-tracks-store';

export const DEV_TEST_HANDLE = 'atodev';
export const DEV_TEST_USER_ID = 'a70d3e0e-4c00-4a1e-8c0d-00000000d3e0';

export type DevArchetypePresetId = 'architect' | 'front_liner' | 'watcher' | 'commander';

/**
 * answer_count written by the thin preset. Must stay under STABILITY_FLOOR_N
 * or effectiveStability stops flooring to 0 and the profile reads as settled.
 * scripts/dev-test-user-check asserts the relationship.
 */
export const THIN_PRESET_ANSWER_COUNT = 0;

/**
 * answer_count / stability written by the ARCHETYPE presets. Both must clear
 * their floors (STABILITY_FLOOR_N, TITLE_STABLE_MIN) so a preset restores a
 * settled profile — this is what makes the thin preset reversible.
 */
export const ARCHETYPE_PRESET_ANSWER_COUNT = STABILITY_FLOOR_N;
export const ARCHETYPE_PRESET_STABILITY = 0.8;

/**
 * Axes where an archetype preset deliberately offsets the GAME track away from
 * the report track, so told-vs-played divergence stays testable on the dev user
 * (divergingAxesFromTracks needs |report - game| >= 0.25). Without this, both
 * tracks carry the same preset vector and divergence is always empty.
 */
const DEV_DIVERGENT_AXES: readonly TraitAxis[] = ['openness', 'extraversion', 'autonomy'];
const DEV_DIVERGENCE_OFFSET = 0.3;

/**
 * Both presets rewrite the whole track table for the dev user. Tracks are
 * upserted, never deleted: wave20 grants only select/insert/update on
 * trait_tracks to authenticated and explicitly revokes delete.
 *
 * Also resets lastDepthAt to null on every row, which clears the depth-dive
 * cooldown (depthReady treats null as ready) — intended, so a persona switch
 * can immediately re-test depth prompts.
 */
function devTracks(
  values: Record<TraitAxis, number> | null,
  answerCount: number,
  stability: number,
  nowIso: string,
): TraitTrack[] {
  const rows: TraitTrack[] = [];
  for (const axis of TRAIT_AXES) {
    for (const track of ['report', 'game'] as const) {
      // NOT NULL in the table. Mid is the neutral carrier when clearing.
      let value = values ? values[axis] : 0.5;
      if (values && track === 'game' && DEV_DIVERGENT_AXES.includes(axis)) {
        // Push away from the report value, staying inside [0, 1].
        value =
          value > 0.5 ? value - DEV_DIVERGENCE_OFFSET : value + DEV_DIVERGENCE_OFFSET;
      }
      rows.push({
        axis,
        track,
        value,
        stability,
        answerCount,
        lastTouched: nowIso,
        lastDepthAt: null,
      });
    }
  }
  return rows;
}

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

  // Settle the tracks too, or a profile that was thinned by the thin preset
  // below would stay thin forever — Categories / Title / Story / Full Profile
  // all read settled tracks, not the me row, so an archetype tap has to undo
  // the thin write to be a real round trip.
  await upsertTraitTracks(
    user.id,
    devTracks(
      preset.values,
      ARCHETYPE_PRESET_ANSWER_COUNT,
      ARCHETYPE_PRESET_STABILITY,
      nowIso,
    ),
  );

  // Reset "already seen" so the same legend re-appears for the next test.
  // wave31 added the owner-scoped delete policy that makes this allowed.
  const { error: historyError } = await supabase
    .from('user_legend_history')
    .delete()
    .eq('user_id', user.id);
  if (historyError) throw historyError;
}

/**
 * Clears the dev-test user's profile so the Legends thin-profile gate fires:
 * catalog non-empty, NO archetype matched, isThinProfile true. No archetype
 * preset above can reach this state, since each is built to match one.
 *
 * Two writes, because thin is two separate facts:
 *   1. me axis columns -> null, so buildLegendView sees no poles and nothing
 *      matches (a mid value would also miss, but null is the honest unanswered
 *      state and makes missingAxis pick the first unanswered axis).
 *   2. trait_tracks -> answer_count 0, so effectiveStability floors to 0 for
 *      every axis and settledCount lands at 0.
 *
 * NOT identical to a brand-new account: a real new user has NO track rows,
 * while this leaves 32 rows carrying a mid value. Readers that gate on
 * answerCount (settled math, Categories, Title, Story) treat the two the same,
 * but any reader that takes track.value directly — Full Profile's per-axis rows
 * — will show 16 filled mid-band axes rather than "not answered yet". Rows are
 * overwritten rather than removed because wave20 revokes delete on
 * trait_tracks; upsert is the only path the client has.
 *
 * Reversible: any archetype preset above rewrites both the me row AND the
 * tracks at a settled answer_count, so a thin apply is undone by one tap.
 */
export async function applyDevThinProfilePreset(): Promise<void> {
  if (!PRE_LAUNCH_DEV) throw new Error('Dev test presets are pre-launch only');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== DEV_TEST_USER_ID) {
    throw new Error('Dev test presets only apply to the fixed dev-test user');
  }

  const clearedValues: Record<string, null> = {};
  for (const axis of TRAIT_AXES) clearedValues[axis] = null;

  const { error } = await supabase
    .from('me')
    .update({
      ...clearedValues,
      trait_sources: {},
      trait_touched_at: {},
    })
    .eq('id', user.id);
  if (error) throw error;

  await upsertTraitTracks(
    user.id,
    devTracks(null, THIN_PRESET_ANSWER_COUNT, 0, new Date().toISOString()),
  );

  const { error: historyError } = await supabase
    .from('user_legend_history')
    .delete()
    .eq('user_id', user.id);
  if (historyError) throw historyError;
}
