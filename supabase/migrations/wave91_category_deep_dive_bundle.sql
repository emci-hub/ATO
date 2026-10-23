-- wave91_category_deep_dive_bundle.sql
-- Category deep dive bundle (emci approved 2026-10-08: "bundle deep dives per call").
--
-- One claimed AI call now writes up to two cards: the category the person
-- tapped, plus their next strongest open category, which the app opens the
-- next day. The claim (claim_category_deep_dive, 1/day) is unchanged; only the
-- save limit on new rows per day becomes cap x 2 so the second card can be
-- stored. Restates save_category_deep_dive from wave90 with that one line
-- changed. No table, row or other function is touched.

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

revoke all on function public.save_category_deep_dive(text, text, jsonb, date) from public, anon;
grant execute on function public.save_category_deep_dive(text, text, jsonb, date) to authenticated;
