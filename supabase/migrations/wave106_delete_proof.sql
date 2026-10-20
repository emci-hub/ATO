-- wave106_delete_proof.sql · master plan Step 10 (roadmap step 7, S8: deletion proof), 2026-10-20.
-- Apply AFTER wave105 (it counts circle_compare_share, which wave105 creates). NOT applied until emci runs it.
--
-- What it does (one transaction):
--   1. count_user_rows (the delete-account proof) also counts the four per-account tables it missed:
--      circle_compare_share (wave105), ai_library_seen, ai_library_reports (wave93), ai_library_wanted (wave94).
--      All four already cascade with the account; the proof just could not see them. Shared content that only
--      names its author (ai_library_cards, daily_line_pool, question_bank_pool: created_by ON DELETE SET NULL)
--      is counted by created_by, so a leftover author link would show up as a remaining row.
--      Body = wave104's copy (wave103 + circle_requests) + those lines, nothing else changed.
--   2. dev_access_grants.granted_by had no ON DELETE (= NO ACTION), so deleting anyone who ever granted dev
--      access (in practice root) failed inside auth.admin.deleteUser. It becomes ON DELETE SET NULL (nullable):
--      the grants given to OTHER people stay, only the granter's id is cleared. The grantee's own grants still
--      cascade through user_id as before.
-- No row is deleted. No app function changes (count_user_rows is service_role only).

begin;

-- 2. dev_access_grants.granted_by: NO ACTION -> SET NULL ------------------------------------------------
do $$
declare
  v_con text;
begin
  for v_con in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.dev_access_grants'::regclass
      and c.contype = 'f'
      and a.attname = 'granted_by'
  loop
    execute format('alter table public.dev_access_grants drop constraint %I', v_con);
  end loop;
end;
$$;

alter table public.dev_access_grants alter column granted_by drop not null;
alter table public.dev_access_grants
  add constraint dev_access_grants_granted_by_fkey
  foreign key (granted_by) references public.me(id) on delete set null;

-- 1. count_user_rows(uuid) · source: wave104_circle_safety.sql + the four tables + shared-content authors --
create or replace function public.count_user_rows(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.me where id = p_user_id)
  + (select count(*) from public.checks where user_id = p_user_id)
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
  + (select count(*) from public.dev_access_grants where user_id = p_user_id or granted_by = p_user_id)
  + (select count(*) from public.dev_trace_sessions where user_id = p_user_id)
  + (select count(*) from public.dev_trace_events where user_id = p_user_id)
  + (select count(*) from public.trait_answers where user_id = p_user_id)
  + (select count(*) from public.trait_flags where user_id = p_user_id)
  + (select count(*) from public.trait_profile_snapshots where user_id = p_user_id)
  + (select count(*) from public.trait_answer_changes where user_id = p_user_id)
  + (select count(*) from public.daily_pick_answers where user_id = p_user_id)
  + (select count(*) from public.daily_line_days where user_id = p_user_id)
  + (select count(*) from public.legend_museum where user_id = p_user_id)
  + (select count(*) from public.category_deep_dives where user_id = p_user_id)
  + (select count(*) from public.play_saves where user_id = p_user_id)
  + (select count(*) from public.circle_gifts where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.circle_visit_share where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.circle_requests where from_user = p_user_id or to_user = p_user_id)
  + (select count(*) from public.circle_compare_share where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.ai_library_seen where user_id = p_user_id)
  + (select count(*) from public.ai_library_reports where user_id = p_user_id)
  + (select count(*) from public.ai_library_wanted where user_id = p_user_id)
  + (select count(*) from public.ai_library_cards where created_by = p_user_id)
  + (select count(*) from public.daily_line_pool where created_by = p_user_id)
  + (select count(*) from public.question_bank_pool where created_by = p_user_id)
  + (select count(*) from public.me where referred_by = p_user_id)
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;

commit;
