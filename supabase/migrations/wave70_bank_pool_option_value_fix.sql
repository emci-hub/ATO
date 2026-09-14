-- wave70_bank_pool_option_value_fix.sql
-- Corrects one stray answer value in the shared question_bank_pool catalog.
--
-- NOT APPLIED YET — awaiting emci's review, same as wave68 and wave69.
--
-- Background: every question in src/lib/questions/bank.ts uses 0.2 / 0.5 / 0.8
-- for three-option questions (or 0.2 / 0.8 for two-option ones). One row broke
-- that pattern with a third option at 0.75 — an asymmetric high pole, so the
-- same "strongly agree"-shaped answer moved the trait less on this question
-- than on the other 49. scripts/band-study-check.ts surfaced it while proving
-- the reachable support of the instrument.
--
-- bank.ts and the wave49 seed text were both corrected in the band
-- recalibration commit. This migration exists because that is not enough:
-- wave49's seed is `insert ... on conflict (prompt) do nothing`, so on any
-- database where wave49 already ran, the row still holds the old value and
-- re-running the seed will not touch it. question_bank_pool is the SHARED
-- global catalog, so until this runs, every user drawing that question is
-- still served 0.75.
--
-- Matched on prompt, which is wave49's own conflict target and therefore
-- unique. Idempotent: re-running it is a no-op once the value is 0.8.

update public.question_bank_pool
set options = '[{"text":"I panic-order whatever''s closest","value":0.2},{"text":"Takes me a sec but I land on something","value":0.5},{"text":"I ask what everyone else got","value":0.8}]'::jsonb
where prompt = 'Everyone at the table already knows their order. You don''t.'
  and options @> '[{"value":0.75}]'::jsonb;
