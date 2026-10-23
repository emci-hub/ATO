---
name: content-inventory-facts
description: 2026-10-01 audit of post-intake content assets - what feeds personalised content, what is dead, share mechanics
metadata:
  type: project
---

- Home insight: generate-insight.ts (5 fields, caps 60/80/400/200/200), tap-only, table daily_insights (wave69), cache key ato.today-insight.v1 (also widget). No reroll/save/share/react UI. fetchInsightHistory has no caller. recentTone always [] and current_focus only ever written null (onboarding.tsx:187).
- Edge fn ai-generate has NO per-kind logic: callType only 'sage'|'explore'; caps app_config ai_daily_cap 20 / monthly 200 / story_daily_cap 1 / questions_daily_cap 3 (questions claim may be unused now).
- Share: expo-sharing + react-native-view-shot are in package.json but NO src file imports them; lib/share.ts (named in share-poster.tsx comment) does not exist. SharePoster only renders on [handle].tsx. Circle, Around, Legends, Sage tabs are all RebuiltNotice placeholders.
- category-statement-archive-fold.tsx has no importer; milestones/MilestoneToast mostly dead (toast reused for round-complete only).
- *_COPY_REVIEWED flags only show a dev banner (PRE_LAUNCH_DEV) except push-insight.ts:69 which hard-gates the insight push on CATEGORY_STATEMENTS_COPY_REVIEWED.
