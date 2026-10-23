-- wave104_circle_safety.sql · master plan Step 7 (roadmap step 3: Circle safety, M5 / M6 / S3), 2026-10-20.
-- Design: docs/circle-design.md (option A). Apply AFTER wave103. NOT applied until emci runs it in the SQL editor.
--
-- What it does (one transaction):
--   1. Friend requests: new table circle_requests + circle_request / circle_requests / circle_respond /
--      circle_cancel / circle_remove. A connections row is only made on accept (the mirror trigger adds the
--      reverse row as before). The app can no longer insert into connections directly
--      (connections_insert_own dropped). Existing friendships are kept as they are.
--   2. Block + report: circle_block / circle_unblock / circle_blocked / circle_report write the existing
--      blocks / reports tables. A block removes the friendship and pending requests and is never shown to
--      the other person.
--   3. A blocked pair reads nothing: block checks added to categories_share_allowed, category_share_status,
--      set_circle_visit_share, get_or_create_thread, public_profile (signed-in caller). circle_visit_* and
--      legend_circle_friends already had them.
--   4. peer_profile and peer_checks return no rows (the consentless-connect leak; nothing in the app reads
--      them; Circle option B, Step 7b, decides what friends may see).
--   5. Reports survive account deletion: reports."from" / reports.user_id become ON DELETE SET NULL and a
--      report keeps the reported handle + reason. count_user_rows needs no change (the ids are nulled).
--   6. Name / handle filter: me trigger refuses slurs and staff-impersonation names on insert or when the
--      name / handle changes (lists = src/lib/name-filter.ts, pinned by check:circle-safety). Existing rows
--      are not touched.
--   (+) reset_dev_test_user and count_user_rows restated from wave103 with circle_requests.
--   7. Advisor fixes: search_path on 7 helper functions; the public 'around' bucket stops allowing listing
--      (public file URLs keep working: they do not use this policy).
-- No row is deleted. Every new app function starts with require_adult() (wave101 rule).

begin;

-- 1. Friend requests --------------------------------------------------------------------------------

create table if not exists public.circle_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint circle_requests_distinct check (from_user <> to_user)
);
create unique index if not exists circle_requests_one_pending
  on public.circle_requests (from_user, to_user) where status = 'pending';
create index if not exists circle_requests_to_pending
  on public.circle_requests (to_user) where status = 'pending';

alter table public.circle_requests enable row level security;
-- Read-only for the two people involved; every write goes through the functions below.
drop policy if exists circle_requests_select_parties on public.circle_requests;
create policy circle_requests_select_parties on public.circle_requests
  for select using (auth.uid() = from_user or auth.uid() = to_user);

-- Connections are made on accept only.
drop policy if exists connections_insert_own on public.connections;

-- Either direction blocked?
create or replace function public._circle_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocked_by = p_a and b.blocked_user = p_b)
       or (b.blocked_by = p_b and b.blocked_user = p_a)
  );
$$;
revoke all on function public._circle_blocked(uuid, uuid) from public, anon, authenticated;

-- Circle size cap (accepted friends).
create or replace function public._circle_size(p_uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.connections where user_id = p_uid;
$$;
revoke all on function public._circle_size(uuid) from public, anon, authenticated;

create or replace function public.circle_request(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_peer uuid;
  v_reverse uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public._rate_limit_caller('circle_request', 20, 3600) then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  select m.id into v_peer from public.me m
    where m.handle = lower(btrim(coalesce(p_handle, ''), ' @'))
    limit 1;
  -- A block (either way) or an account that is not 18+ looks exactly like "no one with that handle".
  if v_peer is null or public._circle_blocked(uid, v_peer) or not public.is_adult(v_peer) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_peer = uid then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;
  if exists (select 1 from public.connections c where c.user_id = uid and c.peer_id = v_peer) then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;
  if public._circle_size(uid) >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'cap');
  end if;
  -- They already asked me: asking back accepts.
  select r.id into v_reverse from public.circle_requests r
    where r.from_user = v_peer and r.to_user = uid and r.status = 'pending'
    limit 1;
  if v_reverse is not null then
    if public._circle_size(v_peer) >= 20 then
      return jsonb_build_object('ok', false, 'reason', 'cap');
    end if;
    update public.circle_requests set status = 'accepted', responded_at = now() where id = v_reverse;
    insert into public.connections (user_id, peer_id) values (uid, v_peer) on conflict do nothing;
    return jsonb_build_object('ok', true, 'state', 'accepted');
  end if;
  if exists (select 1 from public.circle_requests r
             where r.from_user = uid and r.to_user = v_peer and r.status = 'pending') then
    return jsonb_build_object('ok', false, 'reason', 'pending');
  end if;
  if (select count(*) from public.circle_requests r where r.from_user = uid and r.status = 'pending') >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'cap');
  end if;
  insert into public.circle_requests (from_user, to_user) values (uid, v_peer);
  return jsonb_build_object('ok', true, 'state', 'sent');
end;
$$;
revoke all on function public.circle_request(text) from public, anon;
grant execute on function public.circle_request(text) to authenticated;

create or replace function public.circle_requests()
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
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'peer', r.from_user, 'handle', m.handle) order by r.created_at)
      from public.circle_requests r
      join public.me m on m.id = r.from_user
      where r.to_user = uid and r.status = 'pending' and not public._circle_blocked(uid, r.from_user)
    ), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'peer', r.to_user, 'handle', m.handle) order by r.created_at)
      from public.circle_requests r
      join public.me m on m.id = r.to_user
      where r.from_user = uid and r.status = 'pending' and not public._circle_blocked(uid, r.to_user)
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.circle_requests() from public, anon;
grant execute on function public.circle_requests() to authenticated;

create or replace function public.circle_respond(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_from uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select r.from_user into v_from from public.circle_requests r
    where r.id = p_id and r.to_user = uid and r.status = 'pending'
    for update;
  if v_from is null or p_accept is null or public._circle_blocked(uid, v_from) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not p_accept then
    update public.circle_requests set status = 'declined', responded_at = now() where id = p_id;
    return jsonb_build_object('ok', true);
  end if;
  if not public.is_adult(v_from) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if public._circle_size(uid) >= 20 or public._circle_size(v_from) >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'cap');
  end if;
  update public.circle_requests set status = 'accepted', responded_at = now() where id = p_id;
  insert into public.connections (user_id, peer_id) values (uid, v_from) on conflict do nothing;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.circle_respond(uuid, boolean) from public, anon;
grant execute on function public.circle_respond(uuid, boolean) to authenticated;

create or replace function public.circle_cancel(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.circle_requests set status = 'cancelled', responded_at = now()
    where id = p_id and from_user = uid and status = 'pending';
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0);
end;
$$;
revoke all on function public.circle_cancel(uuid) from public, anon;
grant execute on function public.circle_cancel(uuid) to authenticated;

create or replace function public.circle_remove(p_peer uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- The unmirror trigger removes the reverse row.
  delete from public.connections where user_id = uid and peer_id = p_peer;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0);
end;
$$;
revoke all on function public.circle_remove(uuid) from public, anon;
grant execute on function public.circle_remove(uuid) to authenticated;

-- 2. Block + report ---------------------------------------------------------------------------------

create or replace function public.circle_block(p_peer uuid)
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
  if p_peer is null or p_peer = uid or not exists (select 1 from auth.users u where u.id = p_peer) then
    return jsonb_build_object('ok', false);
  end if;
  insert into public.blocks (blocked_by, blocked_user) values (uid, p_peer) on conflict do nothing;
  delete from public.connections where (user_id = uid and peer_id = p_peer) or (user_id = p_peer and peer_id = uid);
  update public.circle_requests set status = 'cancelled', responded_at = now()
    where status = 'pending'
      and ((from_user = uid and to_user = p_peer) or (from_user = p_peer and to_user = uid));
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.circle_block(uuid) from public, anon;
grant execute on function public.circle_block(uuid) to authenticated;

create or replace function public.circle_unblock(p_peer uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from public.blocks where blocked_by = uid and blocked_user = p_peer;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0);
end;
$$;
revoke all on function public.circle_unblock(uuid) from public, anon;
grant execute on function public.circle_unblock(uuid) to authenticated;

create or replace function public.circle_blocked()
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
  return coalesce((
    select jsonb_agg(jsonb_build_object('peer', b.blocked_user, 'handle', m.handle) order by b.created_at)
    from public.blocks b
    left join public.me m on m.id = b.blocked_user
    where b.blocked_by = uid
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.circle_blocked() from public, anon;
grant execute on function public.circle_blocked() to authenticated;

-- Reports outlive both accounts: the ids go null on delete, the handle + reason stay for triage.
alter table public.reports add column if not exists reported_handle text;
alter table public.reports add column if not exists status text not null default 'open';
alter table public.reports add column if not exists handled_at timestamptz;
alter table public.reports add column if not exists admin_note text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reports_status_check' and conrelid = 'public.reports'::regclass) then
    alter table public.reports add constraint reports_status_check check (status in ('open', 'actioned', 'dismissed'));
  end if;
end $$;

alter table public.reports alter column "from" drop not null;
do $$
declare
  r record;
begin
  -- Drop whatever the two auth.users foreign keys are called, then re-add them as SET NULL.
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.reports'::regclass and c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.reports drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.reports
  add constraint reports_from_fkey foreign key ("from") references auth.users(id) on delete set null,
  add constraint reports_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
-- At most one target; after a deletion both may be null (the insert policy still demands exactly one).
alter table public.reports drop constraint if exists reports_exactly_one_target;
alter table public.reports add constraint reports_at_most_one_target check (num_nonnulls(message_id, user_id) <= 1);

create or replace function public.circle_report(p_peer uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_handle text;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_reason is null or p_reason not in ('harassment', 'hate', 'sexual', 'spam', 'impersonation', 'other') then
    return jsonb_build_object('ok', false, 'reason', 'bad_reason');
  end if;
  if p_peer is null or p_peer = uid then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select m.handle into v_handle from public.me m where m.id = p_peer;
  if v_handle is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not public._rate_limit_caller('circle_report', 10, 86400) then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  insert into public.reports ("from", user_id, reason, reported_handle)
  values (uid, p_peer, p_reason, v_handle);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.circle_report(uuid, text) from public, anon;
grant execute on function public.circle_report(uuid, text) to authenticated;

-- 3. A blocked pair reads nothing -------------------------------------------------------------------

-- categories_share_allowed(uuid) · source: wave101 + block check
create or replace function public.categories_share_allowed(p_peer uuid)
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
    and not public._circle_blocked(auth.uid(), p_peer)  -- wave104
    and (
      (
        coalesce((select close_friends_share from public.me where id = auth.uid()), false)
        and coalesce((select close_friends_share from public.me where id = p_peer), false)
      )
      or (
        exists (
          select 1 from public.category_share s
          where s.user_id = auth.uid() and s.peer_id = p_peer and s.enabled
        )
        and exists (
          select 1 from public.category_share s
          where s.user_id = p_peer and s.peer_id = auth.uid() and s.enabled
        )
      )
    );
$$;
revoke all on function public.categories_share_allowed(uuid) from public, anon;
grant execute on function public.categories_share_allowed(uuid) to authenticated;

-- category_share_status(uuid) · source: wave101 + block check
create or replace function public.category_share_status(p_peer uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  select case
    when auth.uid() is null or p_peer is null or auth.uid() = p_peer then null
    when not exists (
      select 1 from public.connections c
      where c.user_id = auth.uid() and c.peer_id = p_peer
    ) then null
    when public._circle_blocked(auth.uid(), p_peer) then null  -- wave104
    else jsonb_build_object(
      'allowed', public.categories_share_allowed(p_peer),
      'mine', exists (
        select 1 from public.category_share s
        where s.user_id = auth.uid() and s.peer_id = p_peer and s.enabled
      ),
      'via_pool', (
        coalesce((select close_friends_share from public.me where id = auth.uid()), false)
        and coalesce((select close_friends_share from public.me where id = p_peer), false)
      )
    )
  end;
$$;
revoke all on function public.category_share_status(uuid) from public, anon;
grant execute on function public.category_share_status(uuid) to authenticated;

-- set_circle_visit_share(uuid,boolean) · source: wave101 + block check
create or replace function public.set_circle_visit_share(p_peer uuid, p_on boolean)
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
     or public._circle_blocked(uid, p_peer) then  -- wave104
    return jsonb_build_object('ok', false, 'reason', 'not_in_circle');
  end if;
  insert into public.circle_visit_share (user_id, peer_id, enabled, updated_at)
  values (uid, p_peer, p_on, now())
  on conflict (user_id, peer_id) do update set enabled = excluded.enabled, updated_at = now();
  return jsonb_build_object('ok', true, 'mine', p_on, 'allowed', public.circle_visit_allowed(p_peer));
end;
$$;
revoke all on function public.set_circle_visit_share(uuid,boolean) from public, anon;
grant execute on function public.set_circle_visit_share(uuid,boolean) to authenticated;

-- get_or_create_thread(uuid) · source: wave101 + block check (chat is parked; master plan step 14)
create or replace function public.get_or_create_thread(p_peer uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_id uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if v_me is null then raise exception 'not authenticated'; end if;
  if p_peer is null or p_peer = v_me then raise exception 'invalid peer'; end if;

  if not exists (
    select 1 from public.connections
    where (user_id = v_me and peer_id = p_peer)
       or (user_id = p_peer and peer_id = v_me)
  ) or public._circle_blocked(v_me, p_peer) then  -- wave104
    raise exception 'not connected';
  end if;

  v_a := least(v_me, p_peer);
  v_b := greatest(v_me, p_peer);

  select t.id into v_id from public.threads t where t.user_a = v_a and t.user_b = v_b;
  if v_id is not null then return v_id; end if;

  insert into public.threads (user_a, user_b) values (v_a, v_b)
  on conflict (user_a, user_b) do nothing
  returning id into v_id;

  if v_id is null then
    select t.id into v_id from public.threads t where t.user_a = v_a and t.user_b = v_b;
  end if;

  return v_id;
end;
$$;
revoke all on function public.get_or_create_thread(uuid) from public, anon;
grant execute on function public.get_or_create_thread(uuid) to authenticated;

-- public_profile(text) · source: wave98_server_hardening.sql + a signed-in caller never sees someone
-- they blocked or who blocked them. Signed-out (the share page) is unchanged.
create or replace function public.public_profile(p_handle text)
returns table(id uuid, name text, handle text, show_up text, talk_style text, recipe jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._rate_limit_caller('public_profile', 60, 600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return query
    select m.id, m.name, m.handle, m.show_up, m.talk_style, m.recipe
    from public.me m
    where m.handle = lower(btrim(p_handle, ' @'))
      and (auth.uid() is null or not public._circle_blocked(auth.uid(), m.id))  -- wave104
    limit 1;
end;
$$;

-- 4. peer_profile / peer_checks return nothing ------------------------------------------------------
-- Same signatures so an old app gets an empty answer, not an error. Circle option B (Step 7b) decides
-- what a friend may see (shareable strengths only, per-friend opt-in).

create or replace function public.peer_profile(p_user_id uuid)
returns table (id uuid, name text, handle text, show_up text, talk_style text, recipe jsonb)
language sql
security definer
set search_path = public
as $$
  select public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  select m.id, m.name, m.handle, m.show_up, m.talk_style, m.recipe
  from public.me m
  where false;  -- wave104: closed until Step 7b
$$;
revoke all on function public.peer_profile(uuid) from public, anon;
grant execute on function public.peer_profile(uuid) to authenticated;

create or replace function public.peer_checks(p_user_id uuid)
returns table (
  day integer,
  status text,
  read_text text,
  do_text text
)
language sql
security definer
set search_path = public
as $$
  select public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  select c.day, c.status, c.read_text, c.do_text
  from public.checks c
  where false;  -- wave104: closed; Read/Do text is never shown to friends
$$;
revoke all on function public.peer_checks(uuid) from public, anon;
grant execute on function public.peer_checks(uuid) to authenticated;

-- 5. Name / handle filter (lists = src/lib/name-filter.ts) -----------------------------------------

create or replace function public._name_fold(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(translate(lower(coalesce(p, '')), '013457@$', 'oieastas'), '[^a-z]', '', 'g');
$$;
revoke all on function public._name_fold(text) from public, anon, authenticated;

create or replace function public._name_not_allowed(p text, p_kind text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  -- name-filter:SLURS_ANYWHERE
  anywhere text[] := array['nigger','nigga','faggot','fagot','tranny','trannie','wetback','raghead','towelhead','beaner','chink','retard','hitler','kkk'];
  -- name-filter:SLURS_WHOLE
  whole text[] := array['fag','kike','spic','coon','gook','paki','nazi'];
  -- name-filter:STAFF_PREFIXES
  prefixes text[] := array['admin','support','official','moderator','atoteam','atostaff','atosupport','atoofficial','atoadmin','teamato'];
  -- name-filter:STAFF_SUFFIXES
  suffixes text[] := array['official','support','admin','moderator'];
  folded text := public._name_fold(p);
  w text;
  s text;
begin
  if folded = '' then return false; end if;
  foreach s in array anywhere loop
    if position(s in folded) > 0 then return true; end if;
  end loop;
  if p_kind = 'name' then
    foreach w in array regexp_split_to_array(translate(lower(coalesce(p, '')), '013457@$', 'oieastas'), '[^a-z]+') loop
      if w = any(whole) then return true; end if;
    end loop;
    if folded = 'ato' then return true; end if;
    foreach s in array prefixes loop
      if left(s, 3) = 'ato' and left(folded, length(s)) = s then return true; end if;
    end loop;
    return false;
  end if;
  if folded = any(whole) then return true; end if;
  foreach s in array prefixes loop
    if left(folded, length(s)) = s then return true; end if;
  end loop;
  foreach s in array suffixes loop
    if right(folded, length(s)) = s then return true; end if;
  end loop;
  return false;
end;
$$;
revoke all on function public._name_not_allowed(text, text) from public, anon, authenticated;

create or replace function public.me_name_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Service role, cron and the SQL editor are not the person using the app.
  if coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' then
    return new;
  end if;
  if (tg_op = 'INSERT' or new.name is distinct from old.name)
     and public._name_not_allowed(new.name, 'name') then
    raise exception 'name_not_allowed' using errcode = 'P0001';
  end if;
  if (tg_op = 'INSERT' or new.handle is distinct from old.handle)
     and public._name_not_allowed(new.handle, 'handle') then
    raise exception 'name_not_allowed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.me_name_guard() from public, anon, authenticated;
drop trigger if exists me_name_guard on public.me;
create trigger me_name_guard
  before insert or update of name, handle on public.me
  for each row execute function public.me_name_guard();

-- 6. The dev sign-up reset and delete-account's row count cover circle_requests ---------------------
-- Both bodies = wave103 + one circle_requests line each. Reset account (root) keeps the requests on
-- purpose, like connections (other people are in these rows); they go with the account on delete.

-- reset_dev_test_user() · source: wave103_drop_crisis_plumbing.sql + circle_requests
create or replace function public.reset_dev_test_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dev_id constant uuid := 'a70d3e0e-4c00-4a1e-8c0d-00000000d3e0';
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if auth.uid() is distinct from v_dev_id then
    raise exception 'reset_dev_test_user: only the dev-test account may call this';
  end if;
  delete from public.checks where user_id = v_dev_id;
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
  delete from public.circle_requests where from_user = v_dev_id or to_user = v_dev_id;
  delete from public.me where id = v_dev_id;
end;
$$;
revoke all on function public.reset_dev_test_user() from public, anon;
grant execute on function public.reset_dev_test_user() to authenticated;

-- count_user_rows(uuid) · source: wave103_drop_crisis_plumbing.sql + circle_requests
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
  + (select count(*) from public.circle_requests where from_user = p_user_id or to_user = p_user_id)
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;

-- 7. Advisor fixes ----------------------------------------------------------------------------------

alter function public.recipe_from_account_id(uuid) set search_path = public;
alter function public.trait_is_direct_source(text) set search_path = public;
alter function public._bank_premium_price(text) set search_path = public;
alter function public.trait_ewma_step(double precision, double precision, int, double precision, text) set search_path = public;
alter function public.daily_pick_position(date) set search_path = public;
alter function public._profile_code(jsonb) set search_path = public;
alter function public._profile_changed(jsonb, jsonb) set search_path = public;

-- Public bucket: files stay readable by URL (/object/public/around/...); nobody can list the bucket.
drop policy if exists around_public_read on storage.objects;

commit;
