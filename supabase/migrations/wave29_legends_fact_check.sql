-- Wave 29: Legends — flip fact_checked to true for the 4 approved legends.
-- Applied to production 2026-09-02 (project aijzsmupaaaxjctfgwpl).
--
-- Fact-check pass on the grounding paragraph of each legend (the "[X] Energy"
-- section is interpretive by design and was excluded): no specific invented
-- dates or quotes in any of the four; the general claims are accurate or
-- well-known lore (the Alexander weeping anecdote is hedged with "the story
-- goes" in the stored copy, keeping it honest as lore). All four passed, so
-- flip fact_checked. Idempotent.

update public.legends
set fact_checked = true
where canonical_slug in (
  'leonardo-da-vinci-1452',
  'alexander-the-great-356bc',
  'confucius-551bc',
  'athena-greek-mythology'
);
