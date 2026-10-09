-- wave95_ai_library_key_regex.sql
-- Fix (found on the first live fill run, 2026-10-09): Postgres regexes allow a
-- repeat count of at most 255, so the bucket-key pattern '{3,300}' in wave93/94
-- raised "invalid repetition count(s)" the first time it ran, and every card
-- save, serve, claim and look-ahead failed. Same functions and constraints with
-- '{3,255}' (the longest real key is ~170 characters). Nothing else changes;
-- the tables were still empty.

begin;

alter table public.ai_library_cards drop constraint if exists ai_library_cards_bucket_key_check;
alter table public.ai_library_cards add constraint ai_library_cards_bucket_key_check
  check (bucket_key ~ '^[a-z0-9_|:=+,.!-]{3,255}$');
alter table public.ai_library_wanted drop constraint if exists ai_library_wanted_bucket_key_check;
alter table public.ai_library_wanted add constraint ai_library_wanted_bucket_key_check
  check (bucket_key ~ '^[a-z0-9_|:=+,.!-]{3,255}$');

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

revoke all on function public.library_serve(text, text, text) from public, anon;
grant execute on function public.library_serve(text, text, text) to authenticated;

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

revoke all on function public.claim_library_write(text, text, text, text) from public, anon;
grant execute on function public.claim_library_write(text, text, text, text) to authenticated;

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
     or p_bucket is null or p_bucket !~ '^[a-z0-9_|:=+,.!-]{3,255}$'
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

revoke all on function public.library_want(text, text[], text) from public, anon;
grant execute on function public.library_want(text, text[], text) to authenticated;

commit;
