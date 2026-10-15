---
name: intake-empty-traits-facts
description: 2026-10-02 finding - 4 axes empty after "50 done"; pager row order, gate math, tier shape
metadata:
  type: project
---

- Full Profile pager (components/paged-questions.tsx, PAGE_SIZE 5) rows = uniqueCategoryAxes(CATEGORY_DEFS) order: cons, agree, steady, open, extra, auto, comp, rel, growth, locus, selfeff, play, assert(4), coop(2), anx(2), avoid(2). The LAST 10 rows (pages 9-10) are exactly the four empty axes (conflict_*, attachment_*).
- Saves are background (runBatchSave), only on Next/Finish, only for pending picks; stale AsyncStorage stamps (not cleared by reset RPC) make rows look answered with no save. upsertTraitTracks errors are swallowed in persistMergedTraits (.catch console.log). DB axis CHECKs are fine (wave21).
- Gate bankTotalProgress = sum min(report answerCount, bank size) per axis, capped per axis -> cannot reach 50 with an axis at 0; so the 4 empty axes means the gate was NOT done (<=40/50).
- Bank per-axis = 2 x AXIS_TIER_COUNTS (tiered-axis-plan.ts); frozen-intake-check asserts length == TIERED_ROUND_SIZE*2. Not even per axis.
