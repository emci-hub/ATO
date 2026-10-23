---
name: unlock-intake-facts
description: How the 50-question intake, unlocks, milestones, settled/filled counts and token claims actually behave in code (2026-10-01 audit)
metadata:
  type: project
---

- Live unlock = ONE signal: src/lib/full-profile-gate.ts isFullProfileDone (bankTotalProgress answered>=total, 50). Gates Home Load insight/story, Questions next-25, Explore categories. sageUnlocked(25)/legendsUnlocked(50) in questions/progressive-unlock.ts only read by dev-lab + rolls/compose (parked). Sage and Legends tabs are RebuiltNotice placeholders.
- src/lib/milestones.ts MILESTONE_DEFS + components/milestone-toast.tsx have ZERO live callers (only humanizeAxis is imported, by paged-questions). me.celebrated_milestone_ids (wave43) + persistCelebratedMilestones exist server-side but unused.
- Only live celebration: components/full-profile-banner.tsx (AsyncStorage per device+account, key ato.profile.fullUnlock.seen.<id>.v1), mounted in app/(tabs)/intake-sweep.tsx.
- bankTotalProgress counts per-axis answerCount (capped at bank list length), NOT distinct questions: re-answering, Full Profile slider edits (self_settings), any updateTraits all advance it. Bank = 50 (6/6/6, 4/4/4, 2x10). Round = 25 fixed (tiered-axis-plan: 3,3,3,2,2,2,1x10), not adaptive.
- "N of 16 settled" label = Math.round(SUM of effectiveStability) (trait-stability.ts settledCount), not axis count. Max stability after 3 answers 0.5775. After 50 intake: 6 axes have >=3 answers, label ~4-5, isThinProfile(<6/15) true => storyReady false => Story says "Not ready yet" right after "unlocked". After round 1 all 16 have 3 answers, label ~10.
- Client-visible term is "settled"/"Still settling"; the word "calibrating" is not in any UI string.
- +21 intake: RPC claim_full_profile_complete counts trait_history rows source=self_situation >=50; history rows only written when rounded value changes (historyDiff) or countOnly path => consistent answerers can be short, claim silently fails (claimFullProfileCompleteQuiet swallows).
- Round +21 needs pack with exactly 25 items (wave52); short rounds never pay, UI silent. onUpdated() runs BEFORE claimOngoingRoundCompleteQuiet in questions-fold saveRoundAnswers -> balance stale.
- Buddy = components/nav-pixel.tsx (top-right pixel face, tap = random mood, no badge). docs/system-map.data.js has a "buddy" design proposal (dot + sheet).
- PRE_LAUNCH_DEV=true: "Draft copy - waiting on emci review." badges show to all testers (story, full-profile-fold, profile-fill, category-teaser unmounted).
- humanizeAxis (milestones.ts, "Placeholder copy - unreviewed") is the user-visible label above every question in PagedQuestions (e.g. "attachment anxiety"); reviewed AXIS_CONCEPTS/AXIS_EDITOR_COPY exist but are not used there.
- OptionalIntake / CoreIntakeSweep are not mounted anywhere now.
