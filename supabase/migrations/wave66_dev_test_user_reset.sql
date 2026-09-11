-- wave66_dev_test_user_reset.sql
-- Dev-only: reset the fixed dev-test account (@atodev) all the way back to
-- before onboarding, without touching auth.users, so emci can retest the
-- "Introduce yourself" flow without deleting and recreating the account.
--
-- Hard-gated to the one literal id below (matches DEV_TEST_USER_ID in
-- src/lib/dev-test-user.ts) via auth.uid() inside the function body —
-- SECURITY DEFINER so it can delete rows the client has no direct DELETE
-- grant on (me, trait_tracks — see wave19/wave20 revokes), but it refuses to
-- run for any other caller even if invoked directly.
--
-- Table list below was re-derived by grepping every `references auth.users`
-- FK across supabase/migrations/*.sql (2026-09-11), plus checks/crisis_flags/
-- connections/me — baseline tables applied before migration tracking
-- started, so they predate that grep and aren't in it. NOT copied from
-- count_user_rows() (explore.sql), which predates wave19/wave20/wave44+ and
-- is known-stale. Excludes tables since dropped (wave57/60/61) and the
-- shared/global question_bank_pool (wave49) — that pool is not this user's
-- data, every row in it is a candidate for any user. me.id itself is deleted
-- last: dev_access_grants, dev_trace_sessions, dev_trace_events
-- (dev_access.sql) and invite_codes.owner_id (stage8_invite_referral.sql)
-- all reference public.me(id) on delete cascade, so deleting the me row
-- cleans those up automatically — no explicit delete needed for them.

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
  delete from public.sage_messages where user_id = v_dev_id;
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

comment on function public.reset_dev_test_user() is
  'Dev-only. Deletes every row scoped to the fixed dev-test account (@atodev) except auth.users, so the "Introduce yourself" onboarding flow can be replayed without deleting/recreating the account. Hard-gated to that one literal id inside the function body regardless of caller.';
