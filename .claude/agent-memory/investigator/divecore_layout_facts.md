---
name: divecore-layout-facts
description: Divecore stage sizing: who is flex leftover, Turf War board is width-square in ScrollView, real shell heights, grow-only has one caller
metadata:
  type: project
---

Full math lives in docs/divecore-audit/layout.md (2026-10-14).

- Street shell: play.tsx streetColumn paddingTop insets.top; ResourceBar renders 56 (not STREET_SIZE 44: gear 40+12+marginTop 4); TabBar ~60+max(b,6) (SE icon-only 64); Turf run dock = 116+max(b,8); Dive has NO bars (street false for mode dive, all 4 safe-area edges).
- Hideout stage = pet-room.tsx `stage` flex:1 measured by onLayout; room canvas 352x576 fit-to-contain (hideout-iso.ts:507); row mode reserves 64 inside stage; strip 36 fixed, icon row 64 fixed. Height-limited on every phone.
- Dive: stage flex:1 between DiveTopBar (~113) and dock (~264, the ONLY useGrowOnlyHeight caller; ReservedRegion has 0 callers).
- Turf War board = width-square (W-24, aspectRatio 1) inside play.tsx ScrollView (always scrollable: 128 trailing pad); no height input anywhere; setup->run swaps tab bar for dock (-55/-60 viewport) and hides lede (-60 board top). Board drag hands touch to ScrollView.
- check:fixed-regions only greps source strings, no geometry. layout-shot.tsx omits street bars (only dive shot is faithful).
- Gotcha: pet-games Catch hint is pinned 2 lines but renders 3; coachLine minHeight 58 < 3x20.
