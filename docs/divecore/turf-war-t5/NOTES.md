# Turf War T5 — combat effects: previews + frame time (2026-10-17)

**Stop 1 (emci picked 2026-10-17):** Archer B (new magenta dart + star), Vine A (library `root/*`), Crystal A (library `spark/*`),
Death B (new plum smoke pop, brightened, 1.1 s). Samples: `t5-*.png|gif` (A vs B on the real board, strips, scale sheet, greyscale).

**Build previews** (static web export + Playwright, served on a fresh port with one listener, served bundle size = export size):
- `max-*.png|gif` = 430×932, `se-*.png|gif` = 375×667.
- `*-setup-towers.png` 2 archers + vine + crystal built; `*-wave.png` mid-fight with +20 stress creeps (dev kit);
  `*-wave-fight.gif` 18 frames of the fight (darts, impacts, flashes, pops, chip trail, merged numbers);
  `*-leak.gif` / `*-leak-strip.png` a natural leak (no towers, 2x): red ring at the exit + small board shake, then the lost card as before;
  `max-wave-off.png` Effects Quality Off (no shots, impacts, pops, flash; numbers only; corpses as before).
- Preview-only CSS: on web the absolutely positioned baked board / ambient layers (since T4) paint over the in-flow units `<svg>`,
  so the script sets `svg[viewBox="0 0 100 100"]{position:relative}`. Native draws children in order — no app change. Without it
  the web preview shows no creeps or towers (that is why the T4 wave shot had none).

**Frame time** (headless Chromium, 3 s sample, wave with 4 towers + ~20 creeps, ms):

| Phone | Effects | avg | p95 | max |
|---|---|---|---|---|
| 430×932 | Full | 9.0 | 29.2 | 37.4 |
| 375×667 | Full | 8.8 | 29.2 | 41.6 |
| 430×932 | Off | 8.2 | 29.2 | 33.3 |

T4 measured 5.0 ms in a wave with 2 creeps and no towers, so these numbers are a much heavier scene, not a regression measure.
Full vs Off with the same scene: +0.8 ms avg. The p95 spikes match the 100 ms sim tick (whole board SVG re-render) in both modes.
Not device-verified.
