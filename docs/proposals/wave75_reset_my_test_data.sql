-- ============================================================================
-- DRAFT — NOT APPLIED. NOT A MIGRATION YET.
-- Lives in docs/proposals/ on purpose so nothing applies it by accident.
-- To use it: emci reviews, then it is copied to
--   supabase/migrations/wave75_reset_my_test_data.sql
-- and applied. Written 2026-10-01; tightened after review the same day.
-- ============================================================================
--
-- WHY. emci lifted the "dev-test user only" rule (2026-10-01) so testing can
-- happen on a real account without deleting and recreating it. The app can
-- already jump an account to any point in the 50 questions (it only writes that
-- account's own rows). What the app CANNOT do by itself:
--
--   * delete the token history, so the +21 for finishing the 50 (paid once ever)
--     can be earned again on a re-test;
--   * delete saved rounds of 25, insights, category reads and the story;
--   * reset the token balance (a trigger refuses client writes to it).
--
-- WHAT THIS ADDS. One function, reset_my_test_data(): "clear all my questions".
-- It wipes what the account has answered or been given — answers, trait scores,
-- rounds, tokens, insights, category reads, story — and keeps the profile itself
-- (name, handle, birthday, city, AI consent, friends, root status). The account
-- lands back at 0 / 50, as if it had just signed up.
--
-- WHO CAN USE IT.
--   * ROOT ACCOUNTS ONLY (public.is_root()). An ordinary invited tester cannot
--     call it — otherwise they could loop it to re-earn the +21 forever.
--   * It acts on the CALLER'S OWN account only (auth.uid()). No account id can
--     be passed in, so a root cannot reset anybody else with it either.
--   * It refuses once sign-up is public (app_config.signup_mode = 'public').
--     Drop it in the pre-launch pass anyway.
--
-- WHAT IT DELIBERATELY LEAVES ALONE.
--   * ai_usage — today's AI call count. Clearing it would hand back the day's 20
--     paid calls on every reset.
--   * checks, crisis_flags, ai_provider_log — history / safety / audit rows.
--   * Anything belonging to other people (connections, threads, invites).
--   * The profile row. "Start over from the sign-up form" is NOT offered here:
--     it would delete rows other accounts point at. The dev-test account's own
--     reset_dev_test_user() still does that for @atodev, unchanged.
-- ============================================================================

create or replace function public.reset_my_test_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_mode text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.is_root() then
    raise exception 'reset_my_test_data is root only' using errcode = '42501';
  end if;

  select signup_mode into v_mode from public.app_config where id = 1;
  if v_mode is distinct from 'invite_only' then
    raise exception 'reset_my_test_data is disabled once sign-up is public' using errcode = '42501';
  end if;

  -- What the account answered, and everything generated from it.
  delete from public.question_items where user_id = uid;
  delete from public.question_packs where user_id = uid;
  delete from public.question_bank_reroll_exclusions where user_id = uid;
  delete from public.trait_history where user_id = uid;
  delete from public.trait_tracks where user_id = uid;
  delete from public.daily_insights where user_id = uid;
  delete from public.category_statements where user_id = uid;
  delete from public.legend_generations where user_id = uid;
  delete from public.trait_rolls where user_id = uid;
  delete from public.trait_roll_snapshots where user_id = uid;
  delete from public.sage_title_flags where user_id = uid;
  delete from public.explore_reactions where user_id = uid;
  delete from public.explore_entries where user_id = uid;
  delete from public.explore_packs where user_id = uid;

  -- Tokens: both ledgers, so the once-ever intake payout can be earned again.
  delete from public.ato_token_events where user_id = uid;
  delete from public.token_events where user_id = uid;

  -- The balance columns are guarded by triggers; these are the same switches
  -- the earn / spend functions set (wave51:68, wave19:113), for this transaction.
  perform set_config('ato.allow_ato_token_write', '1', true);
  perform set_config('ato.allow_token_write', '1', true);

  update public.me
    set
      openness = null, conscientiousness = null, extraversion = null, agreeableness = null,
      steadiness = null, attachment_anxiety = null, attachment_avoidance = null,
      conflict_assertiveness = null, conflict_cooperativeness = null,
      autonomy = null, competence = null, relatedness = null,
      growth_mindset = null, locus_of_control = null, self_efficacy = null, playfulness = null,
      trait_sources = '{}'::jsonb,
      trait_touched_at = '{}'::jsonb,
      celebrated_milestone_ids = '{}',
      question_deferred = '[]'::jsonb,
      sage_knows = '{}'::jsonb,
      sage_story = '{}'::jsonb,
      sage_title = '{}'::jsonb,
      -- the eight preference taps the app's own "Fresh signup" stage also clears
      show_up = null, talk_style = null, knocks_you_off = null, morning_cue = null,
      evening_wind_down = null, energy_pattern = null, support_style = null, current_focus = null,
      ato_tokens = 0,
      tokens = 0
    where id = uid;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.reset_my_test_data() from public, anon;
-- Callable by signed-in accounts, but the body refuses anyone who is not root.
grant execute on function public.reset_my_test_data() to authenticated;

comment on function public.reset_my_test_data() is
  'PRE-LAUNCH TEST TOOL (wave75). Root only, own account only: clears answers, trait scores, rounds, both token ledgers and generated content, keeps the profile. Refuses when app_config.signup_mode is not invite_only. Drop before public launch.';

-- BEFORE APPLYING, CHECK:
--   1. The account you test on is root (me.is_root = true). If it is not, the
--      function refuses; set is_root on it first, or test on the root account.
--   2. Any table added after wave73 that holds per-user question / trait / token
--      rows is added to the list above.
--   3. After applying, the app needs one small button wired to this function
--      (not built yet), and that button must be shown to root only.
