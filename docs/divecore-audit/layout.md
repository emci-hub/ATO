# Divecore layout audit: why the map / scene changes size

Read-only audit, 2026-10-14. Method: static layout math from the styles in the code. Nothing was run on a device.
Values marked "est" depend on font metrics Yoga measures at runtime; the section "What to log" says how to confirm them.

Devices (same as `src/play/layout-shot.tsx` INSET; portrait; side insets 0):

| Short | Window | Insets top/bottom |
|---|---|---|
| Max | 430 x 932 | 59 / 34 |
| 15 | 393 x 852 | 59 / 34 |
| SE | 375 x 667 | 20 / 0 |
| And | 412 x 915 | 24 / 24 |

## 0. Verdict on the suspected cause

The suspicion ("stage is flex leftover, so an in-flow notice steals height, and grow-only regions keep the loss") is only partly right today.

- It was true before `e54311ed` (fixed-regions kit). Since then every in-flow notice in Hideout, Dive and the pet games is either floating, reserved, or fixed height. Section 6 shows runtime delta = 0 for all of them.
- `useGrowOnlyHeight` has exactly ONE caller in the whole app: the Dive dock (`dive-scene.tsx:666`). `ReservedRegion` has zero callers. The shell does not use grow-only (documented at `play.tsx:1022`).
- Turf War is not a flex-leftover stage at all. The board is a width-square inside a ScrollView (section 3). It cannot shrink; it moves and gets clipped.
- What really changes the picture: (a) the tall room canvas is fitted by HEIGHT after ~300 pt of chrome (section 1); (b) the Turf War setup to run bar swap takes 55-60 pt of viewport (section 3); (c) discontinuities in derived modes (section 5).

`check:fixed-regions` only greps source strings (`scripts/check-fixed-regions.ts`). It has no geometry, so it passes while the numbers below move.

## 1. Shell numbers (shared by Hideout, Turf War, pet games)

`src/app/play.tsx:1021` streetColumn: `paddingTop: insets.top`, then `StreetResourceBar` or `StreetHudOutlet`, then `streetBody` (`flex:1, minHeight:0`, line 1624), then `StreetTabBar` or the dock View (`streetDock`). `SafeAreaView edges=['left','right']` inside the body.

| Piece | Source | Height (pt) |
|---|---|---|
| Top inset | `insets.top` | 59 / 59 / 20 / 24 |
| ResourceBar | `street-shell.tsx:415-424`: `minHeight 44` (`STREET_SIZE.resourceBar`) but the gear is 40 tall + `paddingVertical 6` x2 = 52, + `marginTop 4` | **56** (the 44 constant is not what renders) |
| TurfWar HUD (`streetHud`) | `defend-screen.tsx:5101`: `minHeight 48`, pause 40 + 12 padding = 52, + `marginTop 4` | **56** (equal to ResourceBar by coincidence: both are a 40 pt button + 12) |
| TabBar | `street-shell.tsx:429`: `paddingTop 10` + tab content (icon 30 + label ~14 + underline 5 + gaps 2 = ~51; icon-only under 380 wide: min 48) + `max(bottomInset, 6)` | est Max 95 / 15 95 / SE 64 / And 85 |
| Turf dock (running) | `play.tsx:1628` `paddingTop 8` + Skill 52 + gap 8 + row 48 + `max(bottom, 8)` | **116 + max(b,8)** = Max 150 / 15 150 / SE 124 / And 140 |

`ScrollView`-wrapped screens (`play.tsx:919`): dress, defend, shop, about, swords, locker. These sit in `scrollContent` (padding 24 sides, 16 top, 64 bottom, gap 16). Hideout (pet) and Dive are NOT in a ScrollView (`play.tsx:879-915`, `fullSafeArea`).

Shell swaps (only these change the bars): Hideout/others to Dive (`street` is false for `mode==='dive'`, `play.tsx:775`, so Dive has no bars and takes all four safe-area edges); Turf War setup to run (`useStreetDockFilled`, `play.tsx:1024,1047`); `view == null` at first load (hub, then column).

## 2. Hideout room

### 2a. How the size is derived

| Step | File:line | What |
|---|---|---|
| Column | `pet-screen.tsx:814` `screen` flex:1 | topBar is `display:none` in street (816); then `PetRoom`; then `iconRow` |
| Meters | `pet-room.tsx:834`, `street-room.tsx:794-808` | `metersSlot` paddingTop 6 + `StreetStatusStrip` marginTop 4 + `height:36` (fixed, `overflow:hidden`, `flexWrap:nowrap`) = **46** |
| Stage | `pet-room.tsx:1178` `stage: flex:1, minHeight:0`; `onLayout` at 898 | the stage IS the flex leftover; measured into `real` (478-480) |
| Icon row | `pet-screen.tsx:1212` `height: 64` | fixed (Feed + Info; full set while egg, same height) |
| Control row | `pet-room.tsx:486-497`, `hideout-bar.tsx:24-34` | `controlsMode` side / ceiling / row, from `fullFit`. Row mode reserves `HIDEOUT_ROW_RESERVE_PT = 64` INSIDE the stage |
| Scale | `hideout-iso.ts:507-532` | `pt = min(availW/352, availH/576)` (canvas 352x576, content = whole canvas, margin 0). Fit-to-contain, not integer |
| Origin | `hideout-iso.ts:561` | centred in `(width, height - barReserve)` |

No `useWindowDimensions` is used for the room. Before the first `onLayout`, `hideoutScale` is null and the pet box / origin use the fallback (`pet-room.tsx:513-522`): one re-layout pop at mount.

### 2b. Stage rect and room canvas (base state)

Stage height = H - top - 56 - TAB - 46 - 64.
Mode thresholds: side needs (W - canvasW)/2 >= 64; ceiling needs 38*pt >= 44 (pt >= 1.158). None is met at these sizes, so all four are in row mode (barReserve 64).

| Device | Stage rect (W x H) | availH = H - 64 | pt | Room canvas drawn | Share of screen width |
|---|---|---|---|---|---|
| Max | 430 x 612 | 548 | 0.951 | 335 x 548 | 78% |
| 15 | 393 x 532 | 468 | 0.813 | 286 x 468 | 73% |
| SE | 375 x 417 | 353 | 0.613 | 216 x 353 | 58% |
| And | 412 x 640 | 576 | 1.000 | 352 x 576 | 85% |

The canvas is portrait 0.611 aspect; every phone stage is wider than that, so height is always the limiter and the sides are unused. That is the "map is small" effect on SE and 15. It is design math, not a runtime shrink.

### 2c. Things in or beside the column that could change height

| Element | Trigger | Height before to after | Why |
|---|---|---|---|
| Status strip (name, stage, grade chips) | pet changes | 46 to 46 | fixed `height:36` |
| Buff chips | buffs | 0 to 0 | not rendered in street (`pet-room.tsx:887`) |
| Coach row | tip changes | 0 to 0 | not rendered in street (1137) |
| Speech bubble, PlayBanner, sheets, game overlay | events | 0 | absolute / overlay (`play-banner.tsx:95`, `pet-screen.tsx:1194`) |
| Icon row (egg vs hatched) | stage | 64 to 64 | fixed |
| Control row mode | stage size only | constant per device | no runtime input |
| Fonts not ready | first paint | blank `screen` then full | `pet-screen.tsx:796`, no size change after |
| Shell leave to Dive | tap | bars removed (screen switch) | Dive is a different frame (section 4) |

Hideout runtime delta from notices: 0 pt. It does not shrink at runtime; after grow-only: n/a (no grow-only here).

## 3. Turf War (setup and wave)

### 3a. How the board size is derived

| Step | File:line | What |
|---|---|---|
| Container | `play.tsx:919` ScrollView, `defend-screen.tsx:2653-2654` root `container` (row) > `safeArea` (maxWidth 800, gap 16, paddingTop 16, paddingBottom 64) | so top padding is 16+16 = 32, bottom padding 64+64 = 128 |
| Card | `styles.boardCard` 5278: marginHorizontal -(24-8) = -16, paddingHorizontal 4 | card width = W - 48 + 32 = W - 16 |
| Board | `styles.board` 5285: `width:'100%'`, `aspectRatio:1` | **side B = W - 24** (square) |
| Measure | `defend-screen.tsx:2693-2697` | `onLayout` stores only `width` into `boardSizeRef` / `boardSize` (tap + avatar math) |

No `useWindowDimensions`, no flex leftover, no height input anywhere in `defend-screen.tsx` (grep: zero hits). The board cannot shrink with the viewport. It is clipped or scrolled instead.

### 3b. Viewport (the ScrollView height) and the board in it

Viewport V = H - top - (56 resource bar or HUD) - (TAB in setup, DOCK in run).
Board top inside the scroll content: setup 204 (32 + title 44 + 16 + lede 2 lines 48-4 + 16 + card pad 16 + label 20 + 16); run 144 (lede is `display:none`, `defend-screen.tsx:2680`). Label can wrap to 2 lines (cycleNote / replay): +20.
Coach line (run) top = board bottom + 76 (16 gap + FX row 28 + 16 card pad + 16 gap), height 58 (60 with 3 lines of 20 pt text; the check says "3 lines" but 58 < 60).

| Device | B (board side) | V setup | Board rows setup (top-bottom) | Cut | V run | Board rows run | Cut | Coach rows (run) | Coach visible? |
|---|---|---|---|---|---|---|---|---|---|
| Max | 406 | 722 | 204-610 | 0 | 667 | 144-550 | 0 | 626-684 | 41 of 58 |
| 15 | 369 | 642 | 204-573 | 0 | 587 | 144-513 | 0 | 589-647 | 0 (below fold) |
| SE | 351 | 527 | 204-555 | 28 | 467 | 144-495 | 28 | 571-629 | 0 |
| And | 388 | 750 | 204-592 | 0 | 695 | 144-532 | 0 | 608-666 | 58 |

Setup to run: V drops by 55 (Max/15/And) or 60 (SE) because the dock replaces the tab bar; board top moves up 60. On SE the two cancel (cut stays 28), on the others the map moves up 60 inside a viewport that is 55 shorter. Top bar is 56 in both phases (coincidence, not a contract).

Content height in run = coach bottom + 128: Max 812 vs V 667 (scroll range 145), 15 775 vs 587 (188), SE 757 vs 467 (290), And 794 vs 695 (99). The page is ALWAYS scrollable (128 pt trailing padding). The board takes `onResponderTerminationRequest={() => true}` (`defend-screen.tsx:2704`), so a vertical drag on the map hands the touch to the ScrollView and the map slides while you play.

### 3c. Changes while playing

| Event | Trigger | Board size | Content below board | Source |
|---|---|---|---|---|
| Pause | pause button | 0 | +44 (1 line) or +64 (2 lines, narrow): `pausedBox` marginTop 8 + 16 gap + text, in flow | `defend-screen.tsx:3305`, `5318` |
| Coach line paused | pause | 0 | 0 (opacity 0, `minHeight 58`) | 3942, 5098 |
| Coach text 3 lines | tip toggle | 0 | +2 (60 vs 58) | 3943, 5099 |
| Pad panel (tower list, Done) | tap pad | 0 | est +260 to +330 (16 gap + padding 32 + 20 header + 36 per tower row + 36 Done + 16 gaps; more with Bound Bosses) | 3376 |
| Boss alert | wave event | 0 | 0 (absolute) | 3277 |
| Won / Lost | end | 0 | dock to tab bar: V +55/+60; result cards appended | 4105, 4256 |
| Immersive status bar | entering Turf War | 0 | V + (20 SE / 24 And) IF `insets.top` drops to 0 with the bar hidden. iOS notch devices keep it (`use-immersive-mode.ts:13`). Unverified: log it | `play.tsx:220`, `1021` |

So for Turf War the honest statement is: the map does not shrink, but it jumps 60 pt on run start, is clipped on SE, scrolls under a drag, and every in-flow row below it (pause text, pad panel) moves the coach/HUD content.

## 4. Underground / Dive

### 4a. How the size is derived

`play.tsx:879-882`: Dive is in `SafeAreaView edges=undefined` (all four edges, no street bars). `dive-screen.tsx:494` `screen: flex:1`. `dive-scene.tsx`: `scene flex:1` > `topSlot` (DiveTopBar, flexGrow 0) + `stage` (`flex:1, minHeight:0`, line 914, `onLayout` 722 stores `{width,height}`) + `dock` (`flexGrow 0`, grow-only `minHeight`, 848-852). The world is `worldH = band*(MAX_DEPTH+1) + height` from the measured stage.

| Region | Math | Height |
|---|---|---|
| DiveTopBar | bar paddingTop 4 + frame margin 4 + stack padding 16 + gaps 4 + row1 ~27 (shells number 21 pt x 1.28) + StreetLineMap 36 (4 + dot 16 + gap 2 + name 14) + row2 21.8 | est **113** |
| Dock | dock paddingBottom 8 + frame margin 4 + dockPad (padding 24 + 2 gaps 16) + haul row 26 + heat row 26.9 (reserved, opacity 0 off-run, `dive-scene.tsx:883`) + note 2 lines 43.5 (`dive-screen.tsx:505`) + gap 8 + 2 button rows 100 + gap 8 | est **264** |
| Chrome total | | 377 |

PIXEL caption helper: `PIXEL_CAPTION_PT 17` x 1.28 = 21.76 per line (`pixel-theme.ts:59-64`). PixelButton face 50 (`buttonFixed minHeight 50`), caption faces 48.8.

| Device | Stage (W x H) = H - top - bottom - 377 | World aspect |
|---|---|---|
| Max | 430 x 462 | 0.93 |
| 15 | 393 x 382 | 1.03 |
| SE | 375 x 270 | 1.39 |
| And | 412 x 490 | 0.84 |

### 4b. Things that could change height

| Element | Trigger | Delta | Why |
|---|---|---|---|
| Find / caption toast, rare find | find, bust, surface | 0 | `toast` absolute (`dive-scene.tsx:916`) |
| Splash row ("Searching...") replaces the buttons | tap Dive | dock content 160 to 56 (-104); dock stays 264 | grow-only holds it. Without it the stage would grow by ~104-116 |
| Dock status note | run state | 0 | `minHeight` 2 lines, `numberOfLines 2` |
| Heat row | run on/off | 0 | opacity 0 reserve |
| Button rows 1 vs 2 | state | 0 | spacer rows fill to `DIVE_DOCK_ROWS = 2` |
| Grow-only ratchet | any taller layout (a caption face >50, wrapped note) | + (never back) | `useGrowOnlyHeight` keeps the max forever; not triggered in the base states I can compute |
| Haul reveal | surface | 0 | overlay |
| Fonts | first paint | scene bare then full | `dive-scene.tsx:695` |

Dive runtime delta: 0. Dive is already the closest to a fixed-region screen. `layout-shot` for Dive matches the real frame (both use safe area only).

## 5. Pet games (CatchFoodGame / TapTrainGame)

`pet-games.tsx:391` `GamePlate`: `screen flex:1` > `top` (panel) + `stageWrap` (`flex:1`, padding 6 vertical, 8 horizontal) > `PixelFrame grow` (margin 2) > `stage flex:1` (`onLayout` 454) + `dock`. The game is an absolute overlay on the PetScreen root (`pet-screen.tsx:1138,1194`), so it sits inside `streetBody`: the resource bar and tab bar stay on screen.

| Piece | Math | Height |
|---|---|---|
| Area A (inside streetBody) | H - top - 56 - TAB | Max 722 / 15 642 / SE 527 / And 750 |
| Top panel | `top` paddingTop 4 + frame margin 4 + topPad (padding 12 + gap 2) + row 44 (`backHit minHeight 44`) + status line 21.8 (`numberOfLines 1`) | est 88 |
| Stage chrome | stageWrap padding 12 + frame margin 4 | 16 |
| Catch dock | paddingBottom 8 + margin 4 + padding 24 + hint 3 lines 65.3 (`numberOfLines 3`, text is ~160 chars so it always fills 3) | est 101 |
| Train dock | 8 + 4 + 24 + hint 2 lines 43.5 + 8 + bar frame 40 + 8 + TAP 72 | est 208 |

| Device | Catch stage (W-20 x h) | Train stage (W-20 x h) |
|---|---|---|
| Max | 410 x 517 | 410 x 411 |
| 15 | 373 x 437 | 373 x 331 |
| SE | 355 x 322 | 355 x 216 |
| And | 392 x 545 | 392 x 439 |

Changes: Train hint swaps among strings that all fit 2 lines (`minHeight` 2 lines, `pet-games.tsx:859`): 0. Catch hint pinned to 2 lines by the check but renders 3 (constant), so no runtime change, but the pin is wrong by one line. Status line, score: single line, 0. Catch/Train docks differ by 107 pt, so the two games have different stage sizes by design.

`layout-shot.tsx` (catch/train/pet) adds only `paddingTop/Bottom` of the inset. It does NOT render the 56 pt resource bar or the tab bar, so for pet, catch, train it overstates the stage by 56 + TAB = Max +151, 15 +151, SE +120, And +141. Only the `dive` shot is faithful. Also `max` and `15` use the same inset.

## 6. Summary of runtime deltas

| Screen | Notices that change the stage | After grow-only |
|---|---|---|
| Hideout | none (strip fixed 36, rest floats) | no grow-only used |
| Dive | none (all float / reserved) | dock ratchets up only, base 264 |
| Turf War | board never changes; viewport -55/-60 on run start; content below board +44/+64 on pause, +260-330 on pad panel | none; shell bars are not grow-only |
| Pet games | none | none |

## 7. Root causes (ranked)

1. **No owner for stage size.** Each stage is "whatever flex leaves", then each re-derives its own scale after a measure pass (Hideout `pet-room.tsx:478-505`, Dive `dive-scene.tsx:329`, games `pet-games.tsx:414`). Size = H - insets minus ~10 constants spread over 8 files (56, 46, 64, 64, 113, 264, 88, 101/208...). Several of those constants are not what the code says (ResourceBar 44 renders 56; coachLine 58 vs 60; Catch hint 2 vs 3 lines). The gate checks strings, not geometry.
2. **Turf War is not a stage.** The board is a width-square (`W-24`) in a page ScrollView with 128 pt trailing padding. It cannot fill what the regions leave; it is clipped on SE (28 pt), has its coach row below the fold on 15 and SE, jumps 60 pt on run start, and scrolls when dragged. Evidence: `defend-screen.tsx:5285-5290`, `play.tsx:919`, `defend-screen.tsx:2704`.
3. **Setup to run swaps different-height bottom bars** (tab bar 64-95 vs dock 124-150). Allowed as a "screen switch" by the kit, but it is the one real runtime height change in the game screens (-55/-60 viewport).
4. **Tall portrait room fitted by height after ~300 pt of chrome.** Chrome above and below the Hideout stage is 56 + 46 + 64 + TAB = 230-261, plus 64 reserved inside for controls. SE gets a 216 pt wide room (58% of the screen).
5. **Derived discontinuities.** `controlsMode` side/ceiling/row and `barReserve` switch on thresholds of the measured stage; first paint has `hideoutScale = null`; immersive mode can drop `insets.top` on SE/Android (unverified); the tab bar is icon-only under 380 wide.

## 8. Proposed `computeStageFrame(screenId, window, insets)`

One pure function (new file, e.g. `src/play/stage-frame.ts`), called once in `play.tsx` per mode, passed down as props, with a node check that asserts the sums for the four devices above. Top inset taken once at Play mount (not from live `useSafeAreaInsets` during immersive).

| Screen | Fixed regions (pt) | Stage = |
|---|---|---|
| Hideout | RES 56, STRIP 46, ICON 64, TAB `60 + max(b,6)`, CONTROL 64 (always inside the stage, decided by screen id, no thresholds) | `H - top - 56 - 46 - 64 - TAB` then room fit in `stage - 64` |
| Dive | TOP 112 (explicit `height`, not content), DOCK 264 (explicit `height`, not grow-only) | `H - top - bottom - 376` |
| Turf War | HUD 56 (same in setup and run), NOTICE 58 (coach/pause line, absolute or `height:58`), BOTTOM = one height for both phases = DOCK `116 + max(b,8)` (setup shows its Start/Tabs inside the same box) | `H - top - 56 - 58 - BOTTOM`; board side = `min(W-24, stage)`; board outside the ScrollView |
| Pet games | RES 56, TAB, TOP 88, DOCK 208 for both games (Catch pads to Train's height) | `A - 88 - 208 - 16` |

Resulting board / stage with that design (Turf, run, BOTTOM 124-150): Max stage 667-58 = 609 (board 406 fits, 203 spare); 15: 587-58 = 529 (board 369); SE: 467-58 = 409 (board 351 fits, +58 vs today's 28 cut); And 637 (board 388).

Places to change:

| File | Change |
|---|---|
| new `src/play/stage-frame.ts` + `scripts/stage-frame-check.ts` | the function + numbers table above as assertions; add to `check:ota-gate` |
| `src/app/play.tsx` (1021-1059, 919) | compute once, pass `frame`; give Turf War a non-scrolling branch (`mode==='defend'` outside the ScrollView); set explicit heights on ResourceBar/TabBar slots; stop reading live `insets.top` while immersive |
| `src/play/street-shell.tsx` (415-436) | `resbar height 52 + marginTop 4`, tab content `height 50`; drop the unused 44 constant or make it true |
| `src/play/defend-screen.tsx` (2652-2700, 3305, 3376, 3932-3953, 5099, 5285) | board outside ScrollView at `min(W-24, frame.stage)`; pause text and pad panel as overlays or in the fixed NOTICE lane; coachLine `height 60`; same bottom height in setup and run |
| `src/play/pet-room.tsx` (478-505) | take `frame.stage` as the measured size from the parent instead of `onLayout`; fixed control row |
| `src/play/dive-scene.tsx` (666, 848-852) and `dive-hud.tsx` | explicit dock and top-bar heights; remove `useGrowOnlyHeight` |
| `src/play/pet-games.tsx` (461-463, 630, 859) | one dock height for both games; Catch hint `minHeight` 3 lines |
| `src/play/layout-shot.tsx` | render the street bars for pet/catch/train, or compute from `computeStageFrame`; separate `max` inset |
| `scripts/check-fixed-regions.ts` | add a geometry assertion through `computeStageFrame` instead of source regexes |

## 9. What to log to confirm (not computable statically)

Temporary `onLayout` logs (one line each, tag `[layout]`), run on each device size once per screen:

| Where | Log | Settles |
|---|---|---|
| `play.tsx` `streetBody` and `streetColumn`; also `insets.top` on every mode change | `{mode, top, bodyH}` | real RES/TAB/DOCK heights; whether immersive drops `insets.top` on SE/And |
| `street-shell.tsx` ResourceBar and TabBar roots | `{h}` | TAB est 95/64/85 vs real; ResourceBar 52 vs 44 |
| `pet-room.tsx:898` stage `real` + `controlsMode` + `barReserve` | `{w,h,mode,pt}` | section 2b table |
| `dive-scene.tsx` stage and dock `onLayout` | `{stageH, dockH}` | topBar 113 / dock 264 / ratchet |
| `defend-screen.tsx:2693` board `{w,h}` + ScrollView `onLayout` and `onContentSizeChange`, `onScroll` offset | `{B, V, contentH, y}` | section 3b table, drag-scroll while playing |
| `pet-games.tsx:454` stage and dock | `{stageH, dockH}` | section 5 |
| Coach line, `pausedBox`, pad panel `onLayout` | `{h}` | 58 vs 60, +44/+64, +260-330 |
