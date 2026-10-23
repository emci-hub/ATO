---
name: launch-readiness-facts
description: Launch gaps as of 2026-10-19: PRE_LAUNCH_DEV/free-hero flip, no supabase/config.toml, stale legal text, app.json privacy manifest, branches
metadata:
  type: project
---

- PRE_LAUNCH_DEV=true (src/lib/dev-mode.ts:15); PLAY_EVERYTHING_FREE follows (also zeroes aura/finish cost, playStore.ts:2048/2056/2929-3017; airportFree at :6716 only grants on load, never revokes saved owned_hero_ids). check:release-mode passes unenforced (44 checks) without RELEASE_MODE=1.
- No supabase/config.toml: verify_jwt not committed; functions must auth in code (GOTCHAS.md:43).
- Legal: docs/legal/*.DRAFT.md not shipped; src/app/legal/*.md + landing/privacy.html still mention Sage/crisis_flags (app-privacy-labels.md lines 18-20, 50-51).
- app.json privacyManifests hand-listed (no health, no location); Sentry sendDefaultPii false, traces 0 (src/lib/sentry.ts).
- feature/insights-replace-sage is merged (git log master..branch empty). Many other branches look unmerged only because of squash merges.
- PROJECT_CONTEXT.md:557-603 = pre-launch re-gating checklist (guessable QA invite code, play_dev_logs anon-select, dev-test password in git history).
