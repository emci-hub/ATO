-- wave41: QA override invite code.
--
-- A single always-valid, never-consumed, never-expiring invite code for
-- QA/testing, read from a Postgres database setting (`app.qa_override_invite_code`)
-- rather than a row in `invite_codes`. The actual code value is set once via
-- `ALTER DATABASE ... SET app.qa_override_invite_code = '...'` OUTSIDE this
-- migration (never committed to git, never in the app bundle) — this file only
-- teaches `assert_invite_usable`/`complete_signup` to check for it.
--
-- If the setting is unset, `current_setting(..., true)` returns null and both
-- functions behave exactly as before (idempotent, no-op when unconfigured).

create or replace function public.assert_invite_usable(p_code text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_mode text;
  v_code text;
  v_override text;
begin
  select signup_mode into strict v_mode from public.app_config where id = 1;
  if v_mode = 'public' then
    return true;
  end if;

  v_code := nullif(upper(btrim(coalesce(p_code, ''))), '');
  if v_code is null then
    raise exception 'invite_required' using errcode = 'P0001';
  end if;

  v_override := nullif(upper(btrim(coalesce(current_setting('app.qa_override_invite_code', true), ''))), '');
  if v_override is not null and v_code = v_override then
    return true;
  end if;

  if not exists (
    select 1 from public.invite_codes
    where lower(code) = lower(v_code)
      and status = 'active'
      and (max_uses is null or uses_count < max_uses)
  ) then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;

  return true;
end;
$function$;

create or replace function public.complete_signup(
  p_name text,
  p_handle text,
  p_show_up text,
  p_talk_style text,
  p_knocks_you_off text,
  p_morning_cue text,
  p_timezone text,
  p_invite_code text default null::text,
  p_born_on date default null::date,
  p_evening_wind_down text default null::text,
  p_energy_pattern text default null::text,
  p_support_style text default null::text,
  p_current_focus text default null::text
)
 returns me
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_mode text;
  v_code text;
  v_override text;
  v_owner uuid;
  v_me public.me;
  v_existing boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select exists(select 1 from public.me where id = v_uid) into v_existing;

  if v_existing then
    update public.me set
      name = p_name,
      handle = p_handle,
      show_up = nullif(btrim(p_show_up), ''),
      talk_style = nullif(btrim(p_talk_style), ''),
      knocks_you_off = nullif(btrim(p_knocks_you_off), ''),
      morning_cue = nullif(btrim(p_morning_cue), ''),
      timezone = p_timezone,
      evening_wind_down = nullif(btrim(p_evening_wind_down), ''),
      energy_pattern = p_energy_pattern,
      support_style = p_support_style,
      current_focus = p_current_focus,
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

  v_override := nullif(upper(btrim(coalesce(current_setting('app.qa_override_invite_code', true), ''))), '');

  if v_code is not null and v_override is not null and v_code = v_override then
    -- QA override: always valid, never consumed, no invite_codes row touched.
    v_owner := null;
  elsif v_code is not null then
    update public.invite_codes
    set
      uses_count = uses_count + 1,
      status = case
        when max_uses is not null and uses_count + 1 >= max_uses then 'used'
        else status
      end
    where lower(code) = lower(v_code)
      and status = 'active'
      and (max_uses is null or uses_count < max_uses)
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
    evening_wind_down, energy_pattern, support_style, current_focus
  ) values (
    v_uid, p_name, p_handle,
    nullif(btrim(p_show_up), ''), nullif(btrim(p_talk_style), ''),
    nullif(btrim(p_knocks_you_off), ''), nullif(btrim(p_morning_cue), ''),
    p_timezone,
    v_owner, p_born_on,
    nullif(btrim(p_evening_wind_down), ''), p_energy_pattern, p_support_style, p_current_focus
  )
  returning * into v_me;

  return v_me;
end;
$function$;
