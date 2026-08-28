-- Founder codes + access requests.
-- Applied to the `ato` Supabase project (aijzsmupaaaxjctfgwpl).
--
-- Design notes:
--  * is_founder is cosmetic on You. Clients cannot flip it. Root (SQL editor /
--    service_role) can. Flipping true issues one unlimited invite code.
--  * max_uses NULL = unlimited. Consume never marks those rows used.
--  * Access-request inserts are public (email only). Review is /dev-lab via
--    RPCs gated to handle emci (root). Approve emails go out from the
--    review-access Edge Function (Resend, same from-address as OTP).

-- 1. me.is_founder -----------------------------------------------------------
alter table public.me
  add column is_founder boolean not null default false;

comment on column public.me.is_founder is
  'Cosmetic Founder badge on You. Default false. Flipped by root only — not Dev/Admin, no extra app access.';

create or replace function public.me_invite_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('ato.completing_signup', true) = '1' then
    new.is_founder := false;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.referred_by := old.referred_by;
    if coalesce(auth.role(), '') in ('authenticated', 'anon') then
      new.is_founder := old.is_founder;
    end if;
    return new;
  end if;

  if coalesce(auth.role(), '') = 'authenticated' then
    new.referred_by := null;
    new.is_founder := false;
    if (select signup_mode from public.app_config where id = 1) = 'invite_only' then
      raise exception 'invite_required' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- 2. unlimited max_uses ------------------------------------------------------
alter table public.invite_codes drop constraint invite_codes_max_uses_check;
alter table public.invite_codes drop constraint invite_codes_check;
alter table public.invite_codes alter column max_uses drop not null;
alter table public.invite_codes
  add constraint invite_codes_max_uses_check
  check (max_uses is null or max_uses >= 1);
alter table public.invite_codes
  add constraint invite_codes_uses_within_max
  check (max_uses is null or uses_count <= max_uses);

comment on column public.invite_codes.max_uses is
  'NULL means unlimited uses. Founder codes use NULL. Default allotment stays 1.';

create unique index invite_codes_one_unlimited_per_owner
  on public.invite_codes (owner_id)
  where max_uses is null;

create or replace function public.issue_one_invite_code(p_owner uuid, p_max_uses int default 1)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
  v_tries int;
  v_existing text;
begin
  if p_max_uses is not null and p_max_uses < 1 then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;

  if p_max_uses is null then
    select code into v_existing
    from public.invite_codes
    where owner_id = p_owner and max_uses is null
    limit 1;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  v_tries := 0;
  loop
    v_code := upper(encode(gen_random_bytes(5), 'hex'));
    begin
      insert into public.invite_codes (code, owner_id, max_uses, uses_count, status)
      values (v_code, p_owner, p_max_uses, 0, 'active');
      return v_code;
    exception when unique_violation then
      if p_max_uses is null then
        select code into v_existing
        from public.invite_codes
        where owner_id = p_owner and max_uses is null
        limit 1;
        if v_existing is not null then
          return v_existing;
        end if;
      end if;
      v_tries := v_tries + 1;
      if v_tries > 8 then raise; end if;
    end;
  end loop;
end;
$$;

revoke execute on function public.issue_one_invite_code(uuid, int) from public, anon, authenticated;
grant execute on function public.issue_one_invite_code(uuid, int) to service_role;

create function public.me_issue_founder_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_founder and (tg_op = 'INSERT' or old.is_founder is distinct from true) then
    perform public.issue_one_invite_code(new.id, null);
  end if;
  return new;
end;
$$;

create trigger me_issue_founder_code
  after insert or update of is_founder on public.me
  for each row execute function public.me_issue_founder_code();

revoke execute on function public.me_issue_founder_code() from public, anon, authenticated;

-- 3. consume / peek honor unlimited ------------------------------------------
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

create or replace function public.assert_invite_usable(p_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_code text;
begin
  select signup_mode into strict v_mode from public.app_config where id = 1;
  if v_mode = 'public' then
    return true;
  end if;

  v_code := nullif(upper(btrim(coalesce(p_code, ''))), '');
  if v_code is null then
    raise exception 'invite_required' using errcode = 'P0001';
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
$$;

-- 4. access_requests ---------------------------------------------------------
create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  requested_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied')),
  reviewed_at timestamptz,
  invite_code text references public.invite_codes(code) on delete set null
);

create unique index access_requests_email_lower_idx
  on public.access_requests (lower(email));

create index access_requests_pending_idx
  on public.access_requests (requested_at)
  where status = 'pending';

alter table public.access_requests enable row level security;

create policy access_requests_insert_public on public.access_requests
  for insert to anon, authenticated
  with check (true);

comment on table public.access_requests is
  'Landing-page invite requests. Anon can insert an email. Review is root-only via RPCs + review-access.';

create function public.access_requests_normalize()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(btrim(coalesce(new.email, '')));
  if new.email = '' or char_length(new.email) > 320
     or new.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'email_invalid' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.reviewed_at := null;
    new.invite_code := null;
  end if;
  return new;
end;
$$;

create trigger access_requests_normalize
  before insert or update of email on public.access_requests
  for each row execute function public.access_requests_normalize();

revoke execute on function public.access_requests_normalize() from public, anon, authenticated;

create function public.require_root()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select m.id into v_id
  from public.me m
  where m.id = auth.uid() and m.handle = 'emci';
  if v_id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

revoke execute on function public.require_root() from public, anon;
grant execute on function public.require_root() to authenticated;

create function public.list_pending_access_requests()
returns table (
  id uuid,
  email text,
  requested_at timestamptz,
  status text,
  reviewed_at timestamptz,
  invite_code text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_root();
  return query
    select r.id, r.email, r.requested_at, r.status, r.reviewed_at, r.invite_code
    from public.access_requests r
    where r.status = 'pending'
    order by r.requested_at;
end;
$$;

revoke execute on function public.list_pending_access_requests() from public, anon;
grant execute on function public.list_pending_access_requests() to authenticated;

create function public.deny_access_request(p_id uuid)
returns public.access_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.access_requests;
begin
  perform public.require_root();
  update public.access_requests
  set status = 'denied', reviewed_at = now(), invite_code = null
  where id = p_id and status = 'pending'
  returning * into v_row;
  if v_row.id is null then
    raise exception 'request_not_pending' using errcode = 'P0008';
  end if;
  return v_row;
end;
$$;

revoke execute on function public.deny_access_request(uuid) from public, anon;
grant execute on function public.deny_access_request(uuid) to authenticated;

create function public.approve_access_request(p_id uuid)
returns table (id uuid, email text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_root uuid;
  v_email text;
  v_code text;
begin
  v_root := public.require_root();

  select r.email into v_email
  from public.access_requests r
  where r.id = p_id and r.status = 'pending'
  for update;
  if v_email is null then
    raise exception 'request_not_pending' using errcode = 'P0008';
  end if;

  v_code := public.issue_one_invite_code(v_root, 1);

  update public.access_requests
  set status = 'approved', reviewed_at = now(), invite_code = v_code
  where access_requests.id = p_id;

  return query select p_id, v_email, v_code;
end;
$$;

revoke execute on function public.approve_access_request(uuid) from public, anon;
grant execute on function public.approve_access_request(uuid) to authenticated;

grant insert on table public.access_requests to anon, authenticated;

-- 5. seed root as founder (issues the unlimited code) ------------------------
update public.me set is_founder = true where handle = 'emci' and is_founder is not true;
