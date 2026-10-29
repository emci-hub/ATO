# Quests art critique (§1.9 rubric, 0–4 each, pass ≥22, none below 2)

## lantern/test/plate-test-01.png (194×100, pixflux, seed 4101) — 20/28 FAIL (test only, not a deliverable)
| # | Criterion | Score | Note |
|---|---|---|---|
| 1 | Silhouette | 3 | arch rings read clearly at 1x |
| 2 | Value contrast | 3 | bright cyan centre vs dark stone; but the glow sits exactly where the hero will stand |
| 3 | Palette lock | 4 | 10 colours, all inside palette.png (checked by script) |
| 4 | Clean pixels | 3 | a few ragged ring edges |
| 5 | Light/shading | 3 | light comes from the glow, consistent |
| 6 | Scale/camera | 2 | reads as a frontal tunnel, not a side view; ground line is a thin water strip |
| 7 | Style match | 2 | cleaner and flatter than the dive-atlas refs; no stone texture |

## lantern/test/plate-test-02-pro.png (194×100, create_image_pro, seed 4101, style_image = refs/dive-ruins.png, hex palette) — 22/28 PASS (borderline)
| # | Criterion | Score | Note |
|---|---|---|---|
| 1 | Silhouette | 3 | beams and arch read; the dark mass on the left is muddy (rock or statue?) |
| 2 | Value contrast | 3 | glow on the right third, stage centre stays darker, which suits a 64 px hero |
| 3 | Palette lock | 4 | 19 colours, all inside palette.png (script) |
| 4 | Clean pixels | 3 | a few noisy clusters on the left rock |
| 5 | Light/shading | 3 | cyan source at right lights beams and floor consistently |
| 6 | Scale/camera | 3 | true side view with beams; ground band is thin, a stronger flat floor line is still needed for the hero's feet |
| 7 | Style match | 3 | close to the dive-atlas refs (texture, outline) |
Side by side with test 01: `lantern/test/compare-01-vs-02@2x.png`. Recommendation: Pro + style_image + hex palette is the Lantern scene route (10 gens per plate). Fix round for the final far plates: inpaint the left mass and the floor band (cheap), not regenerate.

## Final scores: `params.json` (49 assets, 7 criteria each). Summary, 2026-10-28 (after the reviewer's FAIL, three more fix rounds)
- **Pass (>=22, none below 2): 47 of 49.** 5 far plates, 5 mid layers, 6 props (crystal and crate after fix rounds), 4 of 5 ground strips, Rook + Vey + both portraits, all 9 icons (each scored on its own), VFX V1/V2/V3 up/down, the drip (redrawn), and all 10 heroes (palette-snapped).
- **Placeholders (2 fix rounds each, logged):**
  - **Raft (19):** thin/messy after 4 re-rolls (top-down, flat elevation x2, logs+pole x2). Keep the first raft as a placeholder; next try: `create_1_direction_object` with a style image, or draw it by hand (about 20 px of detail).
  - **Gate ground strip (19):** pixflux perspective tiles, Pro near-black, Pro with a white band on top. The gate plate keeps its own floor band.
- **Palette:** heroes and NPCs come from v3 with no palette input, so every frame is snapped to `palette.png` in CIELAB (`tools/snap-palette.py`, originals beside `snapped/`). An RGB-distance snap dulled them (`heroes/snap-compare@2x.png`); the LAB one keeps hue (`heroes/snap-lab-compare@2x.png`). Unsnapped, the palette criterion is 2 and the heroes score 20/28: emci can still choose the originals (PIXELLAB_ANIMATION §4 prefers them for streetwear heroes).
- Not built: other hero directions (west is a mirror), NPC west views, hero talk/react for the 7 extra heroes (spec: "more animations where they add value").

## PHASE-21 summary (2026-10-29): Masquerade + City + shared. 84 new assets in `params.json`, all >= 22 with no criterion below 2 (no placeholders)
Scores are the author's own read next to refs/; emci's art OK on the three contact sheets (`masquerade-sheet.png`, `city-sheet.png`, `shared-sheet.png`) is still open.
- **Passed first try:** all 10 far plates (22-23), all 10 mid layers (22), 10 of 14 props, 5 of 6 NPCs, all 6 portraits (26), the 3 walk and 3 triumph clips, 5 of 10 emblems, the curtain and train loops, 12 ending cards.
- **Fix rounds that worked:** gold mask (hooded plague doctor -> a plain gold half mask), wine table (white blob -> red cloth with glasses), phone (blank mirror -> chat screen), umbrella (handle), d20 (first try read as a cube -> icosahedron), masquerade badge (grim face -> white mask on wine red), Corvin (a fox-headed figure -> a human with the fox mask on his forehead; the old frames are kept in `npcs/fox-r0/`), Mara / Theo / Dee (first built as a commuter, courier and vendor, then redone as the nurse, busker and cab driver the story names; old frames in `npcs/city-r0/`), dancers loop (drifted and lost a dancer -> first frame pinned as last frame), 4 emblems (clasped hands, bridge, kite, helm), candle flame (capsule -> teardrop).
- **Weak spots, noted for emci:**
  - the bridge emblem (c_coop) is the weakest at 22 (reads as a wooden crate in water);
  - the Lantern "singing deep" and "toll forward" ending cards show a symmetric ceiling, because the top 16 rows of every card are the plate's own top rows mirrored (the cards are 192×116, the plate is 100 tall);
  - ending cards are the composed layers repainted at strength 650, so they stay close to the composition (hero and NPCs are the existing sprites).
- **Deviations from the spec (each logged):** all plates 194 wide (even-width rule, as Lantern); ending cards 192×116 instead of 195×118 (pixflux needs sizes divisible by 4); `bitforge` does not exist in the MCP, `create_image_pixflux` img2img was used; the candle flame and the rain tile are scripts (the flame is below PixelLab's 32x32 minimum for animate_image, the tile must loop seamlessly); 24x24 emblems use `create_image_pixen` (1 gen, square 24 is valid there; pixflux needs 32x32 minimum); portraits use `create_image_pro` 64x64 with the sprite as reference, like Rook and Vey.
- **Smaller notes:** A-C3 train is 194×24 (even rule); the dancers use seed 4814 (fix round; 4813 was the drifting first try); heroes, NPCs and `animate_character` clips have no seed (the tools take none); the dancer silhouettes are dark on the contact sheet by design (they sit on a lit ballroom plate in the app); Corvin's coat tail curve at the back can read as a tail, emci to judge.
- **Extras beyond the list (§1.9 allows them):** Corvin and City NPC redos; rotations south for all 6 NPCs kept in `npcs/` (ref crops `ref-<n>-south64.png`); a second dancer loop; d20 and badge alternates in `shared/wip/`.
- **Palette:** pixflux/Pro output is forced to the 67 colours; pixen emblems, animate_image frames, NPC and hero frames are snapped in CIELAB (`tools/install-misc.py`, `tools/snap-palette.py`); a script check found 0 off-palette colours in every delivered file.

## Batch 1 (2026-10-28, 12 gens) — all FAIL, kept for the record in `lantern/test/` (`batch1-sheet@2x.png`)
- `batch1-fork-far-pro.png` — **fail (criterion 7/composition)**: with `style_image` = approved plate 02 and a "fork" prompt, Pro returned the same composition as plate 02 (statue-rock left, glowing cave right, same beams). The style image copies layout, not just style, so it can't make 4 different locations. No fork is visible. Palette 4, pixels 3, but it is a duplicate.
- `batch1-gate-mid-s450.png`, `batch1-gate-mid-s350.png` — **fail (criteria 1, 6)**: pixflux with `init = far plate` + `no_background` returns the whole scene with the background half cut away, with the same shapes and lit areas, not a framing layer of foreground arches. Lower strength (350) is no better. Init-from-far does not work for the mid layer.
Fix round plan (all three items were run later: see batches 2, 6 and 7 in credits.md and the summary at the top): (a) other locations = Pro with a different `style_image` (a neutral crop, e.g. `refs/dive-ground.png`, or none, with the approved plate only as a `reference_images` "palette and mood" label) and a stronger, location-specific prompt; (b) mid layer = a fresh pixflux `no_background` generation with no init ("foreground only: two rock arches and a wooden beam frame at the left and right edges, empty centre") at strength-free settings, then keep only what sits at the edges; (c) ground strip 194×24 on its own.

Plan (test 01) if emci OKs the direction: move the glow off-centre (right third), ask for a "flat stone floor band across the bottom, side view, tunnel runs left to right", add greybox init (strength ~300) so the ground line is fixed, then try `create_image_pro` with `style_image = refs/dive-ruins.png` once to compare against pixflux.
