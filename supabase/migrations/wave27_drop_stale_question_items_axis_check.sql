-- Wave 27: drop the stale 15-axis check on question_items.axis.
--
-- wave21_playfulness_categories.sql added the 16-axis constraint
-- `question_items_axis_known` (incl. playfulness) and dropped the original
-- 15-axis checks in the same DO block. If the wave21 migration ever ran with
-- that block skipped/failed, or the original `question_items_axis_check`
-- survived an earlier partial apply, production ends up with BOTH checks and
-- playfulness items (now generated, since TRAIT_AXES has 16 entries) are
-- rejected at insert — which surfaces as "Couldn't land a batch." in the app.
--
-- The 16-axis `question_items_axis_known` check is the authority. This drops
-- the redundant older check idempotently; it is harmless to run where the
-- stale constraint is already gone.

alter table public.question_items
  drop constraint if exists question_items_axis_check;
