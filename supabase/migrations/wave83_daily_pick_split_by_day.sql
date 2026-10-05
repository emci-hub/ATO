-- wave83_daily_pick_split_by_day.sql
--
-- APPLIED 2026-10-05 to the live project (by the agent, through the Supabase
-- connector), right after wave82.
--
-- Follow-up to wave82 (same day, from review), touching only what wave82
-- created:
--
-- 1. daily_pick_split now covers ONE day (the day the caller answered) and
--    returns shares rounded to 5%, never raw counts. Before: totals over every
--    cycle of a pick, as exact counts — in a small group, comparing the split
--    just before and after a friend's tap could show what they picked.
-- 2. Three answer texts reworded (emci's draft read still to come):
--    p14 "It suits them" → "Something kind and true", p46 "Texting the crew"
--    → "Texting everyone", p63 "Hard pass" → "No thanks". The values (which
--    end of the trait) are unchanged, so no saved answer changes meaning.
--
-- No user data is altered or deleted.

update public.daily_pick_pool
  set options = '[{"text":"The honest answer","value":0.2},{"text":"Something kind and true","value":0.8}]'::jsonb
  where id = 'p14';
update public.daily_pick_pool
  set options = '[{"text":"A day to myself","value":0.2},{"text":"Texting everyone","value":0.8}]'::jsonb
  where id = 'p46';
update public.daily_pick_pool
  set options = '[{"text":"Obviously yes","value":0.8},{"text":"No thanks","value":0.2}]'::jsonb
  where id = 'p63';

drop function public.daily_pick_split(text);

create function public.daily_pick_split(p_pick_id text, p_ymd date)
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

revoke all on function public.daily_pick_split(text, date) from public, anon;
grant execute on function public.daily_pick_split(text, date) to authenticated;
