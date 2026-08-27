-- Check calendar window (today + 2 days back) + weekly Read/Do text prune.
-- One Check per sequential day already (user_id, day). New logs also bind to
-- logged_on (calendar date in the user's timezone). Direct client inserts are
-- revoked; record_check is the only write path.

-- 1. logged_on ----------------------------------------------------------------
alter table public.checks
  add column if not exists logged_on date;

update public.checks c
set logged_on = (timezone(coalesce(m.timezone, 'UTC'), c.created_at))::date
from public.me m
where m.id = c.user_id
  and c.logged_on is null;

update public.checks
set logged_on = (timezone('UTC', created_at))::date
where logged_on is null;

alter table public.checks
  alter column logged_on set not null;

create index if not exists checks_user_logged_on_idx
  on public.checks (user_id, logged_on);

comment on column public.checks.logged_on is
  'Calendar date this Check is for, in the user timezone. New logs: one per logged_on via record_check. Historical stacked sequential days may share a date.';

-- 2. Read/Do may be pruned after they roll out of the 7-day keep window.
-- CHECK (btrim <> '') already allows NULL (NULL check is not a failure).
alter table public.checks
  alter column read_text drop not null;

alter table public.checks
  alter column do_text drop not null;

-- 3. Prune Read/Do older than today-6 (7 calendar dates, inclusive).
-- Status (did/skip) is kept forever. Sunday recap's previous Sunday (today-7)
-- may already have text pruned; outcome remains.
create or replace function public.prune_check_texts(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_today date;
  v_keep_from date;
begin
  select coalesce(nullif(btrim(timezone), ''), 'UTC')
    into v_tz
  from public.me
  where id = p_user_id;

  if v_tz is null then
    v_tz := 'UTC';
  end if;

  v_today := (timezone(v_tz, now()))::date;
  v_keep_from := v_today - 6;

  update public.checks
  set read_text = null,
      do_text = null
  where user_id = p_user_id
    and logged_on < v_keep_from
    and (read_text is not null or do_text is not null);
end;
$$;

revoke all on function public.prune_check_texts(uuid) from public, anon, authenticated;

create or replace function public.checks_after_write_prune()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.prune_check_texts(new.user_id);
  return new;
end;
$$;

revoke all on function public.checks_after_write_prune() from public, anon, authenticated;

drop trigger if exists checks_after_write_prune on public.checks;
create trigger checks_after_write_prune
after insert on public.checks
for each row execute function public.checks_after_write_prune();

-- 4. record_check — calendar window + one Check per day ----------------------
create or replace function public.record_check(
  p_day integer,
  p_logged_on date,
  p_read_text text,
  p_do_text text,
  p_source text,
  p_status text
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
  v_row public.checks;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_logged_on is null then
    raise exception 'logged_on_required' using errcode = 'P0010';
  end if;

  if p_day is null or p_day < 1 then
    raise exception 'day_required' using errcode = 'P0011';
  end if;

  if p_read_text is null or btrim(p_read_text) = '' then
    raise exception 'read_required' using errcode = 'P0012';
  end if;

  if p_do_text is null or btrim(p_do_text) = '' then
    raise exception 'do_required' using errcode = 'P0013';
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
    user_id, day, logged_on, read_text, do_text, source, status
  ) values (
    v_uid, v_day, p_logged_on, btrim(p_read_text), btrim(p_do_text), p_source, p_status
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_check(integer, date, text, text, text, text) from public, anon;
grant execute on function public.record_check(integer, date, text, text, text, text) to authenticated;

-- 5. Client writes go through record_check only ------------------------------
drop policy if exists checks_insert_own on public.checks;
drop policy if exists checks_update_own on public.checks;

-- 6. Prune existing rows that already sit outside the keep window -----------
do $$
declare
  r record;
begin
  for r in select id from public.me loop
    perform public.prune_check_texts(r.id);
  end loop;
end;
$$;
