# Turf War layout guidelines (step T1, 2026-10-16)

The written rules for the Turf War screen (`defend-screen.tsx`). Pinned by `npm run check:turf-war-layout`
(in `check:ota-gate`); the pure math is `src/play/turf-layout.ts`. Later steps (T2–T7) must keep these.
Phones: **430×932** (Pro Max, insets 59/34) and **375×667** (SE, insets 20/0). Thumb reach: bottom third easy,
middle OK, top corners hard.

## Regions, top → bottom (from `stage-frame.ts`, unchanged)

| Region | 430×932 | 375×667 | What lives there |
|---|---|---|---|
| Top bar | 56 | 56 | wave chip, caps, **pause** (top right) — info + rare actions only |
| NoticeLane | 40 | 40 | coach line, notices, "Boss incoming" — one line |
| **Stage** | 430 × 619 | 375 × 421 | **the board only** |
| ActionDock | 64 (setup) / 158 (wave) | 64 / 130 | Cast, Pounce, speed 1× / 2×, Setup, Call wave |
| TabBar | setup only | setup only | the app's three tabs |

## The board

- **Side = stage width − 16, capped by the stage height** (`turfBoardSide`): **414 pt** on 430, **359 pt** on 375
  (was 406 / 309). 8 pt gutter each side.
- **Centred both ways** (`turfBoardRect`): 102 pt of stage above and below on 430×932; 31 pt on 375×667.
- Same size and spot in setup and wave. No scrolling, nothing resizes it.
- **No title or lede in the stage.** The tab already says "Turf War". The lede ("Protect the Basecore Path…") is the
  first line of the **Setup sheet**. The lane keeps the coach line.
- No HUD text in the board except damage numbers and health bars.

## Pads

- Hit circle radius = **6.25 % of the board** (half the closest pad spacing of 12.5 %, so neighbours touch but never
  overlap), or 22 pt if that is smaller (`padTapRadiusUnits`). 25.9 pt radius on 414, 22.4 pt on 359 → **diameter ≥ 44 pt**.
- Every pad's hit circle sits fully inside the board.

## Build card (built in T2; the rule is fixed now)

- A FloatLayer card at the tapped pad, **at most 120 pt tall** (`BUILD_CARD_MAX_H`), centred on the pad.
- **Above** the pad; **below** it when the pad is in the top 30 % of the board (`buildCardPlacement`). If the preferred side
  has no room it takes the other. Never covers its own pad, clamped inside the stage, closes on outside tap.
- Gap card ↔ hit circle: 8 pt.

## Pause menu and Leave

- Pause is in the **top bar**, 40 pt + 8 pt hit slop = 56 pt target.
- Pausing opens the **pause menu** (FloatLayer card): **Resume** · **Leave**, both 48 pt high. The lane says
  "Paused — the wave is frozen."
- **Leave exists only here.** Not in the dock, not in the classic HUD. It still opens the same "LEAVE RUN?" confirm
  (Cancel returns to the pause menu). The back-swipe still opens that confirm. Why: Leave is a risky action and
  should not sit in the easy-to-reach thumb row beside the speed buttons.

## Dock

- Every button ≥ 44 × 44 (primary 48; Cast 52), gap ≥ 8 pt. One row per state, reserved at its tallest.

## Not changed by T1

Economy, rules, waves, rewards, copy meaning (the lede and pause line only moved / lost the "bar below" pointer).
