# Almanac art (PHASE-11g) — PixelLab credits log

| When | Tool | What | Gens | Balance after |
|---|---|---|---|---|
| 2026-10-28 | get_balance | pre-flight | 0 | 3184.95 left (Tier 2, resets 2026-11-11) |
| 2026-10-28 | search_help | create_image_pixflux vs map_object vs 1_direction vs pixen | 0 | — |
| 2026-10-28 | create_image_pixflux | TEST: pumpkin 32x32, seed 1101, forced 12-colour Halloween palette | 1 | ~3183.95 |
| 2026-10-28 | pixelart_workbench score | test pumpkin: 98.3 (10 colours) | 0 | — |

Test job id: e64060e2-47c3-4380-bd78-bb05fc5862a9 (raw: `art-src/almanac/test/pumpkin.png`).
Tool notes: pixflux needs >= 1024 px area (16x16 refused); `create_image_pixen` does square 16/20/24/28; `create_1_direction_object` is 10-25 gens, so not used for stickers.

## Batch run (emci: "run all four batches, show everything at the end", 2026-10-28)
| Step | Tool | Count | Gens |
|---|---|---|---|
| Decor props 32 (9 new, heart/leaf reused from the library) | create_image_pixflux | 9 | 9 |
| Edge sprigs 64 | create_image_pixflux | 12 | 12 |
| Stickers 32 (11 micro + 12 months) | create_image_pixflux | 23 | 23 |
| Badges 32 (17 events + 4 seasons) | create_image_pixflux | 21 | 21 |
| Deck emblems 32 | create_image_pixflux | 12 | 12 |
| Retries, round 1 and 2 (weak first tries, new prompts) | create_image_pixflux | 19 | 19 |
| Retries, round 3 and new-year sprig | create_image_pixflux | 4 | 4 |
| Deck card frames 192x256 (plain, event, complete) | create_ui_asset | 3 | 30 |
| Ambient loops 64 (snow, leaf, petal, candle, firework, lantern glow) | vfx_workbench (free) | 6 | 0 |
| Workbench score / repair | pixelart_workbench (free) | 14 | 0 |

Balance: 3184.95 before, 3053.95 after = 131 generations (1 test + 130 batch). No Pro call. 77 + pumpkin = 78 final PNGs, 3 frames, 6 loops.
Job id -> asset map: `jobs.tsv`. Final picks (retries win over first tries): `final/SOURCES.tsv`. Raw downloads: `raw/`.
