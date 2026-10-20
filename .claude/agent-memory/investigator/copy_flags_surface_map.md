---
name: copy-flags-surface-map
description: 2026-10-19 map of false *_COPY_REVIEWED flags -> surfaces, counts, review docs, checks
metadata:
  type: project
---

- Flags false (16): TEAM, CATEGORY_BANK, DAILY_PICK, CATEGORY_STATEMENTS, CATEGORY_DEEP_DIVE, DAILY_INSIGHT, PROFILE_CARD, INSIGHT_BANK, POLISH, LEGEND_FIGURES, STORY, TITLE, CATEGORY_READ, STORY_BANK, BANK, STAGED_INTAKE (UNLOCK = alias). Hub list: dev-hub-panels.tsx COPY_FLAGS (~568).
- No screen hard-gates on any flag except push-insight.ts:69 (CATEGORY_STATEMENTS). All others only show a PRE_LAUNCH_DEV badge or nothing.
- Counts: DAILY_PICKS 64, insight bank 208 (192 trait + 16 starter), QUESTION_BANK 400 (intake(1..3) in bank/*.ts = 48; 352 rest, 22/trait), story-bank 66, legends 120, teams 48 phrases + 10 endings.
- Review docs w/ real checkboxes: category-bank (37), insight-bank (209), daily-line(341), legend-figures(120). Generated (no boxes): category-deep-dive, team-names (gen-*-review.ts scripts).
- ai-library.bundle.js includes category-bank text, legend roster, deep-dive/story prompts; NOT teams, insight-bank, daily-pick, polish.
