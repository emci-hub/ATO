-- Ids of MILESTONE_DEFS (src/lib/milestones.ts) already shown/celebrated for
-- this user. Distinct from the existing milestones_celebrated column
-- (presence-streak celebrations in NavPixel/useGrowth) — unrelated mechanism.
-- Owner-only writes are already covered by me's existing RLS
-- (auth.uid() = id); no new policy is required.
alter table public.me add column if not exists celebrated_milestone_ids text[] not null default '{}'::text[];
