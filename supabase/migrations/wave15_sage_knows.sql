-- Does Sage know you? — rotation cursor, weekly slot, per-axis streak.
-- Additive. Does not touch trait columns, complete_signup, or Talk.

alter table public.me
  add column if not exists sage_knows jsonb not null default '{}'::jsonb;

alter table public.me drop constraint if exists me_sage_knows_object;
alter table public.me
  add constraint me_sage_knows_object
  check (jsonb_typeof(sage_knows) = 'object');

comment on column public.me.sage_knows is
  'Does Sage know you? weekly slot, last axis, per-axis confirm streak, and graduation. Empty object when unused.';
