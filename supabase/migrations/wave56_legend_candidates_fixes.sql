-- wave56_legend_candidates_fixes.sql
--
-- Review fixes for wave55_legend_candidates.sql, found before push:
--
-- 1. CRITICAL: insert_legend_candidate had no require_root() and no quota
--    check inside it — only granted to `authenticated`, security definer,
--    writing into legend_figures/legend_variants/legend_archetypes, tables
--    wave25/wave32 deliberately revoke insert/update/delete from
--    authenticated on. Any signed-in user could call it directly (bypassing
--    the dev-lab UI entirely) and plant an attacker-authored candidate that
--    looks legitimate in the root review queue — a review-queue-poisoning
--    path, not just an unbounded-write one. Fixed: require_root() at the top
--    of the body, same as approve/reject already had. claim_legend_generation
--    also gains require_root() for the same reason — nothing else in this
--    feature calls it, and it should not be a general-authenticated-user quota
--    RPC when the entire workflow it feeds is root-only.
--
-- 2. approve_legend_variant now also requires fact_checked = false in its
--    WHERE clause — was previously happy to "approve" an already-approved
--    row (a harmless no-op today, but with no signal that nothing changed).
--    Matches reject_legend_variant's existing fact_checked = false guard.
--
-- 3. wave55's own migration comment (lines 20-23) claims require_root()
--    "checks handle='emci', not the live admin account emci2" — that was
--    true before wave34_root_is_column.sql, which is NOT true today:
--    require_root()/is_root() have read me.is_root (flipped for emci2) since
--    wave34. Correcting the record here rather than editing wave55's
--    already-applied file. Same stale copy in src/app/dev-lab.tsx
--    ("Sign in as emci") is corrected in the same commit as this migration.

create or replace function public.claim_legend_generation()
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
  perform public.require_root();

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

comment on function public.claim_legend_generation() is
  'Root-only (require_root()). Claim one Legend-candidate generation (legend_generations_daily_cap/day, default 5). Called once per generation attempt, BEFORE generateText/ai-generate.';

create or replace function public.insert_legend_candidate(
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
  perform public.require_root();

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

comment on function public.insert_legend_candidate(jsonb, jsonb, text) is
  'Root-only (require_root()) — closes a review-queue-poisoning path where any authenticated user could otherwise write a candidate that looks legitimate in the review screen (found in review, wave56). Always fact_checked=false, source=ai. canonical_slug conflict reuses the existing figure (never overwrites its other fields).';

create or replace function public.approve_legend_variant(p_variant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_root();

  update public.legend_variants
    set fact_checked = true
    where id = p_variant_id and fact_checked = false;

  if not found then
    raise exception 'variant not found or already approved' using errcode = '22023';
  end if;
end;
$$;

comment on function public.approve_legend_variant(uuid) is
  'Root-only (require_root()). Flips fact_checked true for a not-yet-approved row only (matches reject_legend_variant''s own guard) — a no-op re-approve now reports "already approved" instead of silently succeeding.';

-- Grants unchanged from wave55 (create or replace preserves them on the same signatures).
