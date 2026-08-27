-- Wave 1.5 Stage 9 — Intake core.
-- Five net-new self-report columns on ME. Existing talk_style / show_up /
-- knocks_you_off / morning_cue names and types are unchanged.
-- These are answers the person tapped, never a diagnosis or assessment.
-- Public surfaces must not show energy_pattern / recovery_style /
-- support_style / current_focus (same rule as the poster showing a color,
-- not raw answers).

-- 1. Columns -----------------------------------------------------------------
alter table public.me
  add column if not exists evening_wind_down text,
  add column if not exists energy_pattern text,
  add column if not exists recovery_style text,
  add column if not exists support_style text,
  add column if not exists current_focus text;

alter table public.me drop constraint if exists me_evening_wind_down_present;
alter table public.me
  add constraint me_evening_wind_down_present
  check (evening_wind_down is null or btrim(evening_wind_down) <> '');

alter table public.me drop constraint if exists me_energy_pattern_known;
alter table public.me
  add constraint me_energy_pattern_known
  check (
    energy_pattern is null
    or energy_pattern = any (array['morning', 'afternoon', 'evening', 'night_owl']::text[])
  );

alter table public.me drop constraint if exists me_recovery_style_known;
alter table public.me
  add constraint me_recovery_style_known
  check (
    recovery_style is null
    or recovery_style = any (array['movement', 'sleep', 'talking', 'alone_time', 'music']::text[])
  );

alter table public.me drop constraint if exists me_support_style_known;
alter table public.me
  add constraint me_support_style_known
  check (
    support_style is null
    or support_style = any (array['nudge', 'space', 'listen', 'plan']::text[])
  );

alter table public.me drop constraint if exists me_current_focus_known;
alter table public.me
  add constraint me_current_focus_known
  check (
    current_focus is null
    or current_focus = any (array['habit', 'through_it', 'like_yourself', 'show_up']::text[])
  );

comment on column public.me.evening_wind_down is
  'Self-report chip phrase. Times the evening Check push. Nullable on pre-intake rows.';
comment on column public.me.energy_pattern is
  'Self-report: morning / afternoon / evening / night_owl. Not a diagnosis. Nullable on pre-intake rows.';
comment on column public.me.recovery_style is
  'Self-report: movement / sleep / talking / alone_time / music. Not a diagnosis. Nullable on pre-intake rows.';
comment on column public.me.support_style is
  'Self-report: nudge / space / listen / plan. Not a diagnosis. Nullable on pre-intake rows.';
comment on column public.me.current_focus is
  'Self-report: habit / through_it / like_yourself / show_up. Not a diagnosis. Nullable on pre-intake rows.';

-- 2. complete_signup — require the 5 new fields on INSERT only ---------------
drop function if exists public.complete_signup(text, text, text, text, text, text, text, text, date);

create function public.complete_signup(
  p_name text,
  p_handle text,
  p_show_up text,
  p_talk_style text,
  p_knocks_you_off text,
  p_morning_cue text,
  p_timezone text,
  p_invite_code text default null,
  p_born_on date default null,
  p_evening_wind_down text default null,
  p_energy_pattern text default null,
  p_recovery_style text default null,
  p_support_style text default null,
  p_current_focus text default null
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
      evening_wind_down = coalesce(nullif(btrim(p_evening_wind_down), ''), evening_wind_down),
      energy_pattern = coalesce(p_energy_pattern, energy_pattern),
      recovery_style = coalesce(p_recovery_style, recovery_style),
      support_style = coalesce(p_support_style, support_style),
      current_focus = coalesce(p_current_focus, current_focus),
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

  if p_evening_wind_down is null or btrim(p_evening_wind_down) = ''
     or p_energy_pattern is null
     or p_recovery_style is null
     or p_support_style is null
     or p_current_focus is null then
    raise exception 'intake_required' using errcode = 'P0006';
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
    id, name, handle, show_up, talk_style, knocks_you_off, morning_cue, timezone,
    referred_by, born_on,
    evening_wind_down, energy_pattern, recovery_style, support_style, current_focus
  ) values (
    v_uid, p_name, p_handle, p_show_up, p_talk_style, p_knocks_you_off, p_morning_cue, p_timezone,
    v_owner, p_born_on,
    btrim(p_evening_wind_down), p_energy_pattern, p_recovery_style, p_support_style, p_current_focus
  )
  returning * into v_me;

  return v_me;
end;
$$;

revoke execute on function public.complete_signup(text, text, text, text, text, text, text, text, date, text, text, text, text, text) from public, anon;
grant execute on function public.complete_signup(text, text, text, text, text, text, text, text, date, text, text, text, text, text) to authenticated;
