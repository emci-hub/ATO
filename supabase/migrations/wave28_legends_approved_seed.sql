-- Wave 28: Legends — seed the 4 approved legends + archetype links.
-- Applied to production 2026-09-02 (project aijzsmupaaaxjctfgwpl, migration
-- 20260902182605_wave28_legends_approved_seed).
--
-- Content copied verbatim from docs/legends-content-spec.md "Reference
-- samples (approved 2026-09-02)". teaser and full_story are stored exactly as
-- approved (full_story keeps the blank line between the grounding paragraph
-- and the "[Name] Energy:" block). fact_checked=false pending emci's review —
-- unchecked legends are never presented as fact.
--
-- Depends on wave25 schema + the wave26 archetype_defs seed (the four
-- arch_the_* ids below). Idempotent: legends upsert on canonical_slug,
-- junction inserts on conflict do nothing.

-- 1. legends -----------------------------------------------------------------

insert into public.legends
  (canonical_slug, name, era_title, type, teaser, full_story, fact_checked)
values
  ('leonardo-da-vinci-1452', 'Da Vinci', 'Renaissance Italy', 'historical',
   'Never finished anything — because finishing wasn''t the point.',
   'Da Vinci kept notebooks of unfinished machines, half-solved anatomy, plans within plans. He carried the Mona Lisa for over a decade, endlessly retouching.

Architect Energy: the structure isn''t a chore, it''s the actual joy. The discomfort you feel with ''good enough'' isn''t a flaw — it''s the same instinct that let him see what nobody else had drawn yet.',
   false),
  ('alexander-the-great-356bc', 'Alexander the Great', 'Ancient Macedonia', 'historical',
   'Ran out of world before he ran out of drive.',
   'He led every major battle from the front line, not the back of the formation — first into danger, not last out of it. When there was nothing left to conquer, the story goes he wept. Not from grief, but from stillness.

Front-Liner Energy: rest doesn''t feel like relief, it feels like a problem. The pull you feel toward the next thing, before this one''s even settled, isn''t restlessness — it''s the same hunger that moved him.',
   false),
  ('confucius-551bc', 'Confucius', 'Spring and Autumn China', 'historical',
   'Said less than everyone else — and still ended up right.',
   'He spent years observing before ever teaching, convinced that watching how people actually behaved mattered more than any theory about how they should. His students recorded his words specifically because he rarely wasted them.

Watcher Energy: silence isn''t absence, it''s data collection. The instinct to hold back until you''ve actually seen the pattern isn''t hesitation — it''s the same discipline that made people listen when he finally spoke.',
   false),
  ('athena-greek-mythology', 'Athena', 'Greek mythology', 'mythical',
   'Never needed to raise her voice to win the room.',
   'Where other gods won through force or spectacle, Athena won through strategy — famously outmaneuvering rather than overpowering. She was the one generals prayed to before a battle, not the one who fought loudest in it.

Commander Energy: control isn''t about volume, it''s about being three moves ahead. The calm you carry into chaos isn''t coldness — it''s the same clarity that made her the god armies actually trusted.',
   false)
on conflict (canonical_slug) do update set
  name = excluded.name,
  era_title = excluded.era_title,
  type = excluded.type,
  teaser = excluded.teaser,
  full_story = excluded.full_story,
  fact_checked = excluded.fact_checked;

-- 2. legend_archetypes (links) ------------------------------------------------

insert into public.legend_archetypes (legend_id, archetype_id)
select l.id, a.id
from (values
  ('leonardo-da-vinci-1452',    'arch_the_architect'),
  ('alexander-the-great-356bc', 'arch_the_front_liner'),
  ('confucius-551bc',           'arch_the_watcher'),
  ('athena-greek-mythology',    'arch_the_commander')
) as v (slug, arch_id)
join public.legends l on l.canonical_slug = v.slug
join public.archetype_defs a on a.id = v.arch_id
on conflict (legend_id, archetype_id) do nothing;
