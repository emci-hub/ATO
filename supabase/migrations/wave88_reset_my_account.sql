-- wave88_reset_my_account.sql
-- Dev Tools Hub "Reset account" (emci, approved 2026-10-07). Replaces "Start
-- over" (start_over_my_test_data, which is kept so older bundles still work).
--
-- WHAT IT DOES: wipes the CALLER's own game data so the account behaves like a
-- brand-new sign-up: every answer, round, pick, daily line day, card, insight,
-- category row, legend, roll, every ATO token event and the balances, the
-- milestones, and the account's own AI-written daily lines. One transaction.
--
-- WHAT IT KEEPS (deliberately): the account (`me` row, handle, invite, root,
-- AI consent), auth, Apple link, invite codes, Circle/safety rows (connections,
-- messages, blocks, mutes, reports), dev access grants and traces, and the AI
-- usage + provider logs, so a reset never refills the AI quota. Shared content
-- (question_bank, question_bank_pool, written daily lines) is never touched.
--
-- WHO: root only (require_root, read from me.is_root on the server), and only
-- while sign-up is invite-only. No parameters: it can only ever act on
-- auth.uid(). Revoked from public/anon.
--
-- Also (found in the 2026-10-07 audit): reset_dev_test_user and count_user_rows
-- missed six tables added since wave71 (trait_answers, trait_flags,
-- trait_profile_snapshots, trait_answer_changes, daily_pick_answers,
-- daily_line_days). All six cascade on account delete already, so nothing was
-- ever orphaned, but the dev re-run kept old answers and the delete-account
-- audit under-counted. Both are restated with them added.
--
-- The list of tables reset_my_account clears is pinned by
-- scripts/reset-account-check.ts against every table that references
-- auth.users in the migrations: a new per-account table must be added here or
-- to that check's KEEP list, or the check fails.

create or replace function public.reset_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  v_mode text;
  v_rows int := 0;
  n int;
begin
  uid := public.require_root();

  select signup_mode into v_mode from public.app_config where id = 1;
  if v_mode is distinct from 'invite_only' then
    raise exception 'reset_my_account is disabled once sign-up is public' using errcode = '42501';
  end if;

  -- Children before parents (question_items -> question_packs, explore_*,
  -- trait_answer_changes -> trait_profile_snapshots), though each FK cascades.
  delete from public.ato_token_events where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.token_events where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.question_items where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.question_packs where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.question_bank_reroll_exclusions where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_answer_changes where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_profile_snapshots where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_answers where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_flags where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_history where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_tracks where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.daily_insights where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.category_statements where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.legend_generations where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_roll_snapshots where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.trait_rolls where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.sage_title_flags where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.explore_reactions where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.explore_entries where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.explore_packs where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.daily_pick_answers where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.daily_line_days where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.checks where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.crisis_flags where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  -- This account's own AI-written daily lines (owner-only rows). Written,
  -- shared lines (source 'authored') are never touched.
  delete from public.daily_line_pool where created_by = uid and source = 'ai'; get diagnostics n = row_count; v_rows := v_rows + n;

  -- Balances are guarded by triggers (me_ato_tokens_guard, me_tokens_guard):
  -- only a write that sets these transaction-local flags may change them,
  -- the same way the earn/spend functions do.
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
      milestones_celebrated = '{}'::jsonb,
      question_deferred = '[]'::jsonb,
      sage_knows = '{}'::jsonb,
      sage_story = '{}'::jsonb,
      sage_title = '{}'::jsonb,
      ato_tokens = 0,
      tokens = 0,
      show_up = null, talk_style = null, knocks_you_off = null, morning_cue = null,
      evening_wind_down = null, energy_pattern = null, support_style = null, current_focus = null
    where id = uid;

  perform set_config('ato.allow_ato_token_write', '0', true);
  perform set_config('ato.allow_token_write', '0', true);

  return jsonb_build_object('ok', true, 'rows_deleted', v_rows);
end;
$$;

revoke all on function public.reset_my_account() from public, anon;
grant execute on function public.reset_my_account() to authenticated;

-- reset_dev_test_user: wave71 body + the six tables it missed + the account's
-- own AI daily lines. Gate and every other line unchanged.
create or replace function public.reset_dev_test_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dev_id constant uuid := 'a70d3e0e-4c00-4a1e-8c0d-00000000d3e0';
begin
  if auth.uid() is distinct from v_dev_id then
    raise exception 'reset_dev_test_user: only the dev-test account may call this';
  end if;

  delete from public.checks where user_id = v_dev_id;
  delete from public.crisis_flags where user_id = v_dev_id;
  delete from public.connections where user_id = v_dev_id or peer_id = v_dev_id;
  delete from public.messages where sender_id = v_dev_id;
  delete from public.threads where user_a = v_dev_id or user_b = v_dev_id;
  delete from public.blocks where blocked_by = v_dev_id or blocked_user = v_dev_id;
  delete from public.mutes where muter = v_dev_id or muted_user = v_dev_id;
  delete from public.reports where "from" = v_dev_id or user_id = v_dev_id;
  delete from public.apple_credentials where user_id = v_dev_id;
  delete from public.explore_packs where user_id = v_dev_id;
  delete from public.explore_entries where user_id = v_dev_id;
  delete from public.explore_reactions where user_id = v_dev_id;
  delete from public.ai_provider_log where user_id = v_dev_id;
  delete from public.ai_usage where user_id = v_dev_id;
  delete from public.question_packs where user_id = v_dev_id;
  delete from public.question_items where user_id = v_dev_id;
  delete from public.trait_history where user_id = v_dev_id;
  delete from public.token_events where user_id = v_dev_id;
  delete from public.trait_tracks where user_id = v_dev_id;
  delete from public.sage_title_flags where user_id = v_dev_id;
  delete from public.category_share where user_id = v_dev_id or peer_id = v_dev_id;
  delete from public.going where user_id = v_dev_id;
  delete from public.trait_rolls where user_id = v_dev_id;
  delete from public.trait_roll_snapshots where user_id = v_dev_id;
  delete from public.question_bank_reroll_exclusions where user_id = v_dev_id;
  delete from public.ato_token_events where user_id = v_dev_id;
  delete from public.legend_generations where user_id = v_dev_id;
  delete from public.category_statements where user_id = v_dev_id;
  delete from public.daily_insights where user_id = v_dev_id;
  -- wave88 additions:
  delete from public.trait_answer_changes where user_id = v_dev_id;
  delete from public.trait_profile_snapshots where user_id = v_dev_id;
  delete from public.trait_answers where user_id = v_dev_id;
  delete from public.trait_flags where user_id = v_dev_id;
  delete from public.daily_pick_answers where user_id = v_dev_id;
  delete from public.daily_line_days where user_id = v_dev_id;
  delete from public.daily_line_pool where created_by = v_dev_id and source = 'ai';

  -- Last: deleting me cascades dev_access_grants, dev_trace_sessions,
  -- dev_trace_events and invite_codes.owner_id. auth.users itself is untouched,
  -- so the session stays signed in and the app routes into onboarding.
  delete from public.me where id = v_dev_id;
end;
$$;

revoke execute on function public.reset_dev_test_user() from public, anon;
grant execute on function public.reset_dev_test_user() to authenticated;

-- count_user_rows: live (wave72) body + the six tables. delete-account's
-- in-band audit expects 0 after a delete; these cascade, so the count stays 0
-- for a deleted account and is now honest for a live one.
create or replace function public.count_user_rows(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.me where id = p_user_id)
  + (select count(*) from public.checks where user_id = p_user_id)
  + (select count(*) from public.crisis_flags where user_id = p_user_id)
  + (select count(*) from public.connections where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.messages where sender_id = p_user_id)
  + (select count(*) from public.threads where user_a = p_user_id or user_b = p_user_id)
  + (select count(*) from public.blocks where blocked_by = p_user_id or blocked_user = p_user_id)
  + (select count(*) from public.mutes where muter = p_user_id or muted_user = p_user_id)
  + (select count(*) from public.reports where "from" = p_user_id or user_id = p_user_id)
  + (select count(*) from public.apple_credentials where user_id = p_user_id)
  + (select count(*) from public.explore_packs where user_id = p_user_id)
  + (select count(*) from public.explore_entries where user_id = p_user_id)
  + (select count(*) from public.explore_reactions where user_id = p_user_id)
  + (select count(*) from public.ai_provider_log where user_id = p_user_id)
  + (select count(*) from public.ai_usage where user_id = p_user_id)
  + (select count(*) from public.question_packs where user_id = p_user_id)
  + (select count(*) from public.question_items where user_id = p_user_id)
  + (select count(*) from public.trait_history where user_id = p_user_id)
  + (select count(*) from public.token_events where user_id = p_user_id)
  + (select count(*) from public.trait_tracks where user_id = p_user_id)
  + (select count(*) from public.sage_title_flags where user_id = p_user_id)
  + (select count(*) from public.category_share where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.going where user_id = p_user_id)
  + (select count(*) from public.trait_rolls where user_id = p_user_id)
  + (select count(*) from public.trait_roll_snapshots where user_id = p_user_id)
  + (select count(*) from public.question_bank_reroll_exclusions where user_id = p_user_id)
  + (select count(*) from public.ato_token_events where user_id = p_user_id)
  + (select count(*) from public.legend_generations where user_id = p_user_id)
  + (select count(*) from public.category_statements where user_id = p_user_id)
  + (select count(*) from public.daily_insights where user_id = p_user_id)
  + (select count(*) from public.invite_codes where owner_id = p_user_id)
  + (select count(*) from public.dev_access_grants where user_id = p_user_id)
  + (select count(*) from public.dev_trace_sessions where user_id = p_user_id)
  + (select count(*) from public.dev_trace_events where user_id = p_user_id)
  -- wave88 additions:
  + (select count(*) from public.trait_answers where user_id = p_user_id)
  + (select count(*) from public.trait_flags where user_id = p_user_id)
  + (select count(*) from public.trait_profile_snapshots where user_id = p_user_id)
  + (select count(*) from public.trait_answer_changes where user_id = p_user_id)
  + (select count(*) from public.daily_pick_answers where user_id = p_user_id)
  + (select count(*) from public.daily_line_days where user_id = p_user_id)
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;
