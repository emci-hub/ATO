-- ============================================================================
-- APPLIED 2026-10-01 by emci, by hand in the Supabase SQL editor (same route as
-- wave75). Reported done by emci; the "Start over" button has not yet been
-- confirmed on a device.
-- ============================================================================
--
-- WHY. The Dev Tools Hub had three overlapping resets and none was complete:
--   * the "Fresh signup" jump only rewrote trait scores (the app cannot delete
--     rounds, answer history or token records itself);
--   * "Clear all my questions (full)" (wave75, reset_my_test_data) cleared
--     everything but also ZEROED the token balance;
--   * "Reset to fresh signup" deletes the whole profile and is @atodev only.
-- emci's call (2026-10-01): ONE "Start over" that clears this account's answers
-- without deleting the account, and KEEPS the token balance.
--
-- WHAT THIS ADDS. One function, start_over_my_test_data(). It is wave75's clear
-- with two differences:
--   1. `me.ato_tokens` and `me.tokens` are NOT touched. The balance stays.
--   2. From the token ledger it removes only the once-ever "finished the 50"
--      record, so that +21 can be earned again on the next walk-through. Round
--      records and question-reroll records go with their rounds and questions
--      (existing wave52 cascades). Category and Legend reroll records stay, so
--      today's once-a-day limit on those still holds.
--
-- CONSEQUENCE TO KNOW ABOUT. Because the balance is kept and the +21 records
-- are cleared, every start-over lets the account earn the +21 again on top of
-- what it already holds. That is the point for testing, and it is why this is
-- root only: an ordinary tester could loop it to mint tokens.
--
-- WHO CAN USE IT. Identical to wave75:
--   * ROOT ACCOUNTS ONLY (public.is_root()).
--   * The CALLER'S OWN account only (auth.uid()); no account id can be passed.
--   * Refuses once sign-up is public (app_config.signup_mode <> 'invite_only').
--     Drop it in the pre-launch pass together with wave75's function.
--
-- WHAT IT LEAVES ALONE. Same as wave75: ai_usage, checks, crisis_flags,
-- ai_provider_log, anything belonging to other people, and the profile row
-- (name, handle, birthday, city, AI consent, friends, root status). Plus, new
-- here: the token balances and the old "notes" ledger (token_events).
--
-- reset_my_test_data() (wave75) is left in place, unused by the app after this.
-- ============================================================================

create or replace function public.start_over_my_test_data()
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
    raise exception 'start_over_my_test_data is root only' using errcode = '42501';
  end if;

  select signup_mode into v_mode from public.app_config where id = 1;
  if v_mode is distinct from 'invite_only' then
    raise exception 'start_over_my_test_data is disabled once sign-up is public' using errcode = '42501';
  end if;

  -- What the account answered, and everything generated from it. Same list as
  -- wave75. Deleting question_items and question_packs removes their own token
  -- records with them (wave52 foreign keys, on delete cascade).
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

  -- Only the once-ever "finished the 50" record, so it can be earned again.
  -- The balance itself is deliberately not changed anywhere below.
  delete from public.ato_token_events
    where user_id = uid and reason = 'full_profile_complete';

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
      -- the eight preference taps, as wave75 clears them
      show_up = null, talk_style = null, knocks_you_off = null, morning_cue = null,
      evening_wind_down = null, energy_pattern = null, support_style = null, current_focus = null
    where id = uid;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.start_over_my_test_data() from public, anon;
-- Callable by signed-in accounts, but the body refuses anyone who is not root.
grant execute on function public.start_over_my_test_data() to authenticated;

comment on function public.start_over_my_test_data() is
  'PRE-LAUNCH TEST TOOL (wave76). Root only, own account only: clears answers, trait scores, rounds, answer history, generated content and the once-ever intake token record; keeps the profile AND the token balances. Refuses when app_config.signup_mode is not invite_only. Drop before public launch.';

-- BEFORE APPLYING, CHECK:
--   1. The account you test on is root (me.is_root = true).
--   2. Any table added after wave75 that holds per-user question / trait rows is
--      added to the list above.
--   3. The `me` update above does not set ato_tokens or tokens. If a trigger on
--      `me` refuses the update for an unrelated guarded column, tell the agent;
--      wave75 needed two set_config switches only because it wrote the balances.
-- AFTER APPLYING, CONFIRM:
--   select proname from pg_proc where proname = 'start_over_my_test_data';
--   (one row back means it is there)
