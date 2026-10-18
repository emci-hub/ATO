# Turf War T2b — wave-chip preview + top-bar restyle (2026-10-18)

emci picked **option B** (separate sheet-kit chip · caps pill · pause button; a card that hangs under the wave chip).
Samples: `samples/option-A|B|C.png` (flat HTML mock-ups).

- `max-*` = 430×932, `se-*` = 375×667. Static web export + Playwright, fresh port, one listener, served bundle size = export size (8,181,800 B).
- `*-setup.png`: Setup. The top bar there is the app shell's (unchanged); the wave chip, caps and pause only exist during a wave.
- `*-wave.png`: wave running, the new top bar (chip · caps · pause, 56 pt). `*-peek.png`: the chip tapped, "Next · wave 2 — 5 swarm, 2 runner" under it.
  `*-wave-closed.png`: tapped again, closed. The board does not move in any of them.
- The card sits in the NoticeLane box + the empty stage strip above the board (64 pt; 71 pt free on SE, 142 pt on 430) and leaves 44 pt at the
  right for the lane's help (?) button.
- Preview scene: default save, Trial wave 1, so the next wave is Trial 2. A boss next-wave and a 3-role wave were pinned in `check:turf-war-layout`
  (data + geometry) but not shot (no save at that seat in the preview).
- Icons in the card are role-tint swatches (the same colours the board's placeholder creeps use), not art; no library asset added.
- Frame time (headless Chromium, 3 s, card open): 16.7 ms avg / 16.8 max on both phones = the 60 Hz cap; the new bar and card add no measurable cost. Not device-verified.
