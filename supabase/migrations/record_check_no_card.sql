-- Honest-empty Today: a consent-off account past day 3 has no Read/Do. Did/Skip
-- still logs a Check. The write path is an explicit p_no_card flag, not blank
-- strings — a real card still requires non-empty read and do.

drop function if exists public.record_check(integer, date, text, text, text, text, text);
drop function if exists public.record_check(integer, date, text, text, text, text, text, boolean);

create function public.record_check(
  p_day integer,
  p_logged_on date,
  p_read_text text,
  p_do_text text,
  p_source text,
  p_status text,
  p_nudge_text text default null,
  p_no_card boolean default false
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
  v_read text;
  v_do text;
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

  if coalesce(p_no_card, false) then
    v_read := null;
    v_do := null;
    v_nudge := null;
  else
    if p_read_text is null or btrim(p_read_text) = '' then
      raise exception 'read_required' using errcode = 'P0012';
    end if;

    if p_do_text is null or btrim(p_do_text) = '' then
      raise exception 'do_required' using errcode = 'P0013';
    end if;

    v_read := btrim(p_read_text);
    v_do := btrim(p_do_text);
    v_nudge := nullif(btrim(coalesce(p_nudge_text, '')), '');
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
    user_id, day, logged_on, read_text, do_text, nudge_text, source, status
  ) values (
    v_uid, v_day, p_logged_on, v_read, v_do, v_nudge, p_source, p_status
  )
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.record_check(integer, date, text, text, text, text, text, boolean) is
  'Sole Check write path. p_no_card true stores null Read/Do for the honest-empty Today. A real card still requires non-empty read and do.';

revoke all on function public.record_check(integer, date, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.record_check(integer, date, text, text, text, text, text, boolean) to authenticated;
