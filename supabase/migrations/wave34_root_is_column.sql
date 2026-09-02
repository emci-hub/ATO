-- Wave 34: root is a column, not a handle string.
--
-- Why: every root gate (is_root(), require_root(), the review-access Edge
-- Function, and the "cannot act on root" guards in root_pause/unpause/delete)
-- compared `me.handle = 'emci'`. Verified on production 2026-09-02: no row
-- has handle 'emci', it is NOT in the reserved list, and the surviving admin
-- account is handle 'emci2'. So (a) the admin surface was unreachable, and
-- (b) anyone holding an invite could register 'emci' and inherit root.
--
-- Fix:
--   1. me.is_root boolean, default false, flipped for the real admin row.
--   2. A BEFORE trigger refuses any is_root change coming from an
--      authenticated JWT (RLS lets a user update their own me row; without
--      this a user could set is_root = true on themselves). Service role and
--      the SQL editor carry no 'authenticated' role claim, so they still can.
--   3. is_root() / require_root() read the column. The three root_* profile
--      functions guard on the column instead of the literal handle.
--   4. 'emci' joins the reserved handles (client + CHECK constraint) so the
--      old literal can never be claimed by anyone.
--
-- Idempotent. Apply with Supabase MCP / CLI after emci's ok — this touches auth.

-- 1. column + admin row ------------------------------------------------------

alter table public.me
  add column if not exists is_root boolean not null default false;

comment on column public.me.is_root is
  'Root admin. Only settable by service role / SQL editor (see me_guard_is_root). Not is_founder.';

update public.me set is_root = true where handle = 'emci2' and is_root is not true;

-- 2. refuse client-side is_root writes ---------------------------------------

create or replace function public.me_guard_is_root()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated' then
    if tg_op = 'INSERT' and new.is_root then
      raise exception 'is_root_readonly' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.is_root is distinct from old.is_root then
      raise exception 'is_root_readonly' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.me_guard_is_root() from public, anon, authenticated;

drop trigger if exists me_guard_is_root on public.me;
create trigger me_guard_is_root
  before insert or update of is_root on public.me
  for each row execute function public.me_guard_is_root();

-- 3. root predicates read the column -----------------------------------------

create or replace function public.is_root()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.me m
    where m.id = auth.uid() and m.is_root
  );
$$;

comment on function public.is_root() is
  'True only when the JWT is a ME row with is_root = true. Not is_founder.';

create or replace function public.require_root()
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
  where m.id = auth.uid() and m.is_root;
  if v_id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

create or replace function public.root_pause_profile(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_is_root boolean;
  v_out jsonb;
begin
  perform public.require_root();
  select m.id, m.is_root into v_id, v_is_root
  from public.me m
  where m.handle = btrim(coalesce(p_handle, ''));
  if v_id is null then
    raise exception 'user_not_found' using errcode = 'P0004';
  end if;
  if v_is_root then
    raise exception 'cannot_act_on_root' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', rb.user_id, 'handle', rb.handle)), '[]'::jsonb)
    into v_out
  from public.pause_branch(v_id) rb;
  return v_out;
end;
$$;

create or replace function public.root_unpause_profile(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_is_root boolean;
  v_out jsonb;
begin
  perform public.require_root();
  select m.id, m.is_root into v_id, v_is_root
  from public.me m
  where m.handle = btrim(coalesce(p_handle, ''));
  if v_id is null then
    raise exception 'user_not_found' using errcode = 'P0004';
  end if;
  if v_is_root then
    raise exception 'cannot_act_on_root' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', rb.user_id, 'handle', rb.handle)), '[]'::jsonb)
    into v_out
  from public.unpause_branch(v_id) rb;
  return v_out;
end;
$$;

create or replace function public.root_delete_profile(p_handle text, p_confirm_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_handle text;
  v_is_root boolean;
  v_out jsonb;
begin
  perform public.require_root();
  v_handle := btrim(coalesce(p_handle, ''));
  if v_handle = '' or v_handle is distinct from btrim(coalesce(p_confirm_handle, '')) then
    raise exception 'handle_confirm_mismatch' using errcode = '22023';
  end if;
  select m.id, m.is_root into v_id, v_is_root
  from public.me m
  where m.handle = v_handle;
  if v_id is null then
    raise exception 'user_not_found' using errcode = 'P0004';
  end if;
  if v_is_root then
    raise exception 'cannot_act_on_root' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', rb.user_id, 'handle', rb.handle)), '[]'::jsonb)
    into v_out
  from public.delete_branch(v_id) rb;
  return v_out;
end;
$$;

-- 4. 'emci' can never be registered -----------------------------------------

alter table public.me drop constraint if exists me_handle_check;
alter table public.me add constraint me_handle_check check (
  handle = lower(handle)
  and handle ~ '^[a-z0-9]{1,20}$'
  and handle <> all (array['ato', 'sage', 'admin', 'support', 'you', 'astrollogs', 'emci'])
);
