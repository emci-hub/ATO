-- Optional password on an existing Auth user (set from Settings after OTP/Apple).
-- No ME columns. Hashes stay in auth.users.encrypted_password (GoTrue bcrypt).
-- OTP and Apple keep working whether or not a password exists.

create or replace function public.auth_has_password()
returns boolean
language sql
stable
security definer
set search_path = auth, public
as $$
  select coalesce(
    length(coalesce(
      (select u.encrypted_password from auth.users u where u.id = auth.uid()),
      ''
    )) > 0,
    false
  );
$$;

revoke execute on function public.auth_has_password() from public, anon;
grant execute on function public.auth_has_password() to authenticated;

comment on function public.auth_has_password() is
  'True when the signed-in auth.users row has a GoTrue password hash. Own account only. Does not return the hash.';

create or replace function public.login_email_for_identifier(p_identifier text)
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_raw text;
  v_handle text;
  v_email text;
begin
  v_raw := lower(trim(coalesce(p_identifier, '')));
  if v_raw = '' then
    return null;
  end if;
  if position('@' in v_raw) > 0 then
    return v_raw;
  end if;
  v_handle := regexp_replace(v_raw, '[^a-z0-9]', '', 'g');
  if v_handle = '' then
    return null;
  end if;
  select u.email
    into v_email
  from public.me m
  join auth.users u on u.id = m.id
  where m.handle = v_handle
  limit 1;
  return v_email;
end;
$$;

revoke execute on function public.login_email_for_identifier(text) from public;
grant execute on function public.login_email_for_identifier(text) to anon, authenticated;

comment on function public.login_email_for_identifier(text) is
  'Maps a login identifier (email or @handle) to auth.users.email for signInWithPassword. Returns null when no handle matches. Does not create users.';
