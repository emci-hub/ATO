---
name: question-round-facts
description: where per-trait question counts are decided, round composition, AI chunking, bank pool exclusion quirks
metadata:
  type: project
---

- Per-trait counts: tiered-axis-plan.ts AXIS_TIER_COUNTS (25), roundAxisCounts (lagging axes first); prewarm.ts reserveTargetFor reads AXIS_TIER_COUNTS x3; prompt.ts only echoes axisCounts. Docs/comments hardcode "25".
- Round = fillFromBank per axis -> fillAxisCountsChunked (CHUNK_SIZE 5, 1 retry, drafts with unrequested axis are dropped by slotsLeft cap) -> one more bank pass. Quota is claim_ai_call in ai-generate (claim_questions_batch wave17 is Infinite Questions only, not used by ongoing).
- Rounds write single-axis only (questions-fold saveRoundAnswers -> updateTraits [draft.axis]); secondaryAxes only in local bank path (answer.ts); addToBankPool drops primary/secondary.
- fetchRecentTexts adds ALL QUESTIONS_BANK prompts to exclude list, and pool is seeded from the same 50 -> authored pool is effectively unreachable in rounds; rounds are mostly per-user AI (wave74).
- Old bank (79ef77a^) had 3/axis; the removed 10 were each axis's 3rd entry.
- Option values are only 0.2/0.5/0.8, high value = high pole always (no reverse keying).
