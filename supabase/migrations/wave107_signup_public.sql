-- wave107_signup_public.sql
--
-- NOT APPLIED. Launch flip, half (b) (master-plan Step 12, emci 2026-10-20).
-- Apply AFTER wave80_trait_lock, once the launch-flip OTA is on phones.
-- Opens sign-up to everyone: `assert_invite_usable` / `complete_signup` stop
-- asking for an invite code, and the app hides the code field
-- (`src/lib/invite.ts` reads this column; a fetch error keeps invite_only).
--
-- Side effect, on purpose: every dev reset RPC that checks signup_mode
-- (reset_my_account, the jump-stage presets, reset_dev_test_user) refuses from now on.
--
-- One config row changes. No user row is altered or deleted.

update public.app_config set signup_mode = 'public' where id = 1;
