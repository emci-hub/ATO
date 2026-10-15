---
name: legends-feature-facts
description: Main-app "Legends" = 64-archetype names (legends64), no historical-figure match exists; old figure catalog dropped wave57; ai-generate has no kind whitelist
metadata:
  type: project
---

- 2026-10-08 audit: no live historical-figure Legends. `(tabs)/legends.tsx` is RebuiltNotice. Old figure catalog (wave25-33, legends/legend_variants, fact_checked gate) + AI candidates (wave55) dropped in wave57 clean-slate.
- Live piece = identity card (src/lib/legends64/identity*.ts, components/identity-card.tsx), local key `ato.identity.v1`. generateLegendStory/legend_generations (wave58, claim_legend_story_generation cap 5/day) is dead (only questions/reroll.ts imports it).
- ai-generate (supabase/functions/ai-generate/index.ts): NO feature/kind whitelist. Client edge.ts sends no callType; server defaults 'sage'. Provider whitelist only. New AI feature needs no edge deploy; per-feature cap = new claim_* RPC + app_config column (copy claim_story_generate wave22 / wave58).
- Story v2 AI path: sage-story-fold.tsx -> claimStoryGenerate -> generateStoryBody (explore/generate.ts) -> parseStoryAnswer (sage-story.ts); 2 passes; saved to me.sage_story.
- Checks: scripts/<name>-check.ts, registered as "check:<name>" in package.json; ota-gate auto-discovers every check:* except EXCLUDED set.
