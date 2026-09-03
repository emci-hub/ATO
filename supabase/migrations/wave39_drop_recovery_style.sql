-- Wave 39 — drop me.recovery_style (fully dead column) and remove its RPC param.
--
-- recovery_style was removed from the app on 2026-09-01 ("Eight Quick Taps",
-- CORE_INTAKE_TOTAL 9→8). Nothing reads or writes it anymore: it is absent from
-- the client Me type / IntakePatch / createMe, from every prompt builder, and
-- from every Edge Function. It survived only as a frozen DB column (historical
-- values coalesced by wave24) plus a now-stale privacy-label line.
--
-- Confirmed on production before writing this: the only live references to
-- recovery_style were the column itself, its me_recovery_style_known CHECK
-- (dropped with the column), and complete_signup. No view, trigger, or other
-- function reads it. Existing historical values are discarded — nothing
-- displays them.
--
-- Also removes p_recovery_style from complete_signup (signature 14 → 13 params)
-- and from both its branches, matching the live wave24 definition verbatim
-- otherwise. The client createMe already omits p_recovery_style.

alter table public.me drop column if exists recovery_style;

-- `create or replace` only replaces a function with the SAME signature; the
-- old 14-arg complete_signup (with p_recovery_style) is a different overload,
-- so it must be dropped explicitly before the 13-arg version is created.
drop function if exists public.complete_signup(text, text, text, text, text, text, text, text, date, text, text, text, text, text);

create or replace function public.complete_signup(
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
  -- consume a code, rewrite referred_by, or change born_on. Intake fields may
  -- be null (skipped) or empty; empty strings collapse to null.
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

  if v_code is not null then
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
$$;

revoke execute on function public.complete_signup(text, text, text, text, text, text, text, text, date, text, text, text, text) from public, anon;
grant execute on function public.complete_signup(text, text, text, text, text, text, text, text, date, text, text, text, text) to authenticated;
