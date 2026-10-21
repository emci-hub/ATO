-- wave105_circle_compare.sql — Circle option B (master plan Step 7b, docs/circle-design.md). NOT APPLIED.
--
-- What a friend may see of you, and only when BOTH of you switch "Compare" on for each other:
-- up to 3 of your shareable STRENGTHS (a lean of at least 0.15 from 0.5, 3+ answers) and the strengths
-- you both have. Keys only ("openness:high"); the phone turns a key into a fixed phrase. Never a raw
-- value, never a number, never attachment, never a struggle-side lean, never Read/Do text, never typed text.
--
-- Private leans:
--   attachment_anxiety, attachment_avoidance (both sides)
--   LOW side of steadiness, competence, self_efficacy, growth_mindset, locus_of_control,
--   conflict_assertiveness, conflict_cooperativeness   (the conflict lows are stricter than the app's
--   isShareableLean on purpose: "low assertiveness" reads as a verdict when a friend sees it)
-- The list is mirrored in src/play/circle-compare.ts and pinned by check:circle-compare.
--
-- Copies tested paths: the switch table = wave97 circle_visit_share; the RPCs = wave104
-- set_circle_visit_share / circle_visit_allowed (accepted friendship, not blocked, both switches on,
-- a switch counts only if set since this friendship began). Additive: no row is changed or deleted.
-- peer_profile / peer_checks stay closed.
-- Every new app function starts with require_adult() (wave101 rule).

-- 1. The switch ----------------------------------------------------------------------------------

create table if not exists public.circle_compare_share (
  user_id uuid not null references auth.users (id) on delete cascade,
  peer_id uuid not null references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, peer_id),
  constraint circle_compare_share_not_self check (user_id <> peer_id)
);

comment on table public.circle_compare_share is
  'Circle compare: per-friend opt-in (2026-10-20). Off by default; both rows must be enabled. Written only by set_circle_compare_share. Cascades with auth.users.';

create index if not exists circle_compare_share_peer_idx on public.circle_compare_share (peer_id);

alter table public.circle_compare_share enable row level security;

drop policy if exists circle_compare_share_select_own on public.circle_compare_share;
create policy circle_compare_share_select_own on public.circle_compare_share
  for select using (auth.uid() = user_id);

revoke all on public.circle_compare_share from public, anon, authenticated;
grant select on public.circle_compare_share to authenticated;

-- 2. Strengths a person can share (internal: no role may call it) ---------------------------------

create or replace function public._compare_strengths(p_user uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(s.key order by s.strength desc, s.key), '{}'::text[])
  from (
    select
      t.axis || ':' || (case when t.value >= 0.5 then 'high' else 'low' end) as key,
      abs(t.value - 0.5) as strength
    from public.trait_tracks t
    where t.user_id = p_user
      and t.track = 'report'
      and t.answer_count >= 3
      and abs(t.value - 0.5) >= 0.15
      and t.axis not in ('attachment_anxiety', 'attachment_avoidance')
      and not (
        t.value < 0.5
        and t.axis in (
          'steadiness', 'competence', 'self_efficacy', 'growth_mindset', 'locus_of_control',
          'conflict_assertiveness', 'conflict_cooperativeness'
        )
      )
  ) s;
$$;
revoke all on function public._compare_strengths(uuid) from public, anon, authenticated;

-- 3. Allowed: accepted friendship, not blocked, both switches on (set since the friendship began) ---

create or replace function public.circle_compare_allowed(p_peer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  select
    auth.uid() is not null
    and p_peer is not null
    and auth.uid() <> p_peer
    and exists (
      select 1 from public.connections c
      where c.user_id = auth.uid() and c.peer_id = p_peer
    )
    and not public._circle_blocked(auth.uid(), p_peer)
    and exists (
      select 1 from public.circle_compare_share s, public.connections c
      where s.user_id = auth.uid() and s.peer_id = p_peer and s.enabled
        and c.user_id = auth.uid() and c.peer_id = p_peer and s.updated_at >= c.created_at
    )
    and exists (
      select 1 from public.circle_compare_share s, public.connections c
      where s.user_id = p_peer and s.peer_id = auth.uid() and s.enabled
        and c.user_id = p_peer and c.peer_id = auth.uid() and s.updated_at >= c.created_at
    );
$$;
revoke all on function public.circle_compare_allowed(uuid) from public, anon;
grant execute on function public.circle_compare_allowed(uuid) to authenticated;

-- 4. Flip my switch --------------------------------------------------------------------------------

create or replace function public.set_circle_compare_share(p_peer uuid, p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_peer is null or p_peer = uid or p_on is null
     or not exists (select 1 from public.connections c where c.user_id = uid and c.peer_id = p_peer)
     or public._circle_blocked(uid, p_peer) then
    return jsonb_build_object('ok', false, 'reason', 'not_in_circle');
  end if;
  insert into public.circle_compare_share (user_id, peer_id, enabled, updated_at)
  values (uid, p_peer, p_on, now())
  on conflict (user_id, peer_id) do update set enabled = excluded.enabled, updated_at = now();
  return jsonb_build_object('ok', true, 'mine', p_on, 'allowed', public.circle_compare_allowed(p_peer));
end;
$$;
revoke all on function public.set_circle_compare_share(uuid, boolean) from public, anon;
grant execute on function public.set_circle_compare_share(uuid, boolean) to authenticated;

-- 5. My friends' switches + a preview of exactly what a friend would see of me -----------------------

create or replace function public.circle_compare_friends()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'preview', to_jsonb((public._compare_strengths(uid))[1:3]),
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'peer', c.peer_id,
        'mine', coalesce(s.enabled and s.updated_at >= c.created_at, false),
        'allowed', public.circle_compare_allowed(c.peer_id)
      ))
      from public.connections c
      left join public.circle_compare_share s on s.user_id = uid and s.peer_id = c.peer_id
      where c.user_id = uid and not public._circle_blocked(uid, c.peer_id)
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.circle_compare_friends() from public, anon;
grant execute on function public.circle_compare_friends() to authenticated;

-- 6. The compare card: keys only --------------------------------------------------------------------

create or replace function public.circle_compare(p_peer uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_mine text[];
  v_theirs text[];
  v_shared text[];
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.circle_compare_allowed(p_peer) then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  v_mine := public._compare_strengths(uid);
  v_theirs := public._compare_strengths(p_peer);
  -- strongest first (v_mine is already ordered), at most 6 so a shared list cannot be used to read past the top 3
  select coalesce(array_agg(u.k order by u.o), '{}'::text[]) into v_shared
  from unnest(v_mine) with ordinality as u(k, o)
  where u.k = any(v_theirs);
  return jsonb_build_object(
    'ok', true,
    'shared', to_jsonb(v_shared[1:6]),
    'theirs', to_jsonb(v_theirs[1:3])
  );
end;
$$;
revoke all on function public.circle_compare(uuid) from public, anon;
grant execute on function public.circle_compare(uuid) to authenticated;
