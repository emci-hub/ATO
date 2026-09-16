-- Wave 65: second dev-test identity, for handle-collision testing only.
--
-- Preset 6 of the dev-only intake-stage seeding tool (wave65 companion to
-- src/lib/dev-test-user.ts's applyDevIntakeStagePreset): a hidden/paused
-- profile with a known, taken handle, so handle_taken() (wave64) can be
-- exercised against the exact case it was written to fix — a handle owned by
-- a visible=false account used to read as free.
--
-- Deliberately NOT sign-in-able with a password, unlike wave31's @atodev:
--   - no encrypted_password (NULL), so signInWithPassword always fails
--   - no auth.identities row, so no OAuth/social provider can claim it
-- The real barrier against email-OTP/magic-link sign-in is the undeliverable
-- @example.com address, not the missing identities row — GoTrue's OTP path
-- looks the user up by email on auth.users directly, which this row has. No
-- code path in this client sends an OTP to a dev-only address, but that is a
-- client-side fact, not a database one; do not rely on this account being
-- unreachable, only on it never legitimately being reached.
-- It only needs to EXIST as a taken handle. It is never the signed-in
-- session the dev-lab panel runs presets against — DEV_TEST_USER_ID
-- (a70d3e0e-4c00-4a1e-8c0d-00000000d3e0) is unchanged and is the only
-- account applyDevIntakeStagePreset / applyDevArchetypePreset will act on.
--
-- me row is inserted directly (mirrors wave31 step 4), not via
-- complete_signup: that RPC reads auth.uid() and can only run inside a real
-- session for the calling user, which this account deliberately never has.
-- Side effect, same as every me insert including wave31's: the
-- me_after_insert_issue_codes trigger (stage8_invite_referral.sql) mints 4
-- real invite_codes owned by this id. Harmless (owned by an account nobody
-- can sign into, and invite codes are already generated per-user by design)
-- but worth knowing before treating this as a zero-footprint account.
--
-- Idempotent: re-running converges the handle and visibility, same shape as
-- wave31's on conflict update, including the stale-email guard below.

begin;

-- 1. Auth user, no password, no identity row. Stale-email guard, same as
--    wave31: on conflict (id) alone does not catch the email unique index, so
--    a prior row at this email under a different id would make the insert
--    below fail rather than converge.
delete from auth.users
where email = 'ato-dev-collision@example.com'
  and id <> 'a70d3e0e-4c00-4a1e-8c0d-00000000d3e1';

insert into auth.users
  (instance_id, id, aud, role, email,
   email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
   created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000',
   'a70d3e0e-4c00-4a1e-8c0d-00000000d3e1',
   'authenticated', 'authenticated',
   'ato-dev-collision@example.com',
   now(), '{"provider":"email","providers":["email"]}', '{}',
   now(), now())
on conflict (id) do update
  set updated_at = now();

-- GoTrue scans every auth.users row and fails on NULL token columns
-- ("converting NULL to string is unsupported"); rows it creates itself store
-- empty strings. Normalize the same way as wave31, even though this account
-- is never expected to reach GoTrue (no identity, no password).
update auth.users
set confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    phone_change = coalesce(phone_change, ''),
    phone_change_token = coalesce(phone_change_token, ''),
    reauthentication_token = coalesce(reauthentication_token, ''),
    email_change_confirm_status = coalesce(email_change_confirm_status, 0)
where id = 'a70d3e0e-4c00-4a1e-8c0d-00000000d3e1';

-- 2. me row: hidden (visible = false), a known handle, nothing else set up
--    (no traits, no onboarding fields) since this account exists purely to
--    be a name collision, not a profile to inspect.
insert into public.me
  (id, name, handle, timezone, born_on, visible)
values
  ('a70d3e0e-4c00-4a1e-8c0d-00000000d3e1',
   'Ato Dev Collision', 'atodev2', 'America/Denver', '1995-04-10', false)
on conflict (id) do update
  set handle = excluded.handle,
      visible = excluded.visible;

commit;
