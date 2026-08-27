-- Home-only Nudge (internal: zGlitch). Nullable text on checks.
-- Pruned with Read/Do after the 7-day keep window. Never written to the widget.

alter table public.checks
  add column if not exists nudge_text text;

alter table public.checks
  drop constraint if exists checks_nudge_text_check;

alter table public.checks
  add constraint checks_nudge_text_check
  check (nudge_text is null or btrim(nudge_text) <> '');

comment on column public.checks.nudge_text is
  'Home-only Nudge (internal zGlitch). Encouragement from a real recent signal. Null when empty or pruned.';

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
      do_text = null,
      nudge_text = null
  where user_id = p_user_id
    and logged_on < v_keep_from
    and (read_text is not null or do_text is not null or nudge_text is not null);
end;
$$;

revoke all on function public.prune_check_texts(uuid) from public, anon, authenticated;

drop function if exists public.record_check(integer, date, text, text, text, text);

create or replace function public.record_check(
  p_day integer,
  p_logged_on date,
  p_read_text text,
  p_do_text text,
  p_source text,
  p_status text,
  p_nudge_text text default null
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

  v_nudge := nullif(btrim(coalesce(p_nudge_text, '')), '');

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
    v_uid, v_day, p_logged_on, btrim(p_read_text), btrim(p_do_text), v_nudge, p_source, p_status
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_check(integer, date, text, text, text, text, text) from public, anon;
grant execute on function public.record_check(integer, date, text, text, text, text, text) to authenticated;
