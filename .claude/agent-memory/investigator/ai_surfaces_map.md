---
name: ai-surfaces-map
description: Where ATO AI calls live (2026-09-30 audit) - live vs parked surfaces, edge fn facts
metadata:
  type: project
---

- All model calls: src/lib/ai/generate.ts generateText -> edge.ts -> supabase/functions/ai-generate/index.ts (claim_ai_call shared 20/day, 200/mo; max 1024 tok; client can pick provider but not model).
- Live callers (Sep 30): Home daily insight (src/lib/insight/generate-insight.ts), Home SageStoryFold (generateStoryBody), Explore categories-fold (category statements), questions-fold ongoing round + prewarm (generateOngoingRoundBatch).
- Parked/dead: sage.tsx (Talk placeholder), roll.tsx, legends.tsx (RebuiltNotice); sage-title-card, sage-insight, explore-panel have no importers; legends64/rolls generators unreachable.
- 11 categories in src/lib/categories.ts CATEGORY_DEFS; legends64/classify.ts is deterministic (6 axes midpoint 0.5).
- detectCrisis (src/lib/crisis/detect.ts) has no caller outside crisis dir after Talk removal.
- NOW.md is huge (31k tokens): grep it, do not read whole.
