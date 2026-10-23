-- wave101: under-18 server gate (emci 2026-10-20). docs/under18-server.md has the full inventory.
--
-- NOT APPLIED. Apply by hand when emci says so, in this order (docs/under18-server.md "Apply order"):
--   app OTA with the under-18 screen + age confirmation  ->  wave99b  ->  wave99c / wave99d  ->
--   wave100 + wave100b  ->  set born_on on every account that must keep working (root, dev-test,
--   review accounts)  ->  THIS FILE.
-- Several copies below are taken from wave99*/wave100 (serve_bank_set, dev_fill_bank,
-- change_bank_answer): applying this before wave100 would undo wave100's change to them.
--
-- Policy: ATO is 18+. An account under 18, or with no birthday yet (born_on null), keeps its
-- account and every row, and can still read its own me row, set its birthday (the wave99b guard
-- still refuses an under-18 date), sign out, write to support and delete the account. Everything
-- else ("app use") is refused by the server with errcode P0005 / 'age_under_18'. On the 18th
-- birthday every check passes again by itself (worked out from born_on on current_date; nothing
-- is stored).
--
-- Non-destructive: no row is deleted, updated or inserted by this file. No column, table or grant
-- of an existing object changes. account deletion (delete-account Edge Function, service role,
-- ON DELETE CASCADE) is not touched: there is no delete trigger or delete policy here.
--
-- Tested patterns only:
--   is_adult(uuid)       is_root()'s me lookup + is_at_least_age(born_on, 18) (stage2, wave2, wave99b).
--                        Internal: revoked from every client role like _library_crisis (wave93).
--   is_adult()           the caller only (like is_root()); granted to authenticated because RLS
--                        policies run as the caller and need EXECUTE.
--   require_adult()      the require_root() pattern (wave34): raise, else nothing.
--   guarded copies       every APP-USE function is copied WORD FOR WORD from the migration named in
--                        its comment, with ONE added line as its first statement:
--                          plpgsql: perform public.require_adult();   sql: select public.require_adult();
--                        Same signature, language, security mode and search_path. Each copy then
--                        restates its CURRENT grants (revoke from public, anon; grant to authenticated),
--                        which changes nothing: every one is authenticated-only today.
--                        check:under18-server diffs every copy against its source.
--   me_adult_guard       BEFORE UPDATE raise-trigger on me (me_born_on_guard / me_timezone_guard pattern):
--                        an under-18 / no-birthday person may change only born_on, timezone, ai_consent, updated_at on their
--                        own row. Service role / SQL editor writes are untouched (me_timezone_guard rule).
--   connections_adult_guard  BEFORE INSERT raise-trigger: a new Circle link needs two adults.
--   restrictive RLS      on the tables a client still writes directly (and messages, a peer read).
--
-- Not gated, on purpose (see the doc): sign-up (complete_signup, handle_taken: no me row yet =
-- not adult), auth_has_password, own-row reads (home_bootstrap, bank_answered, ai_provider_counts,
-- the table SELECT policies), safety (library_report, blocks, mutes, reports, removing a Circle
-- link), caller-only / pure helpers, and anything anon can already call.

begin;

-- 1. Helpers ----------------------------------------------------------------------------------

create or replace function public.is_adult(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- 18+ today. A missing birthday is NOT adult until the person confirms one; no me row = not adult.
  select coalesce((
    select m.born_on is not null
       and public.is_at_least_age(m.born_on, 18)
    from public.me m
    where m.id = p_uid
  ), false);
$$;
revoke all on function public.is_adult(uuid) from public, anon, authenticated;
comment on function public.is_adult(uuid) is
  'Internal (wave101): true when this me row has a born_on and is 18+ today. Null born_on or no me row = false. Never granted to a client role: nobody can probe another account.';

create or replace function public.is_adult()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_adult(auth.uid());
$$;
revoke all on function public.is_adult() from public, anon;
grant execute on function public.is_adult() to authenticated;
comment on function public.is_adult() is
  'wave101: the caller only (auth.uid()). Used by the restrictive RLS policies, which run as the caller.';

create or replace function public.require_adult()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_adult(auth.uid()) then
    raise exception 'age_under_18' using errcode = 'P0005';
  end if;
end;
$$;
revoke all on function public.require_adult() from public, anon;
grant execute on function public.require_adult() to authenticated;
comment on function public.require_adult() is
  'wave101: first statement of every app-use function. Raises P0005 age_under_18 for an under-18 or no-birthday caller (the same code sign-up uses).';

-- 2. me: an under-18 / no-birthday account may only set its birthday (and timezone, AI consent) ----

create or replace function public.me_adult_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Service role, cron and the SQL editor are not the person using the app.
  if coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' then
    return new;
  end if;
  -- Only a person editing their own row (cascades from someone else's action pass).
  if new.id is distinct from auth.uid() then
    return new;
  end if;
  if old.born_on is not null and public.is_at_least_age(old.born_on, 18) then
    return new;
  end if;
  if (to_jsonb(new) - array['born_on', 'timezone', 'ai_consent', 'updated_at'])
     is distinct from (to_jsonb(old) - array['born_on', 'timezone', 'ai_consent', 'updated_at']) then
    raise exception 'age_under_18' using errcode = 'P0005';
  end if;
  return new;
end;
$$;
revoke all on function public.me_adult_guard() from public, anon, authenticated;

drop trigger if exists me_adult_guard on public.me;
create trigger me_adult_guard
  before update on public.me
  for each row execute function public.me_adult_guard();

-- 3. New Circle links need two adults (me_born_on_guard raise-trigger pattern) --------------------

create or replace function public.connections_adult_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' then
    return new;
  end if;
  if new.user_id = auth.uid() and not public.is_adult(new.user_id) then
    raise exception 'age_under_18' using errcode = 'P0005';
  end if;
  if not public.is_adult(new.user_id) or not public.is_adult(new.peer_id) then
    -- Generic on purpose: never tells the other person why.
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.connections_adult_guard() from public, anon, authenticated;

drop trigger if exists connections_adult_guard on public.connections;
create trigger connections_adult_guard
  before insert on public.connections
  for each row execute function public.connections_adult_guard();

-- 4. Restrictive RLS on the direct client write paths (and messages, a peer read) ----------------
-- A restrictive policy only narrows the existing permissive ones; adults see no change.
-- "to authenticated": anon has no permissive policy on these tables.

drop policy if exists trait_tracks_adult_insert on public.trait_tracks;
create policy trait_tracks_adult_insert on public.trait_tracks
  as restrictive for insert to authenticated
  with check ((select public.is_adult()));

drop policy if exists trait_tracks_adult_update on public.trait_tracks;
create policy trait_tracks_adult_update on public.trait_tracks
  as restrictive for update to authenticated
  using ((select public.is_adult()))
  with check ((select public.is_adult()));

drop policy if exists trait_history_adult_insert on public.trait_history;
create policy trait_history_adult_insert on public.trait_history
  as restrictive for insert to authenticated
  with check ((select public.is_adult()));

drop policy if exists category_share_adult_insert on public.category_share;
create policy category_share_adult_insert on public.category_share
  as restrictive for insert to authenticated
  with check ((select public.is_adult()));

drop policy if exists category_share_adult_update on public.category_share;
create policy category_share_adult_update on public.category_share
  as restrictive for update to authenticated
  using ((select public.is_adult()))
  with check ((select public.is_adult()));

drop policy if exists sage_title_flags_adult_insert on public.sage_title_flags;
create policy sage_title_flags_adult_insert on public.sage_title_flags
  as restrictive for insert to authenticated
  with check ((select public.is_adult()));

drop policy if exists ai_provider_log_adult_insert on public.ai_provider_log;
create policy ai_provider_log_adult_insert on public.ai_provider_log
  as restrictive for insert to authenticated
  with check ((select public.is_adult()));

drop policy if exists play_dev_logs_adult_insert on public.play_dev_logs;
create policy play_dev_logs_adult_insert on public.play_dev_logs
  as restrictive for insert to authenticated
  with check ((select public.is_adult()));

drop policy if exists threads_adult_insert on public.threads;
create policy threads_adult_insert on public.threads
  as restrictive for insert to authenticated
  with check ((select public.is_adult()));

drop policy if exists messages_adult_insert on public.messages;
create policy messages_adult_insert on public.messages
  as restrictive for insert to authenticated
  with check ((select public.is_adult()));

drop policy if exists messages_adult_select on public.messages;
create policy messages_adult_select on public.messages
  as restrictive for select to authenticated
  using ((select public.is_adult()));

-- 5. Guarded copies of every app-use function ------------------------------------------------------
-- Each: the latest definition, word for word, from the cited migration + the one guard line.

-- 5.1 AI library, AI claims, token earn / spend / refund ----------------------------------------

-- claim_library_write(text,text,text,text) · source: wave95_ai_library_key_regex.sql
create or replace function public.claim_library_write(p_kind text, p_mode text, p_bucket text, p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (timezone('utc', now()))::date;
  res jsonb;
  ai jsonb;
  cap int;
  used int;
  usage_key text;
  pick uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind is null or p_kind not in ('deep_dive', 'story', 'legend')
     or p_bucket is null or p_bucket !~ '^[a-z0-9_|:=+,.!-]{3,255}$'
     or p_version is null or p_version !~ '^[a-z0-9]{1,12}$' then
    raise exception 'invalid library request' using errcode = '22023';
  end if;

  if p_mode = 'seed' then
    perform public.require_root();
    select library_seed_daily_cap into strict cap from public.app_config where id = 1;
    usage_key := 'lib_seed';
  elsif p_mode = 'free_legend' then
    if p_kind <> 'legend' then
      raise exception 'invalid mode' using errcode = '22023';
    end if;
    select legend_free_daily_cap into strict cap from public.app_config where id = 1;
    usage_key := 'legend_free';
  elsif p_mode = 'paid' then
    usage_key := null;
  else
    raise exception 'invalid mode' using errcode = '22023';
  end if;

  if public._library_crisis(uid) then
    return jsonb_build_object('ok', false, 'reason', 'crisis');
  end if;

  if usage_key is not null then
    perform pg_advisory_xact_lock(hashtext(uid::text || ':' || usage_key));
    insert into public.ai_usage (user_id, day, calls, by_type)
    values (uid, today, 0, '{}'::jsonb)
    on conflict (user_id, day) do nothing;
    select coalesce((by_type->>usage_key)::int, 0) into used
      from public.ai_usage where user_id = uid and day = today;
    if used >= cap then
      return jsonb_build_object('ok', false, 'reason', 'quota');
    end if;
    update public.ai_usage
      set by_type = jsonb_set(coalesce(by_type, '{}'::jsonb), array[usage_key], to_jsonb(used + 1))
      where user_id = uid and day = today;
    if p_mode = 'seed' then
      return jsonb_build_object('ok', true, 'mode', p_mode);
    end if;
  else
    res := case p_kind
      when 'deep_dive' then public.claim_category_deep_dive()
      when 'story' then public.claim_story_generate()
      else public.claim_legend_figure_story()
    end;
    if (res->>'ok')::boolean is distinct from true then
      return jsonb_build_object('ok', false, 'reason', coalesce(res->>'reason', 'quota'));
    end if;
  end if;

  -- A Legends reveal is paid for (or free) already: an unseen library card is enough.
  if p_kind = 'legend' then
    pick := public._library_pick(uid, p_kind, p_bucket, p_version);
    if pick is not null then
      return jsonb_build_object('ok', true, 'mode', p_mode, 'served', public._library_give(uid, pick));
    end if;
  end if;

  -- The shared AI cap, same as every other model call. Full = roll it all back.
  ai := public.claim_ai_call('explore');
  if (ai->>'ok')::boolean is distinct from true then
    raise exception 'ai quota' using errcode = 'P0043';
  end if;
  return jsonb_build_object('ok', true, 'mode', p_mode, 'balance', res->'balance');
end;
$$;
revoke all on function public.claim_library_write(text,text,text,text) from public, anon;
grant execute on function public.claim_library_write(text,text,text,text) to authenticated;

-- library_serve(text,text,text) · source: wave95_ai_library_key_regex.sql
create or replace function public.library_serve(p_kind text, p_bucket text, p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  today date := (timezone('utc', now()))::date;
  usage_key text;
  used int;
  pick uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- Legends are not here: a reveal is a game move with its own free/paid rule,
  -- so its library cards come through claim_library_write (below).
  if p_kind is null or p_kind not in ('deep_dive', 'story')
     or p_bucket is null or p_bucket !~ '^[a-z0-9_|:=+,.!-]{3,255}$'
     or p_version is null or p_version !~ '^[a-z0-9]{1,12}$' then
    raise exception 'invalid library request' using errcode = '22023';
  end if;
  if public._library_crisis(uid) then
    return jsonb_build_object('ok', false, 'reason', 'crisis');
  end if;

  select library_free_daily_cap into strict cap from public.app_config where id = 1;
  usage_key := 'lib_' || p_kind;
  perform pg_advisory_xact_lock(hashtext(uid::text || ':library'));
  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;
  select coalesce((by_type->>usage_key)::int, 0) into used
    from public.ai_usage where user_id = uid and day = today;
  if used >= cap then
    return jsonb_build_object('ok', false, 'reason', 'daily');
  end if;

  pick := public._library_pick(uid, p_kind, p_bucket, p_version);
  if pick is null then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;

  update public.ai_usage
    set by_type = jsonb_set(coalesce(by_type, '{}'::jsonb), array[usage_key], to_jsonb(used + 1))
    where user_id = uid and day = today;
  return public._library_give(uid, pick);
end;
$$;
revoke all on function public.library_serve(text,text,text) from public, anon;
grant execute on function public.library_serve(text,text,text) to authenticated;

-- library_want(text,text[],text) · source: wave95_ai_library_key_regex.sql
create or replace function public.library_want(p_kind text, p_buckets text[], p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  b text;
  i int := 0;
  n int := 0;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind is null or p_kind not in ('deep_dive', 'story', 'legend')
     or p_version is null or p_version !~ '^[a-z0-9]{1,12}$'
     or p_buckets is null or coalesce(array_length(p_buckets, 1), 0) not between 1 and 11 then
    raise exception 'invalid library request' using errcode = '22023';
  end if;
  if public._library_crisis(uid) then
    return jsonb_build_object('ok', false, 'reason', 'crisis');
  end if;
  cap := case p_kind when 'deep_dive' then 11 when 'story' then 3 else 6 end;
  perform pg_advisory_xact_lock(hashtext(uid::text || ':library_want'));
  -- The phone sends its groups best first: earlier in the list = newer here, so
  -- the trim below keeps the best ones (no tie between rows of one call).
  foreach b in array p_buckets loop
    i := i + 1;
    if b is null or b !~ '^[a-z0-9_|:=+,.!-]{3,255}$' then
      continue;
    end if;
    insert into public.ai_library_wanted (user_id, kind, bucket_key, version, wanted_at)
    values (uid, p_kind, b, p_version, now() - make_interval(secs => i / 1000.0))
    on conflict (user_id, kind, bucket_key) do update
      set version = excluded.version, wanted_at = excluded.wanted_at;
    n := n + 1;
  end loop;
  -- Keep only the newest `cap` groups per kind for this account.
  delete from public.ai_library_wanted w
    where w.user_id = uid and w.kind = p_kind
      and w.bucket_key not in (
        select x.bucket_key from public.ai_library_wanted x
        where x.user_id = uid and x.kind = p_kind
        order by x.wanted_at desc
        limit cap
      );
  return jsonb_build_object('ok', true, 'saved', n);
end;
$$;
revoke all on function public.library_want(text,text[],text) from public, anon;
grant execute on function public.library_want(text,text[],text) to authenticated;

-- library_team_size(text) · source: wave94_ai_library_fill.sql
create or replace function public.library_team_size(p_bucket text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  select case when n >= 5 then (n / 5) * 5 else null end
  from (
    select count(distinct s.user_id)::int as n
    from public.ai_library_seen s
    join public.ai_library_cards c on c.id = s.card_id
    where c.kind = 'deep_dive' and c.bucket_key = p_bucket
  ) t
  where auth.uid() is not null
    and p_bucket not like 'dd|cat_love|%'
    and exists (
      select 1 from public.ai_library_seen mine
      join public.ai_library_cards mc on mc.id = mine.card_id
      where mine.user_id = auth.uid() and mc.kind = 'deep_dive' and mc.bucket_key = p_bucket
    );
$$;
revoke all on function public.library_team_size(text) from public, anon;
grant execute on function public.library_team_size(text) to authenticated;

-- claim_ai_call(text) · source: wave17_infinite_questions.sql
create or replace function public.claim_ai_call(p_call_type text default 'sage')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  daily_cap int;
  monthly_cap int;
  today date := (timezone('utc', now()))::date;
  month_start date := date_trunc('month', timezone('utc', now()))::date;
  daily_count int;
  monthly_count int;
  call_type text := lower(btrim(coalesce(p_call_type, 'sage')));
  typed int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if call_type not in ('sage', 'explore') then
    raise exception 'invalid call type' using errcode = '22023';
  end if;

  select ai_daily_cap, ai_monthly_cap
    into strict daily_cap, monthly_cap
    from public.app_config
    where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select calls into strict daily_count
    from public.ai_usage
    where user_id = uid and day = today;

  select coalesce(sum(calls), 0) into monthly_count
    from public.ai_usage
    where user_id = uid and day >= month_start and day <= today;

  if daily_count >= daily_cap or monthly_count >= monthly_cap then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota',
      'daily', daily_count,
      'daily_cap', daily_cap,
      'monthly', monthly_count,
      'monthly_cap', monthly_cap
    );
  end if;

  update public.ai_usage
    set
      calls = calls + 1,
      by_type = jsonb_set(
        coalesce(by_type, '{}'::jsonb),
        array[call_type],
        to_jsonb(coalesce((by_type->>call_type)::int, 0) + 1)
      )
    where user_id = uid and day = today
    returning calls, coalesce((by_type->>call_type)::int, 0) into daily_count, typed;

  return jsonb_build_object(
    'ok', true,
    'daily', daily_count,
    'daily_cap', daily_cap,
    'monthly', monthly_count + 1,
    'monthly_cap', monthly_cap,
    'call_type', call_type,
    'typed', typed
  );
end;
$$;
revoke all on function public.claim_ai_call(text) from public, anon;
grant execute on function public.claim_ai_call(text) to authenticated;

-- claim_category_deep_dive() · source: wave92_ai_tokens.sql
create or replace function public.claim_category_deep_dive()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  today date := (timezone('utc', now()))::date;
  used int;
  balance int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select category_deep_dive_daily_cap into strict cap from public.app_config where id = 1;
  perform pg_advisory_xact_lock(hashtext(uid::text || ':category_deep_dive'));
  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;
  select coalesce((by_type->>'category_deep_dive')::int, 0) into used
    from public.ai_usage where user_id = uid and day = today;
  if used >= cap then
    return jsonb_build_object('ok', false, 'reason', 'quota', 'daily', used, 'daily_cap', cap, 'call_type', 'category_deep_dive');
  end if;

  balance := public._charge_ai_tokens(uid, 'deep_dive');
  if balance is null then
    return jsonb_build_object('ok', false, 'reason', 'tokens', 'call_type', 'category_deep_dive');
  end if;

  update public.ai_usage
    set by_type = jsonb_set(coalesce(by_type, '{}'::jsonb), '{category_deep_dive}', to_jsonb(used + 1))
    where user_id = uid and day = today;
  return jsonb_build_object('ok', true, 'daily', used + 1, 'daily_cap', cap, 'call_type', 'category_deep_dive', 'balance', balance);
end;
$$;
revoke all on function public.claim_category_deep_dive() from public, anon;
grant execute on function public.claim_category_deep_dive() to authenticated;

-- claim_story_generate() · source: wave92_ai_tokens.sql
create or replace function public.claim_story_generate()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  today date := (timezone('utc', now()))::date;
  used int;
  balance int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select story_daily_cap into strict cap from public.app_config where id = 1;
  perform pg_advisory_xact_lock(hashtext(uid::text || ':story'));
  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;
  select coalesce((by_type->>'story')::int, 0) into used
    from public.ai_usage where user_id = uid and day = today;
  if used >= cap then
    return jsonb_build_object('ok', false, 'reason', 'quota', 'daily', used, 'daily_cap', cap, 'call_type', 'story');
  end if;

  balance := public._charge_ai_tokens(uid, 'story');
  if balance is null then
    return jsonb_build_object('ok', false, 'reason', 'tokens', 'call_type', 'story');
  end if;

  update public.ai_usage
    set by_type = jsonb_set(coalesce(by_type, '{}'::jsonb), '{story}', to_jsonb(used + 1))
    where user_id = uid and day = today;
  return jsonb_build_object('ok', true, 'daily', used + 1, 'daily_cap', cap, 'call_type', 'story', 'balance', balance);
end;
$$;
revoke all on function public.claim_story_generate() from public, anon;
grant execute on function public.claim_story_generate() to authenticated;

-- claim_legend_figure_story() · source: wave92_ai_tokens.sql
create or replace function public.claim_legend_figure_story()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  today date := (timezone('utc', now()))::date;
  used int;
  balance int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select legend_figure_daily_cap into strict cap from public.app_config where id = 1;
  perform pg_advisory_xact_lock(hashtext(uid::text || ':legend_figure'));
  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;
  select coalesce((by_type->>'legend_figure')::int, 0) into used
    from public.ai_usage where user_id = uid and day = today;
  if used >= cap then
    return jsonb_build_object('ok', false, 'reason', 'quota', 'daily', used, 'daily_cap', cap, 'call_type', 'legend_figure');
  end if;

  balance := public._charge_ai_tokens(uid, 'legend');
  if balance is null then
    return jsonb_build_object('ok', false, 'reason', 'tokens', 'call_type', 'legend_figure');
  end if;

  update public.ai_usage
    set by_type = jsonb_set(coalesce(by_type, '{}'::jsonb), '{legend_figure}', to_jsonb(used + 1))
    where user_id = uid and day = today;
  return jsonb_build_object('ok', true, 'daily', used + 1, 'daily_cap', cap, 'call_type', 'legend_figure', 'balance', balance);
end;
$$;
revoke all on function public.claim_legend_figure_story() from public, anon;
grant execute on function public.claim_legend_figure_story() to authenticated;

-- claim_legend_story_generation() · source: wave58_legend_generations.sql
create or replace function public.claim_legend_story_generation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  today date := (timezone('utc', now()))::date;
  used int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select legend_story_generations_daily_cap into strict cap from public.app_config where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':legend_story_gen'));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select coalesce((by_type->>'legend_story_gen')::int, 0) into used
    from public.ai_usage
    where user_id = uid and day = today;

  if used >= cap then
    return jsonb_build_object(
      'ok', false, 'reason', 'quota',
      'daily', used, 'daily_cap', cap, 'call_type', 'legend_story_gen'
    );
  end if;

  update public.ai_usage
    set by_type = jsonb_set(coalesce(by_type, '{}'::jsonb), '{legend_story_gen}', to_jsonb(used + 1))
    where user_id = uid and day = today
    returning coalesce((by_type->>'legend_story_gen')::int, 0) into used;

  return jsonb_build_object(
    'ok', true, 'daily', used, 'daily_cap', cap, 'call_type', 'legend_story_gen'
  );
end;
$$;
revoke all on function public.claim_legend_story_generation() from public, anon;
grant execute on function public.claim_legend_story_generation() to authenticated;

-- claim_title_generate() · source: wave20_trait_tracks_titles.sql
create or replace function public.claim_title_generate()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  today date := (timezone('utc', now()))::date;
  used int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select title_daily_cap into strict cap from public.app_config where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':title'));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select coalesce((by_type->>'title')::int, 0) into used
    from public.ai_usage
    where user_id = uid and day = today;

  if used >= cap then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota',
      'daily', used,
      'daily_cap', cap,
      'call_type', 'title'
    );
  end if;

  update public.ai_usage
    set by_type = jsonb_set(
      coalesce(by_type, '{}'::jsonb),
      '{title}',
      to_jsonb(used + 1)
    )
    where user_id = uid and day = today
    returning coalesce((by_type->>'title')::int, 0) into used;

  return jsonb_build_object(
    'ok', true,
    'daily', used,
    'daily_cap', cap,
    'call_type', 'title'
  );
end;
$$;
revoke all on function public.claim_title_generate() from public, anon;
grant execute on function public.claim_title_generate() to authenticated;

-- claim_questions_batch() · source: wave17_infinite_questions.sql
create or replace function public.claim_questions_batch()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  today date := (timezone('utc', now()))::date;
  used int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select questions_daily_cap into strict cap from public.app_config where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':questions'));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select coalesce((by_type->>'questions')::int, 0) into used
    from public.ai_usage
    where user_id = uid and day = today;

  if used >= cap then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota',
      'daily', used,
      'daily_cap', cap,
      'call_type', 'questions'
    );
  end if;

  update public.ai_usage
    set by_type = jsonb_set(
      coalesce(by_type, '{}'::jsonb),
      '{questions}',
      to_jsonb(used + 1)
    )
    where user_id = uid and day = today
    returning coalesce((by_type->>'questions')::int, 0) into used;

  return jsonb_build_object(
    'ok', true,
    'daily', used,
    'daily_cap', cap,
    'call_type', 'questions'
  );
end;
$$;
revoke all on function public.claim_questions_batch() from public, anon;
grant execute on function public.claim_questions_batch() to authenticated;

-- claim_roll_generation() · source: wave48_roll_generation_quota.sql
create or replace function public.claim_roll_generation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  today date := (timezone('utc', now()))::date;
  used int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select roll_generations_daily_cap into strict cap from public.app_config where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':roll_gen'));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select coalesce((by_type->>'roll_gen')::int, 0) into used
    from public.ai_usage
    where user_id = uid and day = today;

  if used >= cap then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota',
      'daily', used,
      'daily_cap', cap,
      'call_type', 'roll_gen'
    );
  end if;

  update public.ai_usage
    set by_type = jsonb_set(
      coalesce(by_type, '{}'::jsonb),
      '{roll_gen}',
      to_jsonb(used + 1)
    )
    where user_id = uid and day = today
    returning coalesce((by_type->>'roll_gen')::int, 0) into used;

  return jsonb_build_object(
    'ok', true,
    'daily', used,
    'daily_cap', cap,
    'call_type', 'roll_gen'
  );
end;
$$;
revoke all on function public.claim_roll_generation() from public, anon;
grant execute on function public.claim_roll_generation() to authenticated;

-- claim_roll() · source: wave46_trait_rolls.sql
create or replace function public.claim_roll()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  today date := (timezone('utc', now()))::date;
  used int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select rolls_daily_cap into strict cap from public.app_config where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':roll'));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select coalesce((by_type->>'roll')::int, 0) into used
    from public.ai_usage
    where user_id = uid and day = today;

  if used >= cap then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota',
      'daily', used,
      'daily_cap', cap,
      'call_type', 'roll'
    );
  end if;

  update public.ai_usage
    set by_type = jsonb_set(
      coalesce(by_type, '{}'::jsonb),
      '{roll}',
      to_jsonb(used + 1)
    )
    where user_id = uid and day = today
    returning coalesce((by_type->>'roll')::int, 0) into used;

  return jsonb_build_object(
    'ok', true,
    'daily', used,
    'daily_cap', cap,
    'call_type', 'roll'
  );
end;
$$;
revoke all on function public.claim_roll() from public, anon;
grant execute on function public.claim_roll() to authenticated;

-- refund_ai_tokens(text) · source: wave92_ai_tokens.sql
create or replace function public.refund_ai_tokens(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tz text;
  local_today date;
  charge record;
  new_balance int;
  v_id uuid;
  usage_key text;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind is null or p_kind not in ('story', 'legend', 'deep_dive') then
    raise exception 'invalid kind' using errcode = '22023';
  end if;
  select coalesce(nullif(timezone, ''), 'UTC') into tz from public.me where id = uid;
  local_today := (timezone(coalesce(tz, 'UTC'), now()))::date;
  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  select id, delta, created_at into charge
    from public.ato_token_events
    where user_id = uid and reason = 'ai_spend' and ai_kind = p_kind
      and created_at > now() - interval '15 minutes'
    order by created_at desc
    limit 1;
  if charge.id is null then
    return jsonb_build_object('ok', false, 'reason', 'nothing to refund');
  end if;

  insert into public.ato_token_events (user_id, delta, reason, ai_kind, local_day)
  values (uid, -charge.delta, 'ai_refund', p_kind, local_today)
  on conflict (user_id, ai_kind, local_day) where reason = 'ai_refund' do nothing
  returning id into v_id;
  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'already refunded today');
  end if;

  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me set ato_tokens = ato_tokens - charge.delta where id = uid returning ato_tokens into new_balance;
  perform set_config('ato.allow_ato_token_write', '0', true);

  usage_key := case p_kind when 'story' then 'story' when 'legend' then 'legend_figure' else 'category_deep_dive' end;
  update public.ai_usage
    set by_type = jsonb_set(
      coalesce(by_type, '{}'::jsonb),
      array[usage_key],
      to_jsonb(greatest(coalesce((by_type->>usage_key)::int, 0) - 1, 0))
    )
    where user_id = uid and day = (timezone('utc', now()))::date;

  return jsonb_build_object('ok', true, 'balance', new_balance, 'delta', -charge.delta);
end;
$$;
revoke all on function public.refund_ai_tokens(text) from public, anon;
grant execute on function public.refund_ai_tokens(text) to authenticated;

-- claim_daily_checkin() · source: wave98_server_hardening.sql
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
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
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
revoke all on function public.claim_daily_checkin() from public, anon;
grant execute on function public.claim_daily_checkin() to authenticated;

-- claim_full_profile_complete() · source: wave92_ai_tokens.sql
create or replace function public.claim_full_profile_complete()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 15;  -- wave92: enough for one AI view of each kind
  tz text;
  today date;
  new_balance int;
  v_event_id uuid;
  v_full_axes int;
  v_legacy_answered int;
  v_answer_count int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC') into tz
  from public.me
  where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- a. every trait has its 3 (staged intake)
  select count(*) into v_full_axes
  from public.trait_tracks
  where user_id = uid and track = 'report' and answer_count >= 3;

  -- b. the old tiered 50, each trait capped at its old size
  select coalesce(sum(least(t.answer_count, l.old_count)), 0) into v_legacy_answered
  from (values
    ('openness', 6), ('conscientiousness', 6), ('extraversion', 6),
    ('agreeableness', 4), ('steadiness', 2), ('attachment_anxiety', 2),
    ('attachment_avoidance', 2), ('conflict_assertiveness', 4),
    ('conflict_cooperativeness', 2), ('autonomy', 2), ('competence', 2),
    ('relatedness', 4), ('growth_mindset', 2), ('locus_of_control', 2),
    ('self_efficacy', 2), ('playfulness', 2)
  ) as l(axis, old_count)
  join public.trait_tracks t
    on t.user_id = uid and t.track = 'report' and t.axis = l.axis;

  -- c. the wave52 rule, kept
  select count(*) into v_answer_count
  from public.trait_history
  where user_id = uid and source = 'self_situation';

  if v_full_axes < 16 and v_legacy_answered < 50 and v_answer_count < 50 then
    raise exception 'full profile not complete' using errcode = '22023';
  end if;

  today := (timezone(tz, now()))::date;

  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ato_token_events (user_id, delta, reason, local_day)
  values (uid, amount, 'full_profile_complete', today)
  on conflict (user_id) where reason = 'full_profile_complete' do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select ato_tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', 'full_profile_complete'
    );
  end if;

  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me
    set ato_tokens = ato_tokens + amount
    where id = uid
    returning ato_tokens into new_balance;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', coalesce(new_balance, 0),
    'delta', amount,
    'reason', 'full_profile_complete'
  );
end;
$$;
revoke all on function public.claim_full_profile_complete() from public, anon;
grant execute on function public.claim_full_profile_complete() to authenticated;

-- claim_intake_complete() · source: wave45_trait_redesign_tokens.sql
create or replace function public.claim_intake_complete()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 20;
  tz text;
  today date;
  new_balance int;
  v_event_id uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC') into tz
  from public.me
  where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  today := (timezone(tz, now()))::date;

  perform pg_advisory_xact_lock(hashtext('tokens:' || uid::text));
  perform set_config('ato.allow_token_write', '1', true);

  insert into public.token_events (user_id, delta, reason, local_day)
  values (uid, amount, 'intake_complete', today)
  on conflict (user_id) where reason = 'intake_complete' do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', 'intake_complete'
    );
  end if;

  update public.me
    set tokens = tokens + amount
    where id = uid
    returning tokens into new_balance;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', coalesce(new_balance, 0),
    'delta', amount,
    'reason', 'intake_complete'
  );
end;
$$;
revoke all on function public.claim_intake_complete() from public, anon;
grant execute on function public.claim_intake_complete() to authenticated;

-- claim_ongoing_round_complete(uuid) · source: wave92_ai_tokens.sql
create or replace function public.claim_ongoing_round_complete(p_pack_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 5;  -- wave92: one AI view per set of 16
  tz text;
  today date;
  new_balance int;
  v_event_id uuid;
  v_pack_owner uuid;
  v_total_items int;
  v_unanswered int;
  v_paid_today int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC') into tz
  from public.me
  where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select user_id into v_pack_owner
  from public.question_packs
  where id = p_pack_id and kind = 'ongoing_round';
  if v_pack_owner is null or v_pack_owner is distinct from uid then
    raise exception 'pack not found' using errcode = '22023';
  end if;

  -- A round is 16 (staged intake, wave78). A round of 25 from before still pays.
  select count(*) into v_total_items
  from public.question_items
  where pack_id = p_pack_id;
  if v_total_items < 16 then
    raise exception 'round not complete' using errcode = '22023';
  end if;

  select count(*) into v_unanswered
  from public.question_items
  where pack_id = p_pack_id and answered_option is null;
  if v_unanswered > 0 then
    raise exception 'round not complete' using errcode = '22023';
  end if;

  today := (timezone(tz, now()))::date;

  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  -- Daily cap (emci, 2026-10-03): at most 2 paid rounds per local day. Checked
  -- under the same lock as the insert, so two claims at once cannot both pass.
  -- A capped round is not consumed: it is refused, not recorded.
  select count(*) into v_paid_today
  from public.ato_token_events
  where user_id = uid and reason = 'ongoing_round_complete' and local_day = today;
  if v_paid_today >= 2 and not exists (
    select 1 from public.ato_token_events
    where user_id = uid and reason = 'ongoing_round_complete' and pack_id = p_pack_id
  ) then
    raise exception 'daily round payout cap reached' using errcode = 'P0042';
  end if;

  insert into public.ato_token_events (user_id, delta, reason, pack_id, local_day)
  values (uid, amount, 'ongoing_round_complete', p_pack_id, today)
  on conflict (user_id, pack_id) where reason = 'ongoing_round_complete' do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select ato_tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', 'ongoing_round_complete'
    );
  end if;

  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me
    set ato_tokens = ato_tokens + amount
    where id = uid
    returning ato_tokens into new_balance;

  update public.question_packs
    set completed_at = now()
    where id = p_pack_id and completed_at is null;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', coalesce(new_balance, 0),
    'delta', amount,
    'reason', 'ongoing_round_complete'
  );
end;
$$;
revoke all on function public.claim_ongoing_round_complete(uuid) from public, anon;
grant execute on function public.claim_ongoing_round_complete(uuid) to authenticated;

-- earn_tokens(text) · source: wave45_trait_redesign_tokens.sql
create or replace function public.earn_tokens(p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  reason text := lower(btrim(coalesce(p_reason, '')));
  amount int;
  tz text;
  today date;
  yesterday date;
  had_yesterday boolean;
  new_balance int;
  v_event_id uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if reason = 'check_in' then
    amount := 3;
  elsif reason = 'game_round' then
    amount := 5;
  else
    raise exception 'invalid earn reason' using errcode = '22023';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC') into tz
  from public.me
  where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  today := (timezone(tz, now()))::date;
  yesterday := today - 1;

  perform pg_advisory_xact_lock(hashtext('tokens:' || uid::text));
  perform set_config('ato.allow_token_write', '1', true);

  insert into public.token_events (user_id, delta, reason, local_day)
  values (uid, amount, reason, today)
  on conflict (user_id, reason, local_day)
    where delta > 0 and reason not in ('intake_complete', 'round_complete')
    do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', reason
    );
  end if;

  update public.me
    set tokens = tokens + amount
    where id = uid
    returning tokens into new_balance;

  if reason = 'check_in' then
    select exists (
      select 1 from public.checks
      where user_id = uid and logged_on = yesterday
    ) into had_yesterday;

    if had_yesterday and not exists (
      select 1 from public.token_events
      where user_id = uid and reason = 'trickle' and local_day = today and delta > 0
    ) then
      insert into public.token_events (user_id, delta, reason, local_day)
      values (uid, 1, 'trickle', today);
      update public.me
        set tokens = tokens + 1
        where id = uid
        returning tokens into new_balance;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', coalesce(new_balance, 0),
    'delta', amount,
    'reason', reason
  );
end;
$$;
revoke all on function public.earn_tokens(text) from public, anon;
grant execute on function public.earn_tokens(text) to authenticated;

-- spend_tokens(text) · source: wave19_trait_history_tokens.sql
create or replace function public.spend_tokens(p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  reason text := lower(btrim(coalesce(p_reason, '')));
  amount int;
  tz text;
  today date;
  current_balance int;
  new_balance int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if reason = 'sage_insight' then
    amount := 8;
  elsif reason = 'profile_depth' then
    amount := 12;
  else
    raise exception 'invalid spend reason' using errcode = '22023';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC'), tokens
    into tz, current_balance
  from public.me
  where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  today := (timezone(tz, now()))::date;

  perform pg_advisory_xact_lock(hashtext('tokens:' || uid::text));

  if coalesce(current_balance, 0) < amount then
    return jsonb_build_object(
      'ok', false,
      'reason', 'insufficient',
      'balance', coalesce(current_balance, 0),
      'price', amount
    );
  end if;

  perform set_config('ato.allow_token_write', '1', true);

  insert into public.token_events (user_id, delta, reason, local_day)
  values (uid, -amount, reason, today);

  update public.me
    set tokens = tokens - amount
    where id = uid
    returning tokens into new_balance;

  return jsonb_build_object(
    'ok', true,
    'balance', coalesce(new_balance, 0),
    'delta', -amount,
    'reason', reason,
    'price', amount
  );
end;
$$;
revoke all on function public.spend_tokens(text) from public, anon;
grant execute on function public.spend_tokens(text) to authenticated;

-- spend_ato_tokens_category_reroll(text) · source: wave51_ato_tokens.sql
create or replace function public.spend_ato_tokens_category_reroll(p_category_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 1;
  tz text;
  today date;
  new_balance int;
  v_event_id uuid;
  category text := btrim(coalesce(p_category_id, ''));
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if category = '' then
    raise exception 'category_id required' using errcode = '22023';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC') into tz
  from public.me
  where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  today := (timezone(tz, now()))::date;

  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ato_token_events (user_id, delta, reason, category_id, local_day)
  values (uid, -amount, 'category_reroll', category, today)
  on conflict (user_id, category_id, local_day) where reason = 'category_reroll' do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select ato_tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', false,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', 'category_reroll',
      'price', amount
    );
  end if;

  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me
    set ato_tokens = ato_tokens - amount
    where id = uid and ato_tokens >= amount
    returning ato_tokens into new_balance;

  if new_balance is null then
    raise exception 'insufficient ato tokens' using errcode = 'P0040';
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', new_balance,
    'delta', -amount,
    'reason', 'category_reroll',
    'price', amount
  );
end;
$$;
revoke all on function public.spend_ato_tokens_category_reroll(text) from public, anon;
grant execute on function public.spend_ato_tokens_category_reroll(text) to authenticated;

-- spend_ato_tokens_legend_reroll() · source: wave51_ato_tokens.sql
create or replace function public.spend_ato_tokens_legend_reroll()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 10;
  tz text;
  today date;
  new_balance int;
  v_event_id uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC') into tz
  from public.me
  where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  today := (timezone(tz, now()))::date;

  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ato_token_events (user_id, delta, reason, local_day)
  values (uid, -amount, 'legend_reroll', today)
  on conflict (user_id, local_day) where reason = 'legend_reroll' do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select ato_tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', false,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', 'legend_reroll',
      'price', amount
    );
  end if;

  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me
    set ato_tokens = ato_tokens - amount
    where id = uid and ato_tokens >= amount
    returning ato_tokens into new_balance;

  if new_balance is null then
    raise exception 'insufficient ato tokens' using errcode = 'P0040';
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', new_balance,
    'delta', -amount,
    'reason', 'legend_reroll',
    'price', amount
  );
end;
$$;
revoke all on function public.spend_ato_tokens_legend_reroll() from public, anon;
grant execute on function public.spend_ato_tokens_legend_reroll() to authenticated;

-- spend_ato_tokens_question_reroll(uuid) · source: wave51_ato_tokens.sql
create or replace function public.spend_ato_tokens_question_reroll(p_question_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount int := 1;
  tz text;
  today date;
  new_balance int;
  v_event_id uuid;
  v_item_owner uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select user_id into v_item_owner
  from public.question_items
  where id = p_question_item_id;
  if v_item_owner is null or v_item_owner is distinct from uid then
    raise exception 'question item not found' using errcode = '22023';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC') into tz
  from public.me
  where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  today := (timezone(tz, now()))::date;

  perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));

  insert into public.ato_token_events (user_id, delta, reason, question_item_id, local_day)
  values (uid, -amount, 'question_reroll', p_question_item_id, today)
  on conflict (user_id, question_item_id, local_day) where reason = 'question_reroll' do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select ato_tokens into new_balance from public.me where id = uid;
    return jsonb_build_object(
      'ok', false,
      'already', true,
      'balance', coalesce(new_balance, 0),
      'delta', 0,
      'reason', 'question_reroll',
      'price', amount
    );
  end if;

  perform set_config('ato.allow_ato_token_write', '1', true);
  update public.me
    set ato_tokens = ato_tokens - amount
    where id = uid and ato_tokens >= amount
    returning ato_tokens into new_balance;

  if new_balance is null then
    raise exception 'insufficient ato tokens' using errcode = 'P0040';
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', new_balance,
    'delta', -amount,
    'reason', 'question_reroll',
    'price', amount
  );
end;
$$;
revoke all on function public.spend_ato_tokens_question_reroll(uuid) from public, anon;
grant execute on function public.spend_ato_tokens_question_reroll(uuid) to authenticated;

-- save_category_deep_dive(text,text,jsonb,date) · source: wave91_category_deep_dive_bundle.sql
create or replace function public.save_category_deep_dive(
  p_category_id text,
  p_leans_key text,
  p_story jsonb,
  p_made_on date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
  cap int;
  added_today int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- One save at a time per account, so two quick saves can't both slip past the limit.
  perform pg_advisory_xact_lock(hashtext(uid::text || ':category_deep_dives'));
  if p_category_id is null or p_category_id !~ '^cat_[a-z]{2,20}$' then
    raise exception 'invalid category_id' using errcode = '22023';
  end if;
  if p_leans_key is null or char_length(p_leans_key) not between 1 and 400 then
    raise exception 'invalid leans_key' using errcode = '22023';
  end if;
  if p_story is null or jsonb_typeof(p_story) <> 'object' or octet_length(p_story::text) > 6000 then
    raise exception 'invalid story' using errcode = '22023';
  end if;
  if p_made_on is null
     or p_made_on > (timezone('utc', now()))::date + 1
     or p_made_on < (timezone('utc', now()))::date - 1 then
    raise exception 'made_on must be today' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.category_deep_dives
    where user_id = uid and category_id = p_category_id and leans_key = p_leans_key
  ) then
    select category_deep_dive_daily_cap into strict cap from public.app_config where id = 1;
    select count(*) into added_today from public.category_deep_dives
      where user_id = uid and made_on = p_made_on;
    -- Bundle (wave91): one claimed call writes up to two cards (the one tapped
    -- + the next one, which opens tomorrow), so new rows per day = cap x 2.
    if added_today >= cap * 2 then
      raise exception 'daily limit' using errcode = '42501';
    end if;
  end if;

  insert into public.category_deep_dives (user_id, category_id, leans_key, story, made_on)
  values (uid, p_category_id, p_leans_key, p_story, p_made_on)
  on conflict (user_id, category_id, leans_key) do update
    set story = excluded.story
        -- made_on is kept: the first save's day counts toward the daily limit.
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.save_category_deep_dive(text,text,jsonb,date) from public, anon;
grant execute on function public.save_category_deep_dive(text,text,jsonb,date) to authenticated;

-- save_legend_figure_story(text,integer,text,text,jsonb,date) · source: wave89_legend_museum.sql
create or replace function public.save_legend_figure_story(
  p_legend_id text,
  p_chapter int,
  p_angle_id text,
  p_moment_id text,
  p_story jsonb,
  p_met_on date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
  cap int;
  added_today int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- New legends join at the same pace as the app offers them (the daily cap),
  -- so nobody can fill the museum at once to read which legends Circle friends met.
  -- One save at a time per account, so two quick saves can't both slip past the limit.
  perform pg_advisory_xact_lock(hashtext(uid::text || ':legend_museum'));
  if p_chapter is null or p_chapter < 0 or p_chapter > 20 then
    raise exception 'invalid chapter' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.legend_museum where user_id = uid and legend_id = p_legend_id and chapter = p_chapter
  ) then
    select legend_figure_daily_cap into strict cap from public.app_config where id = 1;
    -- Counted on the person's own day (met_on, which must be within a day of now).
    select count(*) into added_today from public.legend_museum
      where user_id = uid and met_on = p_met_on;
    if added_today >= cap then
      raise exception 'daily limit' using errcode = '42501';
    end if;
  end if;
  if p_legend_id is null or p_legend_id !~ '^lf_[a-z0-9_]{2,40}$' then
    raise exception 'invalid legend_id' using errcode = '22023';
  end if;
  if p_angle_id is null or p_angle_id !~ '^a[1-6]$' or p_moment_id is null or p_moment_id !~ '^m[1-3]$' then
    raise exception 'invalid angle or moment' using errcode = '22023';
  end if;
  if p_story is null or jsonb_typeof(p_story) <> 'object' or octet_length(p_story::text) > 6000 then
    raise exception 'invalid story' using errcode = '22023';
  end if;
  if p_met_on is null
     or p_met_on > (timezone('utc', now()))::date + 1
     or p_met_on < (timezone('utc', now()))::date - 1 then
    raise exception 'met_on must be today' using errcode = '22023';
  end if;

  insert into public.legend_museum (user_id, legend_id, chapter, angle_id, moment_id, story, met_on)
  values (uid, p_legend_id, p_chapter, p_angle_id, p_moment_id, p_story, p_met_on)
  on conflict (user_id, legend_id, chapter) do update
    set angle_id = excluded.angle_id,
        moment_id = excluded.moment_id,
        story = excluded.story
        -- met_on is kept: the first save's day counts toward the daily limit.
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.save_legend_figure_story(text,integer,text,text,jsonb,date) from public, anon;
grant execute on function public.save_legend_figure_story(text,integer,text,text,jsonb,date) to authenticated;

-- insert_legend_generation(text,text) · source: wave58_legend_generations.sql
create or replace function public.insert_legend_generation(
  p_archetype_code text,
  p_story text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_archetype_code is null or p_archetype_code !~ '^[HL]{3}-[HL]{3}$' then
    raise exception 'invalid archetype_code' using errcode = '22023';
  end if;
  if p_story is null or btrim(p_story) = '' then
    raise exception 'story required' using errcode = '22023';
  end if;

  insert into public.legend_generations (user_id, archetype_code, story)
  values (uid, p_archetype_code, left(trim(p_story), 2000))
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.insert_legend_generation(text,text) from public, anon;
grant execute on function public.insert_legend_generation(text,text) to authenticated;

-- legend_angle_counts(text) · source: wave89_legend_museum.sql
create or replace function public.legend_angle_counts(p_legend_id text)
returns table (angle_id text, moment_id text, n int)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- Nothing under 5 people, so a small invite-only group can never be read back.
  if (select count(distinct lm.user_id) from public.legend_museum lm where lm.legend_id = p_legend_id) < 5 then
    return;
  end if;
  return query
    select lm.angle_id, lm.moment_id, count(*)::int
    from public.legend_museum lm
    where lm.legend_id = p_legend_id
    group by lm.angle_id, lm.moment_id;
end;
$$;
revoke all on function public.legend_angle_counts(text) from public, anon;
grant execute on function public.legend_angle_counts(text) to authenticated;

-- 5.2 Circle, peer reads, chat, invites, Around -------------------------------------------------

-- circle_visit_allowed(uuid) · source: wave97_circle_visits.sql
create or replace function public.circle_visit_allowed(p_peer uuid)
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

-- circle_visit_friends() · source: wave97_circle_visits.sql
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
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
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

-- circle_visit_room(uuid) · source: wave97_circle_visits.sql
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
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
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

-- circle_send_gift(uuid) · source: wave97_circle_visits.sql
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
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
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

-- circle_gift_inbox() · source: wave97_circle_visits.sql
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
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
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

-- circle_open_gift(uuid) · source: wave97_circle_visits.sql
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
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
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

-- set_circle_visit_share(uuid,boolean) · source: wave97_circle_visits.sql
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
     or not exists (select 1 from public.connections c where c.user_id = uid and c.peer_id = p_peer) then
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

-- peer_profile(uuid) · source: stage7_chat_report.sql
create or replace function public.peer_profile(p_user_id uuid)
returns table (id uuid, name text, handle text, show_up text, talk_style text, recipe jsonb)
language sql
security definer
set search_path = public
as $$
  select public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  select m.id, m.name, m.handle, m.show_up, m.talk_style, m.recipe
  from public.me m
  where m.id = p_user_id
    and exists (
      select 1 from public.connections c
      where (c.user_id = auth.uid() and c.peer_id = m.id)
         or (c.user_id = m.id and c.peer_id = auth.uid())
    )
$$;
revoke all on function public.peer_profile(uuid) from public, anon;
grant execute on function public.peer_profile(uuid) to authenticated;

-- peer_checks(uuid) · source: peer_checks.sql
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
  where c.user_id = p_user_id
    and exists (
      select 1 from public.connections x
      where (x.user_id = auth.uid() and x.peer_id = c.user_id)
         or (x.user_id = c.user_id and x.peer_id = auth.uid())
    )
  order by c.day asc;
$$;
revoke all on function public.peer_checks(uuid) from public, anon;
grant execute on function public.peer_checks(uuid) to authenticated;

-- peer_category_pack(uuid) · source: wave21_playfulness_categories.sql
create or replace function public.peer_category_pack(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  select case
    when public.categories_share_allowed(p_user_id)
    then coalesce((select sage_title from public.me where id = p_user_id), '{}'::jsonb)
    else null
  end;
$$;
revoke all on function public.peer_category_pack(uuid) from public, anon;
grant execute on function public.peer_category_pack(uuid) to authenticated;

-- categories_share_allowed(uuid) · source: wave21_playfulness_categories.sql
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

-- category_share_status(uuid) · source: wave21_playfulness_categories.sql
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

-- legend_circle_friends(text) · source: wave89_legend_museum.sql
create or replace function public.legend_circle_friends(p_legend_id text)
returns table (name text)
language sql
security definer
set search_path = public
as $$
  select public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  -- One row per friend (exists, not a join), however many chapters they have heard.
  select m.name
  from public.me m
  where m.id <> auth.uid()
    and exists (
      select 1 from public.legend_museum lm
      where lm.user_id = m.id and lm.legend_id = p_legend_id
    )
    and exists (
      select 1 from public.legend_museum mine
      where mine.user_id = auth.uid() and mine.legend_id = p_legend_id
    )
    and exists (
      select 1 from public.connections c
      where (c.user_id = auth.uid() and c.peer_id = m.id)
         or (c.user_id = m.id and c.peer_id = auth.uid())
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocked_by = auth.uid() and b.blocked_user = m.id)
         or (b.blocked_by = m.id and b.blocked_user = auth.uid())
    )
  order by m.name
  limit 10
$$;
revoke all on function public.legend_circle_friends(text) from public, anon;
grant execute on function public.legend_circle_friends(text) to authenticated;

-- get_or_create_thread(uuid) · source: stage7_chat_report.sql
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
  ) then
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

-- delete_message_for_me(uuid) · source: stage7_chat_report.sql
create or replace function public.delete_message_for_me(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  update public.messages
  set deleted_for = case
    when deleted_for @> array[auth.uid()] then deleted_for
    else array_append(coalesce(deleted_for, '{}'), auth.uid())
  end
  where id = p_message_id and sender_id = auth.uid();
end;
$$;
revoke all on function public.delete_message_for_me(uuid) from public, anon;
grant execute on function public.delete_message_for_me(uuid) to authenticated;

-- my_referrals() · source: stage8_invite_referral.sql
create or replace function public.my_referrals()
returns table (id uuid, handle text, name text)
language sql
stable
security definer
set search_path = public
as $$
  select public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  select m.id, m.handle, m.name
  from public.me m
  where m.referred_by = auth.uid()
  order by m.created_at;
$$;
revoke all on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated;

-- set_going(text,boolean,text) · source: wave2_going_colors.sql
create or replace function public.set_going(p_show_id text, p_going boolean, p_ages text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_born date;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_show_id is null or btrim(p_show_id) = '' then
    raise exception 'show_required' using errcode = 'P0007';
  end if;

  if p_going then
    select born_on into v_born from public.me where id = v_uid;
    if public.show_requires_18(p_ages) and not public.is_at_least_age(v_born, 18) then
      raise exception 'going_under_18' using errcode = 'P0008';
    end if;

    insert into public.going (user_id, show_id)
    values (v_uid, btrim(p_show_id))
    on conflict (user_id, show_id) do nothing;
  else
    delete from public.going
    where user_id = v_uid and show_id = btrim(p_show_id);
  end if;

  return public.night_snapshot(btrim(p_show_id));
end;
$$;
revoke all on function public.set_going(text,boolean,text) from public, anon;
grant execute on function public.set_going(text,boolean,text) to authenticated;

-- night_snapshot(text) · source: wave2_going_colors.sql
create or replace function public.night_snapshot(p_show_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_going boolean := false;
  v_colors jsonb;
  v_faces jsonb;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select exists (
    select 1 from public.going g
    where g.user_id = v_uid and g.show_id = p_show_id
  ) into v_going;

  select coalesce(jsonb_agg(hue order by hue), '[]'::jsonb)
  into v_colors
  from (
    select public.color_hue_from_show_up(m.show_up) as hue
    from public.going g
    join public.me m on m.id = g.user_id
    where g.show_id = p_show_id
      and public.color_hue_from_show_up(m.show_up) is not null
    group by public.color_hue_from_show_up(m.show_up)
    having count(*) >= 3
  ) hues;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'name', m.name,
        'handle', m.handle,
        'show_up', m.show_up,
        'recipe', m.recipe
      )
      order by g.created_at
    ),
    '[]'::jsonb
  )
  into v_faces
  from public.going g
  join public.me m on m.id = g.user_id
  where g.show_id = p_show_id
    and m.visible is true
    and not exists (
      select 1 from public.blocks b
      where (b.blocked_by = v_uid and b.blocked_user = m.id)
         or (b.blocked_by = m.id and b.blocked_user = v_uid)
    );

  return jsonb_build_object(
    'going', v_going,
    'colors', v_colors,
    'faces', v_faces
  );
end;
$$;
revoke all on function public.night_snapshot(text) from public, anon;
grant execute on function public.night_snapshot(text) to authenticated;

-- 5.3 Traits, answers, question sets, rolls -----------------------------------------------------

-- answer_intake_question(text,integer) · source: wave79_trait_checkpoint.sql
create or replace function public.answer_intake_question(p_prompt text, p_option_index int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  q record;
  v_opt jsonb;
  v_count int;
  v_value double precision;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into q from public.intake_questions where prompt = p_prompt;
  if not found then
    raise exception 'unknown question' using errcode = '22023';
  end if;
  if p_option_index is null or p_option_index < 0 then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  v_opt := q.options -> p_option_index;
  if v_opt is null then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  v_value := (v_opt ->> 'value')::double precision;

  perform 1 from public.me where id = uid for update;
  select coalesce(max(answer_count), 0) into v_count
    from public.trait_tracks where user_id = uid and axis = q.axis and track = 'report';
  if v_count >= q.set_no then
    return (select to_jsonb(m) from public.me m where m.id = uid);
  end if;
  if v_count <> q.set_no - 1 then
    raise exception 'question not open' using errcode = '22023';
  end if;

  perform public._trait_write(uid, q.axis, 'self_situation', v_value, 'answer');
  insert into public.trait_answers (user_id, kind, question_key, axis, option_index, value)
    values (uid, 'intake', p_prompt, q.axis, p_option_index, v_value);

  return (select to_jsonb(m) from public.me m where m.id = uid);
end;
$$;
revoke all on function public.answer_intake_question(text,integer) from public, anon;
grant execute on function public.answer_intake_question(text,integer) to authenticated;

-- answer_round_item(uuid,integer) · source: wave85_fixed_question_bank.sql
create or replace function public.answer_round_item(p_item_id uuid, p_option_index int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  it record;
  v_opt jsonb;
  v_value double precision;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_option_index is null or p_option_index < 0 then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  if exists (select 1 from public.question_items
              where id = p_item_id and user_id = uid and bank_question_id is not null) then
    return public.answer_bank_item(p_item_id, p_option_index);
  end if;
  select * into it from public.question_items
    where id = p_item_id and user_id = uid
    for update;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if it.answered_at is not null then
    return (select to_jsonb(m) from public.me m where m.id = uid);
  end if;
  if it.skipped_at is not null then
    raise exception 'already answered' using errcode = 'P0001';
  end if;
  v_opt := it.options -> p_option_index;
  if v_opt is null then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  v_value := (v_opt ->> 'value')::double precision;

  update public.question_items
    set answered_option = p_option_index, answered_at = timezone('utc', now())
    where id = p_item_id;
  perform public._trait_write(uid, it.axis, 'self_situation', v_value, 'answer');
  insert into public.trait_answers (user_id, kind, question_key, axis, option_index, value)
    values (uid, 'round', p_item_id::text, it.axis, p_option_index, v_value);

  return (select to_jsonb(m) from public.me m where m.id = uid);
end;
$$;
revoke all on function public.answer_round_item(uuid,integer) from public, anon;
grant execute on function public.answer_round_item(uuid,integer) to authenticated;

-- answer_bank_item(uuid,integer) · source: wave85_fixed_question_bank.sql
create or replace function public.answer_bank_item(p_item_id uuid, p_option_index int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  it record;
  q record;
  v_kind text;
  v_opt jsonb;
  v_value double precision;
  v_unlogged int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_option_index is null or p_option_index < 0 then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  -- me first, then the item: the same lock order as serve_bank_set,
  -- start_fresh and dev_fill_bank, so they can never deadlock.
  perform 1 from public.me where id = uid for update;
  select * into it from public.question_items
    where id = p_item_id and user_id = uid
    for update;
  if not found or it.bank_question_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if it.answered_at is not null then
    return (select to_jsonb(m) from public.me m where m.id = uid);
  end if;
  if it.skipped_at is not null then
    raise exception 'already answered' using errcode = 'P0001';
  end if;
  select * into q from public.question_bank where id = it.bank_question_id;
  if not found then
    raise exception 'unknown question' using errcode = '22023';
  end if;
  -- The value comes from the bank row, never from the phone or the item copy.
  v_opt := q.options -> p_option_index;
  if v_opt is null then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  v_value := (v_opt ->> 'value')::double precision;
  select kind into v_kind from public.question_packs where id = it.pack_id;

  update public.question_items
    set answered_option = p_option_index, answered_at = timezone('utc', now())
    where id = p_item_id;

  if v_kind = 'bank_retest' then
    -- REPLACE: the old answer to this question goes (and, for an intake
    -- question, the intake-era answer to its old wording), the new one is
    -- logged, and the trait is recomputed from what is left.
    select greatest(0, coalesce((select answer_count from public.trait_tracks
                                  where user_id = uid and axis = q.axis and track = 'report'), 0)
                       - (select count(*) from public.trait_answers where user_id = uid and axis = q.axis))
      into v_unlogged;
    delete from public.trait_answers
      where user_id = uid and axis = q.axis
        and ((kind = 'bank' and question_key = q.id)
             or (kind = 'intake' and question_key = any (q.legacy_prompts)));
    insert into public.trait_answers (user_id, kind, question_key, axis, option_index, value)
      values (uid, 'bank', q.id, q.axis, p_option_index, v_value);
    perform public._trait_replay(uid, q.axis, v_unlogged);
  elsif exists (select 1 from public._bank_answered_ids(uid) a where a.question_id = q.id) then
    -- Already answered elsewhere (an old bundle, a double tap): the item is
    -- closed, nothing is scored twice.
    null;
  else
    perform public._trait_write(uid, q.axis, 'self_situation', v_value, 'answer');
    insert into public.trait_answers (user_id, kind, question_key, axis, option_index, value)
      values (uid, 'bank', q.id, q.axis, p_option_index, v_value);
  end if;

  return (select to_jsonb(m) from public.me m where m.id = uid);
end;
$$;
revoke all on function public.answer_bank_item(uuid,integer) from public, anon;
grant execute on function public.answer_bank_item(uuid,integer) to authenticated;

-- answer_question_item(uuid,integer) · source: wave18_question_skip.sql
create or replace function public.answer_question_item(
  p_item_id uuid,
  p_option_index int
)
returns void
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
  if p_option_index is null or p_option_index < 0 then
    raise exception 'invalid option' using errcode = '22023';
  end if;

  select jsonb_array_length(options) into n
    from public.question_items
    where id = p_item_id and user_id = uid;
  if n is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if p_option_index >= n then
    raise exception 'invalid option' using errcode = '22023';
  end if;

  update public.question_items
    set answered_option = p_option_index,
        answered_at = timezone('utc', now())
    where id = p_item_id
      and user_id = uid
      and answered_at is null
      and skipped_at is null;

  if not found then
    raise exception 'already answered' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.answer_question_item(uuid,integer) from public, anon;
grant execute on function public.answer_question_item(uuid,integer) to authenticated;

-- set_trait_direct(text,double precision,text) · source: wave79_trait_checkpoint.sql
create or replace function public.set_trait_direct(p_axis text, p_value double precision, p_source text)
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
  if p_source is null or p_source not in ('self_tap', 'self_settings', 'self_scenario') then
    raise exception 'invalid source' using errcode = '22023';
  end if;
  if p_value is null or p_value < 0 or p_value > 1 then
    raise exception 'invalid value' using errcode = '22023';
  end if;
  perform public._trait_write(uid, p_axis, p_source, p_value, 'direct');
  return (select to_jsonb(m) from public.me m where m.id = uid);
end;
$$;
revoke all on function public.set_trait_direct(text,double precision,text) from public, anon;
grant execute on function public.set_trait_direct(text,double precision,text) to authenticated;

-- record_game_pick(text,double precision) · source: wave79_trait_checkpoint.sql
create or replace function public.record_game_pick(p_axis text, p_value double precision)
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
  if p_value is null or p_value not in (0.2::float8, 0.8::float8) then
    raise exception 'invalid value' using errcode = '22023';
  end if;
  perform public._trait_write(uid, p_axis, 'self_game', p_value, 'game');
  return (select to_jsonb(m) from public.me m where m.id = uid);
end;
$$;
revoke all on function public.record_game_pick(text,double precision) from public, anon;
grant execute on function public.record_game_pick(text,double precision) to authenticated;

-- confirm_trait_sources(text[]) · source: wave79_trait_checkpoint.sql
create or replace function public.confirm_trait_sources(p_axes text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_axis text;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  foreach v_axis in array coalesce(p_axes, '{}'::text[]) loop
    perform public._trait_write(uid, v_axis, 'self_confirm', null, 'confirm');
  end loop;
  return (select to_jsonb(m) from public.me m where m.id = uid);
end;
$$;
revoke all on function public.confirm_trait_sources(text[]) from public, anon;
grant execute on function public.confirm_trait_sources(text[]) to authenticated;

-- stamp_axis_depth(text) · source: wave79_trait_checkpoint.sql
create or replace function public.stamp_axis_depth(p_axis text)
returns void
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
  update public.trait_tracks set last_depth_at = now()
    where user_id = uid and axis = p_axis;
end;
$$;
revoke all on function public.stamp_axis_depth(text) from public, anon;
grant execute on function public.stamp_axis_depth(text) to authenticated;

-- set_trait_flag(text,boolean) · source: wave85_fixed_question_bank.sql
create or replace function public.set_trait_flag(p_axis text, p_on boolean)
returns void
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
  if p_axis is null or not exists (select 1 from public.question_bank where axis = p_axis) then
    raise exception 'unknown trait' using errcode = '22023';
  end if;
  if coalesce(p_on, false) then
    insert into public.trait_flags (user_id, axis) values (uid, p_axis)
      on conflict (user_id, axis) do nothing;
  else
    delete from public.trait_flags where user_id = uid and axis = p_axis;
  end if;
end;
$$;
revoke all on function public.set_trait_flag(text,boolean) from public, anon;
grant execute on function public.set_trait_flag(text,boolean) to authenticated;

-- serve_bank_set() · source: wave100_question_retire.sql
create or replace function public.serve_bank_set()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_pack uuid;
  v_done int;
  v_set int;
  v_kind text;
  v_fresh boolean;
  r record;
  idx int := 0;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform 1 from public.me where id = uid for update;

  -- One open set at a time: an unfinished one comes back as is.
  select p.id into v_pack
    from public.question_packs p
   where p.user_id = uid and p.set_no is not null and p.kind in ('bank_set', 'ongoing_round')
     and exists (select 1 from public.question_items i
                  where i.pack_id = p.id and i.answered_option is null and i.skipped_at is null)
   order by p.created_at desc
   limit 1;
  if v_pack is not null then
    return v_pack;
  end if;

  -- Sets finished = the fewest questions answered on any trait.
  select coalesce(min(p.answered_n), 0) into v_done
    from public._bank_trait_progress(uid) p
   where p.active_n > 0;
  if v_done >= 25 then
    raise exception 'bank complete' using errcode = 'P0001';
  end if;
  v_set := v_done + 1;

  v_fresh := exists (select 1 from public.trait_profile_snapshots where user_id = uid and reason = 'start_fresh');
  -- Sets 1-3 are the intake (its +21 is the once-ever full-profile claim).
  -- Sets 4-25 pay like the old rounds — unless the person has started fresh,
  -- so a free Start Fresh can never be a way to re-earn tokens.
  v_kind := case when v_set <= 3 or v_fresh then 'bank_set' else 'ongoing_round' end;

  insert into public.question_packs (user_id, generated_on, kind, set_no)
    values (uid, (timezone('utc', now()))::date, v_kind, v_set)
    returning id into v_pack;

  for r in
    with ans as (select question_id from public._bank_answered_ids(uid)),
         open_axes as (select p.axis from public._bank_trait_progress(uid) p where p.answered_n < p.active_n)
    select pick.* from (
      select distinct on (b.axis) b.id, b.axis, b.prompt, b.options
        from public.question_bank b
       where b.id not in (select question_id from ans)
         and b.retired_at is null
         and b.axis in (select o.axis from open_axes o)
       order by b.axis, random()
    ) pick
    order by random()
  loop
    insert into public.question_items (pack_id, user_id, sort_index, axis, prompt, options, bank_question_id)
      values (v_pack, uid, idx, r.axis, r.prompt, r.options, r.id);
    idx := idx + 1;
  end loop;

  -- Uneven accounts (old tiered-50, a dev jump): once some traits run out, a
  -- set still gets 16 by taking a second unanswered question from traits
  -- that have them. Only when fewer than 16 questions remain in the whole
  -- bank is a set short, and a short set never claims to be a paying round
  -- (claim_ongoing_round_complete needs 16).
  -- wave100: a trait never gets more than it still needs (room = what it
  -- needs minus the one the first pass already took), so a retired answer
  -- can never push a trait past its active count.
  if idx < 16 then
    for r in
      with ans as (select question_id from public._bank_answered_ids(uid)),
           room as (select p.axis, p.active_n - p.answered_n - 1 as n
                      from public._bank_trait_progress(uid) p where p.answered_n < p.active_n)
      select x.id, x.axis, x.prompt, x.options from (
        select b.id, b.axis, b.prompt, b.options, rm.n,
               row_number() over (partition by b.axis order by random()) as rn
          from public.question_bank b
          join room rm on rm.axis = b.axis
         where b.id not in (select question_id from ans)
           and b.retired_at is null
           and b.id not in (select i.bank_question_id from public.question_items i
                             where i.pack_id = v_pack and i.bank_question_id is not null)
      ) x
       where x.rn <= x.n
       order by random()
       limit 16 - idx
    loop
      insert into public.question_items (pack_id, user_id, sort_index, axis, prompt, options, bank_question_id)
        values (v_pack, uid, idx, r.axis, r.prompt, r.options, r.id);
      idx := idx + 1;
    end loop;
  end if;
  if idx = 0 then
    raise exception 'question bank is empty' using errcode = 'P0001';
  end if;
  if idx < 16 then
    update public.question_packs set kind = 'bank_set' where id = v_pack;
  end if;

  return v_pack;
end;
$$;
revoke all on function public.serve_bank_set() from public, anon;
grant execute on function public.serve_bank_set() to authenticated;

-- change_bank_answer(uuid,text,integer) · source: wave100_question_retire.sql
create or replace function public.change_bank_answer(p_session uuid, p_question_id text, p_option_index int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  q record;
  v_opt jsonb;
  v_value double precision;
  v_unlogged int;
  v_old jsonb;
  v_session uuid := p_session;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_option_index is null or p_option_index < 0 then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  perform 1 from public.me where id = uid for update;
  if v_session is null then
    if not public._bank_all_done(uid) then
      raise exception 'change answers opens after all 25 sets' using errcode = 'P0001';
    end if;
    -- PREMIUM GATE: null = free. When a price is set, spend it here (same lock).
    if public._bank_premium_price('change_answers') is not null then
      raise exception 'premium tokens required' using errcode = 'P0042';
    end if;
  elsif not public._change_session_ok(uid, v_session) then
    raise exception 'change session is closed' using errcode = 'P0001';
  end if;
  select * into q from public.question_bank where id = p_question_id;
  if not found then
    raise exception 'unknown question' using errcode = '22023';
  end if;
  -- wave100: a retired question keeps the answer it was given; it is never re-asked.
  if q.retired_at is not null then
    raise exception 'retired question' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public._bank_answered_ids(uid) a where a.question_id = q.id) then
    raise exception 'only an answered question can be changed' using errcode = 'P0001';
  end if;
  -- The value comes from the bank row, never from the phone.
  v_opt := q.options -> p_option_index;
  if v_opt is null then
    raise exception 'invalid option' using errcode = '22023';
  end if;
  v_value := (v_opt ->> 'value')::double precision;

  if v_session is null then
    insert into public.trait_profile_snapshots (user_id, reason, profile)
      values (uid, 'change_answers', public._profile_payload(uid))
      returning id into v_session;
  end if;

  -- Same REPLACE as wave85's retest branch, keeping what it removes.
  select greatest(0, coalesce((select answer_count from public.trait_tracks
                                where user_id = uid and axis = q.axis and track = 'report'), 0)
                     - (select count(*) from public.trait_answers where user_id = uid and axis = q.axis))
    into v_unlogged;
  select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_old
    from public.trait_answers a
   where a.user_id = uid and a.axis = q.axis
     and ((a.kind = 'bank' and a.question_key = q.id)
          or (a.kind = 'intake' and a.question_key = any (q.legacy_prompts)));
  delete from public.trait_answers
    where user_id = uid and axis = q.axis
      and ((kind = 'bank' and question_key = q.id)
           or (kind = 'intake' and question_key = any (q.legacy_prompts)));
  insert into public.trait_answers (user_id, kind, question_key, axis, option_index, value)
    values (uid, 'bank', q.id, q.axis, p_option_index, v_value);
  perform public._trait_replay(uid, q.axis, v_unlogged);
  insert into public.trait_answer_changes (user_id, snapshot_id, axis, question_id, old_rows)
    values (uid, v_session, q.axis, q.id, v_old);

  return jsonb_build_object('session', v_session);
end;
$$;
revoke all on function public.change_bank_answer(uuid,text,integer) from public, anon;
grant execute on function public.change_bank_answer(uuid,text,integer) to authenticated;

-- undo_change_session(uuid) · source: wave86_change_answers_history.sql
create or replace function public.undo_change_session(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_snap jsonb;
  c record;
  r jsonb;
  ax text;
  v_val double precision;
  v_cur double precision;
  v_track jsonb;
  v_n int := 0;
  v_now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform 1 from public.me where id = uid for update;
  if not public._change_session_ok(uid, p_session) then
    raise exception 'change session is closed' using errcode = 'P0001';
  end if;
  select profile into v_snap from public.trait_profile_snapshots where id = p_session and user_id = uid;

  -- Answers back, newest change first: a question changed twice ends on the
  -- answer it had before the session.
  for c in
    select * from public.trait_answer_changes
     where snapshot_id = p_session and user_id = uid
     order by created_at desc, id desc
  loop
    delete from public.trait_answers
      where user_id = uid and kind = 'bank' and question_key = c.question_id;
    for r in select value from jsonb_array_elements(c.old_rows)
    loop
      insert into public.trait_answers (id, user_id, kind, question_key, axis, option_index, value, created_at)
        values ((r ->> 'id')::uuid, uid, r ->> 'kind', r ->> 'question_key', r ->> 'axis',
                (r ->> 'option_index')::int, (r ->> 'value')::numeric, (r ->> 'created_at')::timestamptz)
        on conflict (id) do nothing;
    end loop;
    v_n := v_n + 1;
  end loop;

  -- Each touched trait goes back to what the snapshot saved (values at 3
  -- decimals, stability at 2: the payload's precision).
  for ax in select distinct axis from public.trait_answer_changes where snapshot_id = p_session and user_id = uid
  loop
    v_val := nullif(v_snap -> 'values' ->> ax, '')::double precision;
    v_track := v_snap -> 'tracks' -> ax;
    if v_track is null then
      delete from public.trait_tracks where user_id = uid and axis = ax and track = 'report';
    else
      insert into public.trait_tracks (user_id, axis, track, value, stability, answer_count, last_touched)
        values (uid, ax, 'report', coalesce(v_val, 0.5), (v_track ->> 0)::double precision, (v_track ->> 1)::int, now())
        on conflict (user_id, axis, track) do update
          set value = excluded.value, stability = excluded.stability,
              answer_count = excluded.answer_count, last_touched = excluded.last_touched;
    end if;
    execute format('select %I from public.me where id = $1', ax) into v_cur using uid;
    execute format(
      'update public.me set %I = $1, trait_sources = case when $2::text is null then coalesce(trait_sources, ''{}''::jsonb) - $3 else coalesce(trait_sources, ''{}''::jsonb) || jsonb_build_object($3, $2::text) end, trait_touched_at = coalesce(trait_touched_at, ''{}''::jsonb) || jsonb_build_object($3, $4::text) where id = $5',
      ax
    ) using v_val, v_snap -> 'sources' ->> ax, ax, v_now_iso, uid;
    if v_val is not null and (v_cur is null or round(v_cur * 100) <> round(v_val * 100)) then
      insert into public.trait_history (user_id, axis, value, source)
        values (uid, ax, v_val, coalesce(v_snap -> 'sources' ->> ax, 'self_situation'));
    end if;
  end loop;

  -- The session snapshot now equals the live profile: not history. Its change
  -- rows go with it (on delete cascade).
  delete from public.trait_profile_snapshots where id = p_session and user_id = uid;

  return jsonb_build_object('ok', true, 'undone', v_n);
end;
$$;
revoke all on function public.undo_change_session(uuid) from public, anon;
grant execute on function public.undo_change_session(uuid) to authenticated;

-- start_fresh(boolean) · source: wave86_change_answers_history.sql
create or replace function public.start_fresh(p_keep_history boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_snapshot uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform 1 from public.me where id = uid for update;
  if not public._bank_all_done(uid) then
    raise exception 'start fresh opens after all 25 sets' using errcode = 'P0001';
  end if;

  -- PREMIUM GATE: null = free. When a price is set, spend it here (same lock).
  if public._bank_premium_price('start_fresh') is not null then
    raise exception 'premium tokens required' using errcode = 'P0042';
  end if;

  if coalesce(p_keep_history, true) then
    insert into public.trait_profile_snapshots (user_id, reason, profile)
      values (uid, 'start_fresh', public._profile_payload(uid))
      returning id into v_snapshot;
  else
    -- Wipe: every saved card goes. One payload-free marker stays so wave85's
    -- serve_bank_set still knows this account started fresh (no re-earning).
    delete from public.trait_profile_snapshots where user_id = uid;
    insert into public.trait_profile_snapshots (user_id, reason, profile)
      values (uid, 'start_fresh', '{}'::jsonb)
      returning id into v_snapshot;
  end if;

  -- HARD DELETE (emci 2026-10-06), exactly as wave85.
  delete from public.trait_answers where user_id = uid;
  delete from public.trait_tracks where user_id = uid and track = 'report';
  delete from public.trait_history where user_id = uid;
  delete from public.trait_flags where user_id = uid;
  delete from public.question_packs p
   where p.user_id = uid and (p.set_no is not null or p.kind = 'bank_retest')
     and exists (select 1 from public.question_items i
                  where i.pack_id = p.id and i.answered_option is null and i.skipped_at is null);

  update public.me
    set
      openness = null, conscientiousness = null, extraversion = null, agreeableness = null,
      steadiness = null, attachment_anxiety = null, attachment_avoidance = null,
      conflict_assertiveness = null, conflict_cooperativeness = null,
      autonomy = null, competence = null, relatedness = null,
      growth_mindset = null, locus_of_control = null, self_efficacy = null, playfulness = null,
      trait_sources = '{}'::jsonb,
      trait_touched_at = '{}'::jsonb
    where id = uid;

  return jsonb_build_object('ok', true, 'snapshot_id', v_snapshot, 'kept_history', coalesce(p_keep_history, true));
end;
$$;
revoke all on function public.start_fresh(boolean) from public, anon;
grant execute on function public.start_fresh(boolean) to authenticated;

-- skip_question_item(uuid) · source: wave18_question_skip.sql
create or replace function public.skip_question_item(p_item_id uuid)
returns void
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

  update public.question_items
    set skipped_at = timezone('utc', now())
    where id = p_item_id
      and user_id = uid
      and answered_at is null
      and skipped_at is null;

  if not found then
    raise exception 'already closed' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.skip_question_item(uuid) from public, anon;
grant execute on function public.skip_question_item(uuid) to authenticated;

-- skip_rest_question_pack(uuid) · source: wave18_question_skip.sql
create or replace function public.skip_rest_question_pack(p_pack_id uuid)
returns void
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

  update public.question_items
    set skipped_at = timezone('utc', now())
    where pack_id = p_pack_id
      and user_id = uid
      and answered_at is null
      and skipped_at is null;
end;
$$;
revoke all on function public.skip_rest_question_pack(uuid) from public, anon;
grant execute on function public.skip_rest_question_pack(uuid) to authenticated;

-- reroll_question_item(uuid) · source: wave74_bank_pool_owner_and_ai_refund.sql
create or replace function public.reroll_question_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_pack_id uuid;
  v_axis text;
  v_old_bank_id uuid;
  v_answered int;
  v_new_id uuid;
  v_new_prompt text;
  v_new_options jsonb;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select pack_id, axis, question_bank_item_id, answered_option
    into v_pack_id, v_axis, v_old_bank_id, v_answered
    from public.question_items
    where id = p_item_id and user_id = uid
    for update;

  if v_pack_id is null then
    raise exception 'question item not found' using errcode = '22023';
  end if;
  if v_answered is not null then
    raise exception 'already answered' using errcode = '22023';
  end if;
  if v_old_bank_id is null then
    raise exception 'not eligible for reroll' using errcode = '22023';
  end if;

  insert into public.question_bank_reroll_exclusions (user_id, question_bank_item_id)
  values (uid, v_old_bank_id)
  on conflict (user_id, question_bank_item_id) do nothing;

  select p.id, p.prompt, p.options
    into v_new_id, v_new_prompt, v_new_options
    from public.question_bank_pool p
    where p.axis = v_axis
      -- wave74: same visibility rule as the draw
      and (p.source = 'authored' or p.created_by = uid)
      and p.id not in (
        select question_bank_item_id from public.question_bank_reroll_exclusions where user_id = uid
      )
      and p.id not in (
        select question_bank_item_id from public.question_items
        where pack_id = v_pack_id and question_bank_item_id is not null
      )
    order by p.times_served asc, p.id asc
    limit 1;

  if v_new_id is null then
    raise exception 'no reroll candidates available for this axis' using errcode = 'P0042';
  end if;

  update public.question_items
    set prompt = v_new_prompt, options = v_new_options, question_bank_item_id = v_new_id
    where id = p_item_id;

  update public.question_bank_pool set times_served = times_served + 1 where id = v_new_id;

  return jsonb_build_object(
    'id', p_item_id,
    'axis', v_axis,
    'prompt', v_new_prompt,
    'options', v_new_options
  );
end;
$$;
revoke all on function public.reroll_question_item(uuid) from public, anon;
grant execute on function public.reroll_question_item(uuid) to authenticated;

-- fetch_bank_candidates(text,integer) · source: wave74_bank_pool_owner_and_ai_refund.sql
create or replace function public.fetch_bank_candidates(p_axis text, p_limit int)
returns table(id uuid, category text, prompt text, options jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lim int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Same 25-item ceiling the sibling bank RPCs use (wave50). The caller
  -- over-fetches a small multiple of what it needs so it can still drop
  -- near-duplicates client-side and land close to its target.
  lim := least(greatest(coalesce(p_limit, 0), 0), 100);
  if lim = 0 then
    return;
  end if;

  return query
    select b.id, b.category, b.prompt, b.options
    from public.question_bank_pool b
    where b.axis = p_axis
      -- wave74: the shared set is the AUTHORED bank only. An AI-written row is
      -- served only to the account that generated it.
      and (b.source = 'authored' or b.created_by = uid)
      -- Permanent per-user reroll exclusions (wave49): never again, ever.
      and not exists (
        select 1 from public.question_bank_reroll_exclusions x
        where x.user_id = uid and x.question_bank_item_id = b.id
      )
      -- Already served to this user in any earlier pack. Deliberately keyed
      -- on the item EXISTING, not on it being answered: a question sitting
      -- unanswered in an abandoned round was still shown to them, and
      -- re-serving it in a fresh round is the same repeat from their side.
      and not exists (
        select 1 from public.question_items qi
        where qi.user_id = uid and qi.question_bank_item_id = b.id
      )
    -- Least-served first (unchanged), then oldest — a deterministic
    -- tie-break, since times_served is 0 for every row in a freshly
    -- topped-up axis and an unordered tie would make the draw arbitrary.
    order by b.times_served asc, b.created_at asc
    limit lim;
end;
$$;
revoke all on function public.fetch_bank_candidates(text,integer) from public, anon;
grant execute on function public.fetch_bank_candidates(text,integer) to authenticated;

-- bank_pool_depth() · source: wave74_bank_pool_owner_and_ai_refund.sql
create or replace function public.bank_pool_depth()
returns table(axis text, available int)
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

  -- One row per axis PRESENT IN THE POOL. An axis with zero rows is absent
  -- from this result rather than reported as 0 — the caller treats a missing
  -- axis as 0 (see src/lib/questions/prewarm.ts), so a genuinely empty axis
  -- still registers as short and gets topped up.
  return query
    select b.axis, count(*)::int as available
    from public.question_bank_pool b
    where (b.source = 'authored' or b.created_by = uid) -- wave74: same visibility rule as the draw
      and not exists (
        select 1 from public.question_bank_reroll_exclusions x
        where x.user_id = uid and x.question_bank_item_id = b.id
      )
      and not exists (
        select 1 from public.question_items qi
        where qi.user_id = uid and qi.question_bank_item_id = b.id
      )
    group by b.axis;
end;
$$;
revoke all on function public.bank_pool_depth() from public, anon;
grant execute on function public.bank_pool_depth() to authenticated;

-- insert_question_pack(date,jsonb) · source: wave17_infinite_questions.sql
create or replace function public.insert_question_pack(
  p_generated_on date,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pack_id uuid;
  item jsonb;
  idx int := 0;
  entry_count int;
  opt_count int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_generated_on is null then
    raise exception 'generated_on required' using errcode = '22023';
  end if;

  select count(*)::int into entry_count
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb));
  if entry_count < 1 or entry_count > 5 then
    raise exception 'question pack must have 1–5 items' using errcode = '22023';
  end if;

  insert into public.question_packs (user_id, generated_on)
  values (uid, p_generated_on)
  returning id into pack_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    select count(*)::int into opt_count
    from jsonb_array_elements(coalesce(item->'options', '[]'::jsonb));
    if opt_count < 2 or opt_count > 3 then
      raise exception 'question needs 2–3 options' using errcode = '22023';
    end if;

    insert into public.question_items (
      pack_id, user_id, sort_index, axis, prompt, options
    ) values (
      pack_id,
      uid,
      idx,
      item->>'axis',
      left(trim(coalesce(item->>'prompt', '')), 400),
      item->'options'
    );
    idx := idx + 1;
  end loop;

  return pack_id;
end;
$$;
revoke all on function public.insert_question_pack(date,jsonb) from public, anon;
grant execute on function public.insert_question_pack(date,jsonb) to authenticated;

-- store_roll(uuid,jsonb,jsonb) · source: wave46_trait_rolls.sql
create or replace function public.store_roll(p_roll_id uuid, p_items jsonb, p_axis_snapshot jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  -- Deliberately NOT named `item` — every jsonb_array_elements() call below
  -- selects its output column as plain `value` (no AS alias), matching this
  -- repo's own existing convention (explore.sql, wave17, wave44) and
  -- avoiding a real bug found in review: a local variable named `item`
  -- collides with an `AS item` alias under plpgsql's default
  -- variable_conflict = error, raising "column reference is ambiguous" on
  -- every real call — `create or replace function` does not catch this at
  -- migration-apply time (check_function_bodies is syntax-only), so it
  -- would have silently applied clean and failed on first actual use.
  v_item jsonb;
  v_count int := 0;
  v_legend_count int;
  v_story_count int;
  v_category_count int;
  v_snapshot_stored boolean;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_roll_id is null or p_items is null or p_axis_snapshot is null then
    raise exception 'missing roll data' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) <> 13 then
    raise exception 'p_items must contain exactly 13 items (1 legend + 11 categories + 1 story)' using errcode = '22023';
  end if;
  if jsonb_typeof(p_axis_snapshot) <> 'object' then
    raise exception 'p_axis_snapshot must be a JSON object' using errcode = '22023';
  end if;

  select
    count(*) filter (where value->>'type' = 'legend'),
    count(*) filter (where value->>'type' = 'story'),
    count(distinct value->>'category_id') filter (where value->>'type' = 'category')
  into v_legend_count, v_story_count, v_category_count
  from jsonb_array_elements(p_items);

  if v_legend_count <> 1 or v_story_count <> 1 or v_category_count <> 11 then
    raise exception 'p_items must contain exactly 1 legend, 1 story, and 11 distinct categories (got legend=%, story=%, distinct categories=%)',
      v_legend_count, v_story_count, v_category_count using errcode = '22023';
  end if;

  -- `value->'result' is null` alone would only catch a MISSING result key
  -- (SQL NULL) — a caller-supplied JSON `null` literal (`value->'result'`
  -- returns the jsonb scalar 'null', not SQL NULL) would pass that check
  -- and still satisfy trait_rolls.result's `not null` column constraint.
  -- Reject both explicitly.
  if exists (
    select 1 from jsonb_array_elements(p_items)
    where value->>'type' not in ('legend', 'category', 'story')
       or (value->>'type' = 'category') <> (value->>'category_id' is not null)
       or value->'result' is null
       or value->'result' = 'null'::jsonb
       or octet_length((value->'result')::text) > 8192
  ) then
    raise exception 'one or more items has an invalid type, mismatched category_id, a missing/null result, or an oversized result (>8KB)' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':roll_store'));

  if exists (select 1 from public.trait_rolls where roll_id = p_roll_id and user_id = uid) then
    return jsonb_build_object('ok', true, 'already', true, 'roll_id', p_roll_id);
  end if;

  insert into public.trait_roll_snapshots (roll_id, user_id, axis_snapshot)
  values (p_roll_id, uid, p_axis_snapshot)
  on conflict (roll_id) do nothing
  returning true into v_snapshot_stored;

  -- roll_id is a client/caller-generated uuid, not itself unique-checked
  -- against OTHER users before this point — the per-user advisory lock
  -- above only serializes this user's own concurrent calls. If a different
  -- user already holds this exact roll_id (an astronomically unlikely
  -- gen_random_uuid() collision, but silent-if-unhandled), the snapshot
  -- insert above no-ops and this user would otherwise get `ok:true` with
  -- no snapshot ever stored for them — fail loudly instead of continuing
  -- with a missing RCI baseline.
  if v_snapshot_stored is not true then
    raise exception 'roll_id % is already in use by a different roll — retry with a new roll_id', p_roll_id using errcode = '23505';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.trait_rolls (roll_id, user_id, type, category_id, result)
    values (
      p_roll_id,
      uid,
      v_item->>'type',
      v_item->>'category_id',
      v_item->'result'
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'already', false, 'roll_id', p_roll_id, 'count', v_count);
end;
$$;
revoke all on function public.store_roll(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.store_roll(uuid,jsonb,jsonb) to authenticated;

-- reveal_roll_item(uuid) · source: wave47_reveal_requires_ready.sql
create or replace function public.reveal_roll_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_type text;
  v_result jsonb;
  v_revealed_at timestamptz;
  v_price int;
  v_balance int;
  v_new_balance int;
  tz text;
  today date;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtext('tokens:' || uid::text));

  select type, result, revealed_at into v_type, v_result, v_revealed_at
    from public.trait_rolls
    where id = p_item_id and user_id = uid
    for update;

  if v_type is null then
    raise exception 'roll item not found' using errcode = 'P0002';
  end if;

  if v_revealed_at is not null then
    return jsonb_build_object('ok', true, 'already', true, 'revealed_at', v_revealed_at, 'type', v_type);
  end if;

  -- Refuse to charge for an item with nothing to reveal. Every roll item's
  -- result carries a top-level `ready` boolean (composeRoll, TypeScript
  -- side) — a row this is false for legitimately exists (it fills its slot
  -- in the fixed 13-item shape store_roll requires) but has no real content
  -- yet. Treat a MISSING `ready` key the same as false (defensive: an older
  -- or malformed row must not accidentally read as chargeable).
  if coalesce((v_result->>'ready')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'reason', 'not_ready', 'type', v_type);
  end if;

  v_price := case v_type when 'legend' then 5 else 1 end;

  select coalesce(nullif(timezone, ''), 'UTC'), tokens into tz, v_balance
    from public.me
    where id = uid;
  if tz is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  today := (timezone(tz, now()))::date;

  if coalesce(v_balance, 0) < v_price then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', coalesce(v_balance, 0), 'price', v_price);
  end if;

  perform set_config('ato.allow_token_write', '1', true);

  insert into public.token_events (user_id, delta, reason, local_day)
  values (uid, -v_price, 'roll_reveal', today);

  update public.me
    set tokens = tokens - v_price
    where id = uid
    returning tokens into v_new_balance;

  update public.trait_rolls
    set revealed_at = now()
    where id = p_item_id
    returning revealed_at into v_revealed_at;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'balance', v_new_balance,
    'price', v_price,
    'revealed_at', v_revealed_at,
    'type', v_type
  );
end;
$$;
revoke all on function public.reveal_roll_item(uuid) from public, anon;
grant execute on function public.reveal_roll_item(uuid) to authenticated;

-- 5.4 Daily surfaces (check-in card, Daily Pick, daily line, insight, Explore, categories) ------

-- answer_daily_pick(date,text,integer) · source: wave82_daily_pick.sql
create or replace function public.answer_daily_pick(p_ymd date, p_pick_id text, p_option_index int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p record;
  v_opt jsonb;
  v_value double precision;
  v_count int;
  v_mode text;
  v_prev record;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- A local date: today somewhere on Earth, never a past or future day.
  if p_ymd is null
     or p_ymd < (timezone('utc', now()))::date - 1
     or p_ymd > (timezone('utc', now()))::date + 1 then
    raise exception 'not today' using errcode = '22023';
  end if;
  select * into p from public.daily_pick_pool where id = p_pick_id;
  if not found or p.position <> public.daily_pick_position(p_ymd) then
    raise exception 'not the pick for that day' using errcode = '22023';
  end if;
  if p_option_index is null or p_option_index not in (0, 1) then
    raise exception 'invalid option' using errcode = '22023';
  end if;

  perform 1 from public.me where id = uid for update;

  -- One answer a day: a second tap returns the first answer unchanged.
  select * into v_prev from public.daily_pick_answers where user_id = uid and ymd = p_ymd;
  if found then
    return jsonb_build_object('option_index', v_prev.option_index, 'counted', v_prev.counted, 'already', true);
  end if;

  v_opt := p.options -> p_option_index;
  v_value := (v_opt ->> 'value')::double precision;

  select coalesce(max(answer_count), 0) into v_count
    from public.trait_tracks where user_id = uid and axis = p.axis and track = 'report';
  v_mode := case when v_count >= 3 then 'answer' else 'direct' end;

  perform public._trait_write(uid, p.axis, 'self_situation', v_value, v_mode);
  insert into public.daily_pick_answers (user_id, ymd, pick_id, option_index, counted)
    values (uid, p_ymd, p_pick_id, p_option_index, v_mode = 'answer');

  return jsonb_build_object('option_index', p_option_index, 'counted', v_mode = 'answer', 'already', false);
end;
$$;
revoke all on function public.answer_daily_pick(date,text,integer) from public, anon;
grant execute on function public.answer_daily_pick(date,text,integer) to authenticated;

-- daily_pick_split(text,date) · source: wave83_daily_pick_split_by_day.sql
create or replace function public.daily_pick_split(p_pick_id text, p_ymd date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_a int;
  v_b int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- Only someone who answered this pick on this day sees how that day split.
  if not exists (
    select 1 from public.daily_pick_answers where user_id = uid and pick_id = p_pick_id and ymd = p_ymd
  ) then
    return null;
  end if;
  select count(*) filter (where option_index = 0), count(*) filter (where option_index = 1)
    into v_a, v_b
    from public.daily_pick_answers where pick_id = p_pick_id and ymd = p_ymd;
  if v_a + v_b < 20 then
    return null;
  end if;
  -- Percent, rounded to 5, and the two always add up to 100.
  return jsonb_build_object(
    'shares',
    jsonb_build_array(
      round(v_a * 20.0 / (v_a + v_b)) * 5,
      100 - round(v_a * 20.0 / (v_a + v_b)) * 5
    )
  );
end;
$$;
revoke all on function public.daily_pick_split(text,date) from public, anon;
grant execute on function public.daily_pick_split(text,date) to authenticated;

-- record_check(integer,date,text,text,text,text,text,boolean) · source: record_check_no_card.sql
create or replace function public.record_check(
  p_day integer,
  p_logged_on date,
  p_read_text text,
  p_do_text text,
  p_source text,
  p_status text,
  p_nudge_text text default null,
  p_no_card boolean default false
)
returns public.checks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_created timestamptz;
  v_epoch date;
  v_today date;
  v_day integer;
  v_nudge text;
  v_read text;
  v_do text;
  v_row public.checks;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_logged_on is null then
    raise exception 'logged_on_required' using errcode = 'P0010';
  end if;

  if p_day is null or p_day < 1 then
    raise exception 'day_required' using errcode = 'P0011';
  end if;

  if coalesce(p_no_card, false) then
    v_read := null;
    v_do := null;
    v_nudge := null;
  else
    if p_read_text is null or btrim(p_read_text) = '' then
      raise exception 'read_required' using errcode = 'P0012';
    end if;

    if p_do_text is null or btrim(p_do_text) = '' then
      raise exception 'do_required' using errcode = 'P0013';
    end if;

    v_read := btrim(p_read_text);
    v_do := btrim(p_do_text);
    v_nudge := nullif(btrim(coalesce(p_nudge_text, '')), '');
  end if;

  if p_source is null or p_source not in ('bank', 'generated') then
    raise exception 'source_invalid' using errcode = 'P0014';
  end if;

  if p_status is null or p_status not in ('done', 'skipped') then
    raise exception 'status_invalid' using errcode = 'P0015';
  end if;

  select coalesce(nullif(btrim(timezone), ''), 'UTC'), created_at
    into v_tz, v_created
  from public.me
  where id = v_uid;

  if v_created is null then
    raise exception 'me_required' using errcode = 'P0016';
  end if;

  v_epoch := (timezone(v_tz, v_created))::date;
  v_today := (timezone(v_tz, now()))::date;
  v_day := (p_logged_on - v_epoch) + 1;

  if p_logged_on < v_epoch then
    raise exception 'check_window' using errcode = 'P0017';
  end if;

  if p_logged_on > v_today or p_logged_on < (v_today - 2) then
    raise exception 'check_window' using errcode = 'P0017';
  end if;

  if p_day <> v_day then
    raise exception 'day_mismatch' using errcode = 'P0018';
  end if;

  if exists (
    select 1 from public.checks
    where user_id = v_uid and logged_on = p_logged_on
  ) then
    raise exception 'already_logged_on' using errcode = 'P0019';
  end if;

  insert into public.checks (
    user_id, day, logged_on, read_text, do_text, nudge_text, source, status
  ) values (
    v_uid, v_day, p_logged_on, v_read, v_do, v_nudge, p_source, p_status
  )
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.record_check(integer,date,text,text,text,text,text,boolean) from public, anon;
grant execute on function public.record_check(integer,date,text,text,text,text,text,boolean) to authenticated;

-- record_daily_line(date,text) · source: wave77_daily_lines.sql
create or replace function public.record_daily_line(p_ymd date, p_line_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  stored text;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_ymd is null or abs(p_ymd - (now() at time zone 'utc')::date) > 1 then
    raise exception 'day out of range' using errcode = '22023';
  end if;
  if p_line_key is null or p_line_key !~ '^[a-z0-9]{1,16}$' then
    raise exception 'bad line key' using errcode = '22023';
  end if;

  insert into public.daily_line_days (user_id, ymd, line_key)
  values (uid, p_ymd, p_line_key)
  on conflict (user_id, ymd) do nothing;

  select line_key into stored from public.daily_line_days where user_id = uid and ymd = p_ymd;
  return stored;
end;
$$;
revoke all on function public.record_daily_line(date,text) from public, anon;
grant execute on function public.record_daily_line(date,text) to authenticated;

-- react_daily_line(date,text) · source: wave77_daily_lines.sql
create or replace function public.react_daily_line(p_ymd date, p_reaction text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  touched integer;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_reaction is not null and p_reaction not in ('me', 'not_me') then
    raise exception 'bad reaction' using errcode = '22023';
  end if;

  update public.daily_line_days
    set reaction = p_reaction
    where user_id = uid and ymd = p_ymd;
  get diagnostics touched = row_count;
  return touched > 0;
end;
$$;
revoke all on function public.react_daily_line(date,text) from public, anon;
grant execute on function public.react_daily_line(date,text) to authenticated;

-- insert_daily_line_pool_items(jsonb) · source: wave77_daily_lines.sql
create or replace function public.insert_daily_line_pool_items(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  item jsonb;
  v_line text;
  v_key text;
  owned integer;
  added integer := 0;
  inserted integer;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 10 then
    raise exception 'too many items (max 10)' using errcode = '22023';
  end if;

  select count(*) into owned from public.daily_line_pool where created_by = uid;

  for item in select * from jsonb_array_elements(p_items) loop
    exit when owned + added >= 300;
    v_line := left(trim(coalesce(item->>'line', '')), 160);
    v_key := coalesce(item->>'lean_key', '');
    -- Same shape the table check enforces, tested here so one bad tag skips
    -- that line instead of raising and rolling back the whole batch.
    continue when v_line = ''
      or v_key = 'starter'
      or char_length(v_key) > 80
      or v_key !~ '^[a-z_]+:(high|low)(\+[a-z_]+:(high|low))?$';
    insert into public.daily_line_pool (lean_key, line, source, created_by)
    values (v_key, v_line, 'ai', uid)
    on conflict (created_by, line) where source = 'ai' do nothing;
    get diagnostics inserted = row_count;
    added := added + inserted;
  end loop;

  return added;
end;
$$;
revoke all on function public.insert_daily_line_pool_items(jsonb) from public, anon;
grant execute on function public.insert_daily_line_pool_items(jsonb) to authenticated;

-- clear_my_daily_lines() · source: wave77_daily_lines.sql
create or replace function public.clear_my_daily_lines()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  removed integer;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from public.daily_line_days where user_id = uid;
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.clear_my_daily_lines() from public, anon;
grant execute on function public.clear_my_daily_lines() to authenticated;

-- insert_daily_insight(integer,date,text,text,text,text,text) · source: wave87_insight_title_120.sql
create or replace function public.insert_daily_insight(
  p_day int,
  p_ymd date,
  p_theme text,
  p_title text,
  p_reflection text,
  p_try_today text,
  p_watch_for text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_day is null or p_day < 1 then
    raise exception 'day must be >= 1' using errcode = '22023';
  end if;

  if p_ymd is null then
    raise exception 'ymd required' using errcode = '22023';
  end if;

  if btrim(coalesce(p_theme, '')) = ''
     or btrim(coalesce(p_title, '')) = ''
     or btrim(coalesce(p_reflection, '')) = ''
     or btrim(coalesce(p_try_today, '')) = ''
     or btrim(coalesce(p_watch_for, '')) = '' then
    raise exception 'all five insight fields are required' using errcode = '22023';
  end if;

  update public.daily_insights
    set superseded_at = timezone('utc', now())
    where user_id = uid and ymd = p_ymd and superseded_at is null;

  insert into public.daily_insights
    (user_id, day, ymd, theme, title, reflection, try_today, watch_for)
  values (
    uid,
    p_day,
    p_ymd,
    left(btrim(p_theme), 60),
    left(btrim(p_title), 120),
    left(btrim(p_reflection), 400),
    left(btrim(p_try_today), 200),
    left(btrim(p_watch_for), 200)
  )
  returning id into new_id;

  return new_id;
end;
$$;
revoke all on function public.insert_daily_insight(integer,date,text,text,text,text,text) from public, anon;
grant execute on function public.insert_daily_insight(integer,date,text,text,text,text,text) to authenticated;

-- insert_explore_pack(date,text,text,jsonb) · source: explore.sql
create or replace function public.insert_explore_pack(
  p_generated_on date,
  p_trigger text,
  p_fingerprint text,
  p_entries jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pack_id uuid;
  item jsonb;
  idx int := 0;
  entry_count int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_trigger not in ('first', 'weekly', 'signal') then
    raise exception 'invalid trigger' using errcode = '22023';
  end if;
  if p_generated_on is null then
    raise exception 'generated_on required' using errcode = '22023';
  end if;

  select count(*)::int into entry_count
  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb));
  if entry_count < 1 or entry_count > 3 then
    raise exception 'explore pack must have 1–3 entries' using errcode = '22023';
  end if;

  insert into public.explore_packs (user_id, generated_on, trigger, fingerprint)
  values (uid, p_generated_on, p_trigger, left(coalesce(p_fingerprint, ''), 2000))
  returning id into pack_id;

  for item in select value from jsonb_array_elements(p_entries)
  loop
    insert into public.explore_entries (
      pack_id, user_id, sort_index, body, traits, chips, signal_kind
    ) values (
      pack_id,
      uid,
      idx,
      left(trim(coalesce(item->>'body', '')), 1200),
      coalesce(
        array(select jsonb_array_elements_text(coalesce(item->'traits', '[]'::jsonb))),
        '{}'
      ),
      coalesce(
        array(select jsonb_array_elements_text(coalesce(item->'chips', '[]'::jsonb))),
        '{}'
      ),
      nullif(item->>'signal_kind', '')
    );
    idx := idx + 1;
  end loop;

  return pack_id;
end;
$$;
revoke all on function public.insert_explore_pack(date,text,text,jsonb) from public, anon;
grant execute on function public.insert_explore_pack(date,text,text,jsonb) to authenticated;

-- record_explore_reaction(uuid,boolean) · source: explore.sql
create or replace function public.record_explore_reaction(
  p_entry_id uuid,
  p_landed boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_entry_id is null or p_landed is null then
    raise exception 'entry and landed required' using errcode = '22023';
  end if;

  select user_id into owner
  from public.explore_entries
  where id = p_entry_id;

  if owner is null or owner <> uid then
    raise exception 'not found' using errcode = '42501';
  end if;

  insert into public.explore_reactions (user_id, entry_id, landed)
  values (uid, p_entry_id, p_landed)
  on conflict (user_id, entry_id) do update
    set landed = excluded.landed,
        created_at = timezone('utc', now());
end;
$$;
revoke all on function public.record_explore_reaction(uuid,boolean) from public, anon;
grant execute on function public.record_explore_reaction(uuid,boolean) to authenticated;

-- insert_category_statements(jsonb) · source: wave59_category_statements.sql
create or replace function public.insert_category_statements(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  item jsonb;
  v_category_id text;
  entry_count int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select count(*)::int into entry_count
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb));
  if entry_count < 1 or entry_count > 32 then
    raise exception 'expected 1–32 items' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    v_category_id := btrim(coalesce(item->>'category_id', ''));
    if v_category_id = '' then
      raise exception 'category_id required' using errcode = '22023';
    end if;
    if not exists (select 1 from public.category_defs where id = v_category_id) then
      raise exception 'unknown category_id: %', v_category_id using errcode = '22023';
    end if;

    update public.category_statements
      set superseded_at = timezone('utc', now())
      where user_id = uid and category_id = v_category_id and superseded_at is null;

    insert into public.category_statements (user_id, category_id, statement)
    values (uid, v_category_id, left(trim(coalesce(item->>'statement', '')), 600));
  end loop;
end;
$$;
revoke all on function public.insert_category_statements(jsonb) from public, anon;
grant execute on function public.insert_category_statements(jsonb) to authenticated;

-- log_jargon_guard(text) · source: voice_preset_jargon.sql
create or replace function public.log_jargon_guard(p_flag text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (timezone('utc', now()))::date;
  flag text := left(trim(coalesce(p_flag, '')), 80);
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if flag = '' then
    return;
  end if;

  insert into public.ai_usage (user_id, day, calls, jargon_flag, jargon_at)
  values (uid, today, 0, flag, timezone('utc', now()))
  on conflict (user_id, day) do update
    set jargon_flag = excluded.jargon_flag,
        jargon_at = excluded.jargon_at;
end;
$$;
revoke all on function public.log_jargon_guard(text) from public, anon;
grant execute on function public.log_jargon_guard(text) to authenticated;

-- log_phrase_guard(text) · source: explore.sql
create or replace function public.log_phrase_guard(p_flag text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (timezone('utc', now()))::date;
  flag text := left(trim(coalesce(p_flag, '')), 80);
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if flag = '' then
    return;
  end if;

  insert into public.ai_usage (user_id, day, calls, phrase_flag, phrase_at)
  values (uid, today, 0, flag, timezone('utc', now()))
  on conflict (user_id, day) do update
    set phrase_flag = excluded.phrase_flag,
        phrase_at = excluded.phrase_at;
end;
$$;
revoke all on function public.log_phrase_guard(text) from public, anon;
grant execute on function public.log_phrase_guard(text) to authenticated;

-- 5.5 Divecore cloud save -----------------------------------------------------------------------

-- save_play_doc(jsonb,integer,timestamptz) · source: wave96_play_saves.sql
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
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
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
revoke all on function public.save_play_doc(jsonb,integer,timestamptz) from public, anon;
grant execute on function public.save_play_doc(jsonb,integer,timestamptz) to authenticated;

-- bump_play_counter(text) · source: wave96_play_saves.sql
create or replace function public.bump_play_counter(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
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

-- 5.6 Dev tools and root admin ------------------------------------------------------------------

-- apply_dev_trait_preset(jsonb,jsonb,jsonb,jsonb,jsonb) · source: wave79_trait_checkpoint.sql
create or replace function public.apply_dev_trait_preset(
  p_values jsonb,
  p_sources jsonb,
  p_touched jsonb,
  p_tracks jsonb,
  p_history jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_mode text;
  v_axis text;
  r jsonb;
  v_axes text[] := array[
    'openness', 'conscientiousness', 'extraversion', 'agreeableness', 'steadiness',
    'attachment_anxiety', 'attachment_avoidance', 'conflict_assertiveness',
    'conflict_cooperativeness', 'autonomy', 'competence', 'relatedness',
    'growth_mindset', 'locus_of_control', 'self_efficacy', 'playfulness'];
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select signup_mode into v_mode from public.app_config where id = 1;
  if v_mode is distinct from 'invite_only' then
    raise exception 'dev jumps are disabled once sign-up is public' using errcode = '42501';
  end if;
  if jsonb_typeof(p_values) <> 'object' or jsonb_typeof(p_sources) <> 'object'
     or jsonb_typeof(p_touched) <> 'object' or jsonb_typeof(p_tracks) <> 'array'
     or jsonb_typeof(coalesce(p_history, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid preset' using errcode = '22023';
  end if;

  perform 1 from public.me where id = uid for update;
  foreach v_axis in array v_axes loop
    execute format('update public.me set %I = $1 where id = $2', v_axis)
      using nullif(p_values ->> v_axis, '')::numeric, uid;
  end loop;
  update public.me set trait_sources = p_sources, trait_touched_at = p_touched where id = uid;

  for r in select * from jsonb_array_elements(p_tracks) loop
    if not (r ->> 'axis' = any (v_axes)) or (r ->> 'track') not in ('report', 'game') then
      raise exception 'invalid track row' using errcode = '22023';
    end if;
    insert into public.trait_tracks (user_id, axis, track, value, stability, answer_count, last_touched, last_depth_at)
      values (uid, r ->> 'axis', r ->> 'track', (r ->> 'value')::numeric, (r ->> 'stability')::numeric,
              (r ->> 'answer_count')::int, coalesce(nullif(r ->> 'last_touched', '')::timestamptz, now()),
              nullif(r ->> 'last_depth_at', '')::timestamptz)
      on conflict (user_id, axis, track) do update
        set value = excluded.value, stability = excluded.stability, answer_count = excluded.answer_count,
            last_touched = excluded.last_touched, last_depth_at = excluded.last_depth_at;
  end loop;

  if public.is_root() then
    for r in select * from jsonb_array_elements(coalesce(p_history, '[]'::jsonb)) loop
      if not (r ->> 'axis' = any (v_axes)) then
        raise exception 'invalid history row' using errcode = '22023';
      end if;
      insert into public.trait_history (user_id, axis, value, source)
        values (uid, r ->> 'axis', (r ->> 'value')::numeric, r ->> 'source');
    end loop;
  end if;
end;
$$;
revoke all on function public.apply_dev_trait_preset(jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.apply_dev_trait_preset(jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;

-- dev_fill_bank() · source: wave100_question_retire.sql
create or replace function public.dev_fill_bank()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_mode text;
  r record;
  v_idx int;
  v_value double precision;
  v_n int := 0;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.is_root() then
    raise exception 'root only' using errcode = '42501';
  end if;
  select signup_mode into v_mode from public.app_config where id = 1;
  if v_mode is distinct from 'invite_only' then
    raise exception 'dev_fill_bank is disabled once sign-up is public' using errcode = '42501';
  end if;
  perform 1 from public.me where id = uid for update;
  for r in
    with ans as (select question_id from public._bank_answered_ids(uid)),
         room as (select p.axis, p.active_n - p.answered_n as n
                    from public._bank_trait_progress(uid) p where p.answered_n < p.active_n)
    select x.id, x.axis, x.options from (
      select b.id, b.axis, b.options, rm.n,
             row_number() over (partition by b.axis order by b.id) as rn
        from public.question_bank b
        join room rm on rm.axis = b.axis
       where b.id not in (select question_id from ans)
         and b.retired_at is null
    ) x
     where x.rn <= x.n
     order by x.id
  loop
    v_idx := floor(random() * jsonb_array_length(r.options))::int;
    v_value := (r.options -> v_idx ->> 'value')::double precision;
    perform public._trait_write(uid, r.axis, 'self_situation', v_value, 'answer');
    insert into public.trait_answers (user_id, kind, question_key, axis, option_index, value)
      values (uid, 'bank', r.id, r.axis, v_idx, v_value);
    v_n := v_n + 1;
  end loop;
  -- Close any open set, so the screen does not offer half a set of nothing.
  update public.question_items i set skipped_at = timezone('utc', now())
    from public.question_packs p
   where i.pack_id = p.id and p.user_id = uid and p.set_no is not null
     and i.answered_option is null and i.skipped_at is null;
  return v_n;
end;
$$;
revoke all on function public.dev_fill_bank() from public, anon;
grant execute on function public.dev_fill_bank() to authenticated;

-- dev_reset_ai_limits(text) · source: wave92_ai_tokens.sql
create or replace function public.dev_reset_ai_limits(p_handle text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  root_id uuid;
  target uuid;
  target_handle text;
  n int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  root_id := public.require_root();
  if p_handle is null or btrim(p_handle) = '' then
    target := root_id;
  else
    select id into target from public.me
      where lower(handle) in (lower(btrim(p_handle)), lower(ltrim(btrim(p_handle), '@')))
      limit 1;
    if target is null then
      raise exception 'no account with that handle' using errcode = 'P0002';
    end if;
  end if;
  select handle into target_handle from public.me where id = target;

  update public.ai_usage
    set calls = 0, by_type = '{}'::jsonb
    where user_id = target and day >= (timezone('utc', now()))::date - 1;
  get diagnostics n = row_count;

  return jsonb_build_object('ok', true, 'handle', target_handle, 'days_cleared', n);
end;
$$;
revoke all on function public.dev_reset_ai_limits(text) from public, anon;
grant execute on function public.dev_reset_ai_limits(text) to authenticated;

-- reset_dev_test_user() · source: wave97_circle_visits.sql
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
revoke all on function public.reset_dev_test_user() from public, anon;
grant execute on function public.reset_dev_test_user() to authenticated;

-- reset_my_test_data() · source: wave75_reset_my_test_data.sql
create or replace function public.reset_my_test_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_mode text;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.is_root() then
    raise exception 'reset_my_test_data is root only' using errcode = '42501';
  end if;

  select signup_mode into v_mode from public.app_config where id = 1;
  if v_mode is distinct from 'invite_only' then
    raise exception 'reset_my_test_data is disabled once sign-up is public' using errcode = '42501';
  end if;

  -- What the account answered, and everything generated from it.
  delete from public.question_items where user_id = uid;
  delete from public.question_packs where user_id = uid;
  delete from public.question_bank_reroll_exclusions where user_id = uid;
  delete from public.trait_history where user_id = uid;
  delete from public.trait_tracks where user_id = uid;
  delete from public.daily_insights where user_id = uid;
  delete from public.category_statements where user_id = uid;
  delete from public.legend_generations where user_id = uid;
  delete from public.trait_rolls where user_id = uid;
  delete from public.trait_roll_snapshots where user_id = uid;
  delete from public.sage_title_flags where user_id = uid;
  delete from public.explore_reactions where user_id = uid;
  delete from public.explore_entries where user_id = uid;
  delete from public.explore_packs where user_id = uid;

  -- Tokens: both ledgers, so the once-ever intake payout can be earned again.
  delete from public.ato_token_events where user_id = uid;
  delete from public.token_events where user_id = uid;

  -- The balance columns are guarded by triggers; these are the same switches
  -- the earn / spend functions set (wave51:68, wave19:113), for this transaction.
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
      question_deferred = '[]'::jsonb,
      sage_knows = '{}'::jsonb,
      sage_story = '{}'::jsonb,
      sage_title = '{}'::jsonb,
      -- the eight preference taps the app's own "Fresh signup" stage also clears
      show_up = null, talk_style = null, knocks_you_off = null, morning_cue = null,
      evening_wind_down = null, energy_pattern = null, support_style = null, current_focus = null,
      ato_tokens = 0,
      tokens = 0
    where id = uid;

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.reset_my_test_data() from public, anon;
grant execute on function public.reset_my_test_data() to authenticated;

-- start_over_my_test_data() · source: wave85_fixed_question_bank.sql
create or replace function public.start_over_my_test_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_mode text;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.is_root() then
    raise exception 'start_over_my_test_data is root only' using errcode = '42501';
  end if;

  select signup_mode into v_mode from public.app_config where id = 1;
  if v_mode is distinct from 'invite_only' then
    raise exception 'start_over_my_test_data is disabled once sign-up is public' using errcode = '42501';
  end if;

  -- What the account answered, and everything generated from it. Same list as
  -- wave75. Deleting question_items and question_packs removes their own token
  -- records with them (wave52 foreign keys, on delete cascade).
  delete from public.question_items where user_id = uid;
  delete from public.question_packs where user_id = uid;
  delete from public.question_bank_reroll_exclusions where user_id = uid;
  delete from public.trait_history where user_id = uid;
  delete from public.trait_tracks where user_id = uid;
  delete from public.daily_insights where user_id = uid;
  delete from public.category_statements where user_id = uid;
  delete from public.legend_generations where user_id = uid;
  delete from public.trait_rolls where user_id = uid;
  delete from public.trait_roll_snapshots where user_id = uid;
  delete from public.sage_title_flags where user_id = uid;
  delete from public.explore_reactions where user_id = uid;
  delete from public.explore_entries where user_id = uid;
  delete from public.explore_packs where user_id = uid;
  -- wave85
  delete from public.trait_answers where user_id = uid;
  delete from public.trait_flags where user_id = uid;
  delete from public.trait_profile_snapshots where user_id = uid;

  -- Only the once-ever "finished the 50" record, so it can be earned again.
  -- The balance itself is deliberately not changed anywhere below.
  delete from public.ato_token_events
    where user_id = uid and reason = 'full_profile_complete';

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
      question_deferred = '[]'::jsonb,
      sage_knows = '{}'::jsonb,
      sage_story = '{}'::jsonb,
      sage_title = '{}'::jsonb,
      -- the eight preference taps, as wave75 clears them
      show_up = null, talk_style = null, knocks_you_off = null, morning_cue = null,
      evening_wind_down = null, energy_pattern = null, support_style = null, current_focus = null
    where id = uid;

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.start_over_my_test_data() from public, anon;
grant execute on function public.start_over_my_test_data() to authenticated;

-- has_dev_trace_capability() · source: dev_access.sql
create or replace function public.has_dev_trace_capability()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  select public.is_root()
    or exists (
      select 1 from public.dev_access_grants g
      where g.user_id = auth.uid() and g.capability = 'trace'
    );
$$;
revoke all on function public.has_dev_trace_capability() from public, anon;
grant execute on function public.has_dev_trace_capability() to authenticated;

-- my_dev_access() · source: dev_access.sql
create or replace function public.my_dev_access()
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
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
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
revoke all on function public.my_dev_access() from public, anon;
grant execute on function public.my_dev_access() to authenticated;

-- my_dev_trace_session() · source: dev_access.sql
create or replace function public.my_dev_trace_session()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_row public.dev_trace_sessions;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
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
revoke all on function public.my_dev_trace_session() from public, anon;
grant execute on function public.my_dev_trace_session() to authenticated;

-- start_dev_trace() · source: dev_access.sql
create or replace function public.start_dev_trace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_expires timestamptz;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
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
revoke all on function public.start_dev_trace() from public, anon;
grant execute on function public.start_dev_trace() to authenticated;

-- stop_dev_trace() · source: dev_access.sql
create or replace function public.stop_dev_trace()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from public.dev_trace_sessions where user_id = auth.uid();
end;
$$;
revoke all on function public.stop_dev_trace() from public, anon;
grant execute on function public.stop_dev_trace() to authenticated;

-- record_dev_trace(text,jsonb,jsonb,text,text,text,jsonb) · source: dev_trace_steps.sql
create or replace function public.record_dev_trace(
  p_surface text,
  p_library_lines jsonb,
  p_trait_signals jsonb,
  p_raw_before text,
  p_raw_after text,
  p_guard_fired text,
  p_steps jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_remaining int;
  v_steps jsonb := coalesce(p_steps, '[]'::jsonb);
  v_el jsonb;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    return false;
  end if;
  if p_surface not in ('sage', 'explore', 'dawn', 'talk') then
    return false;
  end if;
  if jsonb_typeof(v_steps) <> 'array' then
    return false;
  end if;
  for v_el in select value from jsonb_array_elements(v_steps)
  loop
    if jsonb_typeof(v_el) <> 'object'
       or coalesce(v_el->>'step_type', '') not in ('context_gather', 'model_call', 'guard_check', 'output')
       or coalesce(v_el->>'status', '') not in ('ok', 'flagged', 'failed')
    then
      return false;
    end if;
  end loop;

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
    user_id, surface, library_lines, trait_signals, raw_before, raw_after, guard_fired, steps
  ) values (
    uid,
    p_surface,
    coalesce(p_library_lines, '[]'::jsonb),
    coalesce(p_trait_signals, '{}'::jsonb),
    p_raw_before,
    p_raw_after,
    nullif(btrim(coalesce(p_guard_fired, '')), ''),
    v_steps
  );

  if v_remaining <= 0 then
    delete from public.dev_trace_sessions where user_id = uid;
  end if;
  return true;
end;
$$;
revoke all on function public.record_dev_trace(text,jsonb,jsonb,text,text,text,jsonb) from public, anon;
grant execute on function public.record_dev_trace(text,jsonb,jsonb,text,text,text,jsonb) to authenticated;

-- list_my_dev_trace_events() · source: dev_trace_steps.sql
create or replace function public.list_my_dev_trace_events()
returns table (
  id uuid,
  created_at timestamptz,
  surface text,
  library_lines jsonb,
  trait_signals jsonb,
  raw_before text,
  raw_after text,
  guard_fired text,
  steps jsonb
)
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
  perform public.purge_expired_dev_trace();
  return query
    select e.id, e.created_at, e.surface, e.library_lines, e.trait_signals,
           e.raw_before, e.raw_after, e.guard_fired, e.steps
    from public.dev_trace_events e
    where e.user_id = uid
    order by e.created_at desc
    limit 40;
end;
$$;
revoke all on function public.list_my_dev_trace_events() from public, anon;
grant execute on function public.list_my_dev_trace_events() to authenticated;

-- list_dev_access_grants(text) · source: dev_access.sql
create or replace function public.list_dev_access_grants(p_handle text)
returns table (capability text, granted_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
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
revoke all on function public.list_dev_access_grants(text) from public, anon;
grant execute on function public.list_dev_access_grants(text) to authenticated;

-- set_dev_access_grants(text,text[]) · source: dev_access.sql
create or replace function public.set_dev_access_grants(p_handle text, p_capabilities text[])
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
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
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
revoke all on function public.set_dev_access_grants(text,text[]) from public, anon;
grant execute on function public.set_dev_access_grants(text,text[]) to authenticated;

-- root_search_me(text) · source: dev_access.sql
create or replace function public.root_search_me(p_query text)
returns table (id uuid, handle text, name text, paused boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := lower(btrim(coalesce(p_query, '')));
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
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
revoke all on function public.root_search_me(text) from public, anon;
grant execute on function public.root_search_me(text) to authenticated;

-- root_pause_profile(text) · source: wave34_root_is_column.sql
create or replace function public.root_pause_profile(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_is_root boolean;
  v_out jsonb;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  perform public.require_root();
  select m.id, m.is_root into v_id, v_is_root
  from public.me m
  where m.handle = btrim(coalesce(p_handle, ''));
  if v_id is null then
    raise exception 'user_not_found' using errcode = 'P0004';
  end if;
  if v_is_root then
    raise exception 'cannot_act_on_root' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', rb.user_id, 'handle', rb.handle)), '[]'::jsonb)
    into v_out
  from public.pause_branch(v_id) rb;
  return v_out;
end;
$$;
revoke all on function public.root_pause_profile(text) from public, anon;
grant execute on function public.root_pause_profile(text) to authenticated;

-- root_unpause_profile(text) · source: wave34_root_is_column.sql
create or replace function public.root_unpause_profile(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_is_root boolean;
  v_out jsonb;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  perform public.require_root();
  select m.id, m.is_root into v_id, v_is_root
  from public.me m
  where m.handle = btrim(coalesce(p_handle, ''));
  if v_id is null then
    raise exception 'user_not_found' using errcode = 'P0004';
  end if;
  if v_is_root then
    raise exception 'cannot_act_on_root' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', rb.user_id, 'handle', rb.handle)), '[]'::jsonb)
    into v_out
  from public.unpause_branch(v_id) rb;
  return v_out;
end;
$$;
revoke all on function public.root_unpause_profile(text) from public, anon;
grant execute on function public.root_unpause_profile(text) to authenticated;

-- root_delete_profile(text,text) · source: wave34_root_is_column.sql
create or replace function public.root_delete_profile(p_handle text, p_confirm_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_handle text;
  v_is_root boolean;
  v_out jsonb;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  perform public.require_root();
  v_handle := btrim(coalesce(p_handle, ''));
  if v_handle = '' or v_handle is distinct from btrim(coalesce(p_confirm_handle, '')) then
    raise exception 'handle_confirm_mismatch' using errcode = '22023';
  end if;
  select m.id, m.is_root into v_id, v_is_root
  from public.me m
  where m.handle = v_handle;
  if v_id is null then
    raise exception 'user_not_found' using errcode = 'P0004';
  end if;
  if v_is_root then
    raise exception 'cannot_act_on_root' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', rb.user_id, 'handle', rb.handle)), '[]'::jsonb)
    into v_out
  from public.delete_branch(v_id) rb;
  return v_out;
end;
$$;
revoke all on function public.root_delete_profile(text,text) from public, anon;
grant execute on function public.root_delete_profile(text,text) to authenticated;

-- approve_access_request(uuid) · source: founder_access_requests.sql
create or replace function public.approve_access_request(p_id uuid)
returns table (id uuid, email text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_root uuid;
  v_email text;
  v_code text;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  v_root := public.require_root();

  select r.email into v_email
  from public.access_requests r
  where r.id = p_id and r.status = 'pending'
  for update;
  if v_email is null then
    raise exception 'request_not_pending' using errcode = 'P0008';
  end if;

  v_code := public.issue_one_invite_code(v_root, 1);

  update public.access_requests
  set status = 'approved', reviewed_at = now(), invite_code = v_code
  where access_requests.id = p_id;

  return query select p_id, v_email, v_code;
end;
$$;
revoke all on function public.approve_access_request(uuid) from public, anon;
grant execute on function public.approve_access_request(uuid) to authenticated;

-- deny_access_request(uuid) · source: founder_access_requests.sql
create or replace function public.deny_access_request(p_id uuid)
returns public.access_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.access_requests;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  perform public.require_root();
  update public.access_requests
  set status = 'denied', reviewed_at = now(), invite_code = null
  where id = p_id and status = 'pending'
  returning * into v_row;
  if v_row.id is null then
    raise exception 'request_not_pending' using errcode = 'P0008';
  end if;
  return v_row;
end;
$$;
revoke all on function public.deny_access_request(uuid) from public, anon;
grant execute on function public.deny_access_request(uuid) to authenticated;

-- list_pending_access_requests() · source: founder_access_requests.sql
create or replace function public.list_pending_access_requests()
returns table (
  id uuid,
  email text,
  requested_at timestamptz,
  status text,
  reviewed_at timestamptz,
  invite_code text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  perform public.require_root();
  return query
    select r.id, r.email, r.requested_at, r.status, r.reviewed_at, r.invite_code
    from public.access_requests r
    where r.status = 'pending'
    order by r.requested_at;
end;
$$;
revoke all on function public.list_pending_access_requests() from public, anon;
grant execute on function public.list_pending_access_requests() to authenticated;

-- library_admin_list(text,integer,boolean) · source: wave93_ai_library.sql
create or replace function public.library_admin_list(p_kind text, p_limit int, p_pending_only boolean)
returns table (
  id uuid, kind text, bucket_key text, angle text, card jsonb, source text,
  created_at timestamptz, approved boolean, served_count int, report_count int, retired boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  perform public.require_root();
  return query
    select c.id, c.kind, c.bucket_key, c.angle, c.card, c.source, c.created_at,
           c.approved_at is not null, c.served_count, c.report_count, c.retired_at is not null
    from public.ai_library_cards c
    where (p_kind is null or c.kind = p_kind)
      and (not coalesce(p_pending_only, false) or (c.approved_at is null and c.retired_at is null))
    order by c.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$$;
revoke all on function public.library_admin_list(text,integer,boolean) from public, anon;
grant execute on function public.library_admin_list(text,integer,boolean) to authenticated;

-- library_approve(uuid) · source: wave93_ai_library.sql
create or replace function public.library_approve(p_card_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  perform public.require_root();
  update public.ai_library_cards set approved_at = now()
    where id = p_card_id and approved_at is null and retired_at is null;
  return found;
end;
$$;
revoke all on function public.library_approve(uuid) from public, anon;
grant execute on function public.library_approve(uuid) to authenticated;

-- library_retire(uuid,text) · source: wave93_ai_library.sql
create or replace function public.library_retire(p_card_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  perform public.require_root();
  update public.ai_library_cards
    set retired_at = now(), retired_reason = left(coalesce(nullif(btrim(p_reason), ''), 'root'), 200)
    where id = p_card_id and retired_at is null;
  return found;
end;
$$;
revoke all on function public.library_retire(uuid,text) from public, anon;
grant execute on function public.library_retire(uuid,text) to authenticated;

-- library_retire_old_versions(text,text) · source: wave93_ai_library.sql
create or replace function public.library_retire_old_versions(p_kind text, p_keep_version text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  perform public.require_root();
  update public.ai_library_cards
    set retired_at = now(), retired_reason = 'old version'
    where kind = p_kind and version <> p_keep_version and retired_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.library_retire_old_versions(text,text) from public, anon;
grant execute on function public.library_retire_old_versions(text,text) to authenticated;

-- library_stats() · source: wave93_ai_library.sql
create or replace function public.library_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (timezone('utc', now()))::date;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  perform public.require_root();
  return (
    select coalesce(jsonb_object_agg(k.kind, jsonb_build_object(
      'cards', (select count(*) from public.ai_library_cards c where c.kind = k.kind and c.retired_at is null),
      'buckets', (select count(distinct c.bucket_key) from public.ai_library_cards c where c.kind = k.kind and c.retired_at is null),
      'waiting', (select count(*) from public.ai_library_cards c where c.kind = k.kind and c.approved_at is null and c.retired_at is null),
      'retired', (select count(*) from public.ai_library_cards c where c.kind = k.kind and c.retired_at is not null),
      'written_today', (select count(*) from public.ai_library_cards c where c.kind = k.kind and c.created_at >= today),
      'served_free_today', (select coalesce(sum((u.by_type->>('lib_' || k.kind))::int), 0) from public.ai_usage u where u.day = today)
    )), '{}'::jsonb)
    from (values ('deep_dive'), ('story'), ('legend')) as k(kind)
  );
end;
$$;
revoke all on function public.library_stats() from public, anon;
grant execute on function public.library_stats() to authenticated;

-- library_bucket_counts(text,text) · source: wave93_ai_library.sql
create or replace function public.library_bucket_counts(p_kind text, p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  perform public.require_root();
  return (
    select coalesce(jsonb_object_agg(bucket_key, n), '{}'::jsonb)
    from (
      select bucket_key, count(*) as n from public.ai_library_cards
      where kind = p_kind and version = p_version and retired_at is null
      group by bucket_key
    ) t
  );
end;
$$;
revoke all on function public.library_bucket_counts(text,text) from public, anon;
grant execute on function public.library_bucket_counts(text,text) to authenticated;

-- library_coverage() · source: wave94_ai_library_fill.sql
create or replace function public.library_coverage()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (timezone('utc', now()))::date;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  perform public.require_root();
  return (
    with active as (
      select w.*, public._library_unseen(w.user_id, w.kind, w.bucket_key, w.version) as unseen
      from public.ai_library_wanted w
      where w.wanted_at >= now() - interval '7 days'
    ),
    per_bucket as (
      select kind, bucket_key, version, min(unseen) as worst from active group by kind, bucket_key, version
    ),
    per_person as (
      select user_id, sum(unseen) as waiting, bool_or(unseen = 0) as empty from active group by user_id
    )
    select jsonb_build_object(
      'deep_dive_counts', coalesce((
        select jsonb_object_agg(bucket_key || '#' || version, n) from (
          select bucket_key, version, count(*) as n from public.ai_library_cards
          where kind = 'deep_dive' and retired_at is null
          group by bucket_key, version
        ) t
      ), '{}'::jsonb),
      'wanted', coalesce((
        select jsonb_object_agg(kind, jsonb_build_object('groups', n, 'ready', ready, 'queued', n - ready))
        from (
          select kind, count(*) as n, count(*) filter (where worst >= 2) as ready from per_bucket group by kind
        ) t
      ), '{}'::jsonb),
      'people', (select count(*) from per_person),
      'people_need_ai', (select count(*) from per_person where empty),
      'typical_waiting', (select percentile_cont(0.5) within group (order by waiting) from per_person),
      'versions', coalesce((
        select jsonb_object_agg(kind || '#' || version, n) from (
          select kind, version, count(*) as n from public.ai_library_cards where retired_at is null group by kind, version
        ) t
      ), '{}'::jsonb),
      'today', jsonb_build_object(
        'fill_calls', coalesce((select calls from public.ai_library_fill_days where day = today), 0),
        'fill_cards', coalesce((select cards from public.ai_library_fill_days where day = today), 0),
        'fill_cap', (select library_fill_daily_cap from public.app_config where id = 1),
        'free_served', (
          select coalesce(sum(coalesce((u.by_type->>'lib_deep_dive')::int, 0) + coalesce((u.by_type->>'lib_story')::int, 0)), 0)
          from public.ai_usage u where u.day = today
        ),
        -- Cards the AI wrote on someone's tap (paid, or a free Legends reveal) instead of ahead of time.
        'tap_ai', (select count(*) from public.ai_library_cards c where c.source = 'ai' and c.created_at >= today),
        'skipped', (select count(*) from public.ai_library_fill_fails f where f.day = today and f.fails >= 3)
      )
    )
  );
end;
$$;
revoke all on function public.library_coverage() from public, anon;
grant execute on function public.library_coverage() to authenticated;

-- PostgREST: pick up the new helper functions.
notify pgrst, 'reload schema';

commit;
