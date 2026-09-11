/**
 * 4 Legends 64-archetype presets for the fixed dev-test account, pre-launch
 * (PRE_LAUNCH_DEV) only.
 *
 * The dev-test user is a REAL Supabase auth + me row provisioned by
 * supabase/migrations/wave31_dev_test_user.sql (email ato-dev@example.com,
 * handle @atodev, auth id a70d3e0e-4c00-4a1e-8c0d-00000000d3e0).
 *
 * There is no client-side sign-in for this account anymore — no hardcoded
 * password, no auto-login. Sign in the normal way (Apple / OTP / a password
 * set in Settings) and, while already signed in as @atodev, this module lets
 * that session swap its trait profile between 4 presets, each targeting a
 * distinct classify.ts archetypeCode (core loop redesign §4 — the old
 * figure-catalog matcher, src/lib/legends/match.ts, no longer exists). The
 * account has no special grants (not root, not founder, no dev-lab
 * capabilities).
 *
 * Preset vectors are hand-set so each resolves to its stated `code` under
 * classify.ts's straight midpoint split (>= 0.5 is high) on exactly the 6
 * axes archetypeCode reads (CORE_AXES: conscientiousness, extraversion,
 * openness; MODIFIER_AXES: agreeableness, conflict_assertiveness,
 * relatedness) — unlike the old 0.67/0.33-banded matcher, every value lands
 * somewhere, so there's no "miss" case to guard against, only "which side of
 * 0.5." scripts/dev-test-user-check asserts each preset's values actually
 * resolve to its stated code, so a values edit that drifts the code is
 * caught.
 *
 * Presets are written DIRECTLY to the me trait columns (with self_settings
 * source tokens) rather than through updateTraits's EWMA pipeline: that
 * pipeline blends each write toward prior answers, so a second preset switch
 * would land between the poles and drift the resulting code. A dev persona
 * switch is an exact rewrite by design; history/tracks stay out of it.
 */

import { supabase } from '@/lib/supabase';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { STABILITY_FLOOR_N, TITLE_STABLE_MIN, type TraitTrack } from '@/lib/trait-stability';
import { upsertTraitTracks } from '@/lib/trait-tracks-store';
import {
  DEV_INTAKE_PRESET_SOURCE,
  DEV_INTAKE_PRESET_VALUES,
  devIntakeAnswerPlan,
  devIntakeStageById,
  devIntakeTracks,
  type DevIntakeStageId,
} from '@/lib/dev-intake-stages';

export const DEV_TEST_HANDLE = 'atodev';
export const DEV_TEST_USER_ID = 'a70d3e0e-4c00-4a1e-8c0d-00000000d3e0';

/**
 * Second dev identity (wave65), for handle-collision testing only. Hidden
 * (me.visible = false), no password, no auth.identities row — it can never
 * be the signed-in session, only a taken handle behind a paused profile.
 * Not exported as a user id: nothing in the client is meant to sign in as or
 * write to this account, only read its handle_taken result.
 */
export const DEV_COLLISION_HANDLE = 'atodev2';

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
  /** Expected classify.ts archetypeCode these values resolve to (core: conscientiousness/extraversion/openness, modifier: agreeableness/conflict_assertiveness/relatedness — see legends64/classify.ts's CORE_AXES/MODIFIER_AXES order). */
  code: string;
  values: Record<TraitAxis, number>;
}

export const DEV_ARCHETYPE_PRESETS: readonly DevArchetypePreset[] = [
  {
    id: 'architect',
    code: 'HLL-HLL',
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
    code: 'HHH-HHH',
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
    code: 'LLH-HLL',
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
    code: 'HHH-LHL',
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
 * Switches the signed-in dev user's trait profile to an archetype preset, so
 * Legends' archetypeCode() recomputes to the preset's stated `code` on next
 * load. Refuses to run for anyone except the fixed dev-test user — a real
 * account's traits are never overwritten by this tool.
 *
 * Writes every axis directly to the me row (source self_settings, touched now)
 * so the stored profile is exactly the preset — deliberately not the EWMA
 * updateTraits pipeline, which would blend consecutive switches toward mid
 * band and drift the resulting code (see the module header).
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
  // No "seen history" to reset for the 64-archetype system: archetypeCode()
  // is a pure function of live trait values, recomputed fresh every time
  // Legends loads — there is nothing analogous to the old
  // user_legend_history dedup state to clear. A stale legend_generations row
  // from a previous preset is left in place; the Reroll button (paid) or a
  // fresh manual trigger (if none exists yet) is how a tester gets a new one.
}

/**
 * Clears the dev-test user's profile so Legends' thin-profile gate fires:
 * isThinProfile(settledCount(tracks)) true. Unlike the old figure-catalog
 * system, the 64-archetype system has no "no archetype matched" state to
 * reach — classify.ts always resolves to exactly one code, even from null
 * axes (see midpointHighLow) — so this preset targets settledCount alone,
 * not any archetype-matching concept. No archetype preset above can reach
 * this state, since each is built to reach STABILITY_FLOOR_N.
 *
 * Two writes, because thin is two separate facts:
 *   1. me axis columns -> null (the honest unanswered state, and what makes
 *      missingAxis pick the first unanswered axis).
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
}

/**
 * The onboarding "intake" preference taps, cleared by the fresh stage so the
 * account reads as a signup that has answered nothing yet. All nullable
 * (wave23 dropped NOT NULL on the first four; stage9_intake_core added the
 * rest nullable). `recovery_style` is a parameter of the wave23 RPC but is
 * never collected by the live onboarding screen, so it is deliberately not
 * listed here.
 */
const DEV_INTAKE_PREFERENCE_COLUMNS = [
  'show_up',
  'talk_style',
  'knocks_you_off',
  'morning_cue',
  'evening_wind_down',
  'energy_pattern',
  'support_style',
  'current_focus',
] as const;

/**
 * Jumps the signed-in dev-test user to one onboarding/intake stage.
 *
 * KNOWN LIMIT on 'fresh': the me row itself is NOT deleted. The onboarding
 * screen renders only under `guard={isAuthed && !hasMe}` (src/app/_layout.tsx),
 * so replaying the "Introduce yourself" form would mean deleting the row that
 * IS the @atodev identity — and wave20-era grants give the client no delete on
 * it. This stage resets what the intake forms wrote — traits, sources,
 * tracks, the preference taps — but deliberately NOT the account facts the
 * identity depends on (`born_on`, `timezone`, handle, name), and not
 * `sage_knows`. It does not put the onboarding form back on screen. The
 * separate presence-streak `milestones_celebrated` state is left alone too:
 * it is driven by Checks, not by intake.
 */
export async function applyDevIntakeStagePreset(
  stageId: DevIntakeStageId,
): Promise<void> {
  if (!PRE_LAUNCH_DEV) throw new Error('Dev intake presets are pre-launch only');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== DEV_TEST_USER_ID) {
    throw new Error('Dev intake presets only apply to the fixed dev-test user');
  }

  const stage = devIntakeStageById(stageId);
  if (!stage) throw new Error(`Unknown dev intake stage: ${stageId}`);

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {};

  if (stage.clearsProfile) {
    for (const axis of TRAIT_AXES) patch[axis] = null;
    patch.trait_sources = {};
    patch.trait_touched_at = {};
    for (const column of DEV_INTAKE_PREFERENCE_COLUMNS) patch[column] = null;
  } else {
    const traitSources: Record<string, string> = {};
    const traitTouchedAt: Record<string, string> = {};
    for (const axis of TRAIT_AXES) {
      patch[axis] = DEV_INTAKE_PRESET_VALUES[axis];
      traitSources[axis] = DEV_INTAKE_PRESET_SOURCE;
      traitTouchedAt[axis] = nowIso;
    }
    patch.trait_sources = traitSources;
    patch.trait_touched_at = traitTouchedAt;
  }

  // Cleared on EVERY stage, not just fresh: jumping legends -> sage-boundary
  // and back is the whole point of the tool, and a celebration that already
  // fired would never fire again on the way back up.
  // NOT NULL default '{}' (wave43) — empty array, never null.
  patch.celebrated_milestone_ids = [];

  const { error } = await supabase.from('me').update(patch).eq('id', user.id);
  if (error) throw error;

  await upsertTraitTracks(
    user.id,
    devIntakeTracks(
      stage.clearsProfile ? null : DEV_INTAKE_PRESET_VALUES,
      devIntakeAnswerPlan(stage.answered),
      nowIso,
    ),
  );
}
