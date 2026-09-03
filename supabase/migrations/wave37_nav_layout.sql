-- Per-user bottom-nav layout: a 5-slot bar where slot 5 is always "More"
-- (fixed, not draggable). Slots 1-4 always contain Home and Sage exactly once
-- each (user-draggable positions) plus 2 pool tabs chosen from the reorderable
-- registry (Explore / You / Questions / Around / Legends / Circle).
--
-- Stored as a jsonb object `{ "slots": ["home","explore","sage","you"] }` in
-- left-to-right order. Null means "unset" -> the client falls back to the
-- default layout. Owner-only writes are already covered by me's existing RLS
-- (auth.uid() = id); no new policy is required.
alter table public.me add column if not exists nav_layout jsonb;
