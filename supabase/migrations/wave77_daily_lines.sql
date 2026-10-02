-- wave77_daily_lines.sql
--
-- APPLIED 2026-10-02 to the live project (by the agent, through the Supabase
-- connector; emci lifted the ask-first rule for schema that copies a tested
-- path). Verified after: RLS on both tables, 2 policies, 4 definer functions,
-- no anon access, no direct insert/update/delete for signed-in users.
--
-- Daily lines, stored the way the question pool is stored (wave49 + wave74):
--
--   daily_line_pool  — the lines themselves. `authored` rows are shared with
--                      every signed-in user; `ai` rows belong to the account
--                      that generated them and are visible only to it. Same
--                      select rule as question_bank_pool after wave74.
--   daily_line_days  — one row per user per local day: which line that day
--                      got and the "That's me / Not me" tap. This is what lets
--                      the no-repeat window and the reactions survive a
--                      reinstall and follow the account to a second phone.
--
-- Everything is additive. No existing table, function or row is touched.
-- Account deletion needs nothing extra: daily_line_days cascades with
-- auth.users, and an AI pool row's owner is set null (the row then matches
-- nobody's select rule), exactly as question_bank_pool rows do.
--
-- Lines are identified across the app by `line_key`: a short hash of the
-- line's text (src/lib/daily-line/bank.ts `fnv1a`), not by the pool row's
-- uuid. The app ships the authored bank inside the bundle, so a line has to
-- have the same identity whether it was read from the bundle or from here.
--
-- The client keeps working if this is not applied: every call below is
-- best-effort and the phone's own copy is used instead.

-- 1. The pool ----------------------------------------------------------------

create table public.daily_line_pool (
  id uuid primary key default gen_random_uuid(),
  -- 'starter', 'openness:high', or 'openness:high+autonomy:high'.
  lean_key text not null
    check (lean_key ~ '^(starter|[a-z_]+:(high|low)(\+[a-z_]+:(high|low))?)$' and char_length(lean_key) <= 80),
  line text not null check (char_length(line) between 1 and 160),
  source text not null check (source in ('authored', 'ai')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Uniqueness is per owner, not global. A global unique on `line` would let one
-- account's private AI line block another account from saving the same words
-- (and tell the second account that someone already had them). An authored
-- line is unique among authored lines; an AI line is unique for its owner.
create unique index daily_line_pool_authored_line_idx on public.daily_line_pool (line)
  where source = 'authored';
create unique index daily_line_pool_ai_owner_line_idx on public.daily_line_pool (created_by, line)
  where source = 'ai';

create index daily_line_pool_lean_idx on public.daily_line_pool (lean_key);
create index daily_line_pool_created_by_idx on public.daily_line_pool (created_by)
  where created_by is not null;

alter table public.daily_line_pool enable row level security;

create policy daily_line_pool_select_auth on public.daily_line_pool
  for select to authenticated
  using (source = 'authored' or created_by = auth.uid());

grant select on public.daily_line_pool to authenticated;
revoke insert, update, delete on public.daily_line_pool from public, anon, authenticated;
-- New tables start with the project's default grants, which include anon.
revoke all on public.daily_line_pool from anon;

-- 2. One row per user per day -------------------------------------------------

create table public.daily_line_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  ymd date not null,
  line_key text not null check (line_key ~ '^[a-z0-9]{1,16}$'),
  reaction text check (reaction in ('me', 'not_me')),
  created_at timestamptz not null default now(),
  primary key (user_id, ymd)
);

alter table public.daily_line_days enable row level security;

create policy daily_line_days_select_own on public.daily_line_days
  for select to authenticated
  using (auth.uid() = user_id);

grant select on public.daily_line_days to authenticated;
revoke insert, update, delete on public.daily_line_days from public, anon, authenticated;
revoke all on public.daily_line_days from anon;

-- 3. AI lines join the pool as owner-only rows --------------------------------
-- Copy of insert_bank_pool_items (wave74): caller-owned, capped per call,
-- text trimmed and length-capped here rather than trusted from the client.
-- Adds a per-account ceiling the question version does not have, so one
-- account cannot grow the table without bound.

create function public.insert_daily_line_pool_items(p_items jsonb)
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

-- 4. Record the day's line ----------------------------------------------------
-- First write of the day wins and is returned, so two phones on one account
-- end up showing the same line. Only today or a day either side of it (the
-- server does not know the caller's timezone) can be written.

create function public.record_daily_line(p_ymd date, p_line_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  stored text;
begin
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

revoke all on function public.record_daily_line(date, text) from public, anon;
grant execute on function public.record_daily_line(date, text) to authenticated;

-- 5. The reaction tap ---------------------------------------------------------
-- null clears it. Only a day that already has a recorded line can be reacted to.

create function public.react_daily_line(p_ymd date, p_reaction text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  touched integer;
begin
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

revoke all on function public.react_daily_line(date, text) from public, anon;
grant execute on function public.react_daily_line(date, text) to authenticated;

-- 6. Dev reset: clear the caller's own line history ---------------------------
-- Own rows only. Kept separate from start_over_my_test_data (wave76) so that
-- function is not redefined here.

create function public.clear_my_daily_lines()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  removed integer;
begin
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
