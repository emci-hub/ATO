-- Wave 2 Stage 1 — Around data layer.
-- Typed city on ME (never GPS). Public Storage object at around/{city}/weekend.json.

-- 1. City on ME --------------------------------------------------------------
alter table public.me
  add column if not exists city text;

alter table public.me
  drop constraint if exists me_city_slug;

alter table public.me
  add constraint me_city_slug
  check (city is null or city ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

comment on column public.me.city is
  'Typed city slug for Around (e.g. calgary). Never from live GPS. Nullable on pre-field rows; set at onboarding or Settings.';

-- 2. Public JSON bucket ------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('around', 'around', true, 1048576, array['application/json']::text[])
on conflict (id) do update
set public = true,
    file_size_limit = 1048576,
    allowed_mime_types = array['application/json']::text[];

drop policy if exists around_public_read on storage.objects;
create policy around_public_read
on storage.objects
for select
to public
using (bucket_id = 'around');

-- Writes are service_role only (no insert/update/delete policies for anon).

-- 3. Cron: refresh twice a day (Edmtrain cache must be < 24h) ----------------
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- Job is created in a follow-up SQL once around_refresh_secret lives in Vault.
-- The Edge Function is the source of truth; cron only invokes it.
