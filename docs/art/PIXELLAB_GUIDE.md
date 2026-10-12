# PixelLab art guide (ATO) — read before making any art

Approved by emci 2026-10-12 (Hideout pipeline test, 23/28, workbench 92.2). Every AI that makes or
edits game art for ATO follows this. PixelLab's own docs are the upstream source; this file is our
house version of them. `npm run pixellab:watch` reports when PixelLab's docs change (weekly), so
this guide can be updated — see "Staying current" at the bottom.

Upstream (public, no key): https://api.pixellab.ai/v2/llms.txt ·
https://www.pixellab.ai/llms-full.txt · https://api.pixellab.ai/v2/openapi.json · MCP tool list
(`pixellab` MCP server). Never put the PixelLab key in a file, log or prompt.

## 1. Rule one: PixelLab's dedicated tools first
Do not paint a room or scene as one big image. Build it from parts, in this order:

| Step | Tool | Makes |
|---|---|---|
| 1 | `create_building_kit` (square_topdown, tile 32, walls 1–3 tiles) | room shell: floor, walls, corners, doorways |
| 2 | `create_topdown_tileset` / `create_tiles_pro` | floor tiles, variants, transitions (rug, worn path) |
| 3 | `create_map` + `edit_map` + `place_map_object` + `view_map` | lay out and preview a map on the grid |
| 4 | `create_map_object` (view `low top-down`) / `create_8_direction_object` | every prop as its own transparent sprite |
| 5 | `create_object_state` + `animate_object` (mode `v3`) | interaction states (lamp on/off, arcade playing) and idle loops |
| 6 | `vfx_workbench` (free) | neon glow/flicker, dust, sparkles, emote bubbles |
| 7 | `pixelart_workbench` (free) | `score`, `lint`, `repair`, `selout` on every asset |
| 8 | `reduce_colors` + `palette_image` (0.1 gen) | lock everything to the game palette — all frames together |
| 9 | style references (`create_image_pro` reference_images, `create_tiles_pro` style_images) | keep new assets matching approved ones |

Characters/pets: `create_character` (+ `create_character_state`, `animate_character`,
`animate_with_skeleton_v3`). UI bits: `create_ui_asset`. Hand work = placement, tiny cleanup
(stray pixels, fake text), final checks. Log any fallback to hand drawing and why.

## 2. Sizes — PixelLab's recommended ladder (32 px tile)
| Thing | Canvas | Tiles |
|---|---|---|
| Floor/wall tile | 32 | 1 |
| Small prop (shoebox, boombox, bowl, poster, icon) | 32 | 1 |
| Medium prop (plant, speaker, beanbag, table, hatch) | 64 | 2 |
| Tall prop (lamp, arcade, door, wall height) | 96 | 3 |
| Large prop (couch, bed), hero/pet | 128 | 4 |
| Room | 256 × 576 | 8 × 18 |
| VFX | 64 / 128 | |
| UI icons, emotes | 16 / 32 | |

- Heroes and pets: character canvas 128, shown **1:1, never rescaled** (uneven scaling breaks
  pixels). Grown figure ≈ 101–111 px (~104). Feet on one floor line. Younger stages shrink in code.
- Inside its canvas a prop keeps real-world size vs the grown hero (H ≈ 104 px ≈ 1.75 m):
  couch seat ≈ knee (0.28H), table ≈ 0.25H, sill ≈ 0.55H, speaker ≈ 0.6H, lamp ≈ 0.85–1.5H,
  arcade ≈ 1.0–1.1H, door ≈ 1.25H. Props never scale with the pet's growth stage.
- Small canvases are cheaper per idea: ≤42 px returns 64 candidates, ≤85 → 16, ≤170 → 4.

## 3. Camera and style (locked)
- 3/4 **low top-down**, orthographic: tops and fronts only, no side faces, no vanishing points,
  floor planks straight. Round floor things (rugs, hatches, auras) are flat ellipses.
- One key light top-left; contact shadow under everything, cast down-right.
- Streetwear neon night: drab indigo/plum base, saturation only from lights (magenta + cyan neon,
  warm amber lamp). Two neon hues per room max.
- **No text in the world.** PixelLab often invents fake letters on signs, marquees, posters, tags —
  check every asset; prompt "purely pictorial with zero writing"; fix by inpaint or recolour.

## 4. Gotchas we hit (save generations)
- `create_image_pixflux` `init_image_strength` = how much of the init image to **keep**:
  ~80–150 = layout guide, 400+ copies the greybox almost unchanged.
- Standard Wang tilesets are 16 or 32 px only; `mode: "pro"` allows 64.
- A tileset can ignore direction words ("horizontal planks") — the building-kit floor did better.
- "hoodie"/"person-ish" words can spawn a character inside a prop — say "empty, no person".
- Palette lock with a palette missing a mid tone shifts colours (purple couch → neon pink): extend
  the palette (`palette2`: purples, woods, greys) before locking.
- `reduce_colors` needs same-size frames (pad to one canvas) and ≤512×512 px total per call.
- Wait for jobs with `wait_for_jobs` (≤280 s); Tier 2 = 10 concurrent jobs.

## 5. Gate before anything ships
- Pixel-art critique rubric, 14 items × 0–2: ship ≥ 22/28 with no zero. Also `pixelart_workbench
  score` (target ≥ 90).
- Density map: no bare patch > 3×3 tiles except the pet's walkway; walkway ≥ 1 hero width, every
  use-spot reachable.
- Test at 1× on a phone-size mockup, in greyscale (hero must be top contrast), day/night, neon/normal.

## 6. Working with emci
- Always **show rendered samples** (side-by-side, phone size, labelled) before asking emci to choose.
- Sample first, stop for approval, then build. No commit/PR/OTA of art without approval.
- Report generations used and remaining (`get_balance`).

## 7. Staying current
`npm run pixellab:watch` downloads PixelLab's public docs, compares them with
`docs/art/pixellab-snapshot.json`, and prints what changed (new/removed endpoints, changed
parameters, changed doc sections). It never edits this guide. A weekly scheduled task runs it; when
something changed, an AI drafts the guide update on a branch and emci approves it. After a guide
update is accepted, refresh the snapshot with `npm run pixellab:watch -- --update`.
