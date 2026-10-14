# Divecore placement audit — measured (Phase 1, 2026-10-14)

Every Divecore screen, what is on it, where, how tall, and whether it squeezes or covers the map — **measured
on a running build**. This is the follow-up `layout.md` §9 asked for ("what to log to confirm"): the static
audit in `nav.md` / `notices.md` / `layout.md` stays the reference for code paths; this file gives the real
numbers and corrects the estimates (table at the end).
Read with `docs/divecore-layout-spec.md` (the fix) and `docs/divecore-ui-research.md` (the why, R1–R12).

## How this was measured

- **Real layout, not estimates.** The app was run on web (`expo start --web`, Expo SDK 54, react-native-web)
  and driven with Playwright at **430×932** (iPhone 16 Pro Max, safe area top 59 / bottom 34) and
  **375×667** (iPhone SE, top 20 / bottom 0). Numbers are DOM boxes in pt, y measured from the top of the screen.
- Safe areas were injected the way react-native-safe-area-context reads them on web. One web-only quirk of
  that library (an `edges` list without `top` still adds the top inset on web; native treats it as off) was
  patched in the local `node_modules` only, so the numbers match the phone. Nothing in the repo changed.
- The save was seeded locally: hatched Child pet "Raven", 1,240 Caps, 10/10 Subway Tokens, tutorial seen.
- **Dive and the pet games** were measured in the repo's own layout-shot frames (`/play?shot=dive&inset=max`
  etc., `src/play/layout-shot.tsx`) because the manhole wipe that opens Dive never finishes on web. Those frames
  use the same insets.
- **Store** is dev-unlock only (`shopUnlocked = PRE_LAUNCH_DEV && devUnlocked`), so it is audited from code.
- Screenshots: `docs/divecore/before/{max,se}-*.png` (magenta stripes = status bar / home indicator).

Thumb zones (Hoober, see research doc): split the screen in thirds.
430×932: **top** 0–310 · **middle** 311–621 · **bottom** 622–932. 375×667: **top** 0–222 · **middle** 223–445 · **bottom** 446–667.

## Summary — what to fix first

1. **Turf War wave hides part of the map on SE.** After scrolling down to *Call wave* (it sits 830–870 pt below
   the fold), the setup content collapses but the scroll offset stays: on 375×667 the board's top **146 pt
   (42 %) sits under the HUD** while 230 pt of empty space shows below it. *(new finding)*
2. **Pausing a wave moves the board.** The board jumps **+145 pt** (Pro Max) / **+290 pt** (SE) when you pause
   and back when you resume. *(new finding)*
3. **The map is small where it matters.** Turf War board = **44 %** of screen height on Pro Max (406 of 932);
   Dive picture area = **50 %** (Pro Max) and **41 %** (SE). The Dive dock alone is 250 pt.
4. **Primary actions are out of reach.** *Call wave* needs a long scroll on both phones; ⚙ is top-right; on SE
   *Exit Play* is under the tab bar and the dev kit is below the screen.
5. **Floating things cover things.** PlayBanner floats at `insets.top + 52` over whatever is there (Hideout
   status strip, the Dive top bar, the Turf War board); the Hideout swipe hint covers the room buttons.
6. **The "map shrink bug" is real in the code but did not fire in these states.** The stage is flex-leftover
   everywhere and the bars are grow-only, so any taller bar state shrinks the map for the rest of the visit.
   Measured: Dive stays 468/276 pt across ride / mid-dive; Turf War's coach line sits under a width-sized board,
   so it pushes empty space, not the board. The fix (a stage size computed once) is still the right one.

## Known problems — checked

| Claim | Verdict | Evidence |
|---|---|---|
| Two shells (Classic CommandHub + Street) | **Half true.** Street is the only art skin (`art-skin.ts`), so CommandHub only renders while the save is loading (`view == null`). But Classic chrome is still mounted inside screens with `display: 'none'` (Hideout top bar: ‹ Hub, Stash, ⋯, ⚙; Turf War ‹ Divecore / Swords). | `src/app/play.tsx:847-874`, `pet-screen.tsx:816`, `defend-screen.tsx:2652` |
| Hideout has 3 entry points | **True (4).** Block "Go to the Hideout" button, tab bar *Hideout*, banner tap (target `pet` / `journal`), and Dive's back. | `play.tsx:1076-1085`, `street-shell.tsx:419` |
| Turf War has 2 entry points | **True.** Block *Turf War* tile + tab bar. | `street-shell.tsx:423` |
| Dive's back always returns to the Pet room | **True, and it now conflicts:** the Block's *Underground* tile also opens Dive, but back still lands in the Hideout. The comment "Dive only opens from the Pet room" is stale. | `play.tsx:231-236`, `street-shell.tsx:440` |
| One thing, many names | **True.** See the names table below. | |
| Guide buried at Pet → Info → Guide | **True.** Also reachable from ⚙ → "Open the Guide" (2 taps, top corner) and the tutorial's last card. The in-sheet "?" links open it too. | `divecore-settings.tsx:245`, `pet-screen.tsx:1093` |
| ⚙ is in the hard-to-reach top corner | **True.** 40×40 at x 382, y 69–109 (Pro Max): top zone, far from the right thumb. | measured |
| Exit Play is small text mid-scroll | **True.** "‹ Exit Play", 66×52, y 643–695 on Pro Max; on SE it is at 604–656 — **under the tab bar (603)**, needs a scroll. | measured |
| Dev kit shows in the player hub | **True** (pre-launch only). "Unlock dev kit" row / "Dev" group sit in the Block's scroll (y 716 Pro Max; off-screen on SE). Never renders with `PRE_LAUNCH_DEV` off. | `play.tsx:839-841` |
| 5-card tutorial ≈ 115 words | **More: 124 body words + 12 title words.** And card 3 is stale: it says "Feed, Play, Dive, Expedition and Info are along the bottom", but the Street dock shows Feed + Info only. | `divecore-tutorial.tsx:13-38` |
| Map shrink bug (stage = flex leftover, bars grow-only) | **True in code** (`useGrowOnlyHeight`, `ReservedRegion`, every stage is `flex: 1`). Did not change the stage in the measured states (table below); the measured map losses come from scroll and pause instead. | `fixed-region.tsx`, `dive-scene.tsx:667,852`, `pet-room.tsx:1154` |
| PlayBanner floats at `insets.top + 52` | **True.** `TOP_BAR_H = 52`; top at y 111 (Pro Max) / 72 (SE), 12 pt side margins, zIndex 50. | `play-banner.tsx:19,95` |

### Names in use today

| Thing | Names seen on screen / in code |
|---|---|
| The whole game | Divecore (Block eyebrow), Play (Exit Play), Basecore (claim card, Turf War lede) |
| Home | The Block (tab + header), Command Hub (Locker back link "◀ Command Hub", Hideout a11y "Back to Command Hub"), Hub (DEV label) |
| Pet place | Hideout (tab, Dive back "‹ HIDEOUT"), Pet room (Dive back a11y), Pet (tutorial, Classic) |
| Tower defence | Turf War (tab, title), Defend (code, DEV label), Divecore (tutorial card 5 "Clearing waves in Divecore") |
| Dive | Underground (Block tile, room spot), Dive (tutorial, a11y "How Dive works"), ride (button) |
| Gear | Locker (tab), Locker · Fits (header), Fits / Blades (sub-tabs), Bag (DEV label), Dress (code), Swords |
| Store | Store (tab), Corner Store (header), Shop (Classic), Token shop / Tide shelf / Paid shop (filters) |
| Soft currency | **Caps** (resource bar) = `view.tokens` — but the Hideout build tease says "600 **tokens** to start" and the Store lede "soft tokens"; Classic called it scrap |
| Dive charges | **Subway Tokens** (a11y), "10/10 tokens" (Dive top bar), "ride · 1 token" |
| Run currency | "80 caps" in the Turf War HUD (run caps, not the Caps in the bar) |
| Other | shells (Dive), Shine / Prism stones |

## Screen by screen

Positions are y-ranges in pt. "Map" = the viewport (room, board, picture). Taps under 44 pt are flagged.

### The Block (hub) — `mode 'grove'`, `StreetBlock` in a ScrollView

No map; a scrolling list between the resource bar and the tab bar.

| Element | Pro Max y (h) | SE y (h) | Zone | Map? |
|---|---|---|---|---|
| Resource bar: Caps · Subway Tokens · (stones) · ⚙ | 63–115 (52) | 24–76 (52) | top | — |
| ⚙ Settings (40×40, hitSlop 8) | 69–109 | 30–70 | top-right | — |
| "DIVECORE / THE BLOCK" plate | 115–183 (68) | 76–144 | top | — |
| Pet card (figure, Hunger, Mood) | 195–323 (128) | 156–284 | top/mid | — |
| "Go to the Hideout" button | 335–383 (48) | 296–344 | middle | — |
| Turf War tile + Underground tile | 395–527 (132) | 356–488 | middle | — |
| Basecore research card + Claim button | 555–631 (76) | 516–592 | mid/bottom | — |
| "‹ Exit Play" (text link) | 643–695 (52) | 604–656 **under tab bar** | bottom | — |
| Dev unlock / Dev kit group (pre-launch) | 716–736+ | 677+ **off-screen** | bottom | — |
| Tab bar: Block · Turf War · Hideout · Locker (· Store) | 838–932 (94 incl. 34 inset) | 603–667 (64) | bottom | — |

Notes: there is no horizontal gutter (cards run edge to edge at 430 wide). Under 380 pt wide the tab labels drop
(icons only) — SE shows no tab names. The Store tab appears/disappears with the dev unlock.

### Hideout (pet room) — `mode 'pet'`, `PetScreen` → `PetRoom`

| Element | Pro Max y (h) | SE y (h) | Zone | Map? |
|---|---|---|---|---|
| Resource bar | 63–115 | 24–76 | top | — |
| Classic top bar (‹ Hub, Stash, ⋯ Pet menu, ⚙) | `display: none` | same | — | mounted, hidden |
| Status strip: name · stage · Hunger · Mood · grade (fixed 36) | 125–161 | 86–122 | top | in flow above map |
| **Stage (room)** | **161–774 (613 = 66 %)** | **122–539 (417 = 63 %)** | top→bottom | — |
| · Room spots Play / Stash / Underground / Explore (on the art) | inside stage | inside stage | middle | stage content |
| · Room buttons Hideout / Loft / Call (row mode, 64 reserved) | 710–774 | 475–539 | bottom | inside stage, reserved |
| · Swipe hint "Swipe for rooms…" (first visit) | 712–750 | 477–515 | bottom | **covers the room buttons** |
| · Speech bubble over the pet | floats | floats | middle | covers room art (by design) |
| Dock: Feed · Info (48 buttons) | 774–838 (64) | 539–603 (64) | bottom | — |
| Tab bar | 838–932 (94) | 603–667 (64) | bottom | — |
| Sheets: Feed, Play, Eggs, Card, Pet menu, Stash, Stone, Prism, Info (Status/Journal/Book/Hall/Style/Guide/Dev), tease | bottom sheets | | | cover map (modal) |
| PlayBanner | top at 111 | top at 72 | top | **covers status strip + room top** |

The room art scales continuously with the stage height (`hideoutIntegerScale` room canvas path), so every
pt the bars take is a smaller room.

### Underground / Dive — `mode 'dive'`, fullscreen (no resource bar, no tab bar)

| Element | Pro Max y (h) | SE y (h) | Zone | Map? |
|---|---|---|---|---|
| Top bar panel: "‹ Hideout", stop track (Platform…Ghost), Gear info ›, n/10 tokens, shells | 65–170 (105) | 26–131 (105) | top | — |
| · "‹ Hideout" back — **20 pt tall, hitSlop 10 → 40** | 76–96 | 39–55 (16) | top-left | — |
| · "Gear info ›" / "How Dive works" — **22 pt, hitSlop 8 → 38** | 140–162 | 101–123 | top | — |
| **Stage (subway picture)** | **170–638 (468 = 50 %)** | **131–407 (276 = 41 %)** | middle | — |
| · Find / caption toast ("Found a snack") | stage top + 10 | same | top | floats over the picture |
| · Subway doors, find box, flying shells | stage | stage | | stage content |
| Dock: Bag row · Heat bar · Powers line · 2 button rows (reserved) | 638–888 (250) | 407–657 (250) | bottom | grow-only |
| · Ride / Local · Express / Head up (48–50) | inside dock | inside dock | bottom | — |
| PlayBanner | top at 111 | top at 72 | top | **covers the top bar's lower half** |
| Sheets: Dive info, Dive gear | bottom sheets | | | modal |

The picture is drawn at a fixed aspect inside the stage, so on Pro Max ink bands show above and below it.

### Turf War — setup (`phase` not running), inside the shared ScrollView

| Element | Pro Max y (h) | SE y (h) | Zone | Map? |
|---|---|---|---|---|
| Resource bar | 63–115 | 24–76 | top | — |
| Hidden Classic row (‹ Divecore, Swords) | `display: none` | | | |
| "TURF WAR" title | 147–191 (44) | 108–152 | top | in flow above map |
| Lede "Protect the Basecore Path…" (2 lines) | 203–251 (48) | 164–212 | top | in flow above map |
| Board card label ("ATO · …") | ~275–300 | ~236–261 | top | in flow above map |
| **Board (square, width-sized)** | **319–725 (406²)** | **280–631 (351²)** — last 28 pt under the tab bar | middle | — |
| Effects chip, element matchup, wave card, drops, replays, coach card… | 725 → 1480 | 631 → 1430 | below fold | scroll |
| **"Call wave" (primary)** | **1489–1527** | **1435–1473** | **needs ~650 / ~870 pt of scroll** | — |
| Tab bar | 838–932 | 603–667 | bottom | — |

### Turf War — wave (`phase 'running'`), immersive (status bar hidden)

The shell swaps its bars (marked "screen switch"): the resource bar becomes the HUD, the tab bar becomes the dock.

| Element | Pro Max y (h) | SE y (h) | Zone | Map? |
|---|---|---|---|---|
| HUD: wave chip · run caps · Pause (40×40) | 63–115 (52) | 24–76 | top | — |
| **Board** | **114–520 (406)** | **−70–281: top 146 pt hidden under the HUD** | top/middle | — |
| Empty band | 520–596 | 281–357 | middle | wasted |
| Coach line "Coach tip ›" (min 58, opens to "Coach: …") | 596–654 | 357–415 | middle | in flow under the board |
| Empty band | 654–784 | 415–545 | middle/bottom | wasted |
| Dock: Cast · skill (48) / Pounce · 1× · 2× · Leave (48) | 784–932 (148 incl. inset) | ~545–667 (122) | bottom | — |
| Paused: "Paused — the wave is frozen…" line inside the board card; title returns | board → 259–665 | board → 220–571 | | **board jumps** |
| PlayBanner | top at 111 | top at 72 | top | **covers the board's top edge** |

Body between HUD and dock: 669 pt (Pro Max) / 469 pt (SE). The board uses 61 % / 75 % of it.

### Locker (Fits / Blades) — `mode 'dress' | 'swords'`, ScrollView

No map. Top to bottom: resource bar (63–115) · Fits | Blades buttons · "◀ Command Hub" back link · LOCKER · FITS
plate + lede · first-visit "Legends set your element" tip panel (≈215 pt, *Got it* at 558–606 Pro Max) · Finish
panel · Worn · Equipped bonuses · Bag · Legends list · tab bar. The tip is in flow and pushes everything down
until dismissed (allowed: list screen, no map). The Blades forge has a sword notice line in flow.

### Store (Corner Store) — `mode 'shop'`, ScrollView, dev-unlock only (from code)

Back link · "Corner Store" header + lede · Caps panel · filter chips (Token shop / Tide shelf / Paid shop) ·
rows with Buy buttons · Guide link. A 5th tab appears only after the dev unlock (Apple: don't add/remove tabs).

### Pet games (Catch the food, Tap to train) — fullscreen overlay over the Hideout

| Element | Pro Max | SE | Zone |
|---|---|---|---|
| Top bar "‹ Pet · title · score" (back 72×44) | 71–115 + score line | 32–76 + score line | top |
| Catch: playfield | ~120–790 | ~85–560 | middle |
| Catch: rules hint (3 lines, 101 pt) | 797–898 | 566–667 (runs to the edge, no gutter) | bottom |
| Train: bottom panel (2-line hint · meter · TAP 72) | 690–890 (200) | 459–659 | bottom |

### Overlays used everywhere

| Overlay | Where | Covers |
|---|---|---|
| PlayBanner (toasts, finds, claim) | absolute, `insets.top + 52`, 12 pt sides, zIndex 50 | whatever is below the top bar — strip, board, Dive bar |
| Divecore tutorial (5 cards) | centred modal | everything, first visit / replay |
| Settings sheet (⚙) | bottom sheet; opening it from another tab first jumps to the Block | |
| PlaySheets (pet, Dive) | bottom sheets | map (modal) |
| ManholeTransit / DiamondWipe | full screen | transition |
| PlayDevFab (pre-launch, dev unlocked) | floating button | a corner of every screen |

## Stage size before / after a notice, hint, pause or coach line (measured)

| Screen | State | Stage / map Pro Max | Stage / map SE | Change |
|---|---|---|---|---|
| Hideout | idle | 613 | 417 | — |
| Hideout | swipe hint up | 613 | 417 | none; hint covers room buttons |
| Hideout | PlayBanner up | 613 | 417 | none; banner covers strip + room top |
| Dive | before the ride | 468 | 276 | — |
| Dive | mid-dive (Local / Express / Head up) | 468 | 276 | none (2 rows reserved) |
| Dive | "Searching…" | 468 | 276 | none (grow-only dock, from code) |
| Turf War | setup | board 406 at y 319 | board 351 at y 280 | — |
| Turf War | wave, coach closed | 406 at y 114 | 351 at y −70 (205 visible) | **146 pt of map hidden on SE** |
| Turf War | wave, coach open | 406 at y 114; coach 58→60 | same | +2 pt to the coach box only |
| Turf War | wave, paused | 406 at y 259 | 351 at y 220 | **board jumps +145 / +290** |

Map share of screen height today: Hideout 66 % / 63 % · Dive 50 % / 41 % · Turf War board 44 % / 53 %
(SE: only 31 % visible during a wave).

## Tap targets under 44 pt

Dive back (20 + 2×10 slop = 40), Dive Gear info / How Dive works (22 + 2×8 = 38), resource-bar ⚙ (40 + 2×8 = 56 ok),
Turf War HUD pause (40 + 2×8 ok). Exit Play is a text link (66 wide). Everything else measured ≥ 44.

## Estimates in `layout.md` vs measured

| `layout.md` said | Measured | Verdict |
|---|---|---|
| Resource bar renders 56 (code says 44) | 52 box + 4 margin = 56 below the inset | confirmed |
| Tab bar `~51 + max(b, 6)` | 94 on Pro Max (60 + 34), 64 on SE (58 + 6) | content is ~58–60, not 51 |
| Dive top bar ≈ 113 | 105 panel + 4 = 109 below the inset | close |
| Dive dock ≈ 264 | 250 including its 8 pt bottom padding (+ inset below) | close |
| Turf War SE clips 28 pt (setup) | board 280–631 vs tab bar at 603 → 28 pt under the bar | confirmed |
| Turf War "jumps 60 pt on run start" | worse: the setup scroll offset carries into the wave — on SE **146 pt of the board sit under the HUD**; on Pro Max the board lands at y 114 | new, bigger bug |
| (not listed) | **pausing a wave moves the board +145 (Pro Max) / +290 (SE)** | new bug |
| coachLine 58 vs 60 | 58 closed, 60 open | confirmed |
| Catch hint 3 lines, not 2 | 3 lines, 101 pt | confirmed |
| Immersive mode may drop `insets.top` on SE / Android | not testable on web | still unverified — log on device |
