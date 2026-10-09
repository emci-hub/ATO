-- wave94_ai_library_fill.sql
-- The shared AI library fills itself (emci approved 2026-10-09: "make our
-- library big enough that it won't need AI yet" + "a counter to see progress").
-- Needs wave93.
--
--   1. ai_library_wanted: the groups (bucket keys, never text) each reader's
--      phone says it will need: their next Stories, the day's Legends frames,
--      and any deep-dive group they ran out of. Own rows only via functions,
--      capped per account (11 deep dives, 3 Stories, 6 Legends), deleted with
--      the account. No cross-account trait read is needed.
--   2. An hourly-ish fill (pg_cron every 10 minutes → pg_net → the
--      `ai-library-fill` Edge Function, authorised by a random token kept in
--      Vault). Each run writes up to 5 AI calls of approved seed cards:
--        - every wanted group where the reader has fewer than 2 unseen cards,
--        - then every deep-dive group (all 207) with fewer than 3 cards.
--      Hard cap library_fill_daily_cap (400 calls a day). A group the AI keeps
--      failing on is skipped after 3 failures until the next day.
--   3. The counter (root): coverage per kind, people who would hit the paid AI
--      today, the typical reader's free cards waiting, and today's numbers.
--   4. Team size for a deep-dive group (only from 5 people up, never who).
--
-- Copies tested paths: own-rows tables written by security-definer functions
-- (wave77 daily_line_days), the cron job (wave86 profile-history-monthly),
-- require_root (wave34), counts only from 5 up (wave89). NEW here (emci
-- approved 2026-10-09): the first net.http_post call (pg_net was only enabled
-- in wave2) and the first Vault secret. Check both after applying (end of file).

create extension if not exists pg_net with schema extensions;

-- 1. Settings --------------------------------------------------------------------------

alter table public.app_config
  add column if not exists library_fill_daily_cap int not null default 400 check (library_fill_daily_cap >= 0),
  -- At most 5: each call can take ~24s (Gemini, then DeepSeek), inside the function's time limit.
  add column if not exists library_fill_per_run int not null default 5 check (library_fill_per_run between 0 and 5);

comment on column public.app_config.library_fill_daily_cap is
  'AI calls a day the automatic library fill may make (seed cards, no person charged).';

-- 2. Tables ------------------------------------------------------------------------------

create table public.ai_library_wanted (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('deep_dive', 'story', 'legend')),
  bucket_key text not null check (bucket_key ~ '^[a-z0-9_|:=+,.!-]{3,300}$'),
  version text not null check (version ~ '^[a-z0-9]{1,12}$'),
  wanted_at timestamptz not null default now(),
  primary key (user_id, kind, bucket_key)
);
create index ai_library_wanted_recent_idx on public.ai_library_wanted (wanted_at desc);

-- Failures per group per day (skip after 3), and the fill's own daily count.
create table public.ai_library_fill_fails (
  kind text not null,
  bucket_key text not null,
  version text not null,
  day date not null,
  fails int not null default 0,
  primary key (kind, bucket_key, version, day)
);

create table public.ai_library_fill_days (
  day date primary key,
  calls int not null default 0,
  cards int not null default 0
);

alter table public.ai_library_wanted enable row level security;
alter table public.ai_library_fill_fails enable row level security;
alter table public.ai_library_fill_days enable row level security;
revoke all on public.ai_library_wanted from public, anon, authenticated;
revoke all on public.ai_library_fill_fails from public, anon, authenticated;
revoke all on public.ai_library_fill_days from public, anon, authenticated;

-- 3. The phone says which groups it will need ---------------------------------------------

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
    if b is null or b !~ '^[a-z0-9_|:=+,.!-]{3,300}$' then
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

revoke all on function public.library_want(text, text[], text) from public, anon;
grant execute on function public.library_want(text, text[], text) to authenticated;

-- 4. Helpers --------------------------------------------------------------------------------

-- Cards one reader could still be given in one group (same rules as _library_pick).
create or replace function public._library_unseen(p_uid uuid, p_kind text, p_bucket text, p_version text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.ai_library_cards c
  where c.kind = p_kind and c.version = p_version and c.bucket_key = p_bucket
    and c.retired_at is null
    and c.report_count < (select library_report_retire from public.app_config where id = 1)
    and (c.approved_at is not null or c.created_by = p_uid or c.created_at < now() - interval '24 hours')
    and not exists (select 1 from public.ai_library_seen s where s.user_id = p_uid and s.card_id = c.id);
$$;
revoke all on function public._library_unseen(uuid, text, text, text) from public, anon, authenticated;

-- 5. The fill (the `ai-library-fill` Edge Function, service role only) ---------------------

-- The token the cron job sends, checked against Vault (never stored in a table).
create or replace function public.library_fill_token_ok(p_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_token is not null and length(p_token) >= 32 and exists (
    select 1 from vault.decrypted_secrets
    where name = 'ai_library_fill_token' and decrypted_secret = p_token
  );
$$;
revoke all on function public.library_fill_token_ok(text) from public, anon, authenticated;
grant execute on function public.library_fill_token_ok(text) to service_role;

-- What to write next: wanted groups where someone active in the last 7 days
-- has fewer than 2 unseen cards (most people waiting first), never a group
-- that failed 3 times today.
create or replace function public.library_fill_queue(p_limit int)
returns table (kind text, bucket_key text, version text, waiting int)
language sql
stable
security definer
set search_path = public
as $$
  select w.kind, w.bucket_key, w.version, count(distinct w.user_id)::int as waiting
  from public.ai_library_wanted w
  where w.wanted_at >= now() - interval '7 days'
    and public._library_unseen(w.user_id, w.kind, w.bucket_key, w.version) < 2
    and not exists (
      select 1 from public.ai_library_fill_fails f
      where f.kind = w.kind and f.bucket_key = w.bucket_key and f.version = w.version
        and f.day = (timezone('utc', now()))::date and f.fails >= 3
    )
  group by w.kind, w.bucket_key, w.version
  order by waiting desc, min(w.wanted_at)
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;
revoke all on function public.library_fill_queue(int) from public, anon, authenticated;
grant execute on function public.library_fill_queue(int) to service_role;

-- Live cards per group (the deep-dive baseline), and today's blocked groups.
create or replace function public.library_fill_state(p_kind text, p_version text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'counts', coalesce((
      select jsonb_object_agg(bucket_key, n) from (
        select bucket_key, count(*) as n from public.ai_library_cards
        where kind = p_kind and version = p_version and retired_at is null
        group by bucket_key
      ) t
    ), '{}'::jsonb),
    'blocked', coalesce((
      select jsonb_agg(f.bucket_key) from public.ai_library_fill_fails f
      where f.kind = p_kind and f.version = p_version
        and f.day = (timezone('utc', now()))::date and f.fails >= 3
    ), '[]'::jsonb),
    'per_run', (select library_fill_per_run from public.app_config where id = 1)
  );
$$;
revoke all on function public.library_fill_state(text, text) from public, anon, authenticated;
grant execute on function public.library_fill_state(text, text) to service_role;

-- One AI call of the fill: false once today's cap is reached.
create or replace function public.library_fill_begin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (timezone('utc', now()))::date;
  cap int;
  used int;
begin
  select library_fill_daily_cap into strict cap from public.app_config where id = 1;
  perform pg_advisory_xact_lock(hashtext('library_fill'));
  insert into public.ai_library_fill_days (day) values (today) on conflict (day) do nothing;
  select calls into used from public.ai_library_fill_days where day = today;
  if used >= cap then
    return false;
  end if;
  update public.ai_library_fill_days set calls = calls + 1 where day = today;
  return true;
end;
$$;
revoke all on function public.library_fill_begin() from public, anon, authenticated;
grant execute on function public.library_fill_begin() to service_role;

-- After one call: cards written, or one more failure for that group today.
create or replace function public.library_fill_done(p_kind text, p_bucket text, p_version text, p_cards int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (timezone('utc', now()))::date;
begin
  if coalesce(p_cards, 0) > 0 then
    update public.ai_library_fill_days set cards = cards + p_cards where day = today;
  else
    insert into public.ai_library_fill_fails (kind, bucket_key, version, day, fails)
    values (p_kind, p_bucket, p_version, today, 1)
    on conflict (kind, bucket_key, version, day) do update set fails = ai_library_fill_fails.fails + 1;
  end if;
end;
$$;
revoke all on function public.library_fill_done(text, text, text, int) from public, anon, authenticated;
grant execute on function public.library_fill_done(text, text, text, int) to service_role;

-- 6. The counter (root) -----------------------------------------------------------------------

create or replace function public.library_coverage()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (timezone('utc', now()))::date;
begin
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

-- 7. Team size (deep dives): people who were given a card from this group ------------------
-- Only for a group the caller has had a card from themselves (so nobody can
-- watch another group's count), never "How You Love" (no team there), and
-- only from 5 people up, rounded down to 5s so one friend joining can't be spotted.

create or replace function public.library_team_size(p_bucket text)
returns int
language sql
stable
security definer
set search_path = public
as $$
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

-- 8. The token + the timer ---------------------------------------------------------------------

-- A random token, created once, kept only in Vault. The Edge Function never
-- sees it in an env var: it asks library_fill_token_ok.
do $tok$
begin
  if not exists (select 1 from vault.secrets where name = 'ai_library_fill_token') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'ai_library_fill_token',
      'Bearer token the ai-library-fill cron job sends (wave94).'
    );
  end if;
end
$tok$;

do $cron$
begin
  begin
    perform cron.unschedule('ai-library-fill');
  exception when others then
    null;
  end;
  perform cron.schedule(
    'ai-library-fill',
    '*/10 * * * *',
    $job$
      select net.http_post(
        url := 'https://aijzsmupaaaxjctfgwpl.supabase.co/functions/v1/ai-library-fill',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ai_library_fill_token')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $job$
  );
exception when others then
  raise notice 'pg_cron not available; schedule ai-library-fill by hand: %', sqlerrm;
end
$cron$;

-- AFTER APPLYING, CHECK:
--   select jobname, schedule from cron.job where jobname = 'ai-library-fill';
--   select count(*) from vault.secrets where name = 'ai_library_fill_token';   -- 1
-- To pause the fill: update public.app_config set library_fill_daily_cap = 0 where id = 1;
