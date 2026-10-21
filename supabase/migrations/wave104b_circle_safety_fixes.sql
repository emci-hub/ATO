-- wave104b_circle_safety_fixes.sql · master plan Step 7 reviewer fixes, 2026-10-20. Apply AFTER wave104.
--   1. me_name_guard runs as SECURITY DEFINER (like connections_adult_guard), so a refused name raises
--      name_not_allowed instead of "permission denied for function _name_not_allowed".
--   2. Name filter false positives (judge meaning): "Ato" alone is a real given name, "Coon" a real
--      surname, "snigger" an ordinary word, "lifesupport" an ordinary handle. Lists = src/lib/name-filter.ts.
--   3. Two people asking each other at once: accepting one request also closes the other direction.
-- No row is changed or deleted.

begin;

-- 2. Filter lists (restated from wave104 with the narrower lists) ---------------------------------
create or replace function public._name_not_allowed(p text, p_kind text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  -- name-filter:SLURS_ANYWHERE
  anywhere text[] := array['nigger','nigga','faggot','fagot','tranny','trannie','wetback','raghead','towelhead','beaner','chink','retard','hitler','kkk'];
  -- name-filter:SLURS_WHOLE
  whole text[] := array['fag','kike','spic','gook','paki','nazi'];
  -- name-filter:SAFE_WORDS
  safe text[] := array['snigger'];
  -- name-filter:STAFF_PREFIXES
  prefixes text[] := array['admin','support','official','moderator','atoteam','atostaff','atosupport','atoofficial','atoadmin','teamato'];
  -- name-filter:STAFF_SUFFIXES
  suffixes text[] := array['official','admin','moderator'];
  folded text := public._name_fold(p);
  scrubbed text;
  w text;
  s text;
begin
  if folded = '' then return false; end if;
  scrubbed := folded;
  foreach s in array safe loop
    scrubbed := replace(scrubbed, s, '');
  end loop;
  foreach s in array anywhere loop
    if position(s in scrubbed) > 0 then return true; end if;
  end loop;
  if p_kind = 'name' then
    foreach w in array regexp_split_to_array(translate(lower(coalesce(p, '')), '013457@$', 'oieastas'), '[^a-z]+') loop
      if w = any(whole) then return true; end if;
    end loop;
    -- "Ato" alone is a real given name; only "ATO Team"-style names are staff.
    foreach s in array prefixes loop
      if left(s, 3) = 'ato' and left(folded, length(s)) = s then return true; end if;
    end loop;
    return false;
  end if;
  if folded = any(whole) then return true; end if;
  foreach s in array prefixes loop
    if left(folded, length(s)) = s then return true; end if;
  end loop;
  foreach s in array suffixes loop
    if right(folded, length(s)) = s then return true; end if;
  end loop;
  return false;
end;
$$;
revoke all on function public._name_not_allowed(text, text) from public, anon, authenticated;

-- 1. The trigger function reads the internal filter as its owner ------------------------------------
create or replace function public.me_name_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role, cron and the SQL editor are not the person using the app.
  if coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' then
    return new;
  end if;
  if (tg_op = 'INSERT' or new.name is distinct from old.name)
     and public._name_not_allowed(new.name, 'name') then
    raise exception 'name_not_allowed' using errcode = 'P0001';
  end if;
  if (tg_op = 'INSERT' or new.handle is distinct from old.handle)
     and public._name_not_allowed(new.handle, 'handle') then
    raise exception 'name_not_allowed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.me_name_guard() from public, anon, authenticated;

-- 3. Accepting closes the other direction too ------------------------------------------------------

-- circle_request(text) · source: wave104 + close my own pending request when theirs is accepted
create or replace function public.circle_request(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_peer uuid;
  v_reverse uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public._rate_limit_caller('circle_request', 20, 3600) then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  select m.id into v_peer from public.me m
    where m.handle = lower(btrim(coalesce(p_handle, ''), ' @'))
    limit 1;
  -- A block (either way) or an account that is not 18+ looks exactly like "no one with that handle".
  if v_peer is null or public._circle_blocked(uid, v_peer) or not public.is_adult(v_peer) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_peer = uid then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;
  if exists (select 1 from public.connections c where c.user_id = uid and c.peer_id = v_peer) then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;
  if public._circle_size(uid) >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'cap');
  end if;
  -- They already asked me: asking back accepts.
  select r.id into v_reverse from public.circle_requests r
    where r.from_user = v_peer and r.to_user = uid and r.status = 'pending'
    limit 1;
  if v_reverse is not null then
    if public._circle_size(v_peer) >= 20 then
      return jsonb_build_object('ok', false, 'reason', 'cap');
    end if;
    update public.circle_requests set status = 'accepted', responded_at = now() where id = v_reverse;
    update public.circle_requests set status = 'cancelled', responded_at = now()
      where from_user = uid and to_user = v_peer and status = 'pending';  -- wave104b
    insert into public.connections (user_id, peer_id) values (uid, v_peer) on conflict do nothing;
    return jsonb_build_object('ok', true, 'state', 'accepted');
  end if;
  if exists (select 1 from public.circle_requests r
             where r.from_user = uid and r.to_user = v_peer and r.status = 'pending') then
    return jsonb_build_object('ok', false, 'reason', 'pending');
  end if;
  if (select count(*) from public.circle_requests r where r.from_user = uid and r.status = 'pending') >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'cap');
  end if;
  insert into public.circle_requests (from_user, to_user) values (uid, v_peer);
  return jsonb_build_object('ok', true, 'state', 'sent');
end;
$$;
revoke all on function public.circle_request(text) from public, anon;
grant execute on function public.circle_request(text) to authenticated;

-- circle_respond(uuid,boolean) · source: wave104 + close my own pending request to them on accept
create or replace function public.circle_respond(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_from uuid;
begin
  perform public.require_adult();  -- wave101: 18+ only (docs/under18-server.md)
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select r.from_user into v_from from public.circle_requests r
    where r.id = p_id and r.to_user = uid and r.status = 'pending'
    for update;
  if v_from is null or p_accept is null or public._circle_blocked(uid, v_from) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not p_accept then
    update public.circle_requests set status = 'declined', responded_at = now() where id = p_id;
    return jsonb_build_object('ok', true);
  end if;
  if not public.is_adult(v_from) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if public._circle_size(uid) >= 20 or public._circle_size(v_from) >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'cap');
  end if;
  update public.circle_requests set status = 'accepted', responded_at = now() where id = p_id;
  update public.circle_requests set status = 'cancelled', responded_at = now()
    where from_user = uid and to_user = v_from and status = 'pending';  -- wave104b
  insert into public.connections (user_id, peer_id) values (uid, v_from) on conflict do nothing;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.circle_respond(uuid, boolean) from public, anon;
grant execute on function public.circle_respond(uuid, boolean) to authenticated;

commit;
