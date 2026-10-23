-- wave112: A3 cleanup (roadmap v2 S5; master-plan D13 + D15). emci OK 2026-10-22 ("Yes, drop them").
--
-- 1. public.play_dev_logs (wave73): Divecore dev-test results. Nothing reads it (wave98 removed the
--    read), the only writer (src/play/dev-log.ts) runs only while PRE_LAUNCH_DEV is on, which is off
--    since public sign-up. Live 2026-10-22: 1 test row (2026-09-26), no function or view uses it.
--    Dropping the table deletes that row and its two insert policies.
-- 2. wave101's restrictive write policies on trait_tracks / trait_history: inert since wave80
--    (no client INSERT/UPDATE grant on either table, verified read-only 2026-10-22). Trait writes go
--    through the wave79 server checkpoint only. The other wave101 policies are not touched.
--
-- Nothing else changes. Pinned by check:server-hardening (A3 block). Apply by hand:
--   supabase db query --linked -f supabase/migrations/wave112_a3_cleanup.sql

begin;

drop table if exists public.play_dev_logs;

drop policy if exists trait_tracks_adult_insert on public.trait_tracks;
drop policy if exists trait_tracks_adult_update on public.trait_tracks;
drop policy if exists trait_history_adult_insert on public.trait_history;

commit;

-- AFTER APPLYING, CHECK (read-only):
--   select to_regclass('public.play_dev_logs');                      -- null
--   select policyname from pg_policies where schemaname = 'public'
--     and policyname in ('trait_tracks_adult_insert', 'trait_tracks_adult_update', 'trait_history_adult_insert');  -- 0 rows
