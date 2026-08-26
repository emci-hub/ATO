-- auth.refresh_tokens.user_id is varchar, not uuid.

create or replace function public.pause_branch(p_user_id uuid)
returns table (user_id uuid, handle text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  select coalesce(array_agg(rb.user_id), '{}')
  into v_ids
  from public.referral_branch(p_user_id) rb;

  if coalesce(cardinality(v_ids), 0) = 0 then
    raise exception 'user_not_found' using errcode = 'P0004';
  end if;

  update auth.users u
  set banned_until = 'infinity'::timestamptz
  where u.id = any (v_ids);

  delete from auth.refresh_tokens rt where rt.user_id in (select unnest(v_ids)::text);
  delete from auth.sessions s where s.user_id = any (v_ids);

  return query select rb.user_id, rb.handle from public.referral_branch(p_user_id) rb;
end;
$$;

revoke execute on function public.pause_branch(uuid) from public, anon, authenticated;
grant execute on function public.pause_branch(uuid) to service_role;

create or replace function public.delete_branch(p_user_id uuid)
returns table (user_id uuid, handle text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_paused boolean;
  v_out uuid;
  v_handle text;
begin
  select u.banned_until is not null and u.banned_until > now()
  into v_paused
  from auth.users u
  where u.id = p_user_id;

  if not coalesce(v_paused, false) then
    raise exception 'branch_not_paused' using errcode = 'P0003';
  end if;

  select coalesce(array_agg(rb.user_id), '{}')
  into v_ids
  from public.referral_branch(p_user_id) rb;

  for v_out, v_handle in select rb.user_id, rb.handle from public.referral_branch(p_user_id) rb
  loop
    user_id := v_out;
    handle := v_handle;
    return next;
  end loop;

  delete from auth.refresh_tokens rt where rt.user_id in (select unnest(v_ids)::text);
  delete from auth.sessions s where s.user_id = any (v_ids);
  delete from auth.users u where u.id = any (v_ids);
end;
$$;

revoke execute on function public.delete_branch(uuid) from public, anon, authenticated;
grant execute on function public.delete_branch(uuid) to service_role;
