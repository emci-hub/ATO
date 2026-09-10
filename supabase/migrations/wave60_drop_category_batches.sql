-- wave60_drop_category_batches.sql
-- Removes the old Categorize Q&A system (category_question_items/
-- category_question_batches) now that category_statements (wave59) is live
-- and the old UI/client code has been deleted. Core loop redesign §3.
--
-- NOTE (found live, see wave61): `drop table category_question_batches
-- cascade` only cascades the FK CONSTRAINT on category_question_items — in
-- Postgres, DROP TABLE ... CASCADE drops dependent CONSTRAINTS/VIEWS, not
-- dependent TABLES. category_question_items survived this migration and
-- needed its own explicit drop in wave61.

drop function if exists public.reroll_category_batch_item(uuid, text, jsonb);
drop function if exists public.answer_category_question_item(uuid, int);
drop function if exists public.finalize_category_batches();
drop function if exists public.insert_category_batch_items(text, jsonb);

drop table if exists public.category_question_batches cascade;
