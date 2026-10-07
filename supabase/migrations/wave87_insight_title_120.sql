-- wave87_insight_title_120.sql
-- The stored Focus · try · watch bank (emci, 2026-10-07; this cap approved
-- the same day). The daily insight's title is now a stored focus sentence
-- ("When a friend takes a while to text back, you tend to …"), which runs up
-- to 110 characters; wave69 capped the title at 80, written for a short
-- AI-made headline.
--
-- Raises the title cap from 80 to 120 in both places that hold it: the CHECK
-- on daily_insights.title and insert_daily_insight's server-side truncation.
-- No data change: every existing row is <= 80, so it already passes the new
-- CHECK, and nothing is rewritten. The other four caps are unchanged.
--
-- Mirrors INSIGHT_FIELD_CAPS in src/lib/insight/generate-insight.ts;
-- scripts/insight-check.ts reads this file for the title and fails if they
-- drift apart.

alter table public.daily_insights drop constraint if exists daily_insights_title_check;
alter table public.daily_insights
  add constraint daily_insights_title_check
  check (char_length(title) > 0 and char_length(title) <= 120);

-- Same body as wave69 except left(btrim(p_title), 120). A function cannot be
-- patched, so the whole body is restated; grants carry over on replace and are
-- restated below anyway.
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

revoke all on function public.insert_daily_insight(int, date, text, text, text, text, text)
  from public, anon;
grant execute on function public.insert_daily_insight(int, date, text, text, text, text, text)
  to authenticated;
