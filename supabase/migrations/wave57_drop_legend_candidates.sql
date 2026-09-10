-- wave57_drop_legend_candidates.sql
-- Clean-slate removal of the old Legends content system (figures/variants/
-- archetypes catalog + legend-candidates review tool). Pre-launch, no user
-- data to preserve — see core loop redesign §4 / emci's 2026-09-09 decision.
--
-- trait_axis_valid: confirmed its ONLY caller anywhere in the schema is the
-- archetype_defs_trait_axis_valid CHECK constraint on archetype_defs itself
-- (wave25) — dropped here alongside that table. Its own migration comment
-- already said as much ("Clients never call it; it backs the archetype_defs
-- CHECK"), verified by grepping every migration for other callers before
-- this migration was finalized.
--
-- Signatures below were read directly from the live `create or replace
-- function` statements in wave25/wave55/wave56, not guessed — DROP FUNCTION
-- matches by full signature, so a wrong parameter list would silently no-op
-- rather than error.
--
-- ORDER FOUND LIVE (2026-09-10): a first apply attempt with
-- `trait_axis_valid` dropped before the table drops failed —
-- 2BP01: cannot drop function trait_axis_valid(text) because other objects
-- depend on it (archetype_defs_trait_axis_valid CHECK constraint). The table
-- must drop first so that CHECK constraint is gone before the function drop
-- runs. Reordered below to match what actually applied successfully.

drop function if exists public.reject_legend_variant(uuid);
drop function if exists public.approve_legend_variant(uuid);
drop function if exists public.insert_legend_candidate(jsonb, jsonb, text);
drop function if exists public.claim_legend_generation();

-- Drop order is leaf-first (defensive) — cascade is also present as
-- insurance, though no FK from any table OUTSIDE this 5-table set points
-- into any of them (confirmed by grepping every migration file).
drop table if exists public.user_legend_history cascade;
drop table if exists public.legend_archetypes cascade;
drop table if exists public.legend_variants cascade;
drop table if exists public.legend_figures cascade;
drop table if exists public.archetype_defs cascade;

drop function if exists public.trait_axis_valid(text);

-- Old per-generation quota cap (wave55), superseded by wave58's
-- legend_story_generations_daily_cap for the new system.
alter table public.app_config drop column if exists legend_generations_daily_cap;
