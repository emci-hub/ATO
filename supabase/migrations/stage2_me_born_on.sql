-- Stage 2 addition — self-reported date of birth on ME.
-- Applied to the `ato` Supabase project (aijzsmupaaaxjctfgwpl).
--
-- Store a calendar date, not a frozen age or 16+/18+ boolean, so both
-- thresholds can be recomputed later (app floor now; Wave 2 "going" later)
-- without a schema change. Column is nullable only so existing ME rows
-- survive the add; new signups must pass a date through complete_signup.

-- 1. Column -----------------------------------------------------------------
alter table public.me
  add column if not exists born_on date;

alter table public.me
  drop constraint if exists me_born_on_plausible;

alter table public.me
  add constraint me_born_on_plausible
  check (born_on is null or born_on >= date '1900-01-01');

comment on column public.me.born_on is
  'Self-reported date of birth. Age is computed from this, never stored as a number or boolean. 16+ required at signup; 18+ for Wave 2 going. Nullable only for accounts created before this column.';

-- 2. Age helpers — Wave 2 "going" reads these, not a baked flag --------------
create or replace function public.age_years(p_born_on date)
returns integer
language sql
stable
set search_path = public
as $$
  select case
    when p_born_on is null then null
    else extract(year from age(current_date, p_born_on))::int
  end;
$$;

create or replace function public.is_at_least_age(p_born_on date, p_years integer)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_born_on is not null
     and p_years is not null
     and p_years >= 0
     and p_born_on <= (current_date - make_interval(years => p_years));
$$;

comment on function public.age_years(date) is
  'Whole years since born_on as of current_date. Null in, null out.';

comment on function public.is_at_least_age(date, integer) is
  'True when born_on is on or before current_date minus p_years. Fail-closed on null. 16 = app floor, 18 = Wave 2 going.';

revoke execute on function public.age_years(date) from public, anon;
grant execute on function public.age_years(date) to authenticated;

revoke execute on function public.is_at_least_age(date, integer) from public, anon;
grant execute on function public.is_at_least_age(date, integer) to authenticated;

-- 3. Once set, born_on cannot be edited (stops a 16-year-old rewriting to 18)
create or replace function public.me_born_on_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.born_on is not null and new.born_on is distinct from old.born_on then
    raise exception 'born_on_locked' using errcode = 'P0006';
  end if;

  if tg_op = 'INSERT' then
    if new.born_on is null then
      raise exception 'age_required' using errcode = 'P0003';
    end if;
    if new.born_on > current_date or new.born_on < date '1900-01-01' then
      raise exception 'age_invalid' using errcode = 'P0004';
    end if;
    if not public.is_at_least_age(new.born_on, 16) then
      raise exception 'age_under_16' using errcode = 'P0005';
    end if;
  end if;

  -- Filling a legacy NULL is allowed once, and must still clear 16+.
  if tg_op = 'UPDATE' and old.born_on is null and new.born_on is not null then
    if new.born_on > current_date or new.born_on < date '1900-01-01' then
      raise exception 'age_invalid' using errcode = 'P0004';
    end if;
    if not public.is_at_least_age(new.born_on, 16) then
      raise exception 'age_under_16' using errcode = 'P0005';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists me_born_on_guard on public.me;
create trigger me_born_on_guard
  before insert or update on public.me
  for each row execute function public.me_born_on_guard();

revoke execute on function public.me_born_on_guard() from public, anon, authenticated;

-- 4. complete_signup — require born_on on new rows, check 16+ BEFORE consume
drop function if exists public.complete_signup(text, text, text, text, text, text, text, text);

create function public.complete_signup(
  p_name text,
  p_handle text,
  p_show_up text,
  p_talk_style text,
  p_knocks_you_off text,
  p_morning_cue text,
  p_timezone text,
  p_invite_code text default null,
  p_born_on date default null
)
returns public.me
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mode text;
  v_code text;
  v_owner uuid;
  v_me public.me;
  v_existing boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select exists(select 1 from public.me where id = v_uid) into v_existing;

  -- Re-save of an already-onboarded row: update profile fields only, never
  -- consume a code, rewrite referred_by, or change born_on.
  if v_existing then
    update public.me set
      name = p_name,
      handle = p_handle,
      show_up = p_show_up,
      talk_style = p_talk_style,
      knocks_you_off = p_knocks_you_off,
      morning_cue = p_morning_cue,
      timezone = p_timezone,
      updated_at = now()
    where id = v_uid
    returning * into v_me;
    return v_me;
  end if;

  if p_born_on is null then
    raise exception 'age_required' using errcode = 'P0003';
  end if;
  if p_born_on > current_date or p_born_on < date '1900-01-01' then
    raise exception 'age_invalid' using errcode = 'P0004';
  end if;
  if not public.is_at_least_age(p_born_on, 16) then
    raise exception 'age_under_16' using errcode = 'P0005';
  end if;

  select signup_mode into strict v_mode from public.app_config where id = 1;
  v_code := nullif(upper(btrim(coalesce(p_invite_code, ''))), '');

  if v_mode = 'invite_only' then
    if v_code is null then
      raise exception 'invite_required' using errcode = 'P0001';
    end if;
  end if;

  if v_code is not null then
    update public.invite_codes
    set
      uses_count = uses_count + 1,
      status = case
        when uses_count + 1 >= max_uses then 'used'
        else status
      end
    where lower(code) = lower(v_code)
      and status = 'active'
      and uses_count < max_uses
    returning owner_id into v_owner;

    if v_owner is null then
      if v_mode = 'invite_only' then
        raise exception 'invite_invalid' using errcode = 'P0002';
      end if;
    elsif v_owner = v_uid then
      raise exception 'invite_invalid' using errcode = 'P0002';
    end if;
  end if;

  perform set_config('ato.completing_signup', '1', true);

  insert into public.me (
    id, name, handle, show_up, talk_style, knocks_you_off, morning_cue, timezone, referred_by, born_on
  ) values (
    v_uid, p_name, p_handle, p_show_up, p_talk_style, p_knocks_you_off, p_morning_cue, p_timezone, v_owner, p_born_on
  )
  returning * into v_me;

  return v_me;
end;
$$;

revoke execute on function public.complete_signup(text, text, text, text, text, text, text, text, date) from public, anon;
grant execute on function public.complete_signup(text, text, text, text, text, text, text, text, date) to authenticated;
