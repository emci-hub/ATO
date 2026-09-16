-- wave69_daily_insights.sql
-- The daily insight that replaces the Read/Do card and Dawn
-- (Home/Explore/Insight restructure, T-H1).
--
-- NOT APPLIED YET — awaiting emci's review, same as wave68.
--
-- Why a new table rather than more columns on `checks`: `record_check` stays
-- the only write path for a Check (CLAUDE.md hard invariant) and `checks` is
-- the Check ledger — a did/skip outcome with a 7-day text window. A five-field
-- editorial insight is not a Check: it is generated before any outcome exists,
-- it can be superseded without touching the Check, and it must survive past the
-- Check text window. Overloading `checks` would force `record_check` to become
-- a generation path, which the invariant exists to prevent.
--
-- superseded_at mirrors category_statements' (wave59) archive mechanic, so a
-- paid reroll can land later without a second migration. The partial unique
-- index is what makes "one live insight per user per day" a database fact
-- rather than a client convention.
--
-- Field caps mirror src/lib/insight/generate-insight.ts's INSIGHT_FIELD_CAPS.
-- If either side changes, scripts/insight-check.ts fails — that check parses
-- these CHECK constraints and compares them to the caps in the TypeScript.

create table public.daily_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day int not null check (day >= 1),
  ymd date not null,
  theme text not null check (char_length(theme) > 0 and char_length(theme) <= 60),
  title text not null check (char_length(title) > 0 and char_length(title) <= 80),
  reflection text not null check (char_length(reflection) > 0 and char_length(reflection) <= 400),
  try_today text not null check (char_length(try_today) > 0 and char_length(try_today) <= 200),
  watch_for text not null check (char_length(watch_for) > 0 and char_length(watch_for) <= 200),
  created_at timestamptz not null default now(),
  superseded_at timestamptz
);

-- One live insight per user per day. Superseded rows are exempt, so history
-- accumulates freely underneath the constraint.
create unique index daily_insights_user_ymd_current_idx
  on public.daily_insights (user_id, ymd)
  where superseded_at is null;

create index daily_insights_user_created_idx
  on public.daily_insights (user_id, created_at desc);

comment on table public.daily_insights is
  'Daily five-field insight (theme/title/reflection/try_today/watch_for) shown on Home. Replaces the Read/Do card and Dawn. superseded_at set when replaced; null = the live one for that ymd. Never peer-visible — there is deliberately no peer view, unlike checks.read_text.';

alter table public.daily_insights enable row level security;

-- Owner-only read. No insert/update/delete policy: every write goes through
-- insert_daily_insight below, the same shape wave59 uses, so the supersede
-- step and the insert can never come apart.
create policy daily_insights_select_own on public.daily_insights
  for select using (auth.uid() = user_id);

-- Supersedes the current row for this (user, ymd), then inserts the new one.
-- All-or-nothing per call. Writes only ever touch auth.uid()'s own rows, so
-- there is no cross-user path even if called directly.
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
    left(btrim(p_title), 80),
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

-- Note on p_ymd / p_day: both are client-supplied, unlike record_check's
-- server-derived window. The client owns the user's timezone, so it is the
-- only side that knows which local day "today" is. The blast radius is bounded
-- to the caller's own rows by auth.uid(), and nothing here spends quota, so a
-- user backdating their own insight only reorders their own history. Flagged
-- for emci during review rather than guarded, because a server-side date bound
-- would have to be loose enough (±1 day) to survive UTC-14..UTC+14 skew that
-- it would not actually prevent the thing it looks like it prevents.

-- Every new user-scoped table has to join the two hardcoded lists that track
-- them, or account deletion silently under-reports and the dev reset leaves
-- rows behind. The FK cascade below already removes daily_insights rows on
-- delete; what is missing without this is the *proof* that it did.

-- 1. count_user_rows() — delete-account's in-band audit
--    (supabase/functions/delete-account/index.ts step 5). Full body replaced
--    from wave67 with daily_insights added; a function cannot be patched.
create or replace function public.count_user_rows(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.me where id = p_user_id)
  + (select count(*) from public.checks where user_id = p_user_id)
  + (select count(*) from public.crisis_flags where user_id = p_user_id)
  + (select count(*) from public.connections where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.messages where sender_id = p_user_id)
  + (select count(*) from public.threads where user_a = p_user_id or user_b = p_user_id)
  + (select count(*) from public.blocks where blocked_by = p_user_id or blocked_user = p_user_id)
  + (select count(*) from public.mutes where muter = p_user_id or muted_user = p_user_id)
  + (select count(*) from public.reports where "from" = p_user_id or user_id = p_user_id)
  + (select count(*) from public.sage_messages where user_id = p_user_id)
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
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;

-- 2. reset_dev_test_user() — full body replaced from wave66 with
--    daily_insights added. Gate and table list are otherwise byte-identical.
create or replace function public.reset_dev_test_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dev_id constant uuid := 'a70d3e0e-4c00-4a1e-8c0d-00000000d3e0';
begin
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
  delete from public.sage_messages where user_id = v_dev_id;
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

  -- Last: deleting me cascades dev_access_grants, dev_trace_sessions,
  -- dev_trace_events (dev_access.sql, references public.me(id)) and
  -- invite_codes.owner_id (stage8_invite_referral.sql, same). auth.users
  -- itself is untouched, so the session stays signed in — MeContext.refresh()
  -- then sees no me row and the app's own guard routes into onboarding.
  delete from public.me where id = v_dev_id;
end;
$$;

revoke execute on function public.reset_dev_test_user() from public, anon;
grant execute on function public.reset_dev_test_user() to authenticated;
