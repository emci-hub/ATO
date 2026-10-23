---
name: divecore-ftue-today-facts
description: Existing Divecore coach-tip/notice/a11y systems and "is X ready" selectors, for Today chip + newbie guide bubble (2026-10-18)
metadata:
  type: project
---

- Coach tips already exist: src/play/ftue/{coach-tips.ts,coach-tip-layer.tsx,tip-anchors.ts}; seen flags in play_settings.tipsSeen (inside save, parseSettings play-settings.ts:99 tolerant of new keys); picked in pet-screen.tsx:924; drawn by GameScreen (stage-layout.tsx:163). Hideout only, 5 tips.
- Device-only flag precedent: pet-seen.ts (`ato.play.petSeenStage.v1`, AsyncStorage, no save bump); play-motion.ts PLAY_MOTION_KEY.
- Ready selectors: diveChargeAt/researchAt/canClaimResearch/chargesFullAt (playStore.ts ~1559-1593, 3454, 2527); PlayView.freeDivesToday, pet.expedition ('ready'|...), pet.eggDay, streak.claimedToday, tendBonusAvailable. No shop "ready" selector; no hunger "needs feed" selector except petStatus() (pet-status.ts:101, hunger<=1 = hungry).
- Check-in (ATO daily insight) lives outside Divecore: src/lib/daily-insights (isDoneToday streak.ts:47), AsyncStorage.
- Reduce motion: usePlayMotion (play-motion.ts:159), noticeReduceMotion() set by play.tsx:278. Font scale: only per-Text maxFontSizeMultiplier 1-1.2; no global helper.
