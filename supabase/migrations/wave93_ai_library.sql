-- wave93_ai_library.sql
-- Shared AI library: "library first, AI tops up" (emci approved 2026-10-09).
--
-- People whose leanings fall in the same bucket share AI cards (deep dives,
-- Stories, Legends cards). A tap serves an unseen card from the bucket for
-- free; only an empty bucket costs a new AI card (5 ATO tokens, the existing
-- claims). Safe for a public app (emci 2026-10-09: invite-only is ending):
--
--   * Cards are written ONLY by the `ai-library` Edge Function with the
--     service role, after it built the prompt from the bucket key and checked
--     the answer with the app's own rules. No phone can put text in the library.
--   * A shape guard here re-checks every card (fields, lengths, no links, no
--     @, no brackets, no swear stems, no clinical words) as a backstop.
--   * Cooling period: an AI card goes to its writer at once, and to anyone else
--     after 24 hours with fewer than 2 reports, or sooner once root approves it.
--     Root seed cards are approved as they are written.
--   * Report: two different people reporting a card retire it. Root can retire,
--     approve, or retire a whole old prompt version.
--   * Nobody reads the library directly (RLS on, no policies): each tap gets
--     one card through library_serve.
--   * People in the same Circle get different cards when one is available.
--   * Legends cards are never free through library_serve: a reveal is claimed
--     first (the free reveal has its own small cap), then served or written.
--   * "You and N others got this card" only from 5 people up, never who.
--   * Crisis: nothing is served or written for an account with a crisis flag in
--     the last 24 hours (the phone hides these surfaces anyway).
--
-- Copies tested paths: the shared pool (daily_line_pool, wave77: a shared
-- table written only by a security-definer function), the claims and token
-- charge (wave92), require_root (wave34), the Circle check (wave89
-- legend_circle_friends). Additive: no existing row is changed except three
-- new app_config columns.

-- 1. Settings ---------------------------------------------------------------------

alter table public.app_config
  add column if not exists library_free_daily_cap int not null default 10 check (library_free_daily_cap >= 0),
  add column if not exists library_seed_daily_cap int not null default 120 check (library_seed_daily_cap >= 0),
  add column if not exists legend_free_daily_cap int not null default 2 check (legend_free_daily_cap >= 0),
  add column if not exists library_report_retire int not null default 2 check (library_report_retire >= 1);

comment on column public.app_config.library_free_daily_cap is
  'Free library cards a day per kind (deep_dive / story / legend), per account.';
comment on column public.app_config.library_seed_daily_cap is
  'Root seed AI calls a day (fills the library ahead of people; outside the normal AI cap).';
comment on column public.app_config.legend_free_daily_cap is
  'AI calls a day for the FREE Legends reveal (the daily one + the bonus): never charged.';

-- 2. Tables -------------------------------------------------------------------------

create table public.ai_library_cards (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('deep_dive', 'story', 'legend')),
  bucket_key text not null check (bucket_key ~ '^[a-z0-9_|:=+,.!-]{3,300}$'),
  version text not null check (version ~ '^[a-z0-9]{1,12}$'),
  angle text not null check (angle ~ '^[a-z0-9_]{1,24}$'),
  card jsonb not null check (jsonb_typeof(card) = 'object' and octet_length(card::text) <= 6000),
  source text not null check (source in ('seed', 'ai')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  served_count int not null default 0,
  report_count int not null default 0,
  retired_at timestamptz,
  retired_reason text check (retired_reason is null or char_length(retired_reason) <= 200)
);

create index ai_library_cards_bucket_idx
  on public.ai_library_cards (kind, version, bucket_key)
  where retired_at is null;
create index ai_library_cards_recent_idx on public.ai_library_cards (kind, created_at desc);

-- Who has been shown which card (also the "you and N others" count).
create table public.ai_library_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.ai_library_cards(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
create index ai_library_seen_card_idx on public.ai_library_seen (card_id);

create table public.ai_library_reports (
  card_id uuid not null references public.ai_library_cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, user_id)
);

alter table public.ai_library_cards enable row level security;
alter table public.ai_library_seen enable row level security;
alter table public.ai_library_reports enable row level security;
-- No policies: only the functions below (security definer) read or write.
revoke all on public.ai_library_cards from public, anon, authenticated;
revoke all on public.ai_library_seen from public, anon, authenticated;
revoke all on public.ai_library_reports from public, anon, authenticated;

-- 3. Helpers (internal) ----------------------------------------------------------------

create or replace function public._library_crisis(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crisis_flags f
    where f.user_id = p_uid and f.created_at >= now() - interval '24 hours'
  );
$$;
revoke all on function public._library_crisis(uuid) from public, anon, authenticated;

-- The card's reader-facing text, per kind (ids and keys are not text).
create or replace function public._library_card_text(p_kind text, p_card jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(string_agg(v #>> '{}', ' '), '')
  from unnest(case p_kind
      when 'deep_dive' then array['lax $.title', 'lax $.showsUp[*].line', 'lax $.mix', 'lax $.othersNotice',
                                  'lax $.whatItMeansForYou', 'lax $.joke']
      when 'story' then array['lax $.title', 'lax $.scene', 'lax $.moment', 'lax $.handle', 'lax $.noticed',
                              'lax $.otherWay', 'lax $.means', 'lax $.joke', 'lax $.nextTime']
      else array['lax $.title', 'lax $.howTheTraitWon[*].line', 'lax $.whatItMeansForYou', 'lax $.metScene',
                 'lax $.differ.line', 'lax $.joke']
    end) as p(path)
  cross join lateral jsonb_path_query(p_card, p.path::jsonpath) as v
  where jsonb_typeof(v) = 'string';
$$;
revoke all on function public._library_card_text(text, jsonb) from public, anon, authenticated;

-- Backstop shape guard. The Edge Function already ran the app's full checks.
create or replace function public._library_card_ok(p_kind text, p_card jsonb)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  body text := public._library_card_text(p_kind, p_card);
  core text[] := case p_kind
    when 'deep_dive' then array['title', 'whatItMeansForYou']
    when 'story' then array['scene', 'moment', 'means']
    else array['title', 'whatItMeansForYou']
  end;
  k text;
begin
  if p_card is null or jsonb_typeof(p_card) <> 'object' or octet_length(p_card::text) > 6000 then
    return 'shape';
  end if;
  foreach k in array core loop
    if jsonb_typeof(p_card -> k) is distinct from 'string' or char_length(p_card ->> k) not between 3 and 600 then
      return 'missing ' || k;
    end if;
  end loop;
  -- Legends ids are short (a1-a6, m1-m3): checked by their own pattern.
  if p_kind = 'legend' and (
       coalesce(p_card ->> 'legendId', '') !~ '^lf_[a-z0-9_]{2,40}$'
       or coalesce(p_card ->> 'angleId', '') !~ '^a[1-6]$'
       or coalesce(p_card ->> 'momentId', '') !~ '^m[1-3]$') then
    return 'legend ids';
  end if;
  if char_length(body) < 40 then return 'too short'; end if;
  if body ~* '(https?://|www\.|\.com\M|@|<|>|\[|\]|#)' then return 'link or markup'; end if;
  if body ~* '(fuck|shit|bitch|asshole|\mslut|\mwhore|\mcunt)' then return 'swear'; end if;
  if p_kind <> 'legend' and body ~ '[0-9]' then return 'digit'; end if;
  if p_kind <> 'legend'
     and body ~* '\m(anxious|anxiety|insecure|insecurity|avoidant|disorder|trauma|toxic|needy|clingy|codependent|diagnos|therapy|therapist|symptom)' then
    return 'clinical word';
  end if;
  return null;
end;
$$;
revoke all on function public._library_card_ok(text, jsonb) from public, anon, authenticated;

-- Pick one card for one account: unseen, live, past its cooling period (or
-- approved, or the reader's own), cards no Circle friend has seen first, then
-- the least shown, then at random (two people tapping together differ).
create or replace function public._library_pick(p_uid uuid, p_kind text, p_bucket text, p_version text)
returns uuid
language sql
volatile
security definer
set search_path = public
as $$
  select c.id
  from public.ai_library_cards c
  where c.kind = p_kind and c.version = p_version and c.bucket_key = p_bucket
    and c.retired_at is null
    and c.report_count < (select library_report_retire from public.app_config where id = 1)
    and (c.approved_at is not null or c.created_by = p_uid or c.created_at < now() - interval '24 hours')
    and not exists (select 1 from public.ai_library_seen s where s.user_id = p_uid and s.card_id = c.id)
  order by
    exists (
      select 1 from public.ai_library_seen s
      join public.connections k
        on (k.user_id = p_uid and k.peer_id = s.user_id) or (k.peer_id = p_uid and k.user_id = s.user_id)
      where s.card_id = c.id
    ),
    c.served_count,
    random()
  limit 1;
$$;
revoke all on function public._library_pick(uuid, text, text, text) from public, anon, authenticated;

-- Mark one card shown to one account; returns the card for the phone.
create or replace function public._library_give(p_uid uuid, p_card_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.ai_library_cards;
  seen int;
begin
  insert into public.ai_library_seen (user_id, card_id) values (p_uid, p_card_id) on conflict do nothing;
  update public.ai_library_cards set served_count = served_count + 1 where id = p_card_id returning * into v_card;
  select count(*) into seen from public.ai_library_seen where card_id = p_card_id;
  return jsonb_build_object(
    'ok', true,
    'id', v_card.id,
    'angle', v_card.angle,
    'card', v_card.card,
    -- "You and N others got this card": only from 5 people up, never who.
    'others', case when seen >= 5 then seen - 1 else null end
  );
end;
$$;
revoke all on function public._library_give(uuid, uuid) from public, anon, authenticated;

-- 4. Serve (free) ---------------------------------------------------------------------

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
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- Legends are not here: a reveal is a game move with its own free/paid rule,
  -- so its library cards come through claim_library_write (below).
  if p_kind is null or p_kind not in ('deep_dive', 'story')
     or p_bucket is null or p_bucket !~ '^[a-z0-9_|:=+,.!-]{3,300}$'
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

revoke all on function public.library_serve(text, text, text) from public, anon;
grant execute on function public.library_serve(text, text, text) to authenticated;

-- 5. The claim before a library AI call (the Edge Function calls it as the person) ----
--
--   paid        the existing paid claim for that kind (5 tokens, safety cap),
--               then one unit of the shared AI cap; if that is full, the whole
--               thing rolls back (nothing charged).
--   free_legend the free daily Legends reveal: never charged, legend_free_daily_cap a day.
--   seed        root only: fills the library ahead of people, its own daily cap.
-- Legends (paid or free): once the reveal is claimed, an unseen library card for
-- the bucket is given in the same transaction ('served'), with no AI unit used.
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
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind is null or p_kind not in ('deep_dive', 'story', 'legend')
     or p_bucket is null or p_bucket !~ '^[a-z0-9_|:=+,.!-]{3,300}$'
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

revoke all on function public.claim_library_write(text, text, text, text) from public, anon;
grant execute on function public.claim_library_write(text, text, text, text) to authenticated;

-- 6. Add cards (the Edge Function only, with the service role) ---------------------

create or replace function public.library_add_cards(
  p_user uuid,
  p_kind text,
  p_bucket text,
  p_version text,
  p_items jsonb,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  bad text;
  new_id uuid;
  ids jsonb := '[]'::jsonb;
  first_id uuid;
begin
  if p_kind is null or p_kind not in ('deep_dive', 'story', 'legend')
     or p_bucket is null or p_bucket !~ '^[a-z0-9_|:=+,.!-]{3,300}$'
     or p_version is null or p_version !~ '^[a-z0-9]{1,12}$'
     or p_source not in ('seed', 'ai') then
    raise exception 'invalid library request' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 2 then
    raise exception 'invalid items' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    bad := public._library_card_ok(p_kind, item->'card');
    if bad is not null then
      continue;  -- a card that fails the backstop is never stored
    end if;
    insert into public.ai_library_cards (kind, bucket_key, version, angle, card, source, created_by, approved_at)
    values (
      p_kind, p_bucket, p_version, coalesce(item->>'angle', 'x'), item->'card', p_source, p_user,
      case when p_source = 'seed' then now() else null end
    )
    returning id into new_id;
    ids := ids || jsonb_build_object('id', new_id, 'angle', coalesce(item->>'angle', 'x'));
    first_id := coalesce(first_id, new_id);
  end loop;

  -- The writer reads the first card now; any second one waits in the library.
  if first_id is not null and p_user is not null and p_source = 'ai' then
    return jsonb_build_object('ok', true, 'ids', ids, 'served', public._library_give(p_user, first_id));
  end if;
  return jsonb_build_object('ok', first_id is not null, 'ids', ids);
end;
$$;

revoke all on function public.library_add_cards(uuid, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.library_add_cards(uuid, text, text, text, jsonb, text) to service_role;

-- How many live cards each angle has in a bucket (the Edge Function picks the thinnest).
create or replace function public.library_angle_counts(p_kind text, p_bucket text, p_version text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(angle, n), '{}'::jsonb)
  from (
    select angle, count(*) as n from public.ai_library_cards
    where kind = p_kind and bucket_key = p_bucket and version = p_version and retired_at is null
    group by angle
  ) t;
$$;
revoke all on function public.library_angle_counts(text, text, text) from public, anon, authenticated;
grant execute on function public.library_angle_counts(text, text, text) to service_role;

-- 7. Report (anyone who was shown the card) ------------------------------------------

create or replace function public.library_report(p_card_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  limit_n int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.ai_library_seen where user_id = uid and card_id = p_card_id) then
    return jsonb_build_object('ok', false, 'reason', 'not seen');
  end if;
  insert into public.ai_library_reports (card_id, user_id) values (p_card_id, uid) on conflict do nothing;
  if not found then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  select library_report_retire into strict limit_n from public.app_config where id = 1;
  update public.ai_library_cards
    set report_count = report_count + 1,
        retired_at = case when report_count + 1 >= limit_n and retired_at is null then now() else retired_at end,
        retired_reason = case when report_count + 1 >= limit_n and retired_at is null then 'reports' else retired_reason end
    where id = p_card_id;
  return jsonb_build_object('ok', true, 'already', false);
end;
$$;

revoke all on function public.library_report(uuid) from public, anon;
grant execute on function public.library_report(uuid) to authenticated;

-- 8. Root tools ------------------------------------------------------------------------

create or replace function public.library_retire(p_card_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_root();
  update public.ai_library_cards
    set retired_at = now(), retired_reason = left(coalesce(nullif(btrim(p_reason), ''), 'root'), 200)
    where id = p_card_id and retired_at is null;
  return found;
end;
$$;
revoke all on function public.library_retire(uuid, text) from public, anon;
grant execute on function public.library_retire(uuid, text) to authenticated;

create or replace function public.library_approve(p_card_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_root();
  update public.ai_library_cards set approved_at = now()
    where id = p_card_id and approved_at is null and retired_at is null;
  return found;
end;
$$;
revoke all on function public.library_approve(uuid) from public, anon;
grant execute on function public.library_approve(uuid) to authenticated;

-- Retire every live card of one kind that is NOT this version (after a prompt change).
create or replace function public.library_retire_old_versions(p_kind text, p_keep_version text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  perform public.require_root();
  update public.ai_library_cards
    set retired_at = now(), retired_reason = 'old version'
    where kind = p_kind and version <> p_keep_version and retired_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.library_retire_old_versions(text, text) from public, anon;
grant execute on function public.library_retire_old_versions(text, text) to authenticated;

-- The Dev Hub list: newest first, waiting-for-review first when asked.
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
revoke all on function public.library_admin_list(text, int, boolean) from public, anon;
grant execute on function public.library_admin_list(text, int, boolean) to authenticated;

-- Counts per kind, plus today's library hits vs. newly written cards.
create or replace function public.library_stats()
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

-- Live cards per bucket of one kind (the root seed run fills the thinnest).
create or replace function public.library_bucket_counts(p_kind text, p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
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
revoke all on function public.library_bucket_counts(text, text) from public, anon;
grant execute on function public.library_bucket_counts(text, text) to authenticated;
