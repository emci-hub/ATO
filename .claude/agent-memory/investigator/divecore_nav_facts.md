---
name: divecore-nav-facts
description: Divecore (src/play + src/app/play.tsx) nav wiring - Street shell always on, Classic only a loading fallback, orphaned About, hidden Hideout header, back mismatches
metadata:
  type: project
---

- `streetUiOn()` is constant true (art-skin.ts); CommandHub renders only while `view == null` (play.tsx ~849). Dead classic ternaries remain in ~15 files.
- Street shell hidden for mode dive/sheetlab/swordlab (play.tsx:775) - Dive has no tab bar.
- About mode has no Street entry (only Classic "More" tile). Pet screen header (back, Stash, menu, gear) is `display:none` in Street, so `setSheet('menu')` has no caller.
- Resource-bar gear does setMode('grove') then opens Settings; settings sheet is only mounted in grove.
- Blades back link -> 'defend' but edge/hardware back -> grove. All sub-screen back links say "Command Hub" (neon-ui.tsx:50 default label).
- play_settings migration lives in playStore.ts ~5661 (parseSettings), not play-save.ts. tutorialSeen shown on any mode.
- Hideout controlsMode is 'row' on phones (bar under room, 64pt reserve); room art 352x576, spots from assets/art/rooms/hideout/hideout-td.map.json.
- Audit written to docs/divecore-audit/nav.md (2026-10-14).
