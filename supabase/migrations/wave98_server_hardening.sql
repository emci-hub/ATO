-- wave98 — server hardening before public signup (ato-finish-roadmap step 1).
--
-- 1. Rate limits. A fixed-window counter table + one internal helper, built on the
--    same advisory-lock pattern as claim_ai_call. Callers: public_profile and
--    handle_taken here; password-login and dev-unlock through rate_limit_hit()
--    (service_role only). A function that RAISES rolls its own counter back, so
--    only endpoints that return normally can count failures (see roadmap step 1
--    notes on assert_invite_usable).
-- 2. public_profile / handle_taken take the limit. handle_taken drops its anon
--    grant (wave64 meant authenticated-only; Supabase default privileges kept anon).
-- 3. Anon can no longer execute the six chat/connection definer functions the
--    advisor flagged (peer_profile, get_or_create_thread, delete_message_for_me,
--    is_message_party, mirror_connection, unmirror_connection).
-- 4. play_dev_logs: no anon / authenticated read (insert stays).
-- 5. Check-in timezone farming (S1): me.timezone must be a real IANA zone, and
--    claim_daily_checkin never accepts a local day more than 1 day from the UTC day.
--
-- Rollback: drop trigger me_timezone_guard; re-create the old function bodies from
-- wave92 / wave64 / the supabase/baseline files; drop table rate_limit_hits.

begin;

-- ---------------------------------------------------------------------------
-- 1. Rate-limit table + helpers
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_hits (
  bucket       text        not null,
  key          text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket, key, window_start)
);
alter table public.rate_limit_hits enable row level security;
revoke all on table public.rate_limit_hits from public, anon, authenticated;

-- The caller's address, or 'noip' when PostgREST gave us no header. Cloudflare's
-- header cannot be set by the client; x-forwarded-for's first value is the fallback.
create or replace function public._client_key()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_headers json;
  v_ip text;
begin
  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  exception when others then
    return 'noip';
  end;
  v_ip := nullif(btrim(coalesce(
    v_headers ->> 'cf-connecting-ip',
    split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)
  )), '');
  return coalesce('ip:' || left(v_ip, 64), 'noip');
end;
$$;
revoke all on function public._client_key() from public, anon, authenticated;

-- Count one hit. Returns true while the caller is within p_max per window.
create or replace function public._rate_limit_check(
  p_bucket text, p_key text, p_max integer, p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  if p_max < 1 or p_window_seconds < 1 then
    raise exception 'bad rate limit' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('rl:' || p_bucket || ':' || p_key));
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limit_hits (bucket, key, window_start, hits)
  values (p_bucket, p_key, v_window, 1)
  on conflict (bucket, key, window_start)
  do update set hits = public.rate_limit_hits.hits + 1
  returning hits into v_hits;
  if random() < 0.02 then
    delete from public.rate_limit_hits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end;
$$;
revoke all on function public._rate_limit_check(text, text, integer, integer) from public, anon, authenticated;

-- Per-caller limit for an RPC: the signed-in user, else the client address. With no
-- address at all everyone shares one bucket, so that bucket gets 20x the room.
create or replace function public._rate_limit_caller(
  p_bucket text, p_max integer, p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_max integer := p_max;
begin
  if v_uid is not null then
    v_key := 'u:' || v_uid::text;
  else
    v_key := public._client_key();
    if v_key = 'noip' then v_max := p_max * 20; end if;
  end if;
  return public._rate_limit_check(p_bucket, v_key, v_max, p_window_seconds);
end;
$$;
revoke all on function public._rate_limit_caller(text, integer, integer) from public, anon, authenticated;

-- For Edge Functions (service role). true = allowed.
create or replace function public.rate_limit_hit(
  p_bucket text, p_key text, p_max integer, p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return public._rate_limit_check(left(p_bucket, 40), left(p_key, 128), p_max, p_window_seconds);
end;
$$;
revoke all on function public.rate_limit_hit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 2. public_profile + handle_taken take the limit
-- ---------------------------------------------------------------------------
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
    limit 1;
end;
$$;

create or replace function public.handle_taken(p_handle text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._rate_limit_caller('handle_taken', 30, 600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return exists (
    select 1
    from public.me
    where lower(me.handle) = lower(btrim(coalesce(p_handle, '')))
  );
end;
$$;
revoke execute on function public.handle_taken(text) from public, anon;
grant execute on function public.handle_taken(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Anon cannot reach the chat / connection definer functions
-- ---------------------------------------------------------------------------
revoke execute on function public.peer_profile(uuid) from public, anon;
grant execute on function public.peer_profile(uuid) to authenticated;
revoke execute on function public.get_or_create_thread(uuid) from public, anon;
grant execute on function public.get_or_create_thread(uuid) to authenticated;
revoke execute on function public.delete_message_for_me(uuid) from public, anon;
grant execute on function public.delete_message_for_me(uuid) to authenticated;
revoke execute on function public.is_message_party(uuid) from public, anon;
grant execute on function public.is_message_party(uuid) to authenticated;
-- Trigger functions: a trigger needs no EXECUTE grant at run time.
revoke execute on function public.mirror_connection() from public, anon, authenticated;
revoke execute on function public.unmirror_connection() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. play_dev_logs: write-only for the app
-- ---------------------------------------------------------------------------
drop policy if exists play_dev_logs_select on public.play_dev_logs;
revoke select on public.play_dev_logs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Check-in timezone farming (S1)
-- ---------------------------------------------------------------------------
-- A signed-in client may only store a real zone name. Anything else keeps the old
-- value (on insert: UTC) instead of failing, so a wrong device string never blocks
-- sign-up. Service role / SQL editor writes are untouched.
create or replace function public.me_timezone_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.timezone is not distinct from old.timezone then
    return new;
  end if;
  if new.timezone is null
     or not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.timezone) then
    new.timezone := case when tg_op = 'UPDATE' then old.timezone else 'UTC' end;
  end if;
  return new;
end;
$$;
revoke all on function public.me_timezone_guard() from public, anon, authenticated;

drop trigger if exists me_timezone_guard on public.me;
create trigger me_timezone_guard
  before insert or update of timezone on public.me
  for each row execute function public.me_timezone_guard();

-- Same body as wave92 except the local day: a bad stored zone falls back to UTC and
-- no zone can put the day more than 1 away from the UTC day (real zones span -12..+14).
-- Each local day pays once, so claims by any time T are at most days elapsed + 2.
create or replace function public.claim_daily_checkin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid(); tz text; local_today date; utc_today date := (timezone('utc', now()))::date;
  base int; bonus int; before_count int; amount int; v_id uuid; new_balance int;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select coalesce(nullif(timezone, ''), 'UTC') into tz from public.me where id = uid;
  if tz is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  begin
    local_today := (timezone(tz, now()))::date;
  exception when others then
    local_today := utc_today;
  end;
  if local_today > utc_today + 1 or local_today < utc_today - 1 then
    local_today := utc_today;
  end if;
  select checkin_tokens, checkin_week_bonus into strict base, bonus from public.app_config where id = 1;
  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));
  select count(*) into before_count from public.ato_token_events where user_id = uid and reason = 'daily_checkin';
  amount := case when (before_count + 1) % 7 = 0 then bonus else base end;
  insert into public.ato_token_events (user_id, delta, reason, local_day)
  values (uid, amount, 'daily_checkin', local_today)
  on conflict (user_id, local_day) where reason = 'daily_checkin' do nothing
  returning id into v_id;
  if v_id is null then
    select ato_tokens into new_balance from public.me where id = uid;
    return jsonb_build_object('ok', false, 'already', true, 'balance', coalesce(new_balance, 0),
      'week_count', ((before_count - 1) % 7) + 1);
  end if;
  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me set ato_tokens = ato_tokens + amount where id = uid returning ato_tokens into new_balance;
  perform set_config('ato.allow_ato_token_write', '0', true);
  return jsonb_build_object('ok', true, 'already', false, 'balance', new_balance, 'delta', amount,
    'week_count', (before_count % 7) + 1);
end;
$$;

-- handle_taken became volatile: make PostgREST drop any cached read-only plan.
notify pgrst, 'reload schema';

commit;
