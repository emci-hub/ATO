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
| 8 | `reduce_colors` + `palette_image` (0.1 gen) | lock everything to the game palette — all frames together. **Updated 2026-10-19:** PixelLab tools now accept `target_palette` at creation (see §4), so art can be born in palette; keep this step as the final check |
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

- **Decided (emci 2026-10-12): option A** — this ladder, hero 1:1 (`docs/art/size-conflict-compare.png`).
  The Hideout code runs on it (`src/play/hideout-iso.ts`): canvas 256×576, 32 px art tiles,
  16 px walk cells (half a tile, so paths stay smooth), grown hero 1:1. Room layouts and greybox:
  `scripts/gen-hideout-td.ts` (props placed from the scale table below).
- Heroes and pets: character canvas 128, shown **1:1, never rescaled** (uneven scaling breaks
  pixels). Grown figure ≈ 101–111 px (~106). Feet on one floor line. Younger stages shrink in code.
- Small canvases are cheaper per idea: ≤42 px returns 64 candidates, ≤85 → 16, ≤170 → 4.

### Scale consistency (rule for every new or edited asset)
The **scale reference** is the fully grown hero (kael, H ≈ 106 px ≈ 1.75 m). Everything in the world
(props, tiles, doors, effects, in-world UI) is sized against H as a real object would be, then drawn
at that size natively — never stretched afterwards. Props never scale with the pet's growth stage.

In 3/4 low top-down you see the front AND half the top, so a sprite's box is
**height + ½ depth** tall (real sizes ÷ 1.75 m × H). Measure the sprite's opaque box, not the canvas.

| Object | Real size (h × w × d, m) | Sprite box (w × h, px at H=106) |
|---|---|---|
| Couch / sofa | 0.85 × 2.0 × 0.9 | 121 × 79 (seat ≈ knee) |
| Bed | 0.55 × 1.0 × 2.0 (long side down) | 61 × 94 |
| Beanbag | 0.6 × 0.8 × 0.8 | 48 × 60 |
| Coffee table | 0.45 × 1.1 × 0.6 | 67 × 45 |
| Speaker (floor) | 1.0 × 0.3 × 0.35 | 18 × 71 |
| Floor lamp | 1.7 × 0.4 (shade) | 24 × 113 |
| Arcade cabinet | 1.8 × 0.7 × 0.8 | 42 × 133 |
| Plant (floor pot) | 1.0 × 0.5 × 0.5 | 30 × 75 |
| Door (on the wall, flat) | 2.0 × 0.9 | 55 × 121 |
| Window sill height | 0.95 above floor | sill at 58 |
| Floor tile | — | 32 × 32 |

- **Scale sheet before approval:** every new or edited asset is shown to emci standing next to the
  scale-reference hero (same 1:1 pixels, feet on one line, the target box from the table drawn in).
  More than ±10 % off the table = regenerate at the right canvas size (don't stretch). Example:
  `docs/art/scale-sheet-hideout-test.png` (the first test-room props: couch, table, lamp, arcade,
  plant came out too small).
- Not in the table? Use the real-world size ÷ 1.75 m × H, and add the row here.

## 3. Camera and style (locked)
- 3/4 **low top-down**, orthographic: tops and fronts only, no side faces, no vanishing points,
  floor planks straight. Round floor things (rugs, hatches, auras) are flat ellipses.
- One key light top-left; contact shadow under everything, cast down-right.
- Streetwear neon night: drab indigo/plum base, saturation only from lights (magenta + cyan neon,
  warm amber lamp). Two neon hues per room max.
- **No text in the world.** PixelLab often invents fake letters on signs, marquees, posters, tags —
  check every asset; prompt "purely pictorial with zero writing"; fix by inpaint or recolour.

## 4. Gotchas we hit (save generations)
- `init_image_strength` = how much of the init image to **keep**. PixelLab's guide: 0–300 rough
  colour, 300–400 rough shapes, 400–600 variations of an existing image, 600–900 detail tweaks. For a
  flat greybox used only as a layout guide we got real art at ~80–150; 400+ copied the greybox.
- Standard Wang tilesets are 16 or 32 px only; `mode: "pro"` allows 64.
- A tileset can ignore direction words ("horizontal planks") — the building-kit floor did better.
- "hoodie"/"person-ish" words can spawn a character inside a prop — say "empty, no person".
- Palette lock with a palette missing a mid tone shifts colours (purple couch → neon pink): extend
  the palette (`palette2`: purples, woods, greys) before locking.
- `reduce_colors` needs same-size frames (pad to one canvas) and ≤512×512 px total per call.
- Wait for jobs with `wait_for_jobs` (≤280 s); Tier 2 = 10 concurrent jobs.
- **New 2026-10-19 — `target_palette`** (almost every creation/animation/tileset/UI tool):
  `{"colors": ["#…", …], "name": "…", "max_colors": N}`. With `colors`, every pixel of the result is one
  of them; `max_colors` (2–64) only caps the count. On tilesets it works in `mode: "pro"` only. Pass the
  streetwear-night palette (`docs/art/palette-streetwear-night.png`) when generating, then still run
  `reduce_colors` + `score` as the final check. Same warning as above: a palette missing a mid tone
  shifts colours, so extend it first. Not yet tried on ATO art — test on one asset and show emci before relying on it.
- **New 2026-10-19 — tileset edge controls** (`create_topdown_tileset` / tilesets endpoint):
  `boundary_amplitude` 0–0.3 (wavy border between two terrains, 0 = straight; `boundary_seed` picks the
  meander), `roundness` 0 square → 1 round → 2 corners cut at 45° (above 1 needs pro), `step_slope` 0 cliff →
  2 gentle slope (pro, raised 16-tile set only), `connect_diagonals` (pro only). Most need `mode: "pro"`.
  Good for a worn path or rug edge instead of a ruler-straight border. Check the 32 px tile size still holds.

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

## 7. Every art request: library first, then the rule book
Run these steps for any request, whether it's "make a new hero", "edit the couch" or "add a glow":
1. **Check the library.** Is there already an asset or a close one?
   - Search `assets/art/registry.json` (by category, set, variant, tags, status) and
     `assets/art/ART_LIBRARY.md`, or browse `assets/art/_contact/library.html` (phone:
     `assets/art/_contact/library-portable.html`). Library rules: `.cursor/rules/art-library.mdc`.
   - Packed art lives in `assets/art/<category>/in-use|unused/<set>/<variant>/` (category > set >
     variant, e.g. `heroes/kael/streetwear/`). Raw PixelLab exports live in `art-src/pixellab/<id>/`
     with a `gen.json` per generation at `art-src/pixellab/<id>/<gen>/gen.json` (prompt, seed,
     settings, cost, score) — use the raw frames as edit sources and style references, never the
     packed sheets.
   - Include the `resource` items under `unused/`. Never place off-style sets (primal,
     dungeon-legends, scribble, classic, kenney/craftpix, Expo leftovers) in a streetwear screen, even
     when their status says `resource` (the `needs-restyle` status exists but isn't applied yet, so go
     by set name); regenerate them here with `replaces` instead.
   - Look in the skeleton too (`src/art/skeletons.ts`, generated `SHEET` / `ROOM` / `ART` in
     `src/art/generated-art.ts`): which slots does this kind need, and which are already filled?
   - **Recommend before making anything:** show emci what the library already has that could work
     (picture + id + status), with a pick: reuse as is / edit it / make new. Then follow emci's choice.
   - Found and fits → reuse it. Found but not quite → **edit** it (step 3). Not found → **create** (step 3).
2. **Pick the style anchors** for that type (§9): 2–10 approved assets of the same kind. Every
   generation passes them as style references, and every result is checked against them side by side.
3. **Follow the recipe** for the type in §8. Edits never regenerate from scratch: they change the
   existing asset (identity and style drift come from regenerating).
4. **Clean up and lock:** `reduce_colors` with `docs/art/palette-streetwear-night.png` (all frames
   together; **not for hero clips** — see `PIXELLAB_ANIMATION.md` §4), `pixelart_workbench repair` + `score` (≥ 90), no fake text, and the **scale check** (§2).
5. **Show emci a sample** (side by side with the anchors / the old version, phone size, plus the
   scale sheet). After emci's ok, save it into the library: `npm run art:import -- --from … --id …` (raw + `gen.json` to
   `art-src/`), `npm run art:pack -- --id …`, then `npm run art:sync` and commit the generated files
   (the pre-commit hook does this; never hand-edit `registry.json` / `ART_LIBRARY.md`). A new version
   points at the old one with `replaces`. Code reads art through the skeletons (`ROOM.<room>.<slot>`,
   `SHEET.<family>.<item>.<slot>`, `HERO.<hero>.idle`) or the typed tree (`ART.<kind>.<set>…`), never an
   id string or a loose path. Status starts `candidate`; only emci sets `approved`.
6. **Keep the library current — every time, in the same change:**
   - **New:** import + pack + sync (step 5). A new part that fits no skeleton slot stops the sync: add
     the slot to `src/art/skeletons.ts` (and say so in the report) or rename the art.
   - **Edit:** import the new version with `replaces: <old id>`; the old one goes `unused/` and stays as
     history. Never overwrite a file in place.
   - **Remove:** tag it `remove` in the viewer (exports `art-decisions.json`), then
     `npm run art:apply-decisions -- --apply` — files go to `art-src/art-trash/`, never hard-deleted.
   - **Started or stopped using one:** just `npm run art:sync` (the hook does it) — in-use / unused
     folders and `usedBy` follow the code.
   - Report what was added / replaced / archived in the task report.

## 8. Recipes by asset type
### Heroes and pets (characters)
- **New:** draw the south-facing sprite first with style references (`create_image_pro`
  reference_images = 2–4 approved heroes, 128 canvas), pick the best, then rotate it into 8
  directions with `create_character` mode `v3` + `reference_image_url` (2–9 gens). Alternative:
  `create_character` mode `pro` with `style_character_id` = an approved hero (10–25 gens).
  View `low top-down`; south must be straight-on (a ¾ turn offsets every direction).
- **Edit (look/outfit/accessory):** `edit_image` (Pro) "with reference" or "with text" on the existing
  frame; across an animation use Edit animation (Pro) or `transfer_outfit`. Never re-create the hero.
- **Growth stages:** derive each stage from the previous one (edit/inpaint, same seed) and keep 2–3
  identifiers (palette core, signature shape, eye style). Size is shown by code, not new art.
- **Animations:** `animate_character` / `animate_with_skeleton_v3` (skeleton keeps identity better than
  templates at 128). Walk 6–8 frames at 100–150 ms, idle 2–4 frames at 200–400 ms. After the first
  good frame, **set it as the reference** for every further batch (PixelLab's consistency rule).
  Canvas sizes for skeleton tools: 16/32/64/128/256 only. Pad every frame of a hero onto one square
  canvas with feet aligned (existing pipeline: 192 cell, no cropping). Mirror west↔east.
- Pets that are animals: `body_type: quadruped` + template (cat, dog, bear, horse, lion).

### Props and objects
- Static prop in a room: `create_map_object` (view `low top-down`, outline `selective outline`,
  shading `medium shading`, detail `medium detail`) at the ladder size. To match existing props
  exactly use `create_1_direction_object` with `style_images` (approved props) — small canvases give
  more candidates per generation.
- Needs to face different walls: `create_8_direction_object` (style_object_id = an approved one).
- States (on/off, open/closed, used/new): `create_object_state` from the base object — same
  object, so it never drifts. Idle loops: `animate_object` mode `v3`.
- Wall items (posters, signs, tags): front-on, flat, "purely pictorial with zero writing".

### Effects (VFX)
- `vfx_workbench` (free): start with `--sprite` = the hero/prop it belongs to; export spritesheet.
- Ground effects (auras, rings, dust) are flat ellipses under the feet; body effects float.
- Timing: fast start, slow fade (impact ~6 frames ≈ 0.5 s). Max two neon hues; no black outlines on
  glows. Every effect needs a Reduce Motion version (gentle, no flashing).
- Animating a still image (sign buzz, screen loop): Animate with text (new) — 64 px: 4/8/16 frames =
  1/2/3 gens; 128 px: 3/5/9 gens; frame count must be even; first frame is kept.
- **New 2026-10-19 — PixelLab's own effects artist, `POST /vfx` (paid).** Describe the effect in words
  (optionally with a sprite ≤512 px, ≤32 frames; never rescale). `lite` = 1 gen for most effects, `pro` =
  6 gens (8 with a sprite), a change to an existing effect costs 1 (lite) / 4 (pro); a prompt over 400
  characters costs pro 1.25×. Saved to My effects with a spritesheet + json (anchor/pivot). It is NOT a
  replacement: `vfx_workbench` (free) stays the first choice; use `/vfx` only if the workbench can't
  make the effect, and tell emci the cost first.
- **Available, not used — `POST /normal-map`** (0.5 gen): makes a normal map so an engine can light a sprite
  dynamically. ATO has no dynamic lights (light lives on its own painted layer), so skip unless that changes.

### Rooms, floors, walls
- §1 order: building kit → tilesets (chain `lower_base_tile_id`/`upper_base_tile_id` so terrains
  match) → map objects → states → light layer. Tiles 32 px.
- Worked example (Hideout, emci approved 2026-10-12): `art-src/pixellab/room.hideout.streetwear/`
  (gen.json lists every tool, id and canvas) → `scripts/hideout-room-art.ts` paints the layers →
  `npx tsx scripts/gen-hideout-td.ts` writes them + the map. Re-run after swapping any part.
- What makes high-detail rooms read (research 2026-10-12, Slynyrd Pixelblog 35 + interior write-ups):
  one camera tilt for every piece; a darker back-wall band 2–3 tiles tall is the main depth cue;
  build from parts (floor tiles + wall pieces + props as separate sprites, never one image); mix
  2+ floor variants (base ~55 %, scuffs/knots the rest) so the floor isn't a stamp; flat things
  (rug, hatch, bowl) go on the floor layer; tall props are occluders; light lives on its own layer
  (contact shadows, warm lamp pool, screen spill), not painted into props.
- Building kit `square_topdown` returns 52×111 frames: floor piece is 32×24 at (10,79), back wall
  32×81 at (10,7), side cap 12×24 at (10,7). Floor variants: `create_tiles_pro` with the kit floor as
  `style_images` keeps them on the same 32×24 shape and palette.
- Prop size: `create_map_object` draws ~10–20 % inside its canvas and flattens low-top-down
  furniture. Set the canvas to the §2 target box + ~10 % and say "fills the whole canvas edge to
  edge"; couches need extra height ("seat cushions clearly visible from above").

### UI
- Check the Streetwear UI kit first (`assets/play/sheets/streetwear/ui-kit/`). New pieces:
  `create_ui_asset` (1 gen, ≤ 400×400 on Tier 2) with the kit pieces as init/reference; 9-slice by
  hand after. Icons 16/32 px, ≥ 1 px dark outline, readable on light and dark, info never by colour alone.

### Fixing part of anything
- Small area: `inpaint_image` (mask only the bad region; describe the whole visible area).
- Whole-image instruction ("add a hat", "remove the text"): `edit_image`.
- Many frames: Edit animation (Pro). Never regenerate a whole asset to fix one part.

## 9. Style anchors (anti-drift)
Keep 5–10 approved, cleaned, native-size assets per type as the reference set (never upscaled
copies). Pass the raw frames from `art-src/pixellab/<id>/` as references. Only `approved` (or
emci-picked) items are anchors; `needs-restyle` items never are.
- Heroes (16 approved streetwear sets, `heroes/<slug>/streetwear/`): kael (scale reference), sak,
  raven, kitsune, neon-viper. Raw frames: `art-src/pixellab/hero.<slug>.streetwear/`; registry ids
  `hero.<slug>.streetwear.core` / `.combat`. The `cast` variants are alt skins, not style anchors.
- Room props: the Hideout set (emci approved the room 2026-10-12) — `props/*/hideout/streetwear/`
  (couch, table, lamp, arcade, plant, stereo, speaker, beanbag, window, rug, manhole, bowl, cushion,
  lamp-off, arcade-off); raw + gen.json in `art-src/pixellab/room.hideout.streetwear/`. Wall/floor
  anchor: that folder's `kit/` (building kit) and `floor-variants/`.
- Icons / UI: `icons/streetwear/streetwear` (32 px icon set), `icons/currency|tabs/streetwear`,
  `ui/kit/streetwear`, `ui/frames/streetwear`, `ui/streetwear/streetwear`, all status `resource`
  (house style, not yet emci-approved).
- VFX: none approved in `fx/` yet; the first approved effect becomes the anchor.
Same outline/shading/detail strings per type every time (the "style card"):
| Type | outline | shading | detail | view |
|---|---|---|---|---|
| Room props | selective outline | medium shading | medium detail | low top-down |
| Neon signs / tags | lineless | flat shading | medium detail | low top-down |
| Heroes / pets | match the anchors (dark single-colour outline) | — | — | low top-down |

## 10. Staying current
**Animation work has its own pre-flight: `docs/art/PIXELLAB_ANIMATION.md` §0** (learn/update what we know about
PixelLab with `search_help`, then `get_balance`, then ONE test clip, then generate). Do it every new chat.

`npm run pixellab:watch` downloads PixelLab's public docs, compares them with
`docs/art/pixellab-snapshot.json`, and prints what changed (new/removed endpoints, changed
parameters, changed doc sections). It never edits this guide. A weekly scheduled task runs it; when
something changed, an AI drafts the guide update on a branch and emci approves it. After a guide
update is accepted, refresh the snapshot with `npm run pixellab:watch -- --update`.
