-- Wave 33: Legends — Da Vinci gains a second story variant (v2).
--
-- wave32 split figures from variants and made never-repeat per VARIANT, so a
-- figure can resurface later through a different angle. This seeds Da Vinci's
-- first resurface: a v2 on the same Archetype (arch_the_architect) with a
-- different hook than v1 ("never finished anything" — perfectionism) — v2 is
-- the systematic, self-directed study that made the masterpieces look
-- effortless. Same figure_id, new variant_key, archetype linked.
--
-- fact_checked is true here (device-verify requires it to surface); the copy
-- is newly authored and should still get emci's read.
--
-- Idempotent: the variant insert no-ops on the (figure_id, variant_key)
-- unique constraint; the junction insert no-ops on (legend_id, archetype_id).

begin;

-- 1. New v2 variant (same figure_id, distinct variant_key) --------------------

insert into public.legend_variants
  (id, figure_id, variant_key, teaser, full_story, fact_checked)
select
  gen_random_uuid(), f.id, 'v2',
  'Made masterpieces look effortless because he never skipped the tedious part.',
  'Made masterpieces look effortless because he never skipped the tedious part. Da Vinci filled notebook after notebook with studies — hands, skulls, the flow of water — working mostly alone for years before attempting his major works. He dissected human bodies to learn the muscles and structure underneath what everyone else only glanced at.

Architect Energy: the patient, self-directed study isn''t stalling — it''s how you see the structure everyone else skips. The urge to understand the whole system before you move isn''t hesitation; it''s the same instinct that made his finished work feel inevitable.',
  true
from public.legend_figures f
where f.canonical_slug = 'leonardo-da-vinci-1452'
on conflict (figure_id, variant_key) do nothing;

-- 2. Link v2 to the same archetype -------------------------------------------

insert into public.legend_archetypes (legend_id, archetype_id)
select v.id, 'arch_the_architect'
from public.legend_variants v
join public.legend_figures f on f.id = v.figure_id
where f.canonical_slug = 'leonardo-da-vinci-1452'
  and v.variant_key = 'v2'
on conflict (legend_id, archetype_id) do nothing;

commit;
