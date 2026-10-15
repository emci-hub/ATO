---
name: divecore-notices-facts
description: Where every Divecore notice/banner/sheet lives, PlayBanner geometry vs real bars, known notice bugs (docs/divecore-audit/notices.md has the full table)
metadata:
  type: project
---

Full inventory (80 rows) is in docs/divecore-audit/notices.md. Key wiring:
- All banners: `setToast` reducer in src/app/play.tsx (bannerReducer -> enqueueBanner), rendered once at play.tsx ~1064; pet-screen `onBanner` (6 mini-game banners) goes through the same queue. No Alert.alert / RN Modal anywhere in src/play.
- PlayBanner top = insets.top + 52, but Street resbar / Turf HUD bottom = insets.top + 56 (gear 40 + padV 12 + marginTop 4; STREET_SIZE.resourceBar 44 is only a minHeight). Dive top bar is far taller, so banner sits inside it.
- Bugs found: Street speech bubble never clears (setSpeech has no null path); Defend run coach line ternary shows swordFx first (tip unreachable); PetReveal Pressable label hides caption from VO; check:play-banner pins no a11y/RM/geometry values.
- OS notices: play-notices.ts (8 kinds) -> pet-reminder.ts; push.ts handler shows banners in foreground.
