---
name: sprite-clip-pack-path-facts
description: How a new multi-frame sprite clip / board variant reaches the app (art-pack inputs, skeleton slots, drawers, checks)
metadata:
  type: reference
---

- Sheets are NOT fed by assets/art/fx or art:import. Pack inputs are hardcoded dirs: swRoot = art-src/pixellab/streetwear-pack/migrated/raw (art-pack.ts:512). fx/elements/<el>/<kind>.png+.json -> packSwEffects (art-pack.ts:720) -> assets/play/sheets/streetwear/fx/sheets.json; meta.fx 'el/kind'. ui/ambient/*.png -> ui-kit amb-<name> single-frame ('img') only (art-pack.ts:964).
- Skeleton (src/art/skeletons.ts): FX_SLOTS shot/hit/burst/slash/status (item name free); UI_SLOTS.ambient is a closed list; board is open (null) so SHEET.board['any-id'] works; unknown slot -> art-registry-gen.ts:398 throws.
- Only --boards-only / --ui-only / --heroes-only partial packs exist; no --fx-only. packSwBoards wipes board/ dir (rmSync) and only writes per BOARD_MAPS map (+ ato-glow in the ato branch).
- Board drawn at defend-screen.tsx:3116-3120 as SheetSprite inside the SVG (viewBox 100); sim re-renders whole SVG every 100ms. Frame loops off-SVG: aura-view.tsx useAuraClock (reanimated strip slide) is the pattern; hideout-zzz.tsx = opacity-stacked frames; street-ambient.tsx AmbientSprite = still only. Motion flags: usePlayMotion() (play-motion.ts:159: cosmeticsStill/vestibularSafe) + useFxQuality() (fx-quality.ts:82).
- check:streetwear-assets asserts every BOARD_MAPS id has board/<id> 512x512 and meta.boards[id].pads; fx meta frame count == sheet frames; budget 10MB; <=900 images. check:art-registry only scans PNGs under assets/art (orphans need art:sync), not assets/play/sheets.
- fx kinds hardcoded art-pack.ts:743 (shot/hit/burst/status/slash); element dir name free; loop only for kind shot (758); vfxExportFrames (660) reads Aseprite JSON frames[].pivot + duration; pivot needed. Consumer fx-layer.tsx:284 swKey (falls back to plain/<kind>). Full `--skin streetwear` repacks everything (no --fx-only). Defend: shots drawn defend-screen.tsx:3579, spawnHitFx 1790, floaters 1743, leak 2147, corpses newCreepCorpses 451.
- turf-board-art.ts latestGen() = lexically last gen dir with raw/tileset/tileset.png; barrel-fire flame is part of props/barrel-fire.png (baked), glow blob at line 281.
