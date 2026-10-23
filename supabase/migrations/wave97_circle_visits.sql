-- wave97_circle_visits.sql
-- Divecore Circle visits (hideout roadmap step 6; plan approved by emci 2026-10-15:
-- "ok, approved as planned: peer read of look+decor, handles in the list, sticker gift, two PRs").
--
--   1. circle_visit_share   per-friend opt-in, OFF by default; a visit or a gift needs BOTH
--                           people's switch on (copies wave21 category_share; here the switch is
--                           written only through set_circle_visit_share, never by the phone).
--   2. circle_gifts         one gift per giver -> friend per giver's local day (unique index; the
--                           claim copies wave92 claim_daily_checkin's insert ... on conflict do
--                           nothing). No currency moves: the gift is a sticker the phone shows.
--                           RLS on, no policies: read and written only by the functions below.
--   3. circle_visit_allowed  connected (Circle row), not blocked either way, both switches on.
--   4. _circle_visit_look   THE NEW PATTERN (emci's OK above): reads a friend's Divecore save
--                           (play_saves, wave96) and returns ONLY the pet's look (line, hero,
--                           stage, shiny) and the 3 decor slots, each value checked against a
--                           fixed shape. Never the pet's name, never traits, never anything typed,
--                           never the rest of the save. Internal: no role may call it directly.
--   5. RPCs: circle_visit_friends, set_circle_visit_share, circle_visit_room, circle_send_gift,
--      circle_gift_inbox, circle_open_gift. Every one checks auth.uid() and the Circle row.
--   6. reset_my_account (restated from wave90) wipes both tables, both directions: a reset
--      removes everything this account shared or was sent. reset_dev_test_user / count_user_rows
--      restated from wave96 with both tables (delete-account: on delete cascade + the count).
--
-- Additive: no existing row is changed. Before this is applied the phone shows "Circle visits
-- aren't switched on yet" and the Hideout works as before.

-- 1. The switch ----------------------------------------------------------------------------

create table public.circle_visit_share (
  user_id uuid not null references auth.users (id) on delete cascade,
  peer_id uuid not null references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, peer_id),
  constraint circle_visit_share_not_self check (user_id <> peer_id)
);

comment on table public.circle_visit_share is
  'Divecore Circle visits: per-friend opt-in (2026-10-15). Off by default; both rows must be enabled before either can visit or gift. Wiped by Reset account (both directions); cascades with auth.users.';

create index circle_visit_share_peer_idx on public.circle_visit_share (peer_id);

alter table public.circle_visit_share enable row level security;

create policy circle_visit_share_select_own on public.circle_visit_share
  for select using (auth.uid() = user_id);

revoke all on public.circle_visit_share from public, anon, authenticated;
grant select on public.circle_visit_share to authenticated;

-- 2. The gifts ------------------------------------------------------------------------------

create table public.circle_gifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  peer_id uuid not null references auth.users (id) on delete cascade,
  local_day date not null,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  constraint circle_gifts_not_self check (user_id <> peer_id)
);

comment on table public.circle_gifts is
  'Divecore Circle visits: user_id left a gift for peer_id on user_id''s local day (2026-10-15). One per pair per day. No text, no currency. Wiped by Reset account (both directions); cascades with auth.users.';

create unique index circle_gifts_one_a_day on public.circle_gifts (user_id, peer_id, local_day);
create index circle_gifts_inbox_idx on public.circle_gifts (peer_id, created_at) where opened_at is null;

alter table public.circle_gifts enable row level security;

revoke all on public.circle_gifts from public, anon, authenticated;

-- 3. Who may visit whom ---------------------------------------------------------------------

create or replace function public.circle_visit_allowed(p_peer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and p_peer is not null
    and auth.uid() <> p_peer
    and exists (
      select 1 from public.connections c
      where c.user_id = auth.uid() and c.peer_id = p_peer
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocked_by = auth.uid() and b.blocked_user = p_peer)
         or (b.blocked_by = p_peer and b.blocked_user = auth.uid())
    )
    -- A switch counts only if it was set since this Circle row was made: unfriend + scan back in = off again.
    and exists (
      select 1 from public.circle_visit_share s, public.connections c
      where s.user_id = auth.uid() and s.peer_id = p_peer and s.enabled
        and c.user_id = auth.uid() and c.peer_id = p_peer and s.updated_at >= c.created_at
    )
    and exists (
      select 1 from public.circle_visit_share s, public.connections c
      where s.user_id = p_peer and s.peer_id = auth.uid() and s.enabled
        and c.user_id = p_peer and c.peer_id = auth.uid() and s.updated_at >= c.created_at
    );
$$;

revoke all on function public.circle_visit_allowed(uuid) from public, anon;
grant execute on function public.circle_visit_allowed(uuid) to authenticated;

-- 4. The look (the only part of a save anyone else ever sees) -------------------------------

create or replace function public._circle_visit_look(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when s.doc is null then null else jsonb_build_object(
    'pet', jsonb_build_object(
      'line', case when (s.doc -> 'pet' ->> 'line') ~ '^[a-z0-9_-]{1,48}$' then s.doc -> 'pet' ->> 'line' end,
      'hero', case when (s.doc -> 'pet' ->> 'hero') ~ '^[a-z0-9-]{1,48}$' then s.doc -> 'pet' ->> 'hero' end,
      'stage', case when (s.doc -> 'pet' ->> 'stage') in ('egg', 'baby', 'child', 'teen', 'adult', 'god') then s.doc -> 'pet' ->> 'stage' end,
      'shiny', coalesce(s.doc -> 'pet' -> 'shiny' = 'true'::jsonb, false)
    ),
    'decor', coalesce((
      select jsonb_object_agg(d.key, d.value)
      from jsonb_each_text(case when jsonb_typeof(s.doc -> 'hideout' -> 'decor') = 'object' then s.doc -> 'hideout' -> 'decor' else '{}'::jsonb end) d
      where d.key in ('d1', 'd2', 'd3') and d.value ~ '^dc_[a-z_]{1,32}$'
    ), '{}'::jsonb)
  ) end
  from (select (select doc from public.play_saves where user_id = p_user) as doc) s;
$$;

revoke all on function public._circle_visit_look(uuid) from public, anon, authenticated;

comment on function public._circle_visit_look(uuid) is
  'Internal: the pet look (line, hero, stage, shiny) and 3 decor slots from a Divecore save, each checked against a fixed shape. Never the name or anything else. Called only by circle_visit_room / circle_gift_inbox after circle_visit_allowed.';

-- 5. The calls ------------------------------------------------------------------------------

create or replace function public.circle_visit_friends()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tz text;
  local_today date;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select coalesce(nullif(timezone, ''), 'UTC') into tz from public.me where id = uid;
  local_today := (timezone(coalesce(tz, 'UTC'), now()))::date;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'peer', c.peer_id,
      'handle', m.handle,
      'mine', coalesce(s.enabled and s.updated_at >= c.created_at, false),
      'allowed', public.circle_visit_allowed(c.peer_id),
      'gifted_today', exists (
        select 1 from public.circle_gifts g
        where g.user_id = uid and g.peer_id = c.peer_id and g.local_day = local_today
      )
    ) order by lower(m.handle))
    from public.connections c
    join public.me m on m.id = c.peer_id
    left join public.circle_visit_share s on s.user_id = uid and s.peer_id = c.peer_id
    where c.user_id = uid
      and not exists (
        select 1 from public.blocks b
        where (b.blocked_by = uid and b.blocked_user = c.peer_id)
           or (b.blocked_by = c.peer_id and b.blocked_user = uid)
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.circle_visit_friends() from public, anon;
grant execute on function public.circle_visit_friends() to authenticated;

create or replace function public.set_circle_visit_share(p_peer uuid, p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_peer is null or p_peer = uid or p_on is null
     or not exists (select 1 from public.connections c where c.user_id = uid and c.peer_id = p_peer) then
    return jsonb_build_object('ok', false, 'reason', 'not_in_circle');
  end if;
  insert into public.circle_visit_share (user_id, peer_id, enabled, updated_at)
  values (uid, p_peer, p_on, now())
  on conflict (user_id, peer_id) do update set enabled = excluded.enabled, updated_at = now();
  return jsonb_build_object('ok', true, 'mine', p_on, 'allowed', public.circle_visit_allowed(p_peer));
end;
$$;

revoke all on function public.set_circle_visit_share(uuid, boolean) from public, anon;
grant execute on function public.set_circle_visit_share(uuid, boolean) to authenticated;

create or replace function public.circle_visit_room(p_peer uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  look jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.circle_visit_allowed(p_peer) then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  look := public._circle_visit_look(p_peer);
  if look is null then
    return jsonb_build_object('ok', false, 'reason', 'no_save');
  end if;
  return jsonb_build_object('ok', true, 'look', look);
end;
$$;

revoke all on function public.circle_visit_room(uuid) from public, anon;
grant execute on function public.circle_visit_room(uuid) to authenticated;

create or replace function public.circle_send_gift(p_peer uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tz text;
  local_today date;
  v_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.circle_visit_allowed(p_peer) then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  select coalesce(nullif(timezone, ''), 'UTC') into tz from public.me where id = uid;
  local_today := (timezone(coalesce(tz, 'UTC'), now()))::date;
  insert into public.circle_gifts (user_id, peer_id, local_day)
  values (uid, p_peer, local_today)
  on conflict (user_id, peer_id, local_day) do nothing
  returning id into v_id;
  if v_id is null then
    return jsonb_build_object('ok', false, 'already', true);
  end if;
  return jsonb_build_object('ok', true, 'already', false);
end;
$$;

revoke all on function public.circle_send_gift(uuid) from public, anon;
grant execute on function public.circle_send_gift(uuid) to authenticated;

create or replace function public.circle_gift_inbox()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- Only gifts from friends who still share both ways (a switch turned off hides them).
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'handle', x.handle, 'look', x.look) order by x.created_at)
    from (
      select y.id, y.created_at, y.handle, y.look
      from (
        select g.id, g.created_at, m.handle, public._circle_visit_look(g.user_id) as look
        from public.circle_gifts g
        join public.me m on m.id = g.user_id
        where g.peer_id = uid and g.opened_at is null and public.circle_visit_allowed(g.user_id)
      ) y
      where y.look is not null and (y.look #>> '{pet,hero}') is not null
      order by y.created_at
      limit 20
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.circle_gift_inbox() from public, anon;
grant execute on function public.circle_gift_inbox() to authenticated;

create or replace function public.circle_open_gift(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.circle_gifts set opened_at = now()
    where id = p_id and peer_id = uid and opened_at is null;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.circle_open_gift(uuid) from public, anon;
grant execute on function public.circle_open_gift(uuid) to authenticated;

-- 6. Account reset / dev reset / row count, restated with both tables ----------------------

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
  delete from public.legend_museum where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.category_deep_dives where user_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
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
  -- Divecore Circle visits (wave97): everything shared, both directions (my switches and my
  -- friends' switches for me; gifts I left and gifts left for me).
  delete from public.circle_gifts where user_id = uid or peer_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
  delete from public.circle_visit_share where user_id = uid or peer_id = uid; get diagnostics n = row_count; v_rows := v_rows + n;
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
  delete from public.circle_gifts where user_id = v_dev_id or peer_id = v_dev_id;
  delete from public.circle_visit_share where user_id = v_dev_id or peer_id = v_dev_id;
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
  + (select count(*) from public.circle_gifts where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.circle_visit_share where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;
