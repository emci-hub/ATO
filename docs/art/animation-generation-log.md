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
| 2026-10-22 | kael / Idle swap (source only) | local shift, no PixelLab call | E/W/N/S feet moved onto old Idle foot rows, unreduced colours | 0 | 3,533.45 | new frames in `migrated/raw/animations/Idle`, old archived; **atlas not repacked yet** (pack step blocked by session permissions) |
