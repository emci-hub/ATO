# PixelLab animation generation log

One row per generation job. Balance before/after from `get_balance`. Raw output also goes to
`art-src/pixellab/<id>/<gen>/gen.json`.

| Date | Asset (character / clip / dir) | Tool | Params (frames, size, seed) | Generations | Balance after | Result |
|---|---|---|---|---|---|---|
| 2026-10-21 | — | `get_balance` | free check | 0 | 3,538.10 / 5,000 | connector verified |
| 2026-10-21 | kael / pre-flight (Task B) | `get_balance`, `search_help` | free | 0 | 3,538.10 / 5,000 | tool docs unchanged; **blocked**: sandbox policy denies `api.pixellab.ai` (CONNECT 403), so no upload/download; no generation spent |
| 2026-10-21 | kael / import (192² rotations, 4 dirs) | `create_character` v3 + `direction_images` | n_directions 4, 192×192 | 0.25 | 3,537.85 | char `8106b2fd-…`; nothing generated |
| 2026-10-21 | kael / `breathing-idle` / south, east, north, west | `animate_character` template | 4 frames, 192×192, no seed | 4 (1/dir) | 3,533.85 | 4 clips; feet 3–9 px below current Idle; colours faithful. Raw: `art-src/pixellab/hero.kael.streetwear/breathing-idle-20261021/` |
| 2026-10-21 | kael / breathing-idle ×4 | `reduce_colors` → `palette-streetwear-night.png` | 4 calls × 4 frames | 0.4 | 3,533.45 | 0 off-palette px, but **colours shifted** (current Idle has 0 px in that palette) |
| 2026-10-22 | kael / Idle swap (source only) | local shift, no PixelLab call | E/W/N/S feet moved onto old Idle foot rows, unreduced colours | 0 | 3,533.45 | new frames in `migrated/raw/animations/Idle`, old archived; atlas repacked same day (`hero_kael_streetwear.core`, png8); gate green |
| 2026-10-22 | morwen / import (192² rotations, 4 dirs) | `create_character` v3 + `direction_images` | n_directions 4 | 0.25 | 3,533.20 | char `e1c19bb1-…`; nothing generated |
| 2026-10-22 | morwen / `breathing-idle` / east, west | `animate_character` template | 4 frames, 192×192, no seed | 2 (1/dir) | 3,531.20 | **identity lost**: no staff, plain slim robe, 131–135 px tall (current 104–108); not installed. Raw: `art-src/pixellab/hero.morwen.streetwear/breathing-idle-20261022/pixellab-out/`; GIFs `docs/art/animation-tests/morwen-breathing-idle/` |
| 2026-10-22 | morwen / `breathing-idle` / east | `animate_character` **skeleton-v3** | 4 frames, 192×192, no seed | 3 (3/dir) | 3,528.20 | identity kept (hat, hair, robe), height 105 px, feet on row 150; drift: arm forward-low, hem motifs softer. Not installed, west not generated. Raw: `art-src/pixellab/hero.morwen.streetwear/breathing-idle-skeleton-v3-20261022/`; GIFs `docs/art/animation-tests/morwen-skeleton-v3/` |
| 2026-10-22 | morwen / `breathing-idle` / west | `animate_character` skeleton-v3 (group `ecfcc9d0-…`) | 4 frames, 192×192 | 3 | 3,525.20 | height 106, feet row 150, staff/hat/hair/robe kept; drift: frame 0 hair flares sideways, hem edge noisier. Not installed (awaiting emci's ok on west). GIFs in `docs/art/animation-tests/morwen-skeleton-v3/` |
