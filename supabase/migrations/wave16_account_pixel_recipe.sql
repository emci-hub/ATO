-- Stable per-account Kenney recipe at signup. One of 6 shape-family looks
-- (body + face; hands hidden at rest). Color still comes from show_up at render.
-- Hash: first 8 hex digits of the uuid, matching accountRecipeIndex() in TS.

create or replace function public.recipe_from_account_id(p_id uuid)
returns jsonb
language sql
immutable
parallel safe
as $$
  select (array[
    '{"source":"shape","parts":{"body":"circle","face":"even","hand":"hidden"},"palette":null}'::jsonb,
    '{"source":"shape","parts":{"body":"rhombus","face":"tired","hand":"hidden"},"palette":null}'::jsonb,
    '{"source":"shape","parts":{"body":"square","face":"set","hand":"hidden"},"palette":null}'::jsonb,
    '{"source":"shape","parts":{"body":"squircle","face":"listen","hand":"hidden"},"palette":null}'::jsonb,
    '{"source":"shape","parts":{"body":"circle","face":"glow","hand":"hidden"},"palette":null}'::jsonb,
    '{"source":"shape","parts":{"body":"rhombus","face":"set","hand":"hidden"},"palette":null}'::jsonb
  ])[
    (('x' || substr(replace(p_id::text, '-', ''), 1, 8))::bit(32)::bigint % 6)::int + 1
  ];
$$;

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
    evening_wind_down, energy_pattern, recovery_style, support_style, current_focus,
    recipe
  ) values (
    v_uid, p_name, p_handle, p_show_up, p_talk_style, p_knocks_you_off, p_morning_cue, p_timezone,
    v_owner, p_born_on,
    btrim(p_evening_wind_down), p_energy_pattern, p_recovery_style, p_support_style, p_current_focus,
    public.recipe_from_account_id(v_uid)
  )
  returning * into v_me;

  return v_me;
end;
$$;

update public.me
set recipe = public.recipe_from_account_id(id)
where recipe is null
   or (
     coalesce(recipe->>'source', 'shape') = 'shape'
     and coalesce(recipe->>'base', recipe->'parts'->>'body', 'circle') = 'circle'
     and coalesce(recipe->>'top', recipe->'parts'->>'face', 'even') in ('even', 'face_a')
   );
