---
name: shared-ai-library-facts
description: Map of the 3 AI card surfaces (deep dive, Story, Legends): prompts inputs, claim RPCs, save paths, trust model, pool precedents (wave74 made AI pool rows owner-only)
metadata:
  type: project
---

- Latest migration is wave92_ai_tokens.sql (next = wave93). Claims: claim_story_generate / claim_legend_figure_story / claim_category_deep_dive (all no-arg, charge _charge_ai_tokens(uid, kind)); refund_ai_tokens(p_kind text).
- Saves are client-validated then client-RPC: save_category_deep_dive(cat,leans_key,story,made_on), save_legend_figure_story(...), Story = direct update me.sage_story. ai-generate only checks consent + claim_ai_call(callType explore|sage), writes nothing, prompt is free client text.
- wave74 precedent: AI pool rows (question_bank_pool, daily_line_pool) were made OWNER-ONLY on purpose (client could write arbitrary text shared to all). A shared AI library reverses that stance.
- No "retire a bad row" column on either pool; no per-user seen table except daily_line_days / question_items anti-join / question_bank_reroll_exclusions.
- Deep dive leansKey = `v2|axis:lean:round(pct/10),...` (axis-sorted); prompt gets only pole name + strongly/clearly/slightly + sounds-like; joke style seeded by userId.
- Story: sage_story JSON on me row; "Built from" computed locally from thread categoryIds+tracks; prompt includes user-specific TOLD-VS-PLAYED note (divergence).
- Legends: whereYouMatch/differ stored lean per axis; "Matched on" = matchedOnLine(pick.ts) computed locally, not stored.
