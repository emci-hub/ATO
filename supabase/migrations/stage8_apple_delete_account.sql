-- Stage 8, piece 1 — Sign in with Apple + in-app delete account with token revoke.
-- Applied to the `ato` Supabase project (aijzsmupaaaxjctfgwpl).
--
-- Design notes:
--  * `apple_credentials` stores Apple's *refresh token* for a user. This is the
--    only way to revoke later: Supabase's native `signInWithIdToken` flow only
--    consumes the identity token, so `session.provider_refresh_token` is null
--    and Apple's authorization code stays unused and available for us to
--    exchange ourselves. If we don't store the refresh token at sign-in time,
--    revocation at delete time is impossible.
--  * `apple_credentials` has RLS enabled and DELIBERATELY NO POLICIES. No
--    policy means no anon/authenticated access at all; only the service_role
--    key (which bypasses RLS) can read or write it. The client must never be
--    able to read an Apple refresh token.
--  * `apple_sub` is UNIQUE. Apple's `sub` is stable per user per developer
--    team, and is the SAME value whether or not the user chose "Hide My
--    Email". This unique constraint is the database-level guarantee that one
--    Apple identity maps to at most one row — a relay address can never open a
--    second account.
--  * `account_deletions` intentionally has NO foreign key on `user_id`. An FK
--    to auth.users would cascade-delete the audit row at the exact moment the
--    user is deleted, destroying the record that proves deletion and
--    revocation happened. It is a plain uuid on purpose.

-- 1. apple_credentials --------------------------------------------------------
create table public.apple_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Apple's stable subject identifier. Same across Hide-My-Email and real
  -- email, so it — not the email — is the identity key.
  apple_sub text not null unique,
  -- Apple's refresh token, required by POST /auth/revoke at delete time.
  refresh_token text,
  -- Access token from the same exchange; a valid fallback revocation target.
  access_token text,
  -- Which client_id (bundle ID) the tokens were issued to. Revocation must be
  -- sent with the same client_id, so store it rather than assuming.
  client_id text not null,
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.apple_credentials enable row level security;

-- No policies by design. service_role only. See header note.

comment on table public.apple_credentials is
  'Apple refresh/access tokens for Sign in with Apple revocation. service_role only — RLS on with zero policies. Never expose to the client.';

-- 2. account_deletions --------------------------------------------------------
-- Admin-visible audit trail. Survives the user row it describes.
create table public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  -- Plain uuid, NOT a foreign key. See header note.
  user_id uuid not null,
  had_apple_identity boolean not null default false,
  -- Apple's literal HTTP status from POST /auth/revoke.
  -- NOTE: 200 does NOT prove revocation. Verified against the live endpoint —
  -- Apple answers 200 with an empty body to any request carrying a
  -- `client_secret` field at all, including a literal "this-is-not-a-jwt" with
  -- an unregistered client_id. Only a missing client_secret returns 400.
  -- null = revocation was not attempted (no Apple identity / no stored token).
  apple_revoke_status integer,
  -- The real proof: after revoking, the refresh token is used against Apple's
  -- /auth/token endpoint, which DOES validate. true = Apple rejected it
  -- (invalid_grant), so the authorization is genuinely gone. false = Apple
  -- still honoured it, meaning revocation silently failed despite the 200.
  -- null = indeterminate.
  apple_revocation_confirmed boolean,
  -- Apple's response body when it was not a clean 200 (Apple returns an empty
  -- body on success, so a non-empty value here always means something failed).
  apple_revoke_error text,
  -- Rows actually removed, counted after the delete. Proof of cascade.
  rows_remaining integer,
  deleted_at timestamptz not null default now()
);

create index account_deletions_deleted_at_idx on public.account_deletions(deleted_at);

alter table public.account_deletions enable row level security;

-- No policies by design. Admin reads happen in the Supabase dashboard, same
-- discipline as the `reports` table from Stage 7.

comment on table public.account_deletions is
  'Audit trail for in-app account deletion: Apple revocation status + post-delete row count. Deliberately has no FK to auth.users so it survives the deletion it records.';

-- 3. count_user_rows ----------------------------------------------------------
-- Counts every row anywhere in the schema that still references a user id.
-- Called immediately AFTER the delete so the result is in-band proof the
-- cascade actually emptied the account rather than a toast claiming it did.
-- A correct delete returns 0.
--
-- service_role only: execute is revoked from public/anon/authenticated so a
-- signed-in user cannot probe another account's row footprint.
create function public.count_user_rows(p_user_id uuid)
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
  + (select count(*) from auth.users where id = p_user_id);
$$;

revoke execute on function public.count_user_rows(uuid) from public, anon, authenticated;
grant execute on function public.count_user_rows(uuid) to service_role;
