-- Wave 72: count_user_rows() also counts the three dev-only user-scoped tables.
--
-- WRITTEN, NOT APPLIED. Same stop-for-review rule as wave69/70/71, because it
-- touches the account-deletion path. Apply only after emci has read it.
--
-- THIS FIXES AN AUDIT, NOT A LEAK. Deletion itself is already complete and that
-- was verified against the live database on 2026-09-15, not assumed:
--   * an orphan scan over every user-keyed uuid column in `public` (user_id,
--     owner_id, sender_id, peer_id, user_a, user_b) returned ZERO orphaned rows;
--   * all 20 rows in `account_deletions` report rows_remaining = 0;
--   * the account created seven seconds after the most recent deletion holds 0
--     trait_tracks, 0 question_packs, 0 question_items, 0 daily_insights and 16
--     null trait columns.
-- Every one of the three tables below already cascades from auth.users, which is
-- why the orphan scan is clean. They are simply absent from `count_user_rows`'s
-- hardcoded list, so the `rows_remaining` figure that `delete-account` reports
-- in-band can under-count. That is the exact false-clean-audit failure wave67
-- was written to prevent, and PROJECT_CONTEXT states the rule directly: every
-- user-scoped table must join this list.
--
-- Missing tables, all dev tooling and all confirmed present live:
--   dev_access_grants    (user_id)
--   dev_trace_sessions   (user_id)
--   dev_trace_events     (user_id)
--
-- NOT added, deliberately: `category_question_batches` / `category_question_items`.
-- An earlier read flagged them as the same gap, but `to_regclass` returns NULL
-- for both against the live database — wave44 was never applied, so the tables
-- do not exist and naming them here would make this function fail to create.
-- If wave44 is ever applied, both must be added to this list in the same pass.
--
-- Body is the live definition (pg_get_functiondef, 2026-09-15) with three lines
-- added and nothing else changed. Idempotent: create or replace, re-runnable.

begin;

create or replace function public.count_user_rows(p_user_id uuid)
returns integer
language sql
security definer
set search_path to 'public'
as $function$
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
  -- wave72 additions:
  + (select count(*) from public.dev_access_grants where user_id = p_user_id)
  + (select count(*) from public.dev_trace_sessions where user_id = p_user_id)
  + (select count(*) from public.dev_trace_events where user_id = p_user_id)
  + (select count(*) from auth.users where id = p_user_id);
$function$;

commit;
