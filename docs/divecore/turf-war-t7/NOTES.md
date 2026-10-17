# Turf War T7 — polish beats + perf pass: samples, previews + frame time (2026-10-17)

**Stop 1 (emci picked 2026-10-17, all recommended):** Wave start B (new cyan street portal at the path start + the lane
line "WAVE n · <phase> · N puffs on the road"), Wave clear B (the same portal plays its closing half at the exit, no new
art), Win B (new gold + cyan sparks over every tower, staggered 170 ms, the reward lines unchanged), Lose A (a red ghost of
the leaker re-walks its last 3 cells at about half speed with a red trail, then the exit ring; Reduce Motion / Motion Off
get the still version B). Samples: `t7-*.png|gif` (A/B on the real board, zoomed strips, scale sheet vs the 62 px
board-scale hero, greyscale). Both new effects from `vfx_workbench` (0 PixelLab generations). Ids + parts:
`art-src/.../fx/elements/gen-t7.json`. Workbench score 86 (portal) / 85.5 (sparks): the penalties are the gaps between
the swirl arms and the single-pixel sparks (by design); `repair` versions (96 / 88) are saved in the PixelLab gallery only.

**Also in this step (emci 2026-10-17):** "BOSS INCOMING" now shows on "Important only" notices too (`important: true`
on that one NOTIFY; every other NOTIFY is still hidden there).

**Build previews** (static web export + Playwright, each build served on a fresh port with one listener, served bundle =
export size: before 10,325,045 B, after 10,348,938 B; preview CSS `svg[viewBox="0 0 100 100"]{position:relative}` as in T5/T6).
- `max-*` = 430×932, `se-*` = 375×667, `*-rm` = in-game Motion Reduced, `*-off` = Effects Quality Off.
- `*-start.gif|-strip.png`: Main wave 9 — the lane line + the cyan portal opening at the path start as the first creep steps out.
- `*-win.gif|-strip.png`: Trial wave 1 — the portal closes at the exit on the last kill, sparks pop over each tower in turn,
  then the won card (it waits `winBeatMs` ≈ 1.7 s for 6 towers; the win is paid on the same tick as before).
- `*-lose.gif|-strip.png`: Trial wave 1, no towers — the red ghost walks the last 3 cells into the exit, the trail stays,
  the ring plays, then the lost card (it waits `LOSE_BEAT_MS` = 1.72 s).
- `max-*-rm`: the same beats as still frames (portal open frame / sparks frame fade in and out; the whole trail, the ghost
  one cell short of the exit, a full-size ring that only fades). No flash, shake or hit stop anywhere.
- `max-lose-off`: no beat (no portal, sparks or replay); the lost card shows at once, as before T7.

**Frame time — perf pass** (headless Chromium, 3 s during a busy Main wave 9: 12 towers (8 on SE) + 20 stress creeps,
God mode, 1x; `scriptPct` = share of the 3 s the JS thread was busy):

| Phone | Effects | before avg | before p95 | before JS | after avg | after p95 | after JS |
|---|---|---|---|---|---|---|---|
| 430×932 | Full | 9.0 ms | 37.4 | 77.9 % | 8.5 ms | 33.4 | 75.7 % |
| 375×667 | Full | 8.7 ms | 37.4 | 77.4 % | 8.2 ms | 33.3 | 74.8 % |
| 430×932 | Off | 7.2 ms | 33.3 | 64.0 % | 7.0 ms | 29.2 | 66.7 % |

What changed: the baked board image (`TurfBoardBase`), the non-Streetwear field tiles (`BoardDecorTiles`) and the road /
ghost group in the units SVG (`StaticRoad`) are `memo` layers with stable props, so the 100 ms tick skips them. The gain is
small (≈ 0.5 ms avg, 2–3 points of JS time on Full; Off is within noise): most of the per-tick cost is the units `<Svg>`
itself (towers, creeps, bars), which really changes every tick. A bigger win would need the creeps off React state (not in
this step). Setup (no wave) is unchanged at ≈ 5.7 ms. Not device-verified.

**Motion audit T4–T7** (pinned by `check:turf-war-layout`):

| Effect | Full | Minimal | Off | Reduce Motion / Motion Off |
|---|---|---|---|---|
| T4 ambient loops | all | every other site | still frame | half speed / still frame |
| T5 hit flash · shake · hit stop | on | flash only | none | none |
| T5 death pop | on | on | corpse | on (no flash in it) |
| T5 exit ring (now drawn by the T7 replay) | grows + fades | same | none | **full size, fade only (new in T7)** |
| T6 entrance sigil · telegraphs | anim | anim | none · still shapes | still |
| T6 boss death · flash · shake · hit stop | all | no shake / hit stop | corpse | soft blast, no flash / shake / hit stop |
| T7 portal · clear · sparks · replay | anim | anim (sparks every other tower) | none | still frames |

**Known limits (reviewer, cosmetic):** the ghost uses the leaker's last drawn frame (it glides, no walk cycle); the
leaker is the creep furthest along the road on the leak tick, so two leaks on one tick show one ghost; if the sim is not
built yet when a wave starts, the portal uses the alley board's start; the old T5 ring call (fade-only under calm motion)
is a fallback that no current quality setting reaches (the replay draws the ring). In the web preview the closed
dev-kit sheet can still catch taps on SE (the script presses Call wave by keyboard), and the browser's own reduced-motion
flag freezes the Expo web splash, so the `-rm` previews use the in-game Motion setting instead.
