# Turf War — before (step T0, 2026-10-16)

Investigator map of Turf War as of master `83db80f0`. Screenshots in this folder (2x): `max-setup.png`, `max-wave.png`
(430×932), `se-setup.png`, `se-wave.png` (375×667). Wave shots ≈ 12 s into Trial wave 1, 2 Viper towers, 2 creeps.

## Files
- Route `src/app/play.tsx:836` mounts `DefendScreen`; tab `'turf' ↔ 'defend'` in `src/play/play-nav.ts:12-37`, label `street-shell.tsx:198`.
- **One file holds the screen:** `src/play/defend-screen.tsx` (5,614 lines): setup, wave, won card `:3675`, lost card `:3826`,
  build / upgrade float panel `:3502-3673`, Setup sheet `:3887` (PlaySheet), dev kit.
- Engine `src/play/defend.ts` (pure sim, 100 ms tick); waves `director.ts`, `data/waves.json`, `data/wave-tables.json`.
- Board: `board-data.ts` (`ATO_PATH :121`, `ATO_PADS :145`, `BOARD_MAPS :232`, `neon-maze` parked), `board-layouts.ts`,
  `board-decor.ts`, `neon-chrome.tsx`.
- Art roles `skin.ts :42-68` + `assets/play/skins/{streetwear,cast}/skin.json`; clips `cast-actor.ts`, `cast-kits.ts`,
  `tower-skins-data.ts`, `kits.ts`, `kit-combat.ts`. FX `fx-layer.tsx`, `fx-quality.ts`, `status-icon-row.tsx`.
- Layout kit `stage-layout.tsx`, `stage-frame.ts`, `fixed-region.tsx`; chrome `street-shell.tsx`, `street-ui.tsx`, `neon-ui.tsx`, `play-sheet.tsx`.
- **No base-health HUD:** one leak ends the run (`defend-screen.tsx:2128`; lost copy `:3828`).

## How it is drawn
- React Native Views + ONE `react-native-svg` `<Svg viewBox="0 0 100 100">` (`:2834`). No Skia / canvas. The sim runs on
  `setInterval(100 ms)` → `setSim`, so the **whole SVG re-renders every tick** (`:2143`). Walk-frame tick 50 ms (`:261`), FX tick 33 ms (`:5054`).
- Board is square: `boardSide = max(160, min(stage.w-24, stage.h-112))` (`:2670`; `TURF_HEADER_PT = 112` `:223` = the in-stage
  "TURF WAR" title + lede). 406 pt on 430×932, 309 pt on 375×667. Static camera. **~100 pt empty under the board on 430×932.**
- Ground = ONE baked 512×512 picture (`SHEET.board.ato`, `src/art/generated-art.ts:2325`; drawn `:2673/:2839`). Path, pads and
  taps come from `board-data`, not the picture. 16×16 grid (cell 6.25 units = 32 art px), 19 waypoints, 15 pads, tower cap 6 (`defend.ts:222`).
- Creeps village-girl / wizard / knight (8-dir + Walk 8f); towers viper / ghost / lux; bosses = oni / archangel hero art; shot = Kenney `fx.shot`.
- Draw order: board → range rings `:2889` → towers `:2945` → bound bosses `:3008` → corpses `:3090` → creeps + bars `:3110` →
  shots `:3278` → `FxLayer :3292` → sword aura `:3310` → Avatar `:3321` → damage floaters `:3336` → boss pill `:3351`.
- Placeholders: coloured circle fallback `:225`, HP bars (SVG Rect), tower letter badge "A" `:2990`.

## Animations / effects now
| What | Where | How |
|---|---|---|
| Creep walk / idle / corpse (1.1 s) | `:272` | sprite clips on a JS clock |
| Tower idle / attack / skill | `:2945`, `startTowerOnce :1159` | sprite clips, 8-dir fallback |
| Shots | `spawnShot :1746` | sprite flight 95 u/s, 900 ms life |
| Kit hit FX | `spawnHitFx :1771`, `fx-layer.tsx` | SVG strokes / rings / shards per element, 280 / 560 ms, quality Full / Minimal / Off |
| Damage numbers | `HitFloater :4847` | reanimated `withTiming` 700 ms, max 8, kills gold |
| Boss telegraph | `:2085`, pill `:3351` | RN View "BOSS INCOMING" 1.5 s ahead + `alertHaptic` (code shape, no art) |
| Avatar / sword aura | `:2560` / `:3310` | reanimated |
| Range rings, placement preview | — | dashed SVG circles |

Missing: creep hit flash, base-hit effect, wave-start banner, spawn effect, win / lose celebration, screen shake, map ambience. Win / lose are plain cards.

## Checks that pin it (all in `check:ota-gate`, `scripts/ota-gate.ts:49-51`)
- `check:fixed-regions` (`:59-65, 80-103`): `useStageFrame('turf-setup')`, `computeStageFrame('turf-wave', …)`, `coachLine` style; bans unmarked run-phase `display:'none'`.
- `check:stage-bounds` (`:30, 82-85, 137-139`): **the `boardSide` line is pinned verbatim** (`:83`), no ScrollView around the board, setup stage = wave stage at both phones.
- `check:streetwear-assets` (`:170-179`): every board baked 512×512, pad count matches `board-data`.
- `check:board-layouts` (layout restore, scrap bank), `check:towers`, `check:creeps`, `check:heroes` (engine, `recordDefendWin`),
  `check:finishes` / `check:auras` (no foil / aura strings in Defend), `check:play-cloud-save :117` (`countOnce('turf_wave_start')`),
  `check:divecore-nav`, `check:divecore-ftue` (coach tip `turf`), `check:play-isolation`.
- The `fixed-regions: screen switch` marker is in no src file: setup → wave keep one stage size (`stage-frame.ts:36-39`).

## Layout numbers
- Regions (`stage-frame.ts:41-48`): `turf-setup` top bar 56 / notice 40 / dock 64 / tab bar 60 + inset; `turf-wave` dock 64 + tab-bar
  height, no tab bar. Stage 619 pt high on 430×932 (y 155), 421 on 375×667 (y 116). Wave dock 158 / 130.
- Wave top bar: `streetHud` minHeight 48; pause 40×40 + hitSlop 8 (`:5159-5173`); wave chip, "N caps", pause.
- Wave dock: Cast skill (full width, minHeight 52), then Pounce (flex) · 1x · 2x · **Leave** (minWidth 52 / minHeight 48) (`:5174-5177, :3432-3468`).
  Setup dock: Setup (minWidth 112) + CALL WAVE (`:3469`).
- Float panel (build / won / lost): absolute left/right 8, bottom = dock + 8, **maxHeight 75 % of the stage** (`:3502-3510`), covers the board.
  Cards use `styles.card` (radius 16, pad 12), not `sheet-kit.tsx`.

## Art library (616 entries)
- No registry `usedBy` names defend / turf; Turf art loads through `assets/play/sheets` + `skin.json` (registry lists `*.cast.atlas*`:
  creep.knight / village-girl / wizard, boss.oni / titan-x, tower.ghost / lux / viper).
- **Unused streetwear candidates** (td-3q-low, 64×64, `resource`): pads `pad-manhole-ring`, `pad-manhole-splat`, `pad-concrete-x`,
  `pad-sticker-slab`; props barrel-fire, dumpster(-open), fence-chainlink(-torn), fire-hydrant(-spray), jersey-barrier, streetlight(-broken),
  traffic-cone(-fallen), trash-bags, tire-stack, oil-drum, shopping-cart, paint-splat / graffiti-tag decals (47 streetwear props, ~10 used by the Hideout).
- Tiles: `tile.streetwear.road-path.tile-0..17` (18 × 32×32), asphalt-sidewalk, sidewalk-lot, brick-graffiti-sidescroller (128). 71 other tiles off-style / archived.
- FX: 14 streetwear fx at 32×32 (drip, moth, note, pigeon, plane, rat, spark, star, steam, wisp), only `fx.shine` in use. **No impact / explosion / muzzle art.**
- UI: `ui.kit.streetwear.{hud,resbar,panel,header,button-grey,toast,tabbar,sheet,pieces,portrait}` and `ui.streetwear.{health-bar, button-normal/pressed,
  card-frame, panel-frame}` unused. Live pieces via `SHEET.ui` (resbar, chip-on, pause `:2685-2701`).
- `src/play/sheet-kit.tsx` (border 2, radius 6/4, gap 8, pad 12, tap 44, type 18/16/14/12, `sheetCard`, `SheetSection`): **not imported by Turf War.**

## Economy / copy (leave alone in visual steps)
- Scrap ("caps" on the wave HUD, "Scrap" in Setup): `defend.ts` `TOWER_DEFS` (placeCost 40, levelCostScrap [0,40,90]), `KEPT_BOARD_MIN_SCRAP`,
  `setupScrapFor` (`board-layouts`, pinned); UI `defend-screen.tsx:2692, 3520-3540, 3583, 3912`.
- Rewards `recordDefendWin` (`playStore.ts:3386`, `DefendWinResult :3268`, `play.tsx:494`), `tokenClearBase` 50 (`tune.ts:100`), half-token replay /
  daily cap `playStore.ts:394`, win copy `defend-screen.tsx:3690-3756`, `winWave :1922`, boss fragments / stars `engine/bound-boss.ts`,
  `engine/drop-table.ts`, `data/drops.json`, shell streak `play-settings.ts:331-378`.
- Copy: lede `:2761`, "The path was breached." `:3828`, "BOSS INCOMING" `:3365`, `coach.ts`, `ftue/coach-tips.ts:21`, `help/help-content.ts:38-46`.
  Analytics `countOnce('turf_wave_start')` `:1570` (pinned).

## Screenshot method
Static `npx expo export --platform web --dev` into the scratchpad, `python -m http.server <fresh port>`, Playwright headless
(installed Playwright wants chromium 1248, 1148 is installed → the script passes `executablePath`). Save seeded into
`localStorage['ato.play.store.v1']` in a throwaway browser profile only.
