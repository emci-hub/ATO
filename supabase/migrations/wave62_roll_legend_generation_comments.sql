-- wave62_roll_legend_generation_comments.sql
-- Comment-only fix (core loop redesign §4, T-15): the legend item in a roll
-- now generates a real story via the 64-archetype system (rolls/compose.ts),
-- so wave46/wave48's "legend match is free/deterministic" and "~12
-- sub-generations" claims are stale — corrected here rather than editing
-- those already-applied migrations in place, same convention wave48 used to
-- correct wave46's claim_roll comment.

comment on column public.app_config.rolls_daily_cap is
  'Per-user daily cap on trait-roll generations. One roll = one quota unit regardless of its ~13 sub-generations (11 category reads + 1 story + 1 legend story, core loop redesign §4 — legend used to be free/deterministic matching against a figure catalog, now a real AI call like the others). This is the blunt backstop from §7 — RCI eligibility is checked client-side (src/lib/rci.ts, src/lib/rolls/run.ts), not independently re-verified server-side (a known, accepted gap).';

comment on column public.app_config.roll_generations_daily_cap is
  'Per-user daily cap on individual roll-content generations (category reads + story + legend story, core loop redesign §4), claimed once per generation call — separate from rolls_daily_cap (which gates how many roll COMPOSITIONS may start per day, not how many generations one composition makes). A roll now needs ~13 generations (was ~12 before the legend item started generating a real story), still comfortably under the default cap of 15.';
