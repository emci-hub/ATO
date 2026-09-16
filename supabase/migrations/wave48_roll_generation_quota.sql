-- Trait system redesign (§7): a dedicated, per-generation quota for roll
-- content, layered IN FRONT OF the shared ai-generate dispatch — not a
-- change to ai-generate itself.
--
-- Found in review of the client-side roll wiring (wave46/47 already
-- applied): src/lib/rolls/generate.ts's generateRollItemText goes through
-- the same generateText -> ai-generate path every other feature uses, which
-- claims quota against the SHARED Sage/Explore pool (claim_ai_call,
-- ai_daily_cap/ai_monthly_cap) regardless of which feature is calling —
-- confirmed by tracing the actual dispatch code (src/lib/ai/edge.ts never
-- sends a callType at all, so ai-generate always defaults to 'sage'). This
-- is true for EVERY existing AI feature today, not something rolls
-- introduced — Infinite Questions has the exact same shape: its own
-- questions_daily_cap (claim_questions_batch, wave17) is claimed BEFORE
-- calling generateText, as an ADDITIONAL bound layered in front of the
-- shared pool, not a replacement for it. That is the real, working pattern
-- this repo already uses to bound one feature's cost independently — this
-- migration gives rolls the same shape, mirroring claim_questions_batch
-- exactly, rather than attempting to modify the already-live ai-generate
-- Edge Function (a much larger, riskier change with no way to test it live
-- — this Supabase project has no branching on its current plan).
--
-- rolls_daily_cap (wave46, claim_roll) still gates how many roll
-- COMPOSITIONS may be attempted per day (1). This new cap gates how many
-- individual AI GENERATIONS roll composition may make per day — a roll
-- needs ~12 (11 category reads + 1 story), so the default gives a little
-- headroom for the shortfall-retry pattern src/lib/questions/chunked-generate.ts
-- already established, without being large enough to fund a second roll's
-- worth of generations on its own.

alter table public.app_config
  add column if not exists roll_generations_daily_cap int not null default 15
    check (roll_generations_daily_cap >= 0);

comment on column public.app_config.roll_generations_daily_cap is
  'Per-user daily cap on individual roll-content generations (category reads + story), claimed once per generation call — separate from rolls_daily_cap (which gates how many roll COMPOSITIONS may start per day, not how many generations one composition makes).';

create or replace function public.claim_roll_generation()
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

  select roll_generations_daily_cap into strict cap from public.app_config where id = 1;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':roll_gen'));

  insert into public.ai_usage (user_id, day, calls, by_type)
  values (uid, today, 0, '{}'::jsonb)
  on conflict (user_id, day) do nothing;

  select coalesce((by_type->>'roll_gen')::int, 0) into used
    from public.ai_usage
    where user_id = uid and day = today;

  if used >= cap then
    return jsonb_build_object(
      'ok', false,
      'reason', 'quota',
      'daily', used,
      'daily_cap', cap,
      'call_type', 'roll_gen'
    );
  end if;

  update public.ai_usage
    set by_type = jsonb_set(
      coalesce(by_type, '{}'::jsonb),
      '{roll_gen}',
      to_jsonb(used + 1)
    )
    where user_id = uid and day = today
    returning coalesce((by_type->>'roll_gen')::int, 0) into used;

  return jsonb_build_object(
    'ok', true,
    'daily', used,
    'daily_cap', cap,
    'call_type', 'roll_gen'
  );
end;
$$;

revoke all on function public.claim_roll_generation() from public, anon;
grant execute on function public.claim_roll_generation() to authenticated;

comment on function public.claim_roll_generation() is
  'Claim one roll-content generation (roll_generations_daily_cap/day, default 15). Called once per category-read/story generation attempt, BEFORE the generateText/ai-generate call — does not itself call a vendor or touch the shared Sage/Explore quota (that still happens separately inside ai-generate, same as every other feature today).';

-- Correct the earlier claim_roll comments (wave46), which claimed RCI
-- eligibility is "decided in the calling Edge Function" — no such Edge
-- Function exists. Eligibility (rollEligible, src/lib/rolls/compose.ts)
-- currently runs client-side only, same trust-the-caller-with-a-hard-bound model this
-- repo already uses for claim_intake_complete — bounded by rolls_daily_cap
-- (1/day) regardless of whether the RCI check was honestly evaluated. Two
-- separate comments carried this claim (the function's own, and the
-- rolls_daily_cap column's) — both corrected here, found in review.
comment on function public.claim_roll() is
  'Claim one roll generation (rolls_daily_cap/day, default 1). Does not increment Sage/Explore/Questions calls. RCI eligibility (rollEligible) is checked client-side before this is called — not independently re-verified server-side (a known, accepted gap; bounded by this 1/day cap regardless).';

comment on column public.app_config.rolls_daily_cap is
  'Per-user daily cap on trait-roll generations. One roll = one quota unit regardless of its ~12 sub-generations (legend match is free/deterministic; 11 category reads + 1 story are the AI calls, each separately bounded by roll_generations_daily_cap above). This is the blunt backstop from §7 — RCI eligibility is checked client-side (src/lib/rci.ts, src/lib/rolls/run.ts), not independently re-verified server-side (a known, accepted gap).';
