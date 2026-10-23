---
name: play-ui-map-facts
description: Play (Divecore) layout structure and fixed-regions audit (2026-10-13): shells, floating banner, per-screen violations
metadata:
  type: project
---

- play.tsx: street shell = streetColumn[resbar OR HudOutlet] + streetBody(flex1, 180ms FadeIn keyed by mode) + [tabbar OR dock]. Pet/Dive = fullSafeArea (no scroll); everything else = ScrollView (Defend, Dress, Shop, Swords, hub Block).
- Only floating toast: PlayBanner (play-banner.tsx, absolute top = insets.top+52, queue in play-banner-queue.ts, rendered play.tsx ~1062). PlaySheet = absolute bottom sheet (maxHeight 0.8/0.85 of window), not Modal.
- Defend board = width-based aspectRatio:1 inside ScrollView (stable); bossAlert floats; dock/HUD via StreetDockFill/StreetHudFill slots (street-shell.tsx) swap resbar/tabbar -> body height changes on run start.
- Pet room: PetRoom stage flex1; street status strip (street-room.tsx StreetStatusStrip) is flexWrap + minHeight 36 (can grow to 2 rows); classic coach slot/meters vary.
- Pet games: GamePlate stage flex1, dock hint has no minHeight (train hint 1-2 lines).
- Tabs (src/app/(tabs)) are all ScrollView pages; no flex:1 visual region + panel pairs.
