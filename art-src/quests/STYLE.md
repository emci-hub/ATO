# Quests art style lock (PHASE-15)

Status: **FROZEN 2026-10-28.** emci approved plate 02 (`create_image_pro`, seed 4101, `style_image` = `refs/dive-ruins.png`, hex palette; 22/28) as the style anchor; it lives at `refs/plate-lantern-gate-far.png`. Scene route = Pro + style_image + hex palette (10 gens per 194×100 plate), fixes by inpaint. The ⚑ art OK lantern gate on the final contact sheet is still open.
Rules source: `docs/ATO-BUILD.md` §1.9 (wins over CLAUDE.md for Quests art, R23).

## Style card (identical on every call)
- `outline`: "single color black outline" · `shading`: "medium shading" · `detail`: "medium detail" ("low detail" for ≤24 px)
- `text_guidance_scale`: 8
- `negative_description` (where a tool offers it): "blurry, anti-aliased, gradient, text, watermark, perspective distortion, photo"
- palette: `palette.png` (67 colours: Resurrect 64 + `#22D3EE #0B8A8F #0B5E65 #F9C22B #F79617 #05070D`; hex list in `palette.txt`). `create_image_pixflux` takes it as `color_image_base64` (forced palette); `create_image_pro` takes the hex list as `palette`.
- view `side`, light key top-left unless the scene's own source (glow) says otherwise.
- Lantern mood: deep blue stone, cyan glow. No "bad" pole art; hero at least 2 value steps above the background.

## Seeds
Lantern 4101 · NPC 4401+n · icons 4501 · VFX 4501–4506 · hero anims 4701+ · ambient 4801+ (full list: §1.9).

## Style references (`refs/`, native resolution)
`room-wall.png`, `room-floor.png` (room-atlas), `dive-ruins.png`, `dive-ground.png` (dive-atlas), `hero-druid|champion|witch.png` (dungeon-legends south, tight crop). The first 3 approved Quests plates get added here after emci's OK.

## Tool notes (search_help 2026-10-28)
- No `generate-with-style-v2` exists in the MCP. Scenes: `create_image_pixflux` (1 gen, forced palette, init image, **no** style reference) or `create_image_pro` (10–15 gens at this size, `style_image` + up to 4 `reference_images` + hex palette). Props: `create_1_direction_object` with `style_images`.
- Canvas must be **even** at this size: 195 is refused; Lantern plates use **194×100** (logged deviation from the spec's 195×100; the stage layer can be 1 px wider in code or the plate edge-extended).
- `create_character` mode pro at 64 gives 8 directions for 10 gens; `animate_character` template = 1 gen per direction; `animate_image` = `ceil(w*h*frames/65536)` min 1, even frames 4–16, no timing and no palette parameter (timing lives in our data; palette snap afterwards).

## What worked in the Lantern batch (2026-10-28)
- Far plates: `create_image_pro` 194x100, `style_image` = a NEUTRAL atlas crop (`refs/dive-ground.png`), hex palette, no init. A finished plate as `style_image` repeats its composition.
- Mid layers: `create_image_pixflux` `no_background`, forced palette, no init, "foreground only ... at the left and right edges, empty open centre". Init-from-far does not work.
- Props: pixflux 32x32..64x32, prompt "strict flat side elevation" (the default drifts to a 3/4 view).
- NPCs/heroes: `create_character` mode v3 (no palette input). Import a south sprite = 1 gen (4 directions), template idle = 1 gen per direction, custom 4-frame v3 clip = 1 gen. Portraits: `create_image_pro` 64x64 with the sprite as `reference_images` (without it: a different person).
- 16x16 icons: `create_image_pro` returns 64 candidates for 10 gens; download `?index=0..63` and pick from a grid. Ask for "very simple flat bold shapes" and `max_colors` 6-8.
- Tools not used / rejected: `vfx_workbench` (31x23 canvas auto-fit, white specks), so VFX and the drip are `vfx/gen-vfx.py`.
- Rebuild the sheet and scores: `tools/build-sheet.py`, `tools/write-params.py`.

## Rubric (0–4 each, pass ≥22/28, no criterion below 2; 2 fix rounds then placeholder + log)
1 silhouette · 2 value contrast / focal point · 3 palette lock · 4 clean pixels · 5 light and shading · 6 scale and camera (side view, ground line, 64 px hero) · 7 style match to refs (animations: no boiling, stable volume, foot contact)
