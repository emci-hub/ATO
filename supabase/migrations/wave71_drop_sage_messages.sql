-- wave71_drop_sage_messages.sql
-- Drops Talk's message store, retired with the voice provider lane.
--
-- NOT APPLIED YET — awaiting emci's review, same as wave69/wave70.
--
-- Background: Talk's entire backend (routeTalkReply, the local/remote/gemini
-- provider layer, select-provider, the voice config) was deleted on 2026-09-14
-- as part of the bottom-up rebuild. The Sage tab is now a registered route
-- rendering a "being rebuilt" placeholder — kept so the change ships over OTA
-- rather than needing a native build. Nothing writes or reads sage_messages any
-- more.
--
-- ⚠️ THIS DESTROYS EVERY STORED CONVERSATION. Read before applying:
--   * If Talk gets rebuilt and should keep its history, DO NOT APPLY THIS.
--     Leaving the table costs nothing — it is inert, RLS-owned, and cascades on
--     account delete like every other user-scoped table.
--   * Apply it only once you have decided Talk starts clean.
--
-- Also removes the table from the two hardcoded lists that track user-scoped
-- tables, so `count_user_rows()` stops counting a table that no longer exists
-- (it would otherwise throw on every delete-account audit) and
-- `reset_dev_test_user()` stops deleting from it. Both are full-body replaces
-- because a Postgres function cannot be patched in place; they are otherwise
-- byte-identical to their wave69 versions minus the sage_messages line.

-- The reports RLS policy names sage_messages in its WITH CHECK body, so
-- Postgres records a dependency and a plain DROP is refused under RESTRICT.
-- `cascade` is NOT the answer: reports_insert_owner is the ONLY insert policy
-- on public.reports, and reports has RLS enabled — cascading would silently
-- drop it and break user reporting entirely. So the policy is recreated first,
-- minus the sage branch, and only then does the table go.
--
-- The rest of the policy is byte-identical to stage7_chat_report.sql:278-292:
-- a report still must come from the caller, still must name exactly one of
-- message_id / user_id, a message report still must be on a thread the caller
-- is party to, and a user report still cannot target yourself.
drop policy if exists reports_insert_owner on public.reports;

create policy reports_insert_owner on public.reports
  for insert with check (
    auth.uid() = reports."from"
    and num_nonnulls(message_id, user_id) = 1
    and (
      (message_id is not null and public.is_message_party(reports.message_id))
      or (user_id is not null and user_id <> auth.uid())
    )
  );

drop table if exists public.sage_messages;

-- 1. count_user_rows() — delete-account's in-band audit
--    (supabase/functions/delete-account/index.ts step 5).
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
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;

-- 2. reset_dev_test_user()
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

  -- Last: deleting me cascades dev_access_grants, dev_trace_sessions,
  -- dev_trace_events (dev_access.sql, references public.me(id)) and
  -- invite_codes.owner_id (stage8_invite_referral.sql, same). auth.users
  -- itself is untouched, so the session stays signed in — MeContext.refresh()
  -- then sees no me row and the app's own guard routes into onboarding.
  delete from public.me where id = v_dev_id;
end;
$$;

revoke execute on function public.reset_dev_test_user() from public, anon;
grant execute on function public.reset_dev_test_user() to authenticated;
