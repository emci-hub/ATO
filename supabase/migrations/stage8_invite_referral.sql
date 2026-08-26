-- Stage 8, piece 2 — Referral spec (invite box, Auth + ME only).
-- Applied to the `ato` Supabase project (aijzsmupaaaxjctfgwpl).
--
-- Design notes:
--  * `signup_mode` is the entire go-public switch. Default invite_only.
--    Flipping the row to `public` is the only change required to drop the
--    code requirement — no rebuild.
--  * Invite consume is a single UPDATE ... WHERE uses_count < max_uses
--    returning the row. Two concurrent redeems: one wins, the other sees
--    zero rows. No separate SELECT-then-UPDATE window.
--  * `referred_by` is set only inside complete_signup. Clients cannot write
--    it (trigger strips / rejects). Hidden: public_profile does not return it.
--  * pause_branch / delete_branch / unpause_branch are service_role only —
--    same dashboard-query discipline as reports. No admin UI.
--  * Regular account deletion SET NULL on referred_by so deleting yourself
--    does not delete people you invited. delete_branch is the explicit
--    cluster hard-delete, and only after the branch is paused.
--  * Root (emci) has referred_by null. Existing ME rows get the default
--    allotment of 4 codes on backfill; new ME rows get 4 via trigger.

-- 1. app_config --------------------------------------------------------------
create table public.app_config (
  id int primary key default 1 check (id = 1),
  signup_mode text not null default 'invite_only'
    check (signup_mode in ('invite_only', 'public'))
);

insert into public.app_config (id, signup_mode) values (1, 'invite_only');

alter table public.app_config enable row level security;

create policy app_config_select_all on public.app_config
  for select using (true);

comment on table public.app_config is
  'Single-row app config. signup_mode is the invite/public switch. Writes are service_role only (no write policies).';

-- 2. me.referred_by ----------------------------------------------------------
alter table public.me
  add column referred_by uuid references public.me(id) on delete set null;

alter table public.me
  add constraint me_referred_by_not_self check (referred_by is distinct from id);

create index me_referred_by_idx on public.me (referred_by)
  where referred_by is not null;

comment on column public.me.referred_by is
  'Hidden FK: which ME row invited this user. Never shown publicly. Own-account "who I referred" is the reverse lookup.';

-- 3. invite_codes ------------------------------------------------------------
create table public.invite_codes (
  code text primary key,
  owner_id uuid not null references public.me(id) on delete cascade,
  max_uses int not null default 1 check (max_uses >= 1),
  uses_count int not null default 0 check (uses_count >= 0),
  status text not null default 'active'
    check (status in ('active', 'used', 'revoked')),
  created_at timestamptz not null default now(),
  check (uses_count <= max_uses)
);

create index invite_codes_owner_id_idx on public.invite_codes (owner_id);

create unique index invite_codes_code_lower_idx on public.invite_codes (lower(code));

alter table public.invite_codes enable row level security;

-- Owner can read their own codes so they can share them. No client writes —
-- codes are issued by trigger / service_role seed.
create policy invite_codes_select_own on public.invite_codes
  for select using (auth.uid() = owner_id);

comment on table public.invite_codes is
  'Invite codes. Default allotment of 4 issued on ME insert. Consume is atomic via complete_signup.';

-- Normalize stored codes so lookup can be case-insensitive via lower(code).
create function public.invite_codes_normalize()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.code := upper(btrim(new.code));
  if new.code = '' then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

create trigger invite_codes_normalize
  before insert or update of code on public.invite_codes
  for each row execute function public.invite_codes_normalize();

-- 4. issue codes on ME insert ------------------------------------------------
create function public.issue_invite_codes(p_owner uuid, p_count int default 4)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  i int;
  v_code text;
  v_tries int;
begin
  if p_count < 1 then return; end if;
  for i in 1..p_count loop
    v_tries := 0;
    loop
      v_code := upper(encode(gen_random_bytes(5), 'hex'));
      begin
        insert into public.invite_codes (code, owner_id, max_uses, uses_count, status)
        values (v_code, p_owner, 1, 0, 'active');
        exit;
      exception when unique_violation then
        v_tries := v_tries + 1;
        if v_tries > 8 then raise; end if;
      end;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.issue_invite_codes(uuid, int) from public, anon, authenticated;
grant execute on function public.issue_invite_codes(uuid, int) to service_role;

create function public.me_after_insert_issue_codes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.issue_invite_codes(new.id, 4);
  return new;
end;
$$;

create trigger me_after_insert_issue_codes
  after insert on public.me
  for each row execute function public.me_after_insert_issue_codes();

-- 5. Guard: clients cannot set referred_by, and cannot insert a ME row in
--    invite_only except through complete_signup (which sets a txn-local GUC).
create function public.me_invite_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('ato.completing_signup', true) = '1' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.referred_by := old.referred_by;
    return new;
  end if;

  -- INSERT from an authenticated client.
  if coalesce(auth.role(), '') = 'authenticated' then
    new.referred_by := null;
    if (select signup_mode from public.app_config where id = 1) = 'invite_only' then
      raise exception 'invite_required' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger me_invite_guard
  before insert or update on public.me
  for each row execute function public.me_invite_guard();

-- 6. complete_signup — Auth box enforcement ---------------------------------
create function public.complete_signup(
  p_name text,
  p_handle text,
  p_show_up text,
  p_talk_style text,
  p_knocks_you_off text,
  p_morning_cue text,
  p_timezone text,
  p_invite_code text default null
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
  -- consume a code or rewrite referred_by. Matches the old upsert behaviour.
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

  select signup_mode into strict v_mode from public.app_config where id = 1;
  v_code := nullif(upper(btrim(coalesce(p_invite_code, ''))), '');

  if v_mode = 'invite_only' then
    if v_code is null then
      raise exception 'invite_required' using errcode = 'P0001';
    end if;
  end if;

  if v_code is not null then
    -- Atomic consume. The WHERE is the race window closer: two sessions
    -- updating the same row serialize on the row lock, and the loser sees
    -- uses_count already at max.
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
      -- In public mode an optional bad code is ignored (flipping the switch
      -- must not start rejecting signups). In invite_only it is a hard reject.
      if v_mode = 'invite_only' then
        raise exception 'invite_invalid' using errcode = 'P0002';
      end if;
    elsif v_owner = v_uid then
      raise exception 'invite_invalid' using errcode = 'P0002';
    end if;
  end if;

  perform set_config('ato.completing_signup', '1', true);

  insert into public.me (
    id, name, handle, show_up, talk_style, knocks_you_off, morning_cue, timezone, referred_by
  ) values (
    v_uid, p_name, p_handle, p_show_up, p_talk_style, p_knocks_you_off, p_morning_cue, p_timezone, v_owner
  )
  returning * into v_me;

  return v_me;
end;
$$;

revoke execute on function public.complete_signup(text, text, text, text, text, text, text, text) from public;
grant execute on function public.complete_signup(text, text, text, text, text, text, text, text) to authenticated;

-- Peek whether a code is currently usable. Does not consume. Anon-callable so
-- the Auth screen can reject before sending an OTP.
create function public.assert_invite_usable(p_code text)
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
      and uses_count < max_uses
  ) then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke execute on function public.assert_invite_usable(text) from public;
grant execute on function public.assert_invite_usable(text) to anon, authenticated;

-- Own-account "who I referred" list. Handle + name only — never referred_by,
-- never anyone else's tree.
create function public.my_referrals()
returns table (id uuid, handle text, name text)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.handle, m.name
  from public.me m
  where m.referred_by = auth.uid()
  order by m.created_at;
$$;

revoke execute on function public.my_referrals() from public;
grant execute on function public.my_referrals() to authenticated;

-- 7. Branch walk (shared by pause / unpause / delete) ------------------------
create function public.referral_branch(p_user_id uuid)
returns table (user_id uuid, handle text)
language sql
stable
security definer
set search_path = public
as $$
  with recursive branch as (
    select m.id, m.handle
    from public.me m
    where m.id = p_user_id
    union all
    select child.id, child.handle
    from public.me child
    join branch parent on child.referred_by = parent.id
  )
  select id, handle from branch;
$$;

revoke execute on function public.referral_branch(uuid) from public, anon, authenticated;
grant execute on function public.referral_branch(uuid) to service_role;

create function public.pause_branch(p_user_id uuid)
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

  -- Infinity = disabled until unpause_branch clears it. Reversible.
  -- Qualify columns: RETURNS TABLE (user_id ...) makes a bare user_id
  -- ambiguous against auth.refresh_tokens.user_id.
  update auth.users u
  set banned_until = 'infinity'::timestamptz
  where u.id = any (v_ids);

  -- Existing JWTs would otherwise keep working until expiry.
  delete from auth.refresh_tokens rt where rt.user_id in (select unnest(v_ids)::text);
  delete from auth.sessions s where s.user_id = any (v_ids);

  return query select rb.user_id, rb.handle from public.referral_branch(p_user_id) rb;
end;
$$;

revoke execute on function public.pause_branch(uuid) from public, anon, authenticated;
grant execute on function public.pause_branch(uuid) to service_role;

create function public.unpause_branch(p_user_id uuid)
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
  set banned_until = null
  where u.id = any (v_ids);

  return query select rb.user_id, rb.handle from public.referral_branch(p_user_id) rb;
end;
$$;

revoke execute on function public.unpause_branch(uuid) from public, anon, authenticated;
grant execute on function public.unpause_branch(uuid) to service_role;

create function public.delete_branch(p_user_id uuid)
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
  -- Operational rule from the spec: only after a paused branch has been
  -- reviewed. The named user must currently be banned.
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

  -- Collect the result set before the delete so RETURN still has rows.
  for v_out, v_handle in select rb.user_id, rb.handle from public.referral_branch(p_user_id) rb
  loop
    user_id := v_out;
    handle := v_handle;
    return next;
  end loop;

  delete from auth.refresh_tokens rt where rt.user_id in (select unnest(v_ids)::text);
  delete from auth.sessions s where s.user_id = any (v_ids);
  -- Cascades every public FK (me, invite_codes, …). referred_by on anyone
  -- outside this set becomes null (ON DELETE SET NULL).
  delete from auth.users u where u.id = any (v_ids);
end;
$$;

revoke execute on function public.delete_branch(uuid) from public, anon, authenticated;
grant execute on function public.delete_branch(uuid) to service_role;

-- 8. count_user_rows — include invite_codes so delete-account cascade proof
--    still returns 0 after this box.
create or replace function public.count_user_rows(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.me where id = p_user_id)
  + (select count(*) from public.checks where user_id = p_user_id)
  + (select count(*) from public.crisis_flags where user_id = p_user_id)
  + (select count(*) from public.connections where user_id = p_user_id or peer_id = p_user_id)
  + (select count(*) from public.messages where sender_id = p_user_id)
  + (select count(*) from public.threads where user_a = p_user_id or user_b = p_user_id)
  + (select count(*) from public.blocks where blocked_by = p_user_id or blocked_user = p_user_id)
  + (select count(*) from public.mutes where muter = p_user_id or muted_user = p_user_id)
  + (select count(*) from public.reports where "from" = p_user_id or user_id = p_user_id)
  + (select count(*) from public.sage_messages where user_id = p_user_id)
  + (select count(*) from public.apple_credentials where user_id = p_user_id)
  + (select count(*) from public.invite_codes where owner_id = p_user_id)
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;

-- 9. Backfill default allotment for ME rows that already exist (emci, yeezy).
--    Root's referred_by stays null. Extra root codes can still be inserted
--    by hand in the SQL editor.
do $$
declare
  r record;
begin
  for r in select id from public.me loop
    if not exists (select 1 from public.invite_codes where owner_id = r.id) then
      perform public.issue_invite_codes(r.id, 4);
    end if;
  end loop;
end;
$$;
