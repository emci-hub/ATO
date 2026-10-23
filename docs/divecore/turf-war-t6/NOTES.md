# Turf War T6 — boss effects: samples, previews + frame time (2026-10-17)

**Stop 1 (emci picked 2026-10-17, all recommended):** Entrance B (new magenta sigil + light column, `summon/burst`),
Enrage B (new red sigil, `enrage/burst`) **with no rule change** (the warning starts as the boss nears its enrage HP line,
65 % for a 50 % line; the runners still come the moment it fires), Death B (new plum blast + ring + sparks, `bossko/burst`),
Boss bar A (name over a thin bar in the wave chip's box). Sovereign Nova telegraph: one design (amber disc fills the real
blast radius). Samples: `t6-*.png|gif` (A/B/C on the real board, strips, scale sheet, greyscale, boss bar mock).
All three new effects from `vfx_workbench` (0 PixelLab generations). Ids + parts: `art-src/.../fx/elements/gen-t6.json`.

**Build previews** (static web export + Playwright, served on a fresh port with one listener, served bundle size = export
size 10,325,057 B; same preview CSS as T5: `svg[viewBox="0 0 100 100"]{position:relative}`). Scene: Final boss beat (dev
"Preview boss beat (Final)"), 12 towers (8 on SE) + the Ember Sovereign Bound Boss on pad (4,4), God mode, 1x.
- `max-*` = 430×932, `se-*` = 375×667, `max-off-*` = Effects Quality Off.
- `*-entrance.png|gif`: "BOSS INCOMING · Final form — Ember Sovereign" in the NoticeLane (no in-stage pill), the sigil at the
  spawn, the boss bar in the wave chip's box, the charged Nova disc around the Bound Boss pad.
- `*-bar.png`: top bar + lane mid-fight (red bar, pale chip, white tick at the 50 % enrage line). Same 56 pt bar, same box.
- `*-enrage.png`: the boss in its warning band (≤ 65 %): red sigil at the spawn + still red glow under the boss.
- `*-death.gif|-strip.png`: the plum blast where the boss fell, the 60 ms hit stop + small board shake (Full), then the won
  card — held 1.17 s (`resultHold`) when the boss is the last kill, because the card covered the blast (display only; the
  win is paid on the same tick as before).
- `max-off-*`: no sigil animation, no blast, no flash / shake / hit stop; telegraphs are still shapes, bar + notice stay.

**Frame time** (headless Chromium, 3 s sample during the boss fight, ms):

| Phone | Effects | avg | p95 | max |
|---|---|---|---|---|
| 430×932 | Full | 8.4 | 25.0 | 33.4 |
| 375×667 | Full | 7.7 | 20.8 | 29.1 |
| 430×932 | Off | 6.8 | 20.8 | 25.1 |

Full vs Off, same scene: +1.6 ms avg (the T5 combat fx + T6 boss fx together). p95 spikes follow the 100 ms sim tick, as in T5.
Not device-verified.

**Known limits:** the enrage warning's lead depends on how fast the towers hit (emci's choice: no rule change); a Bound Boss
placed mid-wave with creeps already in range casts at once (the telegraph shows full, then fades after 600 ms); the capture
starts ~1 s after the boss spawns (the dev menu closes first), so the light column is mostly over in `*-entrance.png`
(see `t6-entrance-B.gif` for the whole sigil).
