-- Wave 73: play_dev_logs — automatic results from Play dev tests (FPS test first).
--
-- Approved by emci 2026-09-25 ("Ok") after seeing this exact shape. Applied by
-- hand in the Supabase SQL editor — NOT via `supabase db push`, which would also
-- push the written-but-unapplied wave72.
--
-- Deliberately NOT user-keyed: no user_id, no FK to me/auth.users. Rows hold
-- device test numbers only (fps, frame times, creep counts, platform), nothing
-- personal, so the table stays out of count_user_rows / the account-deletion
-- audit. The client only inserts behind PRE_LAUNCH_DEV + the Play dev PIN.
--
-- Access: signed-in clients may INSERT only (size-capped). anon may SELECT so
-- the results can be read back with the public anon key from a dev machine —
-- acceptable because the rows are non-personal perf numbers; revisit with the
-- pre-launch security pass (drop the anon select, or drop the table).

begin;

create table if not exists public.play_dev_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (char_length(kind) between 1 and 40),
  payload jsonb not null check (pg_column_size(payload) < 20000),
  platform text check (platform is null or char_length(platform) <= 40),
  app_update text check (app_update is null or char_length(app_update) <= 80)
);

create index if not exists play_dev_logs_created_idx
  on public.play_dev_logs (created_at desc);

comment on table public.play_dev_logs is
  'Non-personal Play dev test results (FPS test). Insert: authenticated. Select: anon (dev read-back). Drop or lock down before public launch.';

alter table public.play_dev_logs enable row level security;

revoke all on table public.play_dev_logs from public, anon, authenticated;
grant insert on table public.play_dev_logs to authenticated;
grant select on table public.play_dev_logs to anon, authenticated;

drop policy if exists play_dev_logs_insert on public.play_dev_logs;
create policy play_dev_logs_insert on public.play_dev_logs
  for insert to authenticated
  with check (true);

drop policy if exists play_dev_logs_select on public.play_dev_logs;
create policy play_dev_logs_select on public.play_dev_logs
  for select to anon, authenticated
  using (true);

commit;
