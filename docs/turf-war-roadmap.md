# Turf War roadmap (Divecore) — the plan's state

Planned 2026-10-16 (step T0) on emci's goal: do for **Turf War** (bottom nav "Turf War", code `defend`) what the Hideout
roadmap did for the Hideout — better map art, animated map details, real combat effects, a modern UI, and written
layout guidelines with a check. **Waiting for emci's approval** (order + permissions, see "Questions" at the bottom).

Same loop as `docs/hideout-roadmap.md`: one fresh chat per step; each step = one draft PR (Play-only, docs kept out of
the code PR except `docs/divecore*`), previews at 430×932 + 375×667 in `docs/divecore/turf-war-<step>/`,
`npm run check:ota-gate`, one reviewer pass, emci's OK → squash-merge → docs-only commit on master → `npm run ota:publish`.
Each chat ends with assessment → next → new-chat prompt (`Model:` line + one code block).

Inputs: `docs/divecore/turf-war-before/FINDINGS.md` (code map, file:line) + before shots in the same folder;
`docs/turf-war-research.md` (what other games do, with sources).

## Status

| # | Step | State |
|---|---|---|
| T0 | Investigate, research, plan (this doc) | ✔ docs on master. Waiting for emci's approval |
| T1 | Layout guidelines doc + `check:turf-war-layout` + the layout moves (board fills the stage, Leave → pause menu, title out of the stage) | ✔ merged (PR #64, 2026-10-16); OTA see "Step T1 as built" |
| T2 | HUD + UI kit: top bar, dock buttons (cost / afford / cooldown), build card at the pad, won / lost cards on `sheet-kit` | not started |
| T3 | Map art: new baked board from PixelLab parts (tiles, pads, props), same path and pads | not started |
| T4 | Map animation: ambient layer (neon flicker, steam, fire barrel, blinking light, pigeons), outside the sim SVG | not started |
| T5 | Combat effects: hit flash, per-tower projectiles + impacts (PixelLab VFX), death pop, health-bar chip trail, damage numbers, leak hit | not started |
| T6 | Boss effects: entrance (NoticeLane + ground mark), telegraphs, boss bar in the top region, boss death | not started |
| T7 | Polish + phone check: wave start / clear beats, win / lose celebration, spawn portal, perf pass, Reduce Motion audit | not started |

Every step ships on its own OTA. T1 and T2 change code layout only (no art). T3 and T4 need emci to pick art from samples
first (two stops inside the step: samples → pick → build). T5 and T6 need effect samples (GIF strips) the same way.

## Decisions (do not re-ask)
- **Visual and layout only.** No change to scrap / caps prices, tower stats, waves, rewards (`recordDefendWin`, tokens, shells,
  fragments, stars), win / lose rules or the one-leak loss. No change to copy meaning; copy may **move** (e.g. the lede leaves the stage).
- **Same board geometry for the whole plan:** 16×16 grid, 32 art px per cell, 512×512 baked board, `ATO_PATH` 19 waypoints,
  15 pads, tower cap 6. New art is painted onto that grid (so `check:streetwear-assets` and `check:board-layouts` keep passing).
- **Library first, PixelLab toolset first, samples before any art choice** (`docs/art/PIXELLAB_GUIDE.md`). Turf War art is drawn
  at **board scale** (1 cell = 32 art px, the guide's tile); props and pads sized on the 32 / 64 ladder against that cell, plus the
  usual scale sheet against the grown hero for anything that stands on the board.
- **Fixed regions + stage bounds hold** (`fixed-regions.mdc`, `stage-bounds.mdc`): shake, flashes and banners move **stage content
  only**, never a region; announcements go through `notify()` into the NoticeLane; nothing new floats over the regions.
- **Every effect obeys `fx-quality` (Full / Minimal / Off) and Reduce Motion / Motion Off.** Off = no shake, no flash, no hit stop,
  numbers still readable. No full-screen flashes.
- **Perf guard:** new looping animation never lives inside the sim `<Svg>` that re-renders every 100 ms; ambient and VFX loops get their
  own layer (reanimated or a sprite clip on its own clock). Each step records a frame-time note from the preview.
- Shared UI uses `src/play/sheet-kit.tsx` tokens (border 2, radius 6 / 4, spacing 4 / 8 / 12 / 16, tap ≥ 44, type 22 / 18 / 16 / 14 / 12).
- Play-only: `src/play/**`, `assets/play/**`, `assets/art/**`, `art-src/**`, `scripts/check-*` for Play; never `src/app/**` except `play.tsx`.

## Guidelines (draft — T1 turns this into `docs/turf-war-layout.md` + `check:turf-war-layout`)

Phones: 430×932 (max) and 375×667 (SE). Thumb reach: bottom third easy, middle OK, top corners hard (research doc).

| Region (top → bottom) | What lives there | Rules |
|---|---|---|
| **Top bar** (56 pt) | wave chip ("Wave 3/10", tap = next-wave preview), caps (scrap), pause (top right); while a boss is alive the wave chip's box shows the boss bar instead | Info + rare / risky actions only. Pause ≥ 44 pt hit area. Fixed widths; numbers in fixed boxes. **The boss bar lives inside the 56 pt top bar** (same box as the wave chip, decided in T0) so `REGIONS` and the board size never change for it. |
| **NoticeLane** (40 pt) | coach line, notices (`notify()`), "Boss incoming" | One line. Never a second lane, never a floating banner. |
| **Stage** (619 / 421 pt) | the board only: path, pads, towers, creeps, Avatar, effects | **Board fills the stage width** (minus 8 pt side gutter), centred vertically; the title + lede leave the stage (lede → top of the Setup sheet; the lane keeps the coach line). No HUD text inside the board except damage numbers and health bars. |
| **Build card** (FloatLayer) | tower choices / upgrade for the tapped pad | A FloatLayer card (stage-bounds rule 3) **positioned at the pad's on-screen spot**: above the pad (below it if the pad is in the top 30 % of the board), never covers the pad, clamped inside the stage, closes on outside tap. |
| **ActionDock** (64 pt + tab-bar height in wave) | primary thumb actions: Cast, Pounce, speed (1x / 2x), Call wave, Setup | Bottom third. Primary buttons 48 pt high, all ≥ 44 × 44, ≥ 8 pt apart. One row per state, reserved at its tallest (setup / wave / boss). Every action button shows icon · label · state (ready / cooldown sweep / not affordable). **Leave moves out of the dock into the pause menu** (risky action, out of the easy zone). |
| **TabBar** (setup only) | the app's three tabs | unchanged |
| **Float / Modal** | Setup sheet, pause menu, won / lost cards, confirm Leave | `sheet-kit` cards; won / lost = one primary button low on the card. |

- Tap targets ≥ 44 pt (prefer 48 for primary); pads on the board get a ≥ 44 pt hit circle even when the art is smaller (after T1 the
  SE board cell is ~22.4 pt, so a 44 pt hit area is ~2 cells; adjacent pads are ~44.9 pt apart on SE, so circles just touch — check
  they never overlap).
- No HUD button within 12 pt of the board edge where a pad sits (Kingdom Rush mis-tap lesson).
- Selection reads at a glance: selected tower = ring + slight lift; range ring only while selected / placing.
- Feedback appears above or beside the finger, never under it.

`check:turf-war-layout` (T1) asserts, at 430×932 and 375×667 from `computeStageFrame`: board side = stage width − 16 (or the stage
height cap), board fully inside the stage, every dock button ≥ 44 × 44 and ≥ 8 pt apart, Leave not in the dock, pause in the top bar,
every pad's hit circle ≥ 44 pt and inside the board, build-card placement rule (above / below) never off-stage for any of the 15 pads,
and no new in-stage text nodes besides the pinned ones.

## Steps

### T1 — Layout guidelines + rails
- **Scope:** write `docs/turf-war-layout.md` (the guidelines above, final numbers); add `scripts/check-turf-war-layout.ts` +
  `npm run check:turf-war-layout` in `check:ota-gate`. Code moves in `defend-screen.tsx`: drop `TURF_HEADER_PT` (title + lede leave the stage:
  title is the top bar / tab label, lede goes to the top of the Setup sheet; the lane keeps the coach line `:2741-2750`); `boardSide` →
  fill the stage width (update the verbatim pin in `check:stage-bounds` on purpose); centre the board vertically; Leave → a small pause
  menu (Resume · Leave) — both Leave buttons (`:3465` street dock, `:4336` classic HUD) go there, the existing confirm (`:964`,
  `:4639-4680`) and the back-swipe path (`:1660`) stay; the pause line `:2717` ("…Leave from the bar below.") needs new words (Q2b);
  pad hit circles ≥ 44 pt. Pure layout math goes in a new `src/play/turf-layout.ts` so the check can import it.
- **Files:** `src/play/defend-screen.tsx`, new `src/play/turf-layout.ts`, `scripts/check-turf-war-layout.ts`, `scripts/check-stage-bounds.ts`
  (pin), `scripts/ota-gate.ts`, `package.json` (script line only), `docs/turf-war-layout.md` (docs → separate docs commit).
- **Previews:** setup + wave at both phones (before / after side by side), pause menu open.
- **Done:** board ≈ 414 pt wide on 430 and ≈ 359 pt on 375 (was 406 / 309), centred (≈ 102 pt above + below on 430×932, ≈ 31 pt on
  375×667, instead of one ~100 pt band under it), Leave only in the pause menu,
  gate green, reviewer PASS, OTA.

#### Step T1 as built (2026-10-16, PR #64)
- Board = stage width − 16 capped by the stage height: **414 pt on 430×932, 359 pt on 375×667**, centred both ways (`src/play/turf-layout.ts`:
  `turfBoardSide`, `turfBoardRect`). Title + lede left the stage; the lede is the first line of the Setup sheet.
- Leave only in the **pause menu** (Resume · Leave, FloatLayer card shown while `paused` and no confirm is open). Top-bar pause opens it;
  Cancel on the confirm returns to it; back-swipe path unchanged. Both old Leave buttons removed (the classic HUD one was already unreachable).
  Pause line = "Paused — the wave is frozen." (Q2b proposal, used as written).
- Pad hit radius **6.25 units** (was 6.5: neighbours at 12.5 units overlapped) → ≥ 44 pt diameter and never overlapping (`padTapRadiusUnits`).
  Dock row gap 6 → 8.
- `buildCardPlacement` + `BUILD_CARD_MAX_H = 120` exist for T2 (above the pad, below for the top 30 %, flips if no room, clamped). Card must stay ≤ 120 pt tall.
- `check:turf-war-layout` (5 groups, in the gate); `check:stage-bounds` boardSide pin updated. Layout doc: `docs/turf-war-layout.md`.
- Previews (before = `turf-war-before/`, after = `turf-war-t1/`): setup, setup sheet, wave, pause menu at both phones. No before shot of the pause state.
- Preview gotcha: an old `python -m http.server` from an earlier session kept answering on the same port with the OLD bundle. Use a fresh port
  and check the served bundle size matches the export.

### T2 — HUD + UI kit
- **Scope:** `src/play/turf-ui.tsx` built on `sheet-kit` tokens: top bar (wave chip with a next-wave preview popover — creep icons + count
  from `director.ts`, no new data), caps counter, pause; dock buttons with icon + label + state (cooldown radial sweep, not-affordable dim +
  red cost); **build card at the pad** (replaces the bottom float panel that covers 75 % of the stage): tower choices with cost, tap = preview
  range, tap again = buy (two-tap like Kingdom Rush; outside tap cancels); upgrade card the same way; won / lost cards on `sheetCard` with one
  primary button. Library first for frames / icons (`ui.kit.streetwear.*`, `ui.streetwear.*` are unused candidates); `create_ui_asset` only
  for what is missing, samples first. Replace the tower letter badge with level pips.
- **Files:** `defend-screen.tsx` (wiring), new `turf-ui.tsx`, maybe `src/play/turf-build-card.tsx`; icons via `ART.*` + `art:sync`.
- **Checks:** extend `check:turf-war-layout` (build card inside the stage for all 15 pads at both phones, cards ≥ 44 pt taps,
  no `styles.card` left on Turf cards); keep `check:fixed-regions` pins.
- **Previews:** setup, wave, build card open on a top / middle / bottom pad, upgrade card, won, lost, next-wave preview — both phones.
- **Done:** gate green, reviewer PASS, OTA. Prices, stats and copy meaning unchanged (check compares `TOWER_DEFS` untouched).

### T3 — Map art
- **Scope:** a new baked 512×512 board on the same grid: library first (`tile.streetwear.road-path.*`, asphalt-sidewalk, pads
  `pad-manhole-*`, street props listed in FINDINGS) → show emci a **reuse / edit / new** sheet; then PixelLab building kit / `create_tiles_pro` /
  `create_topdown_tileset` for the road + sidewalk + kerb transitions, `create_map_object` for missing props, `create_map` + `view_map` to lay
  it out, `reduce_colors` to the streetwear night palette, workbench score ≥ 90, critique ≥ 22/28. Props stay off the path and off pad hit
  circles; nothing tall hides a creep (low props only along the path). Painter script `scripts/turf-board-art.ts` (same idea as
  `hideout-room-art.ts`) writes the board + a separate `glow` layer for T4.
- **Files:** `art-src/pixellab/board.streetwear/…`, `assets/art/…/board`, the painter script, `SHEET.board.ato` target, `art:sync` output.
- **Checks:** `check:streetwear-assets` (512, pad count) unchanged and green; add a pixel test: path cells darker than kerb by a contrast
  floor, every pad centre lands on pad art.
- **Previews:** samples + scale sheet (stop for emci's pick), then the board in setup + wave at both phones, greyscale readability shot.
- **Done:** emci picked, gate green, reviewer PASS, OTA.

### T4 — Map animation
- **Scope:** ambient layer between the board and the units: 4–6 small loops (neon sign flicker, manhole steam, fire-barrel flame, blinking
  traffic light / streetlight, pigeons that flap off when a creep passes near), from the library first (`fx.streetwear.steam`, `pigeon`,
  `spark`, `wisp` exist at 32×32) then `animate_object` / `vfx_workbench`. Own clock (reanimated / sprite clip), **not** in the sim `<Svg>`.
  `fx-quality` Minimal = half, Off = still frame; Reduce Motion = slower, never a size change.
- **Files:** new `src/play/turf-ambient.tsx`, `defend-screen.tsx` (one mount), art + `art:sync`.
- **Checks:** extend `check:turf-war-layout`: ambient layer outside the sim SVG, honours fx-quality, no ambient sprite over a pad hit circle or the path.
- **Previews:** GIF / frame strip of each loop (emci picks), wave shot both phones, frame-time note.
- **Done:** emci picked, gate green, reviewer PASS, OTA.

### T5 — Combat effects
- **Scope:** creep **hit flash** (60–80 ms white tint, per creep); per-tower **projectile + impact** sprites (viper / ghost / lux; replace the
  Kenney `fx.shot`) from `create_vfx` / `vfx_workbench`, 3–6 frame impacts at 64 px; **death pop** (short burst, keeps the 1.1 s corpse rule or
  replaces it with the burst, same timing); **health bar** only once damaged, with a fast pale chip trail; **damage numbers** merged per creep
  within 150 ms, small random offset, kill numbers gold (existing), cap 8 (existing); **leak hit** at the path end (red pulse + small shake, the
  run still ends as today). Hit stop only on a kill by an ultimate (≤ 60 ms).
- **Files:** `fx-layer.tsx`, `defend-screen.tsx` (spawn points already exist: `spawnShot :1746`, `spawnHitFx :1771`, `HitFloater :4847`),
  new art + `art:sync`.
- **Checks:** extend: every tower has a projectile + impact, effect durations within the table, Off = none of flash / shake / hit stop.
- **Previews:** effect strips (emci picks), a wave shot mid-fight both phones, frame-time note with 20 creeps (dev kit).
- **Done:** emci picked, gate green, reviewer PASS, OTA.

### T6 — Boss effects
- **Scope:** boss entrance = `notify()` in the NoticeLane ("BOSS INCOMING" moves out of the in-stage pill, same words) + a ground mark at the
  spawn; per-ability **telegraph** (ground marker / glow + wind-up ≥ 0.6 s, distinct per ability, from `engine/bound-boss.ts`); **boss bar**
  inside the 56 pt top bar, in the wave chip's box (no new row, `REGIONS` unchanged); boss hit = bigger flash; boss death = burst + 60 ms hit stop + small
  shake (stage only). VFX via `create_vfx` / `vfx_workbench`, samples first.
- **Files:** `defend-screen.tsx`, `fx-layer.tsx`, maybe `src/play/turf-boss-fx.tsx`, art.
- **Checks:** extend: boss bar inside the top bar box (stage frame identical with and without a boss), no in-stage banner, every boss ability has a telegraph ≥ 600 ms.
- **Previews:** boss entrance, telegraph, bar, death — both phones; strips for emci's pick.
- **Done:** emci picked, gate green, reviewer PASS, OTA.

### T7 — Polish + phone check
- **Scope:** wave start beat (lane line + spawn portal at the path start), wave clear beat, win celebration (confetti-free: sparks + the
  existing reward lines), lose beat (the leak replay), perf pass (memo the board, stop re-rendering static layers each tick), Reduce Motion /
  Motion Off audit, emci's phone check list in `docs/ATO_DEVICE_TESTS.md` (docs commit).
- **Done:** emci's phone check passes, gate green, reviewer PASS, OTA.

## Questions for emci (answer once with the approval)
1. **Order** T1 → T7 as listed? (Recommended: layout first so the art in T3 is drawn for the final board size.)
2. **Leave → pause menu** (T1): OK to move the risky Leave button out of the bottom row into a Pause menu? (Recommended: yes.)
   2b. Then the pause line "Paused — the wave is frozen. Leave from the bar below." must change. Proposed: "Paused — the wave is frozen."
   (the menu shows Resume · Leave). OK?
3. **Build at the pad + two-tap buy** (T2): replace the bottom panel with a small card above the tapped pad, tap to preview, tap again to
   buy? (Recommended: yes; prices unchanged.)
   3b. Does the wave **keep running** while the build card is open (as today), or pause like Kingdom Rush? Pausing makes waves easier
   (a rules change). (Recommended: keep running, as today.)
4. **Not in this plan unless you say so** (rule / economy changes): base lives instead of one-leak-loses; a taller portrait map to use
   the spare height (longer path = different difficulty); a separate "damage numbers off" setting. Default: none of these.
5. **PixelLab budget:** T3–T6 ≈ 250–350 generations total (Hideout rooms used 70–100 each). OK?

## Facts a new chat needs
- The whole screen is `src/play/defend-screen.tsx` (5,614 lines): read the line refs in FINDINGS before editing; extract new UI into
  new files instead of growing it.
- The sim re-renders the whole board SVG every 100 ms (`setSim`, `:2143`): keep new loops out of it.
- `check:stage-bounds` pins the `boardSide` line verbatim; T1 changes it on purpose and updates the pin in the same PR.
- Previews: static web export + Playwright works (`docs/divecore/turf-war-before/FINDINGS.md` "Screenshot method"); `expo start --web`
  dies with EMFILE on Windows; seed `localStorage['ato.play.store.v1']` only in a throwaway browser profile.
- `check:play-isolation` judges the working tree: keep `docs/turf-war-*.md` edits out of the code PR (stash them before the gate), commit
  them on master after the merge.
