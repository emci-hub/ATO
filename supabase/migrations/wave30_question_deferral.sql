-- Wave 30: per-user deferred question axes (intake skip -> rotating pool).
--
-- When a user skips a question in a questionnaire sweep ("A faster pass",
-- the You-tab "Want to add a bit more?" stepper), that question's axis is
-- persisted here instead of being silently dropped, so the skip relocates
-- the axis into the regular rotating Questions pool ("Tell Sage more" ->
-- "A few questions"). Once the axis gains a trait value (answered anywhere),
-- the app drops it from this list. Entries are validated against the app's
-- 16-axis vocabulary by the client before persisting.

alter table public.me
  add column if not exists question_deferred jsonb not null default '[]'::jsonb;

comment on column public.me.question_deferred is
  'Axes the user skipped in an intake/questionnaire sweep. Served by the rotating Questions pool until the axis is answered.';
