-- wave55_legend_candidates.sql
--
-- AI-generated Legend candidates (T-06). 8 of 12 archetype_defs (wave26) have
-- zero legend_variants — this closes that gap without a parallel pool table:
-- legend_variants already has the exact right gate (`fact_checked`, false
-- until a human verifies it — wave32), and fetchLegendCatalog already only
-- ever reads fact_checked=true rows, so an AI candidate simply lands in the
-- existing tables with fact_checked=false and is invisible to matching/reroll
-- until approved. Approving it needs zero client-side matching/reroll code
-- change — bestVariantForFigure and buildLegendView already only see
-- approved rows.
--
-- Quota: claim_legend_generation mirrors claim_roll_generation
-- (wave48_roll_generation_quota.sql) exactly — its own app_config cap column
-- and its own ai_usage.by_type key, claimed BEFORE generateText, independent
-- of the shared Sage/Explore pool. One legend candidate = one generation, so
-- (unlike rolls, which layer a composition cap in front of a generation cap)
-- this is the only cap this feature needs.
--
-- Review gate: approve/reject are root-only (require_root(), same function
-- every other root RPC in this repo uses — inherits that function's known,
-- already-tracked gap that it checks handle='emci', not the live admin
-- account emci2; not fixed here, out of this migration's scope).

-- 1. legend_variants.source -----------------------------------------------

alter table public.legend_variants
  add column if not exists source text not null default 'authored'
    check (source in ('authored', 'ai'));

comment on column public.legend_variants.source is
  'authored (hand-written, the only kind before this migration) | ai (generated via insert_legend_candidate, always inserted with fact_checked=false). Mirrors question_bank_pool.source.';

-- 2. claim_legend_generation -------------------------------------------------

alter table public.app_config
  add column if not exists legend_generations_daily_cap int not null default 5
    check (legend_generations_daily_cap >= 0);

comment on column public.app_config.legend_generations_daily_cap is
  'Per-user daily cap on Legend-candidate generations (one figure+variant proposal = one generation), claimed once per attempt — separate from the shared Sage/Explore pool, same shape as roll_generations_daily_cap.';

create function public.claim_legend_generation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap int;
  today date := (timezone('utc', now()))::date;
  used int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select legend_generations_daily_cap into strict cap from public.app_config where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':legend_gen'));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select coalesce((by_type->>'legend_gen')::int, 0) into used
    from public.ai_usage
    where user_id = uid and day = today;

  if used >= cap then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota',
      'daily', used,
      'daily_cap', cap,
      'call_type', 'legend_gen'
    );
  end if;

  update public.ai_usage
    set by_type = jsonb_set(
      coalesce(by_type, '{}'::jsonb),
      '{legend_gen}',
      to_jsonb(used + 1)
    )
    where user_id = uid and day = today
    returning coalesce((by_type->>'legend_gen')::int, 0) into used;

  return jsonb_build_object(
    'ok', true,
    'daily', used,
    'daily_cap', cap,
    'call_type', 'legend_gen'
  );
end;
$$;

revoke all on function public.claim_legend_generation() from public, anon;
grant execute on function public.claim_legend_generation() to authenticated;

comment on function public.claim_legend_generation() is
  'Claim one Legend-candidate generation (legend_generations_daily_cap/day, default 5). Called once per generation attempt, BEFORE generateText/ai-generate — does not itself call a vendor or touch the shared Sage/Explore quota.';

-- 3. insert_legend_candidate -------------------------------------------------

create function public.insert_legend_candidate(
  p_figure jsonb,
  p_variant jsonb,
  p_archetype_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_slug text := btrim(coalesce(p_figure->>'canonical_slug', ''));
  v_name text := btrim(coalesce(p_figure->>'name', ''));
  v_era text := btrim(coalesce(p_figure->>'era_title', ''));
  v_type text := btrim(coalesce(p_figure->>'type', ''));
  v_variant_key text := btrim(coalesce(p_variant->>'variant_key', ''));
  v_teaser text := btrim(coalesce(p_variant->>'teaser', ''));
  v_full_story text := btrim(coalesce(p_variant->>'full_story', ''));
  v_figure_id uuid;
  v_variant_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_slug = '' or v_name = '' or v_era = '' or v_type = '' then
    raise exception 'figure fields required' using errcode = '22023';
  end if;
  if v_variant_key = '' or v_teaser = '' or v_full_story = '' then
    raise exception 'variant fields required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.archetype_defs where id = p_archetype_id) then
    raise exception 'unknown archetype_id' using errcode = '22023';
  end if;

  insert into public.legend_figures (canonical_slug, name, era_title, type)
  values (v_slug, v_name, v_era, v_type)
  on conflict (canonical_slug) do update set canonical_slug = excluded.canonical_slug
  returning id into v_figure_id;

  insert into public.legend_variants (figure_id, variant_key, teaser, full_story, fact_checked, source)
  values (v_figure_id, v_variant_key, v_teaser, v_full_story, false, 'ai')
  on conflict (figure_id, variant_key) do nothing
  returning id into v_variant_id;

  if v_variant_id is null then
    raise exception 'duplicate variant_key for this figure' using errcode = '23505';
  end if;

  insert into public.legend_archetypes (legend_id, archetype_id)
  values (v_variant_id, p_archetype_id)
  on conflict do nothing;

  return jsonb_build_object('figure_id', v_figure_id, 'variant_id', v_variant_id);
end;
$$;

revoke all on function public.insert_legend_candidate(jsonb, jsonb, text) from public, anon;
grant execute on function public.insert_legend_candidate(jsonb, jsonb, text) to authenticated;

comment on function public.insert_legend_candidate(jsonb, jsonb, text) is
  'Writes an AI-proposed figure+variant+archetype-link, always fact_checked=false and source=ai — invisible to fetchLegendCatalog/matching/reroll until approve_legend_variant flips it. canonical_slug conflict reuses the existing figure (never overwrites its other fields) so a candidate for an already-authored figure adds a new variant to it instead of erroring.';

-- 4. approve_legend_variant / reject_legend_variant (root-only) --------------

create function public.approve_legend_variant(p_variant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_root();

  update public.legend_variants
    set fact_checked = true
    where id = p_variant_id;

  if not found then
    raise exception 'variant not found' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.approve_legend_variant(uuid) from public, anon;
grant execute on function public.approve_legend_variant(uuid) to authenticated;

comment on function public.approve_legend_variant(uuid) is
  'Root-only (require_root()). Flips fact_checked true — the moment a candidate becomes servable to real users via matching + reroll, no other write needed.';

create function public.reject_legend_variant(p_variant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_root();

  delete from public.legend_variants
    where id = p_variant_id and fact_checked = false;

  if not found then
    raise exception 'not found or already approved' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.reject_legend_variant(uuid) from public, anon;
grant execute on function public.reject_legend_variant(uuid) to authenticated;

comment on function public.reject_legend_variant(uuid) is
  'Root-only (require_root()). Deletes a not-yet-approved candidate variant (cascades its legend_archetypes link). Refuses to delete an already-approved (fact_checked=true) row — rejection is only for candidates, never a way to unpublish live content. A rejected candidate can leave an orphan legend_figures row with zero variants if it was that figure''s only one — harmless (fetchLegendCatalog only ever starts from legend_variants), not cleaned up here.';
