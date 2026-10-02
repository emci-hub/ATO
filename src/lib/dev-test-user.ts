/**
 * Dev test actions on an account's own data, pre-launch (PRE_LAUNCH_DEV) only.
 *
 * Three things live here:
 *   - `applyDevIntakeStagePreset` — "Jump this account": writes the signed-in
 *     account's own trait rows to a known point (lib/dev-intake-stages.ts).
 *   - `startOverMyTestData` — "Start over": the server clears the account's
 *     answers and everything generated from them, keeps the account and its
 *     token balance (wave76, root only).
 *   - `resetDevTestUserToFreshSignup` — the dev-test account only: deletes its
 *     profile row so the real sign-up form runs again (wave66).
 *
 * The dev-test user is a REAL Supabase auth + me row provisioned by
 * supabase/migrations/wave31_dev_test_user.sql (email ato-dev@example.com,
 * handle @atodev, auth id a70d3e0e-4c00-4a1e-8c0d-00000000d3e0). There is no
 * client-side sign-in for it: sign in the normal way.
 *
 * REMOVED 2026-10-01: the four Legends archetype presets and the thin-profile
 * preset. Legends is a placeholder and no screen called them.
 */

import { supabase } from '@/lib/supabase';
import { TRAIT_AXES } from '@/lib/traits';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { bumpAccountDataEpoch } from '@/lib/account-data-epoch';
import { insertTraitHistory } from '@/lib/trait-history-store';
import { upsertTraitTracks } from '@/lib/trait-tracks-store';
import {
  DEV_INTAKE_PRESET_SOURCE,
  DEV_INTAKE_PRESET_VALUES,
  devHistoryRows,
  devIntakeStageById,
  devIntakeTracks,
  devPlanTotal,
  type DevAnswerPlan,
  type DevIntakeStageId,
} from '@/lib/dev-intake-stages';

export const DEV_TEST_HANDLE = 'atodev';
export const DEV_TEST_USER_ID = 'a70d3e0e-4c00-4a1e-8c0d-00000000d3e0';

/**
 * Tops the account's answer history up to what the plan stands for.
 *
 * `claim_full_profile_complete` (wave52) pays the first +21 only once 50
 * `self_situation` rows exist in trait_history, and a jump writes none, so the
 * reveal could never show the +21 on a jumped account. The client may insert
 * its own history rows but not delete them, so this only ever ADDS the
 * shortfall: repeated jumps do not pile rows up.
 */
async function topUpAnswerHistory(userId: string, plan: DevAnswerPlan): Promise<void> {
  const target = devPlanTotal(plan);
  const { count, error } = await supabase
    .from('trait_history')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', DEV_INTAKE_PRESET_SOURCE);
  if (error) throw error;
  const missing = target - (count ?? 0);
  if (missing <= 0) return;
  await insertTraitHistory(userId, devHistoryRows(plan, missing));
}

/**
 * What every dev rewrite of an account must do afterwards, or the app shows
 * the account it was a moment ago: drop the device's answer stamps and page
 * position, then tell mounted screens to reload. Lazily imported so the Node
 * check scripts that read this module never load AsyncStorage.
 */
async function afterAccountRewrite(options: { alsoInsight?: boolean } = {}): Promise<void> {
  try {
    const { clearLocalQuestionState } = await import('@/lib/local-account-data');
    await clearLocalQuestionState(options);
  } catch (err) {
    console.log('[dev] local question state clear skipped:', err);
  }
  bumpAccountDataEpoch();
}

/**
 * "Jump this account": puts the signed-in account at one stage.
 *
 * RULE (emci, lifted 2026-10-01 and widened the same day to cover the stages
 * past the 50): any signed-in account may seed ITS OWN rows pre-launch — RLS
 * scopes every write here to the caller. It overwrites that account's trait
 * scores and answer counts, so the UI asks for a second tap on every account.
 *
 * Writes the me trait columns, the track rows and — for root, which can undo
 * it with Start over — the answer-history top-up that makes the +21 testable.
 * Leaves saved rounds, tokens and generated text alone — "Start over" is what
 * clears those. `celebrated_milestone_ids` is emptied on every jump so the
 * after-50 reveal shows again; that is the point of jumping back and forth.
 */
export async function applyDevIntakeStagePreset(
  stageId: DevIntakeStageId,
  options: { topUpHistory?: boolean } = {},
): Promise<void> {
  if (!PRE_LAUNCH_DEV) throw new Error('Dev jumps are pre-launch only');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to use the dev jumps');

  const stage = devIntakeStageById(stageId);
  if (!stage) throw new Error(`Unknown dev stage: ${stageId}`);
  const plan = stage.plan();

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  const traitSources: Record<string, string> = {};
  const traitTouchedAt: Record<string, string> = {};
  for (const axis of TRAIT_AXES) {
    const answered = plan[axis] > 0;
    patch[axis] = answered ? DEV_INTAKE_PRESET_VALUES[axis] : null;
    if (answered) {
      traitSources[axis] = DEV_INTAKE_PRESET_SOURCE;
      traitTouchedAt[axis] = nowIso;
    }
  }
  patch.trait_sources = traitSources;
  patch.trait_touched_at = traitTouchedAt;
  // NOT NULL default '{}' (wave43) — empty array, never null.
  patch.celebrated_milestone_ids = [];

  const { error } = await supabase.from('me').update(patch).eq('id', user.id);
  if (error) throw error;

  // From here the account HAS changed, so the cleanup runs even if a later
  // write throws — otherwise screens keep showing the account as it was.
  try {
    await upsertTraitTracks(user.id, devIntakeTracks(DEV_INTAKE_PRESET_VALUES, plan, nowIso));
    // History rows cannot be deleted by the client and only "Start over" (root)
    // removes them. So they are only written where they can be undone: on a
    // non-root account they would sit in the "How this has shifted" timeline
    // for good and hand that account one real +21.
    if (options.topUpHistory) await topUpAnswerHistory(user.id, plan);
  } finally {
    await afterAccountRewrite();
  }
}

/**
 * Fully resets the signed-in dev-test user back to before onboarding —
 * unlike "Start over", this actually deletes the
 * `me` row (via the `reset_dev_test_user` RPC, wave66), so the app's own
 * `guard={isAuthed && !hasMe}` (src/app/_layout.tsx) puts the real
 * "Introduce yourself" onboarding screen back on screen — no account
 * deletion/recreation needed. The Supabase auth user/session is untouched;
 * only data scoped to this one fixed account is removed. The RPC itself
 * hard-gates to the same literal id server-side, so this client guard is a
 * convenience, not the only enforcement.
 */
export async function resetDevTestUserToFreshSignup(): Promise<void> {
  if (!PRE_LAUNCH_DEV) throw new Error('Dev-test reset is pre-launch only');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== DEV_TEST_USER_ID) {
    throw new Error('Dev-test reset only applies to the fixed dev-test user');
  }

  const { error } = await supabase.rpc('reset_dev_test_user');
  if (error) throw error;
  await afterAccountRewrite({ alsoInsight: true });
}

/** Shown when the server function behind "Start over" is not there yet. */
export const START_OVER_NOT_APPLIED =
  'Start over needs the wave76 database change, which is not applied yet.';
export const START_OVER_NOT_ROOT = 'Only a root account can start over.';

/**
 * "Start over" — the one reset for the signed-in account: answers, trait
 * scores, saved rounds, answer history, generated text and the once-ever +21
 * record, so the whole flow can be walked again from 0 of 50. Keeps the
 * account, the profile and the token balance. The server does the work and
 * enforces the rules (root only, own account only, invite-only phase):
 * `start_over_my_test_data()`, wave76.
 */
export async function startOverMyTestData(): Promise<void> {
  if (!PRE_LAUNCH_DEV) throw new Error('Start over is pre-launch only');
  const { error } = await supabase.rpc('start_over_my_test_data');
  if (error) {
    const text = `${error.code ?? ''} ${error.message ?? ''}`;
    // PostgREST answers PGRST202 / "Could not find the function" until wave76 is applied.
    if (/PGRST202|Could not find the function/i.test(text)) throw new Error(START_OVER_NOT_APPLIED);
    if (/root only/i.test(text)) throw new Error(START_OVER_NOT_ROOT);
    // A real Error, so the panel shows the server's own reason (e.g. sign-up is public).
    throw new Error(error.message || 'Could not start this account over.');
  }
  await afterAccountRewrite({ alsoInsight: true });
}
