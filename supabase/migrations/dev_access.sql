-- Dev-access: per-capability grants, session trace capture, root pause/delete.
-- Grantable capabilities: card, traits, quota, fence, trace.
-- NEVER grantable (root-only, hardcoded): profile-pause, profile-delete, access-review.

create function public.is_root()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.me m
    where m.id = auth.uid() and m.handle = 'emci'
  );
$$;

revoke execute on function public.is_root() from public, anon;
grant execute on function public.is_root() to authenticated;

comment on function public.is_root() is
  'True only when the JWT is the ME row with handle emci. Not is_founder.';

-- 1. grants ------------------------------------------------------------------

create table public.dev_access_grants (
  user_id uuid not null references public.me(id) on delete cascade,
  capability text not null,
  granted_by uuid not null references public.me(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, capability),
  constraint dev_access_grants_capability_grantable
    check (capability in ('card', 'traits', 'quota', 'fence', 'trace'))
);

comment on table public.dev_access_grants is
  'Per-capability TestFlight hub access. CHECK allows only card/traits/quota/fence/trace. profile-pause, profile-delete, and access-review cannot be stored here.';

comment on constraint dev_access_grants_capability_grantable on public.dev_access_grants is
  'Hard lock: profile-pause, profile-delete, access-review are not grantable under any circumstance.';

alter table public.dev_access_grants enable row level security;

revoke all on table public.dev_access_grants from public, anon, authenticated;

create function public.my_dev_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_root boolean;
  v_caps text[];
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  v_root := public.is_root();
  if v_root then
    v_caps := array['card', 'traits', 'quota', 'fence', 'trace'];
  else
    select coalesce(array_agg(g.capability order by g.capability), '{}')
      into v_caps
    from public.dev_access_grants g
    where g.user_id = uid;
  end if;
  return jsonb_build_object('is_root', v_root, 'capabilities', to_jsonb(v_caps));
end;
$$;

revoke execute on function public.my_dev_access() from public, anon;
grant execute on function public.my_dev_access() to authenticated;

create function public.root_search_me(p_query text)
returns table (id uuid, handle text, name text, paused boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := lower(btrim(coalesce(p_query, '')));
begin
  perform public.require_root();
  if q like '@%' then
    q := substr(q, 2);
  end if;
  if char_length(q) < 1 then
    return;
  end if;
  return query
    select m.id, m.handle, m.name,
      (u.banned_until is not null and u.banned_until > now()) as paused
    from public.me m
    join auth.users u on u.id = m.id
    where m.handle ilike '%' || q || '%'
    order by m.handle
    limit 20;
end;
$$;

revoke execute on function public.root_search_me(text) from public, anon;
grant execute on function public.root_search_me(text) to authenticated;

create function public.list_dev_access_grants(p_handle text)
returns table (capability text, granted_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.require_root();
  select m.id into v_id from public.me m where m.handle = btrim(coalesce(p_handle, ''));
  if v_id is null then
    raise exception 'user_not_found' using errcode = 'P0004';
  end if;
  return query
    select g.capability, g.granted_at
    from public.dev_access_grants g
    where g.user_id = v_id
    order by g.capability;
end;
$$;

revoke execute on function public.list_dev_access_grants(text) from public, anon;
grant execute on function public.list_dev_access_grants(text) to authenticated;

create function public.set_dev_access_grants(p_handle text, p_capabilities text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_root uuid;
  v_id uuid;
  v_cap text;
begin
  v_root := public.require_root();
  select m.id into v_id from public.me m where m.handle = btrim(coalesce(p_handle, ''));
  if v_id is null then
    raise exception 'user_not_found' using errcode = 'P0004';
  end if;

  foreach v_cap in array coalesce(p_capabilities, '{}')
  loop
    if v_cap not in ('card', 'traits', 'quota', 'fence', 'trace') then
      raise exception 'capability_not_grantable' using errcode = '22023';
    end if;
  end loop;

  delete from public.dev_access_grants where user_id = v_id;
  insert into public.dev_access_grants (user_id, capability, granted_by)
  select v_id, cap, v_root
  from unnest(coalesce(p_capabilities, '{}')) as cap
  on conflict (user_id, capability) do nothing;
end;
$$;

revoke execute on function public.set_dev_access_grants(text, text[]) from public, anon;
grant execute on function public.set_dev_access_grants(text, text[]) to authenticated;

comment on function public.set_dev_access_grants(text, text[]) is
  'Root-only replace of grantable capabilities. Rejects profile-pause, profile-delete, access-review.';

-- 2. trace -------------------------------------------------------------------

create table public.dev_trace_sessions (
  user_id uuid primary key references public.me(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  remaining int not null check (remaining >= 0)
);

create table public.dev_trace_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.me(id) on delete cascade,
  created_at timestamptz not null default now(),
  surface text not null check (surface in ('sage', 'explore', 'dawn')),
  library_lines jsonb not null default '[]'::jsonb,
  trait_signals jsonb not null default '{}'::jsonb,
  raw_before text,
  raw_after text,
  guard_fired text
);

create index dev_trace_events_user_created_idx
  on public.dev_trace_events (user_id, created_at desc);

comment on table public.dev_trace_events is
  'Own-account generation traces. Inserts keyed on auth.uid() only. Auto-delete after 7 days.';

alter table public.dev_trace_sessions enable row level security;
alter table public.dev_trace_events enable row level security;

revoke all on table public.dev_trace_sessions from public, anon, authenticated;
revoke all on table public.dev_trace_events from public, anon, authenticated;

create function public.purge_expired_dev_trace()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.dev_trace_events
  where created_at < timezone('utc', now()) - interval '7 days';
  delete from public.dev_trace_sessions
  where expires_at < timezone('utc', now()) or remaining <= 0;
end;
$$;

revoke execute on function public.purge_expired_dev_trace() from public, anon, authenticated;

create function public.has_dev_trace_capability()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_root()
    or exists (
      select 1 from public.dev_access_grants g
      where g.user_id = auth.uid() and g.capability = 'trace'
    );
$$;

revoke execute on function public.has_dev_trace_capability() from public, anon;
grant execute on function public.has_dev_trace_capability() to authenticated;

create function public.start_dev_trace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_expires timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.has_dev_trace_capability() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform public.purge_expired_dev_trace();
  v_expires := timezone('utc', now()) + interval '30 minutes';
  insert into public.dev_trace_sessions (user_id, started_at, expires_at, remaining)
  values (uid, timezone('utc', now()), v_expires, 20)
  on conflict (user_id) do update
    set started_at = excluded.started_at,
        expires_at = excluded.expires_at,
        remaining = 20;
  return jsonb_build_object(
    'active', true,
    'expires_at', v_expires,
    'remaining', 20
  );
end;
$$;

revoke execute on function public.start_dev_trace() from public, anon;
grant execute on function public.start_dev_trace() to authenticated;

create function public.stop_dev_trace()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from public.dev_trace_sessions where user_id = auth.uid();
end;
$$;

revoke execute on function public.stop_dev_trace() from public, anon;
grant execute on function public.stop_dev_trace() to authenticated;

create function public.my_dev_trace_session()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_row public.dev_trace_sessions;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform public.purge_expired_dev_trace();
  select * into v_row from public.dev_trace_sessions where user_id = uid;
  if v_row.user_id is null then
    return jsonb_build_object('active', false, 'expires_at', null, 'remaining', 0);
  end if;
  return jsonb_build_object(
    'active', true,
    'expires_at', v_row.expires_at,
    'remaining', v_row.remaining
  );
end;
$$;

revoke execute on function public.my_dev_trace_session() from public, anon;
grant execute on function public.my_dev_trace_session() to authenticated;

create function public.list_my_dev_trace_events()
returns table (
  id uuid,
  created_at timestamptz,
  surface text,
  library_lines jsonb,
  trait_signals jsonb,
  raw_before text,
  raw_after text,
  guard_fired text
)
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
  perform public.purge_expired_dev_trace();
  return query
    select e.id, e.created_at, e.surface, e.library_lines, e.trait_signals,
           e.raw_before, e.raw_after, e.guard_fired
    from public.dev_trace_events e
    where e.user_id = uid
    order by e.created_at desc
    limit 40;
end;
$$;

revoke execute on function public.list_my_dev_trace_events() from public, anon;
grant execute on function public.list_my_dev_trace_events() to authenticated;

create function public.record_dev_trace(
  p_surface text,
  p_library_lines jsonb,
  p_trait_signals jsonb,
  p_raw_before text,
  p_raw_after text,
  p_guard_fired text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_remaining int;
begin
  if uid is null then
    return false;
  end if;
  if p_surface not in ('sage', 'explore', 'dawn') then
    return false;
  end if;
  perform public.purge_expired_dev_trace();

  update public.dev_trace_sessions
    set remaining = remaining - 1
  where user_id = uid
    and expires_at > timezone('utc', now())
    and remaining > 0
  returning remaining into v_remaining;

  if v_remaining is null then
    return false;
  end if;

  insert into public.dev_trace_events (
    user_id, surface, library_lines, trait_signals, raw_before, raw_after, guard_fired
  ) values (
    uid,
    p_surface,
    coalesce(p_library_lines, '[]'::jsonb),
    coalesce(p_trait_signals, '{}'::jsonb),
    p_raw_before,
    p_raw_after,
    nullif(btrim(coalesce(p_guard_fired, '')), '')
  );

  if v_remaining <= 0 then
    delete from public.dev_trace_sessions where user_id = uid;
  end if;
  return true;
end;
$$;

revoke execute on function public.record_dev_trace(text, jsonb, jsonb, text, text, text) from public, anon;
grant execute on function public.record_dev_trace(text, jsonb, jsonb, text, text, text) to authenticated;

comment on function public.record_dev_trace(text, jsonb, jsonb, text, text, text) is
  'Inserts a trace row for auth.uid() only when that user has an active capture session. Never accepts a target user_id.';

-- 3. root pause / delete (same pause_branch / delete_branch discipline) ------

create function public.root_pause_profile(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_handle text;
  v_out jsonb;
begin
  perform public.require_root();
  select m.id, m.handle into v_id, v_handle
  from public.me m
  where m.handle = btrim(coalesce(p_handle, ''));
  if v_id is null then
    raise exception 'user_not_found' using errcode = 'P0004';
  end if;
  if v_handle = 'emci' then
    raise exception 'cannot_act_on_root' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', rb.user_id, 'handle', rb.handle)), '[]'::jsonb)
    into v_out
  from public.pause_branch(v_id) rb;
  return v_out;
end;
$$;

revoke execute on function public.root_pause_profile(text) from public, anon;
grant execute on function public.root_pause_profile(text) to authenticated;

create function public.root_unpause_profile(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_handle text;
  v_out jsonb;
begin
  perform public.require_root();
  select m.id, m.handle into v_id, v_handle
  from public.me m
  where m.handle = btrim(coalesce(p_handle, ''));
  if v_id is null then
    raise exception 'user_not_found' using errcode = 'P0004';
  end if;
  if v_handle = 'emci' then
    raise exception 'cannot_act_on_root' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', rb.user_id, 'handle', rb.handle)), '[]'::jsonb)
    into v_out
  from public.unpause_branch(v_id) rb;
  return v_out;
end;
$$;

revoke execute on function public.root_unpause_profile(text) from public, anon;
grant execute on function public.root_unpause_profile(text) to authenticated;

create function public.root_delete_profile(p_handle text, p_confirm_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_handle text;
  v_out jsonb;
begin
  perform public.require_root();
  v_handle := btrim(coalesce(p_handle, ''));
  if v_handle = '' or v_handle is distinct from btrim(coalesce(p_confirm_handle, '')) then
    raise exception 'handle_confirm_mismatch' using errcode = '22023';
  end if;
  select m.id, m.handle into v_id, v_handle
  from public.me m
  where m.handle = v_handle;
  if v_id is null then
    raise exception 'user_not_found' using errcode = 'P0004';
  end if;
  if v_handle = 'emci' then
    raise exception 'cannot_act_on_root' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', rb.user_id, 'handle', rb.handle)), '[]'::jsonb)
    into v_out
  from public.delete_branch(v_id) rb;
  return v_out;
end;
$$;

revoke execute on function public.root_delete_profile(text, text) from public, anon;
grant execute on function public.root_delete_profile(text, text) to authenticated;

comment on function public.root_pause_profile(text) is
  'Root-only. Calls pause_branch. Not grantable via dev_access_grants.';
comment on function public.root_delete_profile(text, text) is
  'Root-only. Calls delete_branch after handle confirm. Requires the branch already paused. Not grantable.';

-- 4. 7-day cleanup (hourly). Check-on-read also purges. ----------------------

do $cron$
begin
  begin
    perform cron.unschedule('dev-trace-expire');
  exception when others then
    null;
  end;
  perform cron.schedule(
    'dev-trace-expire',
    '17 * * * *',
    $job$select public.purge_expired_dev_trace();$job$
  );
exception when others then
  raise notice 'dev-trace cron not scheduled: %', sqlerrm;
end;
$cron$;
