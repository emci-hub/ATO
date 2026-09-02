-- Wave 31: Fixed dev-test identity + owner-deletable legend history.
-- Applied to production 2026-09-02 (project aijzsmupaaaxjctfgwpl, migration
-- wave31_dev_test_user).
--
-- Two unrelated pieces, one versioned change:
--
-- (1) user_legend_history gains an owner-scoped DELETE so the __DEV__-only
--     "Test as" preset switcher (src/lib/dev-test-user.ts) can clear the
--     signed-in dev user's seen set and re-test a legend. A legend is served
--     at most once per user today; without a reset the switcher could only
--     show each of the 4 seeded legends once, ever. Policy is self-scoped
--     (auth.uid() = user_id) — no user can touch another's history.
--
-- (2) The fixed dev-test account is (re)provisioned:
--       email      ato-dev@example.com
--       handle     @atodev
--       auth id    a70d3e0e-4c00-4a1e-8c0d-00000000d3e0
--       password   ATO-dev-user-2026  (bcrypt via crypt(), dev-throwaway only)
--     The earlier ad-hoc account legends-dev@emgens.com (@legendtest, id
--     ddd90aae-2f0f-4507-a160-423b9223d83b) is removed — emci chose a fresh
--     identity over reusing it. Idempotent: re-running converges to the same
--     rows (delete-stale guard + upserts) so future sessions can re-provision
--     by applying this migration's body.

begin;

-- 0. Audit + remove the old ad-hoc dev account (auth.users delete cascades its
--    me row and every owned child row; account_deletions is the one leftover,
--    same convention as the Aug 31 test-account wipe).
insert into public.account_deletions (user_id, had_apple_identity, deleted_at)
values ('ddd90aae-2f0f-4507-a160-423b9223d83b', false, now());

delete from auth.users
where id = 'ddd90aae-2f0f-4507-a160-423b9223d83b';

-- 1. Owner-delete policy on user_legend_history ----------------------------------
drop policy if exists user_legend_history_delete_own on public.user_legend_history;
create policy user_legend_history_delete_own on public.user_legend_history
  for delete using (auth.uid() = user_id);

grant delete on public.user_legend_history to authenticated;

-- 2. Fixed dev-test user (auth.users) -------------------------------------------
-- crypt() writes a bcrypt hash GoTrue can verify, so signInWithPassword works.
delete from auth.users
where email = 'ato-dev@example.com'
  and id <> 'a70d3e0e-4c00-4a1e-8c0d-00000000d3e0';

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
   created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000',
   'a70d3e0e-4c00-4a1e-8c0d-00000000d3e0',
   'authenticated', 'authenticated',
   'ato-dev@example.com',
   crypt('ATO-dev-user-2026', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}',
   now(), now())
on conflict (id) do update
  set encrypted_password = excluded.encrypted_password,
      email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
      updated_at = now();

-- GoTrue scans the auth.users row and fails on NULL token columns
-- ("converting NULL to string is unsupported"); rows it creates itself store
-- empty strings. Normalize the same way for this row.
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
where id = 'a70d3e0e-4c00-4a1e-8c0d-00000000d3e0';

-- 3. Email identity row (mirrors what GoTrue writes for a confirmed email user).
insert into auth.identities
  (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id::text, id,
       jsonb_build_object('sub', id::text, 'email', 'ato-dev@example.com'),
       'email', now(), now(), now()
from auth.users
where id = 'a70d3e0e-4c00-4a1e-8c0d-00000000d3e0'
on conflict (provider, provider_id) do update
  set identity_data = excluded.identity_data,
      updated_at = now();

-- 4. me row (kept trait columns untouched on re-run; presets are applied from
--    the app, never provisioned here).
insert into public.me
  (id, name, handle, timezone, born_on, ai_consent)
values
  ('a70d3e0e-4c00-4a1e-8c0d-00000000d3e0',
   'Ato Dev', 'atodev', 'America/Denver', '1995-04-10', true)
on conflict (id) do update
  set name = excluded.name,
      handle = excluded.handle;

commit;
