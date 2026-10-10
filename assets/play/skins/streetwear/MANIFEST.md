# Streetwear skin — art manifest (PixelLab, 2026-10-10)

Art only. **Nothing here is wired into the game** and nothing is in the app bundle: no
`skin.json`, no registry entry, `play-art-prep` / `play-art-pack` were NOT run. Wiring follows
ATO-streetwear-theme-plan.md later. Raw PixelLab exports (zips, restyled fronts, rejects) and the
working ID log are in `games/grove/ref/streetwear-source/` (`STATE.md`).

**Style:** urban streetwear remix, gritty cel-shaded hi-bit pixel art, bold black outlines, flat
2-3 tone shading. Palette mustard `#E0A526`, charcoal `#2B2B2E`, off-white `#F2EDE4`, paint red `#C8202B`.

**Generations:** 828 used today (balance 4,692 → 3,864 left; resets 2026-10-11). No Pro mode used
(the anchor was made with v3, cheaper than Pro).

## Layout rules (match `skins/cast`)

- Characters: `<slug>/rotations/<dir>.png` (8 dirs) + `<slug>/animations/<Clip>/<east|west>/frame_###.png`.
  Clip names `Idle / Walk / Dash / Attack / Skill / Hurt` (heroes) and `Idle / Walk / Death` (creeps)
  so `play-art-pack.ts` role words map them without a human pick.
- **One canvas per character, never cropped.** PixelLab grows the canvas per clip (128 → 160/176,
  sometimes different E vs W), so every frame was padded onto one square canvas: heroes 192×192,
  creeps 96×96. Horizontal: centred (PixelLab canvases are pivot-centred). Vertical: each clip moved
  as a whole so its first-frame feet sit on the idle stance line (max shift 8px). East and west have
  equal frame counts in every clip. Measure `footAt` when wiring; figures are bigger in their canvas
  than the cast heroes (cast fills ~50%).
- Hero animations: Idle = `breathing-idle` template; Walk/Dash/Attack/Skill/Hurt = `skeleton-v3` with
  templates `walking-8-frames`, `running-8-frames`, `cross-punch`, `fireball`, `taking-punch`
  (template mode drifted off-model in QA; skeleton-v3 keeps identity). Creeps: all skeleton-v3
  (`breathing-idle`, `walking-8-frames`, `falling-back-death`).

## Assets

| Path | Tool (gen cost) | PixelLab id |
|---|---|---|
| `_anchor/street-ninja` | create_character v3 128 (3 gen; 3 candidates = 9) | 6f045b3a-1e1a-47b4-b660-fd4ea7bc9453 (rejected B 513135d7…, C 9434ae64…) |
| `_anchor/style-ref-64.png`, `style-ref-32.png` | local downscale of the anchor (0) | — |
| `map/asphalt-sidewalk.png` (+.json Wang metadata) | create_topdown_tileset 32px (~3) | ea38ba0d-3230-43c4-8e03-e2dcb6612a0b |
| `map/sidewalk-lot.png` (+.json) | create_topdown_tileset 32px, reroll of an all-mustard v1 (~3+3) | 8e22f23a-cbf6-4192-a253-2ed43f27c193 (v1 0d0a757e… rejected) |
| `map/road-path/tile_0..17.png` | create_path_tiles 32px, 18 configs (10-25) | 19584eee-7fdf-49d1-87a9-3e6fdf2b7be1 — edge masks bit0=N bit1=E bit2=S bit3=W: t2=1 t3=2 t4=4 t5=8 t6=10 t7=5 t8=6 t9=12 t10=3 t11=9 t12=14 t13=13 t14=11 t15=7 t16=15, t0/t1=ground, t17 stamp-only |
| `map/brick-graffiti-sidescroller.png` (+.json) | create_sidescroller_tileset 32px (2-3) | 2c9a9b9d-db47-4a63-87a5-7039a7401c0a |
| `props/*` (32 × 64px) | create_1_direction_object, 2 batches (10 + 10) | Set A + pads 602abbb8-4bd4-42f6-8748-e8ee1da0647f, Set B 1c2ab150-7b6e-49c4-943c-7c78ecc6f20d |
| `fx/shot-*`, `fx/coin-*`, `ui/icons/*` (64 × 32px) | create_1_direction_object, one 64-slot batch (10) | 26ddb085-1d4d-427a-a704-1a520fdac9f8 |
| `fx/hit-splat/` (9 frames 64px) | animate_image v3, interpolated glob → splat decal (1; reroll of a thin-ring v1, 1) | job 2907a0e8-415b-494d-9a75-1dc76dc6f13a |
| `fx/hit-splat-{ember,tide,spark,root,void}/` | local palette swap of hit-splat to #FB923C / #38BDF8 / #FACC15 / #34D399 / #A78BFA (0) | — |
| `ui/panel-frame.png` 384×288 | create_ui_asset (15) | c347ea5c-49d6-43ea-bbd6-3efc2c11f83c |
| `ui/button-normal.png`, `button-pressed.png` | create_ui_asset, one sheet split locally (15) | c21f4eda-b0a3-4a73-bdc3-be1e0cd8be06 |
| `ui/health-bar.png` (cropped) | create_ui_asset (25) | 8975e9f3-1df2-4d31-a0c5-a981612b6a3b |
| `ui/card-frame.png` 288×384 | create_ui_asset (15) | fe1978f5-b130-45ed-8599-2fc35b9e4a21 |
| hero restyled fronts (ref only) | edit_image, 4 heroes per call (4 × 10) | 8143ed97, c6fe6cd0, 86602f34, 6cb0b7f8 |
| creep restyled fronts (ref only) | edit_image, 3 per call (10) | 96ddbec7 |

### Heroes (`heroes/<slug>/`, 84 PNG each, 192×192)

Each: create_character v3 from its restyled front (2 gen) + Idle template (1/dir) + 5 skeleton-v3 clips (2-4/dir).
Corvus and Archangel also paid for a first template-mode set (kept in their source zips, not used).

| Hero | Character id |
|---|---|
| corvus | 4ae9fe40-9152-41ef-b839-fc61d7a479c7 |
| archangel | 25a894bb-d246-4f14-9a64-088451118525 |
| oni | 2c90d0a1-0ef7-405e-bd97-4a2ddaa13a34 |
| aurex | 7dafc460-cf9f-40c6-8cfc-4aa05c0e364f |
| kitsune | 19ed908a-f173-45f4-9490-dd4a5e58f254 |
| cyber-shinobi | 95bbe1d1-8532-4831-890e-51a9ff22ad09 |
| elowen | 535363cd-6b15-4daf-b8de-6f206b6a3747 |
| kael | dc37a135-5822-46d1-b3a8-022ccc7c2b12 |
| maldrath | 62e9abf1-0ac9-4538-81e4-a0d5ba57a638 |
| morwen | 8eada467-7b76-4adc-99ba-0afb310eb6f2 |
| neon-viper | add42923-e981-4912-b2ac-697062c67434 |
| raven | 685ebac8-e1ad-414f-9b67-3fbf25e42621 |
| sak | 20b16c7b-7ca6-4182-9e3c-00168386e5bd |
| frost-lich | 60fd62b1-1d55-4a44-8ef7-ffc8c8e65451 |
| velkhar | 358cfbd9-31c7-49e3-ac71-2c19ed9b1bd8 |
| void-raven | 5e3b9e12-997e-4d5c-9efa-c38707e9cc4a |

### Creeps (`creeps/<slug>/`, 46 PNG each, 96×96; created at 64px)

| Creep | Character id |
|---|---|
| village-girl | 8da68657-9b0c-408d-b081-ece6da0a2d50 |
| wizard | f968dd5f-76ef-49ee-9bcb-d1631e003580 |
| knight | 2fbc9bc6-bfe4-4bfb-b40f-2cef6d14dbb8 |

## Known issues (read before wiring)

- `Skill` (fireball template) draws an orange flame on every hero, also ice/void ones — tint or overlay per element.
- 4 frames touch the canvas edge at source (sword tip / flame, 1-2px): oni Attack/west, oni Skill/west ×2, archangel Skill/west.
- Skeleton-v3 sometimes drops the held weapon mid-action (e.g. archangel sword).
- Knight creep's side rotations read paler than its front.
- Icons flagged for emci's look: `ui/icons/REVIEW-leaf.png` (reads as cannabis), `REVIEW-price-tag-dollar.png` and `REVIEW-chain-99.png` (contain characters), `REVIEW-brass-knuckles.png`. `props/graffiti-tag-decal.png` and `ui/icons/graffiti-tag.png` are letter-like wildstyle (not readable).
- Map objects (create_map_object) were not used, so nothing here is subject to the 8-hour auto-delete.
- No boss or tower art yet (no `boss/` or `towers/` folder).
- `ui/card-frame.png` has fake barcode / glyph decoration (not readable).
- `ui/button-normal.png` (150×68) and `button-pressed.png` (138×56) differ in size — pad to one box when wiring.
- Tone check for emci: red paint drips + skull on panel / card / health bar can read like blood.
- **Wiring risk:** `scripts/play-art-prep.ts` has `'skins'` in `FAMILIES` and `PACKED_HERO_ART` only excludes `skins/cast/heroes/`. Re-running prep as-is would bundle ~1,480 loose streetwear frames into `generated-play-assets.ts`. Widen the exclusion (and pack via `play-art-pack.ts`) in the wiring change.

## Files

| Path | PNGs | Size / content |
|---|---|---|
| `_anchor/street-ninja/rotations/` | 8 | 192x192 |
| `_anchor/style-ref-32.png` | 1 | 32x32 |
| `_anchor/style-ref-64.png` | 1 | 64x64 |
| `map/asphalt-sidewalk.png` | 1 | 128x128 |
| `map/brick-graffiti-sidescroller.png` | 1 | 128x128 |
| `map/road-path/` | 18 | 32x32 |
| `map/sidewalk-lot.png` | 1 | 128x128 |
| `props/barrel-fire.png` | 1 | 64x64 |
| `props/bench-graffiti.png` | 1 | 64x64 |
| `props/boombox-crate.png` | 1 | 64x64 |
| `props/boombox.png` | 1 | 64x64 |
| `props/crate.png` | 1 | 64x64 |
| `props/crates-stacked.png` | 1 | 64x64 |
| `props/dumpster-open.png` | 1 | 64x64 |
| `props/dumpster.png` | 1 | 64x64 |
| `props/fence-chainlink-torn.png` | 1 | 64x64 |
| `props/fence-chainlink.png` | 1 | 64x64 |
| `props/fire-hydrant-spray.png` | 1 | 64x64 |
| `props/fire-hydrant.png` | 1 | 64x64 |
| `props/graffiti-tag-decal.png` | 1 | 64x64 |
| `props/jersey-barrier.png` | 1 | 64x64 |
| `props/newspaper-box.png` | 1 | 64x64 |
| `props/oil-drum.png` | 1 | 64x64 |
| `props/pad-concrete-x.png` | 1 | 64x64 |
| `props/pad-manhole-ring.png` | 1 | 64x64 |
| `props/pad-manhole-splat.png` | 1 | 64x64 |
| `props/pad-sticker-slab.png` | 1 | 64x64 |
| `props/paint-splat-decal.png` | 1 | 64x64 |
| `props/shopping-cart-tipped.png` | 1 | 64x64 |
| `props/shopping-cart.png` | 1 | 64x64 |
| `props/spray-can-single.png` | 1 | 64x64 |
| `props/spray-cans.png` | 1 | 64x64 |
| `props/streetlight-broken.png` | 1 | 64x64 |
| `props/streetlight.png` | 1 | 64x64 |
| `props/tire-stack.png` | 1 | 64x64 |
| `props/traffic-cone-fallen.png` | 1 | 64x64 |
| `props/traffic-cone.png` | 1 | 64x64 |
| `props/trash-bags-cup.png` | 1 | 64x64 |
| `props/trash-bags.png` | 1 | 64x64 |
| `fx/coin-cap-mustard.png` | 1 | 32x32 |
| `fx/coin-cap-red.png` | 1 | 32x32 |
| `fx/coin-chain.png` | 1 | 32x32 |
| `fx/coin-medallion.png` | 1 | 32x32 |
| `fx/hit-splat/` | 9 | 64x64 |
| `fx/hit-splat-ember/` | 9 | 64x64 |
| `fx/hit-splat-root/` | 9 | 64x64 |
| `fx/hit-splat-spark/` | 9 | 64x64 |
| `fx/hit-splat-tide/` | 9 | 64x64 |
| `fx/hit-splat-void/` | 9 | 64x64 |
| `fx/shot-mist.png` | 1 | 32x32 |
| `fx/shot-mustard.png` | 1 | 32x32 |
| `fx/shot-red.png` | 1 | 32x32 |
| `fx/shot-white.png` | 1 | 32x32 |
| `ui/button-normal.png` | 1 | 150x68 |
| `ui/button-pressed.png` | 1 | 138x56 |
| `ui/card-frame.png` | 1 | 288x384 |
| `ui/health-bar.png` | 1 | 579x134 |
| `ui/icons/` | 56 | 32x32 |
| `ui/panel-frame.png` | 1 | 384x288 |
| `heroes/archangel/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `heroes/aurex/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `heroes/corvus/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `heroes/cyber-shinobi/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `heroes/elowen/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `heroes/frost-lich/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `heroes/kael/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `heroes/kitsune/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `heroes/maldrath/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `heroes/morwen/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `heroes/neon-viper/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `heroes/oni/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `heroes/raven/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `heroes/sak/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `heroes/velkhar/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `heroes/void-raven/` | 84 | 192x192 — 8 rotations; E+W: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 6f, Walk 8f |
| `creeps/knight/` | 46 | 96x96 — 8 rotations; E+W: Death 7f, Idle 4f, Walk 8f |
| `creeps/village-girl/` | 46 | 96x96 — 8 rotations; E+W: Death 7f, Idle 4f, Walk 8f |
| `creeps/wizard/` | 46 | 96x96 — 8 rotations; E+W: Death 7f, Idle 4f, Walk 8f |
