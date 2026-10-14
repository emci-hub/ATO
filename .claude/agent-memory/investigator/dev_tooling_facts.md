---
name: dev-tooling-facts
description: Dev Hub / DEV bubble / intake presets wiring, dead dev tools, preset vs reset RPC gaps (audited 2026-10-01)
metadata:
  type: project
---

- Hub = src/app/dev-lab.tsx (sections exported and re-used by components/app-dev-fab.tsx; per-screen map in lib/dev-fab-model.ts APP_DEV_SCREENS). Bubble shell = components/play-dev-fab.tsx (also Play kit, app/play.tsx GroveDevKit + play/pet-dev-panel + play/dev-slot Defend slot).
- Dead/no-effect dev tools (2026-10-01): Home slot/ask overrides (readSlotOverride/readAskOverride and resolveTodaySlot have no non-dev consumers), GrowthPreview (readGrowthPreview unused), applyDevArchetypePreset / applyDevThinProfilePreset (no UI caller, only scripts/dev-test-user-check), self_scenario has no live writer.
- Intake presets (applyDevIntakeStagePreset) write me trait cols + trait_tracks only, NO trait_history -> claim_full_profile_complete (wave52 requires >=50 self_situation trait_history rows) throws 'full profile not complete'; banner swallows it. reset_my_test_data (wave75, root only) clears much more (history, packs, tokens, caches in DB) but NOT device AsyncStorage stamps.
