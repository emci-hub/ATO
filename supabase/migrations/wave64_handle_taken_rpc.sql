-- wave64_handle_taken_rpc.sql
--
-- Adds handle_taken(p_handle) — the authoritative "is this handle already
-- claimed" check for the onboarding account step.
--
-- Root cause it replaces: checkHandleAvailable (src/lib/me.ts) used the
-- public_profile RPC and read "no rows" as "available". public_profile is a
-- visibility-filtered lookup (stage8_invite_referral.sql:12 — "Hidden:
-- public_profile does not return it"), so a handle owned by a paused/hidden
-- account came back as free and the user only failed later at insert, on the
-- me.handle unique constraint inside complete_signup (23505).
--
-- This function reads public.me directly, ignoring visibility, and returns a
-- bare boolean — no profile data. That discloses nothing signup does not
-- already disclose (the insert itself distinguishes taken from free).
--
-- Grants follow the revoke-then-grant shape of assert_invite_usable
-- (stage8_invite_referral.sql:313-314) but are authenticated-only, NOT anon:
-- the account step runs inside onboarding, after OTP, so the caller always
-- has a session. assert_invite_usable is anon because it runs on the Auth
-- screen before one exists — that reason does not apply here, and anon would
-- let an unauthenticated caller probe the existence of hidden/paused handles,
-- which is exactly what public_profile is designed to conceal.
--
-- Case handling: normalizeHandle() lowercases client-side and complete_signup
-- stores what it is given, but lower() on both sides here makes the check
-- correct even if a mixed-case handle ever reaches the table.
--
-- complete_signup's unique constraint remains the real enforcement — this is
-- the live pre-check, and 23505 still guards the race (errorMessageForHandle).

create or replace function public.handle_taken(p_handle text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.me
    where lower(me.handle) = lower(btrim(coalesce(p_handle, '')))
  );
$$;

revoke execute on function public.handle_taken(text) from public;
grant execute on function public.handle_taken(text) to authenticated;
