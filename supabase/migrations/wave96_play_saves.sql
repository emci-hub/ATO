-- wave96_play_saves.sql
-- Divecore foundations (emci approved 2026-10-15: "accept all recommendation").
--
--   1. play_saves           one server copy of the Divecore (Play) save per account,
--                           so a reinstall or a new phone keeps the pet. Own-select RLS,
--                           written only through save_play_doc (copies the wave90 owner-
--                           table pattern). An older write (by the phone's clock, capped at
--                           the server's) or an older app version never replaces a newer save;
--                           one write per account per 2 s.
--   2. play_counters_daily  ~6 anonymous daily counters (no user id stored), bumped only
--                           through bump_play_counter with a fixed name list. RLS on, no
--                           policies: nobody reads it from a phone (the wave93 pattern).
--   3. count_user_rows / reset_dev_test_user restated from wave90 (live) with play_saves
--      added. reset_my_account is NOT restated: a reset keeps the Divecore save (KEEP list
--      in scripts/reset-account-check.ts). delete-account removes play_saves through the
--      on delete cascade and counts it through count_user_rows.
--
-- Additive: no existing table or row is changed. The phone keeps working if this is not
-- applied yet (the save stays local; counters are best-effort).

-- 1. The save ---------------------------------------------------------------------------

create table public.play_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  doc jsonb not null check (jsonb_typeof(doc) = 'object' and octet_length(doc::text) <= 1048576),
  doc_version int not null check (doc_version between 1 and 1000),
  saved_at timestamptz not null,
  updated_at timestamptz not null default now()
);

comment on table public.play_saves is
  'Divecore (Play) save, one per account (2026-10-15). doc = the phone''s ato.play.store.v1 json; saved_at = when the phone saved it. Kept on Reset account; deleted with the account.';

alter table public.play_saves enable row level security;

create policy play_saves_select_own on public.play_saves
  for select using (auth.uid() = user_id);

revoke insert, update, delete on public.play_saves from public, anon, authenticated;

create or replace function public.save_play_doc(p_doc jsonb, p_version int, p_saved_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_at timestamptz;
  prev public.play_saves%rowtype;
  kept timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_doc is null or jsonb_typeof(p_doc) <> 'object' or octet_length(p_doc::text) > 1048576 then
    return jsonb_build_object('ok', false, 'reason', 'bad_doc');
  end if;
  if p_version is null or p_version < 1 or p_version > 1000 or p_saved_at is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_meta');
  end if;
  -- A phone clock set ahead must never pin the save: cap it at the server's clock.
  v_at := least(p_saved_at, now());

  perform pg_advisory_xact_lock(hashtext(uid::text || ':play_save'));

  select * into prev from public.play_saves where user_id = uid;
  if found then
    if prev.updated_at > now() - interval '2 seconds' then
      return jsonb_build_object('ok', false, 'reason', 'throttled');
    end if;
    -- An older app (lower save version) never overwrites a save made by a newer one.
    if p_version < prev.doc_version then
      return jsonb_build_object('ok', false, 'reason', 'older_version');
    end if;
  end if;

  insert into public.play_saves (user_id, doc, doc_version, saved_at, updated_at)
  values (uid, p_doc, p_version, v_at, now())
  on conflict (user_id) do update
    set doc = excluded.doc,
        doc_version = excluded.doc_version,
        saved_at = excluded.saved_at,
        updated_at = now()
    where public.play_saves.saved_at <= excluded.saved_at;

  select saved_at into kept from public.play_saves where user_id = uid;
  return jsonb_build_object('ok', true, 'kept_saved_at', kept, 'stale', kept > v_at);
end;
$$;

revoke all on function public.save_play_doc(jsonb, int, timestamptz) from public, anon;
grant execute on function public.save_play_doc(jsonb, int, timestamptz) to authenticated;

comment on function public.save_play_doc(jsonb, int, timestamptz) is
  'Upsert this account''s Divecore save. An older save (saved_at, capped at now) or an older save version never replaces a newer one; one write per 2 s.';

-- 2. Anonymous daily counters ------------------------------------------------------------

create table public.play_counters_daily (
  day date not null,
  name text not null check (name ~ '^[a-z_]{3,40}$'),
  n bigint not null default 0 check (n >= 0),
  primary key (day, name)
);

comment on table public.play_counters_daily is
  'Anonymous Divecore counters per UTC day (2026-10-15). No user id is stored. Bumped only by bump_play_counter; no phone reads it. Counts are spoofable by a signed-in user (rough signal only).';

alter table public.play_counters_daily enable row level security;

revoke all on public.play_counters_daily from public, anon, authenticated;

create or replace function public.bump_play_counter(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_name is null or p_name not in (
    'play_open', 'hideout_open', 'rail_action', 'turf_wave_start', 'dive_start', 'return_next_day'
  ) then
    return;
  end if;
  insert into public.play_counters_daily (day, name, n)
  values ((timezone('utc', now()))::date, p_name, 1)
  on conflict (day, name) do update set n = public.play_counters_daily.n + 1;
end;
$$;

revoke all on function public.bump_play_counter(text) from public, anon;
grant execute on function public.bump_play_counter(text) to authenticated;

comment on function public.bump_play_counter(text) is
  'Add one to an anonymous Divecore counter for today (fixed name list; the user id is never stored).';

-- 3. Account row functions, restated from wave90 with play_saves ------------------------

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
  delete from public.trait_answer_changes where user_id = v_dev_id;
  delete from public.trait_profile_snapshots where user_id = v_dev_id;
  delete from public.trait_answers where user_id = v_dev_id;
  delete from public.trait_flags where user_id = v_dev_id;
  delete from public.daily_pick_answers where user_id = v_dev_id;
  delete from public.daily_line_days where user_id = v_dev_id;
  delete from public.daily_line_pool where created_by = v_dev_id and source = 'ai';
  delete from public.legend_museum where user_id = v_dev_id;
  delete from public.category_deep_dives where user_id = v_dev_id;
  delete from public.play_saves where user_id = v_dev_id;
  delete from public.me where id = v_dev_id;
end;
$$;

revoke execute on function public.reset_dev_test_user() from public, anon;
grant execute on function public.reset_dev_test_user() to authenticated;

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
  + (select count(*) from public.trait_answers where user_id = p_user_id)
  + (select count(*) from public.trait_flags where user_id = p_user_id)
  + (select count(*) from public.trait_profile_snapshots where user_id = p_user_id)
  + (select count(*) from public.trait_answer_changes where user_id = p_user_id)
  + (select count(*) from public.daily_pick_answers where user_id = p_user_id)
  + (select count(*) from public.daily_line_days where user_id = p_user_id)
  + (select count(*) from public.legend_museum where user_id = p_user_id)
  + (select count(*) from public.category_deep_dives where user_id = p_user_id)
  + (select count(*) from public.play_saves where user_id = p_user_id)
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;
