# Almanac art critique (PHASE-11g part 3) � emci OK'd the sheets 2026-10-28

## Gates
| Gate | Result |
|---|---|
| Workbench `score` >= 90 | **87/87 pass.** The snow and firework loops first scored 88.0 and 80.5 (single-pixel particles); redone 2026-10-28 with my own chunky particle sprites (3x3 / 4x4 flakes, 4x4 and 2x2 sparks), now 95.3 and 97.5. |
| Lowest scores | icon.almanac-stickers.month05 90.4, icon.almanac-decor.firework 91.0, icon.almanac-sprigs.eid-al-fitr 91.2, icon.almanac-emblems.lunar-new-year 91.9, icon.almanac-badges.spring 92.0 |
| Pixel-art rubric >= 22/28, no zero | Assessed per group by eye on the 2x/5x sheets, not 14 numbers per asset: **decor, stickers, badges, emblems, sprigs, frames: pass (est. 23-26/28)**. No zero on any item: silhouette reads at 1x, <= 12 colours, forced palette, no text, consistent top-left light and dark outline. Weakest by eye: sprig.summer (busy), sticker.one-year-ago (now a heart, the photo frame was lost in the regen), the loops (particles only). These are my estimates, not a second reviewer's. |
| Size ladder | 32 (decor/stickers/badges/emblems), 64 (sprigs; loop frames), 192x256 (UI frames). Nothing pre-scaled. |
| Palette | Per-asset forced palette: 4 neutrals (#0a0a1c #221c3d #6e6e7e #f0f0f0) + season/event accent from palette-streetwear-night.png. All <= 16 colours, no semi-transparent pixels (script check). |
| Camera / text / garments | Flat, camera-neutral. No text seen. Objects only (no cultural garments). |
| Scale sheet vs hero | Not needed: nothing here is a world object. 11h decides placement. |

## How scores were taken
`pixelart_workbench score` on the PixelLab download of each final (loops: the exported sheet). Where a first try scored under 90 it was regenerated with a simpler prompt (basic shading, low detail): pick_100, one_year_ago, month03, month04, month06, badge easter / thanksgiving_ca / diwali, snowflake. `repair` was tried first: it rarely moved the score and in one case shrank the image, so it was not used.

## Per-asset workbench scores
| id | score |
|---|---|
| `icon.almanac-decor.wreath` | 96.2 |
| `icon.almanac-decor.lantern` | 93.5 |
| `icon.almanac-decor.diya` | 100 |
| `icon.almanac-decor.crescent` | 96.0 |
| `icon.almanac-decor.egg` | 96.0 |
| `icon.almanac-decor.snowflake` | 96.0 |
| `icon.almanac-decor.petal` | 100 |
| `icon.almanac-decor.star` | 99.0 |
| `icon.almanac-decor.firework` | 91.0 |
| `icon.almanac-decor.pumpkin` | 98.3 |
| `icon.almanac-stickers.pick-100` | 94.5 |
| `icon.almanac-stickers.glow-30` | 99.8 |
| `icon.almanac-stickers.one-year-ago` | 100 |
| `icon.almanac-stickers.equinox` | 99.6 |
| `icon.almanac-stickers.full-moon` | 99.8 |
| `icon.almanac-stickers.friday-13th` | 99.6 |
| `icon.almanac-stickers.clock-change` | 92.1 |
| `icon.almanac-stickers.half-year` | 100 |
| `icon.almanac-stickers.first-snow` | 100 |
| `icon.almanac-stickers.payday-friday` | 96.0 |
| `icon.almanac-stickers.small-moment` | 99.0 |
| `icon.almanac-stickers.month01` | 98.3 |
| `icon.almanac-stickers.month02` | 100 |
| `icon.almanac-stickers.month03` | 98.4 |
| `icon.almanac-stickers.month04` | 97.3 |
| `icon.almanac-stickers.month05` | 90.4 |
| `icon.almanac-stickers.month06` | 96.5 |
| `icon.almanac-stickers.month07` | 92.0 |
| `icon.almanac-stickers.month08` | 97.4 |
| `icon.almanac-stickers.month09` | 95.5 |
| `icon.almanac-stickers.month10` | 98.4 |
| `icon.almanac-stickers.month11` | 99.9 |
| `icon.almanac-stickers.month12` | 95.8 |
| `icon.almanac-badges.new-year` | 93.8 |
| `icon.almanac-badges.lunar-new-year` | 97.6 |
| `icon.almanac-badges.valentines` | 96.8 |
| `icon.almanac-badges.easter` | 95.4 |
| `icon.almanac-badges.mothers-day` | 92.3 |
| `icon.almanac-badges.fathers-day` | 99.3 |
| `icon.almanac-badges.summer-solstice` | 100 |
| `icon.almanac-badges.summer` | 94.8 |
| `icon.almanac-badges.back-to-school` | 96.0 |
| `icon.almanac-badges.thanksgiving-ca` | 99.4 |
| `icon.almanac-badges.thanksgiving-us` | 96.0 |
| `icon.almanac-badges.halloween` | 94.1 |
| `icon.almanac-badges.diwali` | 98.0 |
| `icon.almanac-badges.eid-al-fitr` | 98.2 |
| `icon.almanac-badges.winter-solstice` | 94.6 |
| `icon.almanac-badges.christmas` | 95.6 |
| `icon.almanac-badges.year-end` | 96.3 |
| `icon.almanac-badges.season-spring` | 92.0 |
| `icon.almanac-badges.season-summer` | 93.2 |
| `icon.almanac-badges.season-autumn` | 93.7 |
| `icon.almanac-badges.season-winter` | 100 |
| `icon.almanac-emblems.new-year` | 100 |
| `icon.almanac-emblems.lunar-new-year` | 91.9 |
| `icon.almanac-emblems.valentines` | 100 |
| `icon.almanac-emblems.easter` | 99.1 |
| `icon.almanac-emblems.summer` | 100 |
| `icon.almanac-emblems.thanksgiving` | 97.9 |
| `icon.almanac-emblems.halloween` | 94.1 |
| `icon.almanac-emblems.diwali` | 100 |
| `icon.almanac-emblems.eid-al-fitr` | 98.9 |
| `icon.almanac-emblems.winter-solstice` | 94.2 |
| `icon.almanac-emblems.christmas` | 99.7 |
| `icon.almanac-emblems.mothers-day` | 99.8 |
| `icon.almanac-sprigs.new-year` | 98.8 |
| `icon.almanac-sprigs.lunar-new-year` | 92.8 |
| `icon.almanac-sprigs.valentines` | 96.1 |
| `icon.almanac-sprigs.easter` | 96.6 |
| `icon.almanac-sprigs.summer` | 99.5 |
| `icon.almanac-sprigs.thanksgiving` | 97.7 |
| `icon.almanac-sprigs.halloween` | 98.7 |
| `icon.almanac-sprigs.diwali` | 100 |
| `icon.almanac-sprigs.eid-al-fitr` | 91.2 |
| `icon.almanac-sprigs.winter-solstice` | 94.3 |
| `icon.almanac-sprigs.christmas` | 92.2 |
| `icon.almanac-sprigs.mothers-day` | 100 |
| `ui.almanac-frames.plain` | 96.0 |
| `ui.almanac-frames.event` | 96.0 |
| `ui.almanac-frames.complete` | 96.0 |
| `fx.almanac-snow.snow-64` | 95.3 |
| `fx.almanac-leaf.leaf-64` | 98.7 |
| `fx.almanac-petal.petal-64` | 98.7 |
| `fx.almanac-candle.candle-64` | 100 |
| `fx.almanac-firework.firework-64` | 97.5 |
| `fx.almanac-lantern-glow.lantern-glow-64` | 96.0 |

## Deviations
Lantern "sway" is a lantern glow pulse (no sway part in the effects tool). The firework loop plays once. Month glyphs are hemisphere-neutral objects. Registry status shows `resource` because nothing uses the art yet (the sync sets that for unused candidates); only emci sets `approved`. Loop frame lists are in the `.json` next to each sheet (`assets/art/fx/unused/almanac-*/�-64.json`).
