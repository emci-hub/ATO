---
name: ai-launch-audit-facts
description: 2026-10-19 Area-3 audit: live AI = ai-library only; ai-generate is an open prompt proxy; crisis gate dead; check-in tz farming; unchecked boxes 29-32
metadata:
  type: project
---

- Live AI path: client writeLibraryCard -> ai-library fn (consent, claim_library_write, bundle prompt, checks, library_add_cards). Legacy generateText paths (category-deep-dive/generate.ts, legend-figures/generate.ts writeLegendStory) run only on 404 'missing' fallback. rolls/runRoll, reroll.ts, category-statements, legends64/generate-story have NO callers (dead). Story kind has no client caller (server/fill/bundle still support it).
- ai-generate (supabase/functions/ai-generate/index.ts) takes arbitrary client prompt (24k chars), any of 6 providers incl claude, 1024 out; only gate = consent + claim_ai_call (20/day, 200/mo, stage8/wave17). Nothing in the app needs it any more except fallbacks.
- _library_crisis reads crisis_flags, which nothing writes -> gate always false. app-privacy-labels.md still lists crisis_flags.
- claim_daily_checkin keys on me.timezone (no write guard found) -> likely farmable up to ~3 dates/day.
- ai-library-fill (wave94) = cron, global library_fill_daily_cap 400, per_run 5; not mentioned in CLAUDE.md.
- Device boxes 29-32 (Legends, deep dive, Story, tokens) all unticked; Box 30/32 text stale (mentions Sage/Story AI).
