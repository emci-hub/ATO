-- wave61_drop_category_question_items.sql
-- Follow-up to wave60: DROP TABLE ... CASCADE on category_question_batches
-- only cascaded the FK constraint on category_question_items (Postgres
-- CASCADE drops dependent CONSTRAINTS, not dependent TABLES) — found live,
-- the child table itself was still present after wave60. Drop it explicitly.
drop table if exists public.category_question_items cascade;
