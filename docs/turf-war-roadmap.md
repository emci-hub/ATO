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
| T2 | HUD + UI kit: top bar, dock buttons (cost / afford / cooldown), build card at the pad, won / lost cards on `sheet-kit` | ✔ merged (PR #65, 2026-10-17); the leftover (next-wave popover + top-bar restyle) = T2b, merged (PR #72, 2026-10-18), see "Step T2b as built" |
| T3 | Map art: new baked board from PixelLab parts (tiles, pads, props), same path and pads | ✔ merged (PR #66, 2026-10-17); OTA see "Step T3 as built" |
| T4 | Map animation: ambient layer (neon flicker, steam, fire barrel, blinking light, pigeons), outside the sim SVG | ✔ merged (PR #67, 2026-10-17); OTA see "Step T4 as built" |
| T5 | Combat effects: hit flash, per-tower projectiles + impacts (PixelLab VFX), death pop, health-bar chip trail, damage numbers, leak hit | ✔ merged (PR #68, 2026-10-17); OTA see "Step T5 as built" |
| T6 | Boss effects: entrance (NoticeLane + ground mark), telegraphs, boss bar in the top region, boss death | ✔ merged (PR #69, 2026-10-17); OTA see "Step T6 as built" |
| T7 | Polish + phone check: wave start / clear beats, win / lose celebration, spawn portal, perf pass, Reduce Motion audit | ✔ merged (PR #70, 2026-10-17); OTA see "Step T7 as built"; emci's phone check (Box 33) **passed** |
| T8 | More map themes (emci 2026-10-17): same path / pads / grid, a new painting per theme (rooftop, subway underpass, court / park, docks); picker in Setup (emci, option A) | ✔ merged (PR #71, 2026-10-17); OTA see "Step T8 as built"; emci's phone check (Box 34) **passed** (answered in the T2b chat) |
| T2b | T2 leftover (emci 2026-10-18, option B): next-wave preview card under the wave chip + top bar on sheet-kit pieces | ✔ merged (PR #72 squash `4afb7443`, 2026-10-18); OTA iOS `01a14d16-d6c7-79a3-93d2-65ed9ec70d56`, group `e971779c` (message `turf-war-t2b-hud`, see "Step T2b as built"); emci's phone check (Box 35) **passed**, no changes; T8 phone check (Box 34) **passed** |
| T9 | Notices polish (emci 2026-10-18): pause the notice lane while the next-wave card is open (`useNoticePause(wavePeekShown)`), strike the stale "BOSS INCOMING hidden on Important only" bullet (already fixed in T7) | planned, not built; see "Step T9 plan" |

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

#### Step T1 as built (2026-10-16, PR #64, OTA iOS `01a14762-7ead-70b7-8fac-cac9c5ab4fee`, group `b937a993`; awaiting emci's phone check)
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

#### Step T2 as built (2026-10-17, PR #65, OTA iOS `01a147cc-a8d7-7a31-96d2-c5fc628fa997`, group `ea5f6c41`; awaiting emci's phone check; emci answered Q3 yes, Q3b keep running)
- `src/play/turf-ui.tsx`: `TurfButton` (ready / cooling sweep / unaffordable red cost / used / selected, ≥ 48 high), `TurfCard`, `TurfPips`,
  `TurfResultCard` (title, lines, quiet buttons, ONE primary button last). `src/play/turf-build-card.tsx`: `TurfBuildCard` (build / tower / boss
  modes), 344 wide, heights 116 / 104 / 120 pt **including border + padding** (≤ `BUILD_CARD_MAX_H`), placed with `buildCardPlacement`.
- Two-tap buy: first tap on a tower/bound-boss tile arms it (range ring via `placePreview`), second buys; upgrade is two taps ("Tap again to
  upgrade"). Closes on ✕, an empty-board tap in setup (does not also walk the Avatar), or a tap in the strips above/below the board.
  `placePreview` is cleared whenever `selectedPad` changes (reviewer bug).
- Won / lost cards: same copy and actions, built as `lines` in `defend-screen.tsx` (`resultCard`), still on the bottom float panel
  (`turfFloatPanel`, now results only). Lost Retry = `retryLostRun` (same logic as before).
- Dock Cast / Pounce / speeds = `TurfButton` (Cast: icon · label · Ready or seconds, sweep from `getTune().skillCooldownMs`).
- Board: tower level pips (SVG circles, one per level) replace the letter badge (`TOWER_LETTER` gone).
- Small copy moves: tower title shows pips instead of "· level n/3"; bound-hero title lost "· bound hero"; at the tower cap tiles say "max 6" without the price.
- `check:turf-war-layout` now 7 groups (card fits all 15 pads × 3 modes × 2 phones, taps ≥ 44, two-tap buy, no `styles.card` / `ThemedView` in the Turf float cards).
- **Not done in T2 (both done in T2b, see below):** next-wave preview popover on the wave chip; top-bar restyle (it used `StreetFrame` resbar).
  Still not done: library frames/icons (icons are `MaterialCommunityIcons`, as in `sheet-kit`). In the web preview those icons show as empty boxes (font not loaded) — check on the phone.
- Previews: `docs/divecore/turf-war-t2/` (setup, wave, build card top / middle / bottom, armed, upgrade, won, lost; both phones).

#### Step T3 as built (2026-10-17, PR #66, OTA iOS `01a14830-2114-7ba8-a01b-511bfc649a0f`, group `2d3a97cd`; awaiting emci's phone check; emci answered the T2 phone check "passed" and Q5 budget "yes")
- emci picked **option D** at stop 1 after a first round (reuse / standard / pro tilesets) looked "too straight, too harsh": alley asphalt with a rounded,
  slightly wavy kerb (`create_topdown_tileset` pro, roundness 1, boundary_amplitude 0.15), faint worn centre dashes (35 % alpha), road marks, neon light pools. Cobblestone (E) was the other option.
- `scripts/turf-board-art.ts` paints the `ato` board from `art-src/pixellab/board.streetwear/gen-20261017-pixellab-1/` (raw + `gen.json` with every tool id, prompt, score, rejects)
  and a separate **glow** layer, packed as `SHEET.board['ato-glow']` (cleared over pads; **not drawn yet — T4 draws it**; the barrel-fire has its own glow blob there).
  `art-pack.ts` `packSwBoards` uses it for `ato` (`neon-maze` keeps the old paint); `npm run art:pack -- --skin streetwear --boards-only` repacks just the boards.
- Parts: tileset + 11 usable road variants + 16 walk variants + crack decal + 3 props (barrel-fire, tire-stack, traffic-cone), all palette-locked (`reduce_colors`).
  Pads = library `pad-manhole-ring` at native 54 px. Props: low only (cap 0.8 × the 62 px board-scale hero), off road cells, ≥ 6 px beyond every pad hit circle, ≥ 4 cells apart, max 8, all on the board edge.
  Rejected under the 90 workbench bar: hydrant, drain, puddle, trash bags (first try 25 % too low, second 88). Road variants r03 / r05 / r08 / r11 / r13 skipped (the lock turned stains into teal blocks).
- Scores: workbench tileset 95.4, variants 96–99.6, props 92.3–98.5; critique 24/28 (no zero). 77 PixelLab generations used (budget T3–T6 ≈ 250–350 → ~270 left).
- `check:streetwear-assets` group 7: road ≥ 30 luma darker than the kerb (now 30 vs 93) and every pad centre on pad art. Known limit: the road texture still shows a soft scallop repeat, a few cyan speckles from the lock, props sit inside the 24 px edge vignette (darker).
- Previews + stop-1 samples + scale sheet: `docs/divecore/turf-war-t3/`. Frame time in the web preview ≈ 4.8 ms (430) / 5.0 ms (SE), unchanged.
- Preview gotcha (again): two `http.server`s were listening on one port (an old one from another session); check `netstat` and compare the served bundle size AND the board atlas hash with the export.

#### Step T4 as built (2026-10-17, PR #67, OTA iOS `01a14862-98c3-73dc-89ee-51de036cb5be`, group `04dde97f`; awaiting emci's phone check; emci answered the T3 phone check "passed" and picked ALL FIVE loops at stop 1)
- **Layer:** `src/play/turf-ambient.tsx` (+ pure `turf-ambient-layout.ts`): Reanimated UI-thread loops on their own clocks, **outside the sim `<Svg>`**, `pointerEvents none`, `memo`ised
  (stable `getCreeps` = `ambientCreeps` useCallback), one mount in `defend-screen.tsx`. The baked board is now a `ClipImage` (expo-image) **under** the ambient layer, then the units `<Svg>`
  (order pinned by `check:turf-war-layout`). Previously the board was a `SheetSprite` inside the SVG — pixel smoothing may differ slightly (check on the phone).
- **Loops:** A neon pool flicker (the `ato-glow` layer cropped per pool, each with its own key sequence) · B barrel fire = flame (vfx_workbench `torch_flame` 17×28 ×8) + smoke (16×29 ×16, skipped on a barrel whose wisp would
  rise over a pad hit circle: `barrels[i].smoke === false`) + firelight (`ato-fire` layer, new) · C cone lamp blink (code only: amber core + halo) · D pigeons (new 16 px sprite; bob, peck, flap off when a creep is within 11 board
  units ≈ 45 pt; fade in again after 7 s; Reduce Motion = fade only) · E vent steam (16×36 ×12) from a new baked vent grate.
- **Quality / motion:** Full = all; Minimal = every other site animates, the rest hold a still frame (the barrel art has no baked flame, so never hidden), no smoke / steam; Off or Motion Off = still frame;
  Reduce Motion = half speed. A loop always starts at frame 0 (`withRepeat` restarts from the start value — reviewer bug), desync = `withDelay`.
- **Art:** board painter now uses a flameless barrel (`raw/props/barrel.png`, replaces `barrel-fire`; 26 px wide vs the old 22: accepted) and `raw/props/vent-grate.png`; `raw/ambient/{flame,smoke,steam}.png+json` + `pigeon.png`
  (palette-locked by a local nearest-colour snap, same result as `reduce_colors`). `art-pack.ts` `packSwBoards` writes sheets `ato-fire / ato-flame / ato-smoke / ato-steam / ato-pigeon` (`writeFrameStrip`) and
  `meta.boards.ato.ambient` (sites in 512 art px: barrels, cones, vent, pigeons, pools, fires, clips). `npm run art:pack -- --skin streetwear --boards-only` then `art:sync`. The board atlas is now `atlas-0..2.png`. `gen.json` has the ids.
  PixelLab generations ≈ 32 (pigeon 10); ~240 left of the T3–T6 budget.
- **Checks:** `check:turf-war-layout` = 8 groups; ambient group asserts 12 sprites clear of pad hit circles and road cells, layer not an SVG, fx-quality / Reduce Motion rules, pigeon scare rule, memo, frame-0 start, order board → ambient → units.
- **Frame time (web preview, headless):** ≈ 4.2 ms setup / 5.0 ms wave with the layer on, the same with quality Off (no measurable cost). Loop GIFs + stills: `docs/divecore/turf-war-t4/` (stop-1 samples `t4-*.png`, final `*-loop.gif`).
- Not done / for later: a real neon **sign** sprite (the pools stand in for it); the pigeon has no wing frames (flap = squash in code); not device-verified.
- Gotcha: `npx tsx scripts/…` that paints the board takes ~1–2 min; write its output to a file in the background.

#### Step T5 as built (2026-10-17, PR #68 squash `8d584db4`, OTA iOS `01a14a39-ce92-76d0-97e9-d3c35c03ea0f`, group `8961f577`; awaiting emci's phone check; emci answered the T4 phone check "passed")
- **Stop 1 picks (emci):** Archer = new magenta dart + star (`archer/shot` 29×16 ×4 loop, `archer/hit` 45×43 ×6), Vine = library `root/*`, Crystal = library
  `spark/*`, Death = new plum smoke pop (`pop/burst` 36×30 ×13 @ 12 fps = 1.1 s, brightened after the pick). All from `vfx_workbench` (0 PixelLab generations;
  ~240 left of the T3–T6 budget). Raw + `gen-t5.json` (effect ids, rejects) in `art-src/pixellab/streetwear-pack/migrated/raw/fx/elements/{archer,pop}/`.
- **Pipeline:** the element fx path (`packSwEffects`), new **`npm run art:pack -- --skin streetwear --fx-only`** (a full streetwear repack moved ~40 unrelated
  sheets — don't use it for fx). Only `shot` loops; a one-shot must use another kind name (`hit`, `burst`). Then `art:sync` (slots `SHEET.fx.archer.*`, `SHEET.fx.pop.burst`).
- **Code:** `src/play/turf-combat-fx.tsx` = hit flash (white-tinted `ClipImage` copy of the creep's last drawn frame, 70 ms, 250 ms cooldown per creep so a DoT
  never strobes), death pop (replaces the corpse only when it fired), leak ring (exit cell, 520 ms) — one-shots on Reanimated, mounted **after** the units `<Svg>`;
  `useBoardShake` (180 ms, 4 pt) moves the board box only. Pure rules + timing table in `turf-combat-fx-rules.ts`. `defend-screen.tsx`: Streetwear plain Archer
  hits become an `FxEvent` with `skin: 'archer'` (no Kenney shot; the cycle-boss shot keeps it); health bar only once hurt + pale chip (`nextChip` keeps a draining chip);
  numbers merge per creep within 150 ms (+ a fixed ±6/±4 pt nudge); hit stop = the sim interval off for 45 ms on an ultimate kill (≤ 60 ms incl. commit, same dt per tick).
- **Quality / motion (`combatFxFlags`):** Off = none (numbers + corpses as before); Minimal = flash, pop, ring; Full = + shake + hit stop; Reduce Motion / Motion Off = no flash, shake or hit stop.
- **Checks:** `check:turf-war-layout` = 9 groups (every tower kit has a packed looping shot + one-shot hit, durations in the table, Off / calm = no flash / shake / hit stop, layer not an SVG and not looping, mounted after the units SVG, merge window, cap 8).
- **Previews + frame time:** `docs/divecore/turf-war-t5/` (`NOTES.md`): wave with 4 towers + ~20 creeps ≈ 9.0 ms avg (430) / 8.8 (SE), Off 8.2; natural leak GIF.
- **Preview gotcha:** since T4 the web preview hides creeps and towers (absolutely positioned board layers paint over the in-flow units `<svg>` in a browser; native is fine).
  The shot script injects `svg[viewBox="0 0 100 100"]{position:relative}`. The dev "Force leak" row ends the run without `step.leak`, so it shows no ring — let a creep leak instead.
- Not done / for later: archer darts share the FX cap with elemental effects; flash/pop use the creep box from the previous render (tiny offset); not device-verified.

#### Step T6 as built (2026-10-17, PR #69 squash `ef8a58ce`, OTA iOS `01a14a82-3b8b-78a1-9c9a-8ceb87af656e`, group `c6c981e7`; emci's phone check **passed** (answered in the T7 chat); emci answered the T5 phone check "passed")
- **Stop 1 picks (emci, all recommended):** Entrance B = new magenta sigil + light column (`summon/burst` 74×85 ×10 @ 12 fps), Enrage B = new red sigil +
  charge (`enrage/burst` 74×56 ×12 = 1.0 s) **with no rule change**, Death B = new plum blast + ring + sparks (`bossko/burst` 136×66 ×14 = 1.17 s), Boss bar A =
  name over a thin bar. All `vfx_workbench` (0 PixelLab generations; ~240 left of the T3–T6 budget). Raw + `gen-t6.json` in `art-src/.../fx/elements/`.
- **Found at stop 1:** the enemy boss's only ability is the enrage (below `burst.hp_pct` it fires at once and queues runners at the spawn). A fixed 0.6 s lead needs a
  rule change, so emci picked: the warning starts at `hp_pct + 0.15` (`ENRAGE_WARN_BAND`), and the lead depends on tower damage. "Every boss ability" = enrage + the
  Bound Boss echo-skill closed set (`burst` live as Sovereign Nova; `slow_pulse` / `focus_beam` have looks ready, no content).
- **Code:** rules + timings in `src/play/turf-boss-fx-rules.ts` (`BOSS_FX`, `BOSS_TELEGRAPHS`, `telegraphStart` = lead `(600 + tick) × speed` sim ms so the real
  wind-up is ≥ 600 ms at 1x / 2x, `bossFxFlags`, `bossBar`, `WAVE_CHIP_BOX` 132 × 32). The T5 layer `turf-combat-fx.tsx` gained a generic `Strip` (the pop uses it too), `summon`,
  `bossDeath`, `telegraph` / `endTelegraph` (ends by item id, never before `TELEGRAPH_MIN_MS`) and the boss flash (110 ms, opacity 1); `useBoardShake('bossDeath')` = 220 ms / 5 pt.
  `defend-screen.tsx`: `notify({kind:'notify', title:'BOSS INCOMING', body:'<band> — <boss>'})` replaces the pill (`bossAlert` state + styles gone); the enrage glow is a
  static `<Ellipse>` in the sim SVG; the boss bar replaces the wave chip in the top bar (both in one fixed box); a boss kill = blast + hit stop + shake (Full);
  `resultHold` keeps the won card off for `BOSS_DEATH_MS` when the boss was the last kill (it covered the blast; the win is paid on the same tick).
- **Quality / motion:** Off = no sigil, blast, flash, shake or hit stop (telegraphs = still shapes; the bar + notice stay; the boss leaves its corpse as before); Minimal = no shake / hit stop;
  Reduce Motion / Motion Off = still sigil, soft death (skips the white frames), no flash / shake / hit stop.
- **Checks:** `check:turf-war-layout` = 10 groups (T6: sheets packed + one-shot + timings, every ability telegraphed ≥ 600 ms simulated at 1x / 2x, a look per ability, boss
  bar in the top-bar box + the frame never depends on a boss, no in-stage pill, notify words, flags per quality / motion).
- **Previews + frame time:** `docs/divecore/turf-war-t6/` (`NOTES.md`): boss fight ≈ 8.4 ms avg (430) / 7.7 (SE), Off 6.8.
- **Preview gotchas:** the export writes `play.html`; copy it to `play/index.html` or `/play/` is a 404. "Preview boss beat (Final)" + a seed with
  `bound_bosses:[{id:'ember_sovereign',stars:1,...}]` and Main wave 10 reaches the Final boss with the Nova tower; dismiss the "Welcome back" card first.
- **Open / for later:** players on "Important only" notices don't see "BOSS INCOMING" (`notify` kind is hidden there; the old pill always showed); a Bound Boss placed mid-wave
  with a creep in range casts with no wind-up; a 1x → 2x switch mid wind-up shortens it; a boss drawn with a rotated single sprite gets no blast (fails safe). Not device-verified.

#### Step T2b as built (2026-10-18, PR #72 squash `4afb7443`, OTA iOS `01a14d16-d6c7-79a3-93d2-65ed9ec70d56`, group `e971779c` (published by emci: `npm run ota:publish -- --branch production --message "turf-war-t2b-hud" --non-interactive`; ids read from `eas update:list` 2026-10-18); emci's phone check = `docs/ATO_DEVICE_TESTS.md` Box 35 **passed**, no changes (answered 2026-10-18); emci answered the T8 phone check "passed", no changes)
- **Stop 1 (emci): option B** of three (`docs/divecore/turf-war-t2b/samples/`): separate sheet-kit pieces in the top bar + a card hanging under the wave chip.
- **Top bar:** `TurfWaveChip` (132 × 32 visual box inside a 44 pt tap target, chevron, mustard edge while open), `TurfCapsPill` (44 pt), `TurfPauseButton`
  (44 pt + hitSlop 6 = 56 pt target) in `src/play/turf-ui.tsx`; the `resbar` art frame and `chip-on` / `pause` backdrops are no longer used by Turf War. Bar still 56 pt,
  `REGIONS` unchanged; the boss bar still replaces the chip in the same `WAVE_CHIP_BOX`. Setup keeps the app shell's top bar (the chip, caps and pause only exist in a wave).
- **Next-wave card:** `TurfWavePeekCard` on the FloatLayer, 64 pt tall, up to 344 wide, at the lane's top edge: it fills the NoticeLane box + the empty stage margin above the board
  (71 pt free on SE, 142 on 430), leaves 44 pt free at the right for the lane's help (?) button, never reaches the board. Content: "Next · [Main ]wave N", "Stage · <element>" when the
  wave has one, one chip per role (swatch in the board's placeholder creep colour · count × · role name), counts from `director.ts` via `turf-wave-peek.ts` (`nextWaveSeat`: Trial 5 → Main 1,
  Main 10 → Main 1). Closes on a card tap, a tap in the strip it sits in (outside the (?) column), pause, or the boss bar (state reset, never pops back open), and when the run ends.
  Not shown in replays (a replay does not advance the seat; the chip is then plain info).
- **Checks:** `check:turf-war-layout` = 13 groups (+ T2b: top bar 56 pt / REGIONS, kit targets ≥ 44, card inside lane + board margin on both phones, ≥ 44 pt right of it, director counts,
  seat order, wiring pins). Two T1 pause pins moved from `defend-screen.tsx` to the kit (pause = 44 + hitSlop 6). Gate green (168 checks); reviewer found 3 real bugs (strip covered the (?), card
  re-opened after a boss / pause, wrong seat in replays), all fixed before the PR.
- **Previews:** `docs/divecore/turf-war-t2b/` (both phones: setup, wave, card open, closed). Shot before the three reviewer fixes. Frame time 16.7 ms = the headless 60 Hz cap. Not device-verified.
- **Not shot:** a boss next wave and a 3-role wave (no save at that seat in the preview); the data + geometry are pinned in the check, the chips shrink + ellipsize at 315 pt (SE) — check on the phone.
- **Preview gotcha (cloud container):** the web export needs `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` set (dummy values on the command line are enough; nothing committed) and `--clear` after a failed export.
- **Open / for later:** the card covers the lane's notices while open (a notice arriving mid-card is hidden until it closes; a boss bar closes it); icons are role-tint swatches, not art.

#### Step T9 plan (2026-10-18, emci picked "Notices polish"; investigated, not built)
- **BOSS INCOMING on "Important only":** already fixed in T7 (`defend-screen.tsx` emits it with `important: true`; `noticeAllowed` in `src/play/notify/queue.ts`; pinned by `check-turf-war-layout.ts` and `check-notify.ts`). Only the "Open / for later" bullet in "Step T6 as built" is stale: strike it.
- **Notices lost behind the next-wave card:** the card draws over the lane (FloatLayer child) and the queue keeps running, so a notice's 3 s timer expires while covered. Fix = call `useNoticePause(wavePeekShown)` once in `DefendScreen`, next to `wavePeekShown`, unconditionally above any early return (hook: `src/play/notify/notify.ts`, already used in `play.tsx` and `dive-scene.tsx`). While the card is open only `error` notices pass; a showing notice goes back to the queue front and re-shows when the card closes. A boss bar already closes the card, so BOSS INCOMING surfaces right after. No layout change.
- **Pin:** add `assert.match(src, /useNoticePause\(wavePeekShown\)/)` in `check-turf-war-layout.ts` near the peek pins; keep the `{floatCards}{wavePeekCard}` and `wavePeekHidden` pins intact.
- **Gate:** `check:notify`, `check:turf-war-layout`, `check:fixed-regions`, `typecheck`, then `check:ota-gate` once. No new saved setting, no economy / copy change.
- **Not in T9 (decide separately):** a Bound Boss placed mid-wave with a target in range can cast with ~0 wind-up (`telegraphStart` in `turf-boss-fx-rules.ts`); cosmetic only, needs a rules-file edit + pin, newly placed boss's initial cooldown not verified. Art loose ends (neon sign, pigeon wings, card icons) = a later art step with samples first.
- **Done:** gate green, reviewer PASS, OTA, emci's phone check (open the card, trigger a notice, close the card, notice appears).

#### Step T8 as built (2026-10-17, PR #71 squash `d8ab19e6`, OTA iOS `01a14c79-ab4e-7a29-8157-17e0ec353c8a`, group `628316f3` (commit `80344b23`); awaiting emci's phone check = `docs/ATO_DEVICE_TESTS.md` Box 34; emci answered the T7 phone check "passed", no changes)
- **Stop 0 (emci): option A**, a picker in the Setup sheet: a row of theme chips (≥ 44 pt) inside the Maps card on Main (hidden while Neon
  Maze is picked) and its own small card on Trial. Nothing new on screen outside the sheet. Saved device-local `ato.play.boardTheme.v1`
  (emci OK'd the new setting; same pattern as `fx-quality.ts`; no server / cloud save). A theme never changes rewards. A theme is NOT a new
  `boardId`: saved tower layouts (`phase:boardId`) stay shared.
- **Stop 1 picks (emci):** Rooftop **C** (tar walkway + gravel, manhole pads, warm lights), Underpass **A** (damp concrete + pale tiles, yellow
  safety edge, splat pads, dashes), Court **C** (asphalt path + teal hardcourt, manhole pads, cool lights), Docks **A** (dark pier planks +
  concrete quay, manhole pads, dashes). Samples + scale sheet: `docs/divecore/turf-war-t8/samples/`.
- **Painter:** `scripts/turf-board-art.ts` is theme-driven: `TURF_THEMES` (art folder, tileset, skips, pad, props + ambient roles, dashes,
  pools, vent, pigeons, `propFallback`). The alley paints byte-identical to T3/T4 (md5 + the reviewer's atlas compare). `art-pack.ts` packs
  `ato-<theme>` + `-glow` + `-fire` and `meta.boards.ato-<theme>` (ambient clips shared). Runtime: `src/play/turf-theme.ts`
  (`turfBoardArtId`), `turf-theme-store.ts`, `turf-theme-picker.tsx`; `defend-screen.tsx` swaps the board image + ambient layer together
  (falls back to the plain board if a theme is not packed). Streetwear art 7.8 / 10 MB.
- **Art:** 4 pro tilesets (workbench 90.5–99.2) + props per theme, palette-locked + stray-pixel cleanup (95.7–100; roof vent 90.7 before
  cleanup). Off-scale props regenerated; known misses AC −12 % h, bench −14 % h. 86 PixelLab generations (≈ 21 / theme). Raw + `gen.json`
  per theme: `art-src/pixellab/board.streetwear.<theme>/`.
- **Checks:** `check:streetwear-assets` — every theme baked 512 with 15 pads + the T3 pixel test per theme (road / kerb luma: alley 30/93,
  rooftop 26/110, underpass 29/100, court 37/75, docks 44/95; all pad centres on pad art). `check:turf-war-layout` = 12 groups: ambient
  sprites clear of pads and road on every theme + a T8 group (key, default, fallback, picker placement + tap size, rules / reward files never
  read the theme). Gate green; reviewer PASS (fixed: mis-encoded characters from a PowerShell re-save, underpass prop order).
- **Previews:** `docs/divecore/turf-war-t8/` (each theme setup + wave at 430×932 + 375×667, `picker-*` = Theme row + tap Court → saved +
  board switches). Wave frame time 4.5–4.9 ms (T7 alley ≈ 4.8: unchanged).
- **Known limits:** underpass places no cone lamp and the docks no fire barrel (no clear spot on this board), so those themes animate only
  pools + vent / pigeons; four empty `-fire` layers ship (harmless). The theme store has the same tiny load-vs-tap race as `fx-quality.ts`.

#### Step T7 as built (2026-10-17, PR #70 squash `35c1040c`, OTA iOS `01a14b42-c130-7b40-8343-2eb7908aa382`, group `7e9eb190` (commit `9423cb30`); emci's phone check (Box 33) **passed** (answered in the T8 chat); emci answered the T6 phone check "passed")
- **emci before T7:** T6 phone check passed; "BOSS INCOMING" should also show on "Important only" → `NoticeInput.important` (only that one NOTIFY;
  `noticeAllowed(kind, mode, important)`, pinned by `check:notify`); no other change wanted.
- **Stop 1 picks (all recommended):** wave start = new cyan street portal (`gate/burst` 80×56 ×14 @ 12 fps = 1.17 s, own vfx layers, flat ground ellipse; cyan
  so it never reads as the magenta boss sigil) + a lane line `waveStartNotice` ("WAVE n" · "<phase> · N puffs on the road", NOTIFY); wave clear = the same
  portal's frames 7..13 at the exit (0.58 s, no new art); win = new gold + cyan sparks (`cheer/burst` 68×64 ×10 = 0.83 s) over every tower / Bound Boss,
  170 ms apart; lose = red ghost of the leaker re-walks the last 3 cells (1.2 s) with a red trail, then the exit ring. 0 PixelLab generations
  (vfx_workbench). Workbench score 86 / 85.5 (swirl gaps and one-pixel sparks, by design; repaired copies only in the PixelLab gallery). Raw + `gen-t7.json`.
- **Code:** rules + timings `src/play/turf-beat-fx-rules.ts` (`BEAT_FX`, `beatFxFlags`, `portalPoint`, `sparkPoint`, `leakReplayPath`, `winBeatMs`, `LOSE_BEAT_MS`);
  views `src/play/turf-beat-fx.tsx` (`PortalBeat`, `SparksBeat`, `LeakReplay`), drawn by the T5/T6 layer (`portal`, `sparks`, `leakReplay` on the handle).
  `Strip` moved to `src/play/turf-fx-strip.tsx` (+ `stillFrame`). `defend-screen.tsx`: `resultHold` is now `resultHoldMs` + `holdResult(ms)` (max of the boss
  blast, the clear + sparks, the replay); the card waits, `winWave()` / `setPhase('lost')` stay on the same tick.
- **Quality / motion:** Off = no beat; Minimal = sparks on every other tower; Reduce Motion / Motion Off = still frames (portal open frame, sparks frame,
  whole trail + ghost one cell short of the exit + a fade-only ring). No beat flashes, shakes or stops the sim. Motion audit T4–T7 table: `docs/divecore/turf-war-t7/NOTES.md`.
- **Perf pass:** `src/play/turf-board-base.tsx` = `TurfBoardBase` (baked board image), `BoardDecorTiles`, `StaticRoad` as memo layers with stable props.
  Busy wave (Main 9, 12 towers + 20 creeps): 9.0 → 8.5 ms avg (430×932), 8.7 → 8.2 (375×667), JS busy 78 → 76 %. Small: the units `<Svg>` (creeps, towers,
  bars) is the real per-tick cost; a bigger win needs the creeps off React state (not planned).
- **Checks:** `check:turf-war-layout` = 11 groups (T7: sheets + timings, every beat's opaque pixels inside the board on both maps, Off / calm flags, T4–T7
  motion audit, lane line within the notice limits, BOSS INCOMING important, static layers memoised, win still on the same tick). Reviewer PASS.
- **Previews:** `docs/divecore/turf-war-t7/` (start / win / lose on both phones, `-rm` = Motion Reduced, `max-lose-off`, stop-1 samples `t7-*`).
- **Known limits (cosmetic):** the ghost glides (last drawn frame, no walk); two leaks on one tick show one ghost; the old T5 ring fallback is unreachable
  (the replay draws the ring). Preview gotchas: on SE the closed dev-kit sheet catches clicks (press Call wave by keyboard); the browser's own reduced-motion
  flag freezes the Expo web splash (seed `ato.play.reduceMotion.v1 = reduced` instead).

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

### T8 — More map themes (added 2026-10-17, emci: "add more map themes")
- **Scope:** a theme = a different painting of the SAME board (16×16 grid, `ATO_PATH`, 15 pads, tower cap 6), so no play or balance change.
  Make `turf-board-art.ts` theme-driven (one data block per theme: tileset id, variants, pad style, props, light pools), then add themes:
  rooftop (tar roof, vents, AC units, fairy lights), subway underpass (tiled floor, rails, pillars, flicker tubes), court / park, docks.
  The default stays the alley (D). ≈ 30–40 PixelLab generations per theme.
- **Decide first (feature, not art):** how a player gets a theme — picker in Setup, daily rotation, or unlocks — and whether a theme changes rewards (it must not unless emci says so).
- **Checks:** the T3 pixel test runs per theme; `check:streetwear-assets` pad count per board.
- **Done:** emci picked themes from samples, gate green, reviewer PASS, OTA.

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
