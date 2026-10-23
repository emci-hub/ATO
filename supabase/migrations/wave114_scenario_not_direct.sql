-- wave114: a vibe-check scenario is an answer, not a lock.
--
-- trait_is_direct_source used to treat self_scenario like a settings edit, so
-- one onboarding tap full-replaced two traits and every later question on
-- those traits was count-only. The phone no longer sends that source as a
-- direct write. This replaces the function so an account that already has
-- self_scenario stored can be moved by the next real answer.
--
-- No rows are rewritten. The stored number stays until the next answer.
-- self_slider / self_tap / self_confirm / self_settings stay sticky.
-- Apply by hand:
--   supabase db query --linked -f supabase/migrations/wave114_scenario_not_direct.sql

begin;

create or replace function public.trait_is_direct_source(p_source text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_source in ('self_slider', 'self_tap', 'self_confirm', 'self_settings'), false);
$$;

alter function public.trait_is_direct_source(text) set search_path = public;

revoke all on function public.trait_is_direct_source(text) from public, anon, authenticated;

commit;
