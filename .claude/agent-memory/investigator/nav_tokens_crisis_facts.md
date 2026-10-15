---
name: nav-tokens-crisis-facts
description: Non-obvious wiring facts (2026-10-01) for nav slots, ATO tokens, crisis_flags, Home insight cache
metadata:
  type: project
---

- nav-order.ts: home+sage are PINNED (PINNED_IDS), POOL_SLOTS=2; no layout version, `me.nav_layout` normalized on read (me.ts:252) so saved layouts keep Sage. Changing default needs pinned/pool re-split; nav-check.ts pins it hard.
- claimFullProfileComplete (ato-tokens-server.ts) has zero callers; wave52 RPC checks trait_history self_situation >= 50, idempotent via unique index. Spend RPCs raise P0040 on insufficient (reroll.ts trySpend maps it), return ok:false/already:true on daily cap.
- logCrisisFlag does not exist; crisis_flags table + policies are NOT in supabase/migrations (predates tracking). Nothing writes it; no free-text UI feeds detectCrisis (addFact/SageFactsCard have no UI callers; current_focus is a 4-value enum).
- Home shows cached insight (AsyncStorage ato.today-insight.v1, single latest) even if ymd != today; fetchInsightHistory exists but has no caller.
- No scripts/crisis-check.ts exists (only crisis-region-check).
