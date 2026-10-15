---
name: intake-48-plan-facts
description: 2026-10-02 audit of 50->48 (3/trait) intake change; server 50-row token gate, literals, stale-tab deps
metadata:
  type: project
---

- claim_full_profile_complete (supabase/migrations/wave52_ato_tokens_fixes.sql:180-185) requires >=50 self_situation trait_history rows: 48-question intake cannot pay +21 without a new migration.
- Gate = bankTotalProgress (questions/local.ts:156) sum min(answerCount, bank size) per axis; axisVariant = report answerCount = which bank draft shows next.
- Settled = answerCount>=3 and stability>0 (EWMA agreement; first answer sets stability 0). Category ready = >=2 stable axes (categories.ts:331, minStable 2; map-shape needs both axes).
- Home refetches via useFocusEffect(reloadHome) index.tsx:179; explore.tsx:55 deps [userId, me, dataEpoch]; categories-fold.tsx:148 [me.id, me.updated_at, dataEpoch] - count-only answers do not change me.
- Silent track save failure: me.ts:532 upsertTraitTracks .catch console.log only.
