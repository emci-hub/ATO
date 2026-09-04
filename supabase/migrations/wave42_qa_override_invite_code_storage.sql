-- wave42: move the QA override invite code off a Postgres GUC onto a
-- no-policy table.
--
-- wave41 read the override from `current_setting('app.qa_override_invite_code')`,
-- set via `ALTER DATABASE ... SET`. That command is blocked on Supabase's
-- managed hosting (42501: permission denied to set parameter) — the SQL
-- editor role isn't the database owner/superuser. This migration replaces
-- that storage with `public.app_secrets`, a single-row table with RLS
-- enabled and NO policies — same pattern already used by
-- `account_deletions`/`dev_access_grants` in this schema: zero client
-- access (anon/authenticated get nothing, RLS has no permissive policy),
-- readable only from inside SECURITY DEFINER functions running as the
-- table owner, which is exempt from RLS unless FORCE ROW LEVEL SECURITY
-- is set (it is not).
--
-- Deliberately NOT app_config: app_config has `app_config_select_all`,
-- a public-read RLS policy (`qual: true`), so any client — even signed
-- out — can already select every column on it. Storing the code there
-- would have made it fetchable directly from the app.
--
-- The actual code value is set once via a plain UPDATE from the Supabase
-- SQL editor (never committed to git, never in the app bundle):
--   update public.app_secrets set qa_override_invite_code = '...' where id = 1;

create table if not exists public.app_secrets (
  id integer primary key default 1,
  qa_override_invite_code text,
  constraint app_secrets_singleton check (id = 1)
);

insert into public.app_secrets (id) values (1)
on conflict (id) do nothing;

alter table public.app_secrets enable row level security;
-- No policies created on purpose: RLS enabled + zero policies denies all
-- access to every role except the table owner (which SECURITY DEFINER
-- functions run as).

revoke all on public.app_secrets from anon, authenticated;

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

  select nullif(upper(btrim(coalesce(qa_override_invite_code, ''))), '')
    into v_override
    from public.app_secrets where id = 1;

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

  select nullif(upper(btrim(coalesce(qa_override_invite_code, ''))), '')
    into v_override
    from public.app_secrets where id = 1;

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
