-- trait_history.source CHECK predates self_scenario.
--
-- The optional-intake scenario flow (self_scenario, a DIRECT trait source,
-- added client-side Sep 1, 2026) is absent from the trait_history_source_known
-- CHECK written in wave19, so every insertTraitHistory batch that contained a
-- self_scenario row aborted with a CHECK violation -- silently swallowed by the
-- .catch in persistMergedTraits (src/lib/me.ts) while the me write succeeded.
-- Scenario answers therefore never reached trait_history (live count 0).
--
-- Re-add the constraint with the full 8-value TRAIT_SOURCES list, mirroring the
-- order in src/lib/traits.ts (DIRECT then INFERRED). No other client source was
-- missing (self_slider/self_tap/self_confirm/self_settings/self_grid/
-- self_situation/self_game were all already present).

alter table public.trait_history
  drop constraint if exists trait_history_source_known;

alter table public.trait_history
  add constraint trait_history_source_known check (source in (
    'self_slider',
    'self_tap',
    'self_confirm',
    'self_settings',
    'self_scenario',
    'self_grid',
    'self_situation',
    'self_game'
  ));

comment on constraint trait_history_source_known on public.trait_history is
  'Client TRAIT_SOURCES (direct + inferred) mirrored from src/lib/traits.ts. wave38 added self_scenario.';
