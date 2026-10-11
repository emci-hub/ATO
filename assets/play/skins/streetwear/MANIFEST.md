# Streetwear skin — art manifest (PixelLab, 2026-10-10)

Art only. **Nothing here is wired into the game** and nothing is in the app bundle: no
`skin.json`, no registry entry, `play-art-prep` / `play-art-pack` were NOT run. Wiring follows
ATO-streetwear-theme-plan.md later. Raw PixelLab exports (zips, restyled fronts, rejects) and the
working ID log are in `games/grove/ref/streetwear-source/` (`STATE.md`). Wiring plan: `docs/streetwear-wiring-plan.md`
(the old ATO-streetwear-theme-plan.md never existed on disk).

**Style:** urban streetwear remix, gritty cel-shaded hi-bit pixel art, bold black outlines, flat
2-3 tone shading. Palette mustard `#E0A526`, charcoal `#2B2B2E`, off-white `#F2EDE4`, paint red `#C8202B`.

**Generations:** 1,746 on 2026-10-10 (balance 4,692 → 2,946), then ~154 for towers + bosses on 2026-10-11
(cycle reset mid-batch; 4,932 left, next reset 2026-11-11), then 191 for tower clips + icon/UI fixes
(4,932 → 4,741; includes one ghost Attack reroll), then 128 for the frame-consistency pass (4,741 → 4,613), then 31 for 3 attack fixes + shop icons + rarity
frame (4,613 → 4,582); all effects and auras were free (VFX workbench). No Pro mode used
(the anchor was made with v3, cheaper than Pro). Weapon moves cost 3-4 gen per direction.

## Layout rules (match `skins/cast`)

- Characters: `<slug>/rotations/<dir>.png` (8 dirs) + `<slug>/animations/<Clip>/<east|west|north|south>/frame_###.png`
  (north/south added on emci's ask; the game only plays east/west today).
  Clip names `Idle / Walk / Dash / Attack / Skill / Hurt` (heroes) and `Idle / Walk / Death` (creeps)
  so `play-art-pack.ts` role words map them without a human pick.
- **One canvas per character, never cropped.** PixelLab grows the canvas per clip (128 → 160/176,
  sometimes different E vs W), so every frame was padded onto one square canvas: heroes 192×192,
  creeps 96×96. Horizontal: centred (PixelLab canvases are pivot-centred). Vertical: each clip moved
  as a whole so its first-frame feet sit on the idle stance line (max shift 8px). All four facings have
  equal frame counts in every clip. Measure `footAt` when wiring; figures are bigger in their canvas
  than the cast heroes (cast fills ~50%).
- Hero animations: Idle = custom v3 "standing idle, breathing slowly while holding <weapon>" (4f; re-made 2026-10-11 — the old `breathing-idle` template idles made hair/capes/weapons blink); Walk/Dash/Hurt = `skeleton-v3` with
  `walking-8-frames`, `running-8-frames`, `taking-punch` (template mode drifted off-model in QA;
  skeleton-v3 keeps identity). **Attack and Skill are each hero's own weapon move** (8 frames,
  PixelLab custom v3 with a written motion): the first pass used the unarmed `cross-punch` /
  `fireball` templates, which made heroes drop or glitch their weapons. Raven keeps its skeleton
  `cross-punch` attack (emci liked it). Void Raven and Velkhar idles were redone holding their weapon.
  Creeps: all skeleton-v3 (`breathing-idle`, `walking-8-frames`, `falling-back-death`).

### Weapon moves (Attack / Skill)

| Hero | Weapon | Attack | Skill |
|---|---|---|---|
| corvus | none (crow) | lunging clawed-hand slash | releases a swarm of crows |
| archangel | flaming sword | diagonal sword slash | overhead strike, wings spread |
| oni | katana | horizontal katana slash | rising two-handed slash, red flame |
| aurex | greatsword | wide two-handed swing | spinning slash trailing flames |
| kitsune | two katanas | X-cross slash, both blades | dashing dual-blade flurry |
| cyber-shinobi | katana (back) | draw-and-slash | iaido draw, blue trail |
| elowen | sword | forward thrust | spinning slash, green leaves |
| kael | energy blade | fast cyan slash | overhead slash, energy wave |
| maldrath | greatsword | overhead ground slam | wide sweep |
| morwen | staff | staff swing | purple magic bolt |
| neon-viper | none | spinning roundhouse kick | neon dash punch |
| raven | axe | (skeleton cross-punch, kept) | overhead axe chop |
| sak | ice sword | quick slash | thrust, ghost wisps |
| frost-lich | ice greatsword | heavy swing | plants sword, ice spikes |
| velkhar | skull staff | staff strike | purple flame cast |
| void-raven | scythe | wide two-handed sweep | full spinning slash |

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

### Heroes (`heroes/<slug>/`, 176 PNG each — raven 168, its Attack is 6 frames — 192×192)

Each: create_character v3 from its restyled front (2 gen) + Idle template (1/dir) + Walk/Dash/Hurt skeleton-v3 (2-4/dir) + Attack/Skill custom v3 weapon moves (3-4/dir; raven Attack stays skeleton).
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

### Towers (`towers/<slug>/`, 48 PNG each: 8 rotations + E/W Idle/Attack/Skill) — 2026-10-11

Each: edit_image restyle of the cast front (10) + create_character v3 from it (7-8). One canvas per tower = the cast tower's size.
Clips (2026-10-11, east + west only — the engine reads tower clips E/W from `data/towerSkins.json`): `animations/{Idle,Attack,Skill}/{east,west}/`.
Idle = skeleton-v3 `breathing-idle` (4f); Attack / Skill = custom v3, 8f (7-8 gen per direction):

| Tower | Attack | Skill |
|---|---|---|
| ghost | points, drones dart out and fire cyan bolts | arms up, drones spin and release a cyan energy-ring pulse |
| lux | hand forward, drones fire blue light beams | hand up, drones + crystals release a blue lightning burst |
| viper | rifle to shoulder, one shot, muzzle flash | kneels, rapid burst of green shots |

| Tower | Role | Canvas | Character id | Restyle job |
|---|---|---|---|---|
| ghost (hooded drone operator) | tower.vine | 240×240 | 47597b73-27eb-4773-8033-52efaa1aab77 | 711340eb-13cc-4d26-a54e-b9c221864891 |
| lux (blue-haired drone pilot) | tower.crystal | 244×244 | 6159cb5b-4748-4d9a-b485-fb2ffafb5c8e | 9fa06993-6688-4558-8cf8-67517fd63ba0 |
| viper (lizard sniper) | tower.archer | 236×236 | 422ec80c-0e0e-4a4a-88a5-4e81844eb212 | df8ff551-1fc2-434e-9a44-679af179129c |

### Bosses (`boss/<slug>/`) — 2026-10-11

| Boss | Role | Canvas | Clips | Character id |
|---|---|---|---|---|
| oni ("Oni Warlord") | unit.boss_scout (also the `scout_mini` mini-boss band) | 264×264 | 8 rotations; E/W/N/S: Idle 4f, Walk 8f, Run 8f, Death 8f | 85d9255b-ad31-4ddf-825c-256aeadf9cf1 |
| titan-x (mech) | none — cast has it but no skin.json role; `unit.final` is the archangel hero | 244×244 | 8 rotations only (like the cast) | 552049dc-1093-49e1-8211-2b293544169d |

Oni Warlord is a NEW character (emci's pick), not the hero scaled up: edit_image turned the Streetwear Oni hero's front
into a bulkier armoured boss (10, job cef42ec0-41ae-4bf3-b746-549d29fe16cb), then create_character v3 at 192 (5).
Idle/Walk/Run = skeleton-v3 `breathing-idle` / `walking-8-frames` / `running-8-frames`; Death = custom v3, 8 frames
(10 refused at its 256 animation canvas), "staggering back, dropping to one knee leaning on the katana as its flame dies
out, then collapsing forward". Canvas 264 because the katana flame and cape reach the edges of PixelLab's 256 frames.
Titan-X: restyle 0cd3dacc-d77c-4842-a321-ef5b83f0cf87 (10) + v3 (8).
Cost: ~86 (batch 1, before the cycle reset) + 68 (oni clips) ≈ 154 generations.

### Element effects (`fx/elements/<element>/<kind>.png` + `.json` or `.manifest.json`) — 2026-10-11, 0 generations

Made with PixelLab's free VFX workbench (presets/parts recoloured with our element ramps), each saved to
emci's PixelLab "My effects" (re-editable there). Sheet + TexturePacker-style JSON (frame rects, pivot,
per-frame ms); ember/tide/spark/void status loops are effect-only pieces (`.manifest.json`: anchor = unit's feet + offset; its `sheets[].file` name is stale, the sheet is `status.png`; root status is a one-shot TexturePacker sheet; draw
**behind** the unit unless `depth` says front). One colour AND one shape per element (research: hue alone
blurs ice vs void on dark maps):

| Element | Ramp (dark → light) | shot (loop) | hit | burst (skill AoE) | status (loop) | slash |
|---|---|---|---|---|---|---|
| ember | #3a0d05 #C8202B #FB923C #FFE29A | fire orb | flash ring | cartoon fire boom | flames licking up | arc |
| tide | #0a1f3d #1d5fa8 #38BDF8 #B8ECFF | water orb | water splash | splash + ground ring | ice crystals at feet (slow) | arc |
| root | #0b2a1a #1f7a4a #34D399 #C2F5D9 | green orb | leaf burst | vines + ground ring | vines erupt (snare, one-shot) | arc |
| spark | #3a2a00 #b8860b #FACC15 #FFF4A8 | bolt | spark flash | lightning strike from above | crackling arcs | arc |
| void | #1a0b2e #4c1d95 #8b5cf6 #c4b5fd | violet orb | implosion | violet eruption + ring | orbiting motes | arc |
| plain | #2B2B2E #8a5a10 #E0A526 #F2EDE4 | paint bolt | hit star | ground ring | — | arc |

Towers: viper (archer) = plain, ghost (vine) = root, lux (crystal) = spark. Shots fly +x (mirror for left).

### Pet auras (`fx/auras/<style>/behind.png`, `front.png`, `manifest.json`) — 2026-10-11, 0 generations

Replace the runtime-painted SVG auras (emci: "they look bad"). Research: aura layer **behind** the
character, a few particles **in front**, 2-4 tones of one hue, tapered wisps, smooth loop. Drawn in
**greyscale** so the game keeps every tint option (sword element, named element, any #hex) with a stepped
palette map (luminance → 5-stop ramp, outline < 28 kept; reference: `scripts/sprite-gallery/build.ts`
`gradMap`). Frame counts match `data/auras.json` at 8 fps:

| Style | Look | Frames |
|---|---|---|
| blaze | flame tongues + ground ring + sparks | 8 |
| spiky | 12 bold rays turning (seamless) + outline sparks | 6 |
| rune | small ground sigil (8-point, no pentagram) + 4 runes orbiting the waist | 6 |
| bubbles | rising bubbles + soft ground glow | 6 |

### Shop & rarity (`ui/rarity/`, `ui/swords/`, `ui/shop/`) — 2026-10-11, 20 generations

Research: tier colour on frame + glow, colour is never the only signal (gem cut per tier), animated shine only
on the top tiers. `frame-base.png` (greyscale, create_ui_asset 0db9eee4-69f3-47fe-bb14-fb104e310c18, 10 gen)
palette-mapped locally to `frame-{common,rare,epic,legendary,divine}.png` (grey / blue / purple / gold /
pearl). Gems `gem-<tier>.png`: round, square, hexagon, star, winged. `shine.png/.json` = glint + twinkles loop
(free) for legendary/divine only. Swords `sword-<tier>.png` (Splinter → Brand → Cleaver → Mythblade →
Ascendant) + `relic.png` are **greyscale** → tinted per element like auras (21 elements × 5 tiers from 6
icons). Shop items `ui/shop/{dive-charge,merge-crate,shine-stone,prism-stone,star-pearl}.png` replace the stock
glyphs. Icons: one 48px create_1_direction_object batch (10 gen, object 4dda15c1-951d-466f-ac1e-146afd70a112).

### Creeps (`creeps/<slug>/`, 84 PNG each, 96×96; created at 64px)

| Creep | Character id |
|---|---|
| village-girl | 8da68657-9b0c-408d-b081-ece6da0a2d50 |
| wizard | f968dd5f-76ef-49ee-9bcb-d1631e003580 |
| knight | 2fbc9bc6-bfe4-4bfb-b40f-2cef6d14dbb8 |

### Menu UI kit (2026-10-11, batch 6)
`ui/kit/`: panel.png, button-grey.png, header.png, pieces.png (PixelLab ids in STATE.md batch 6, 80 generations). The game draws them as 9-slices from `sheets/streetwear/ui-kit/atlas.png` (`street-ui.tsx`) only while the Streetwear art style is on: panel, header plate, back button, chip on/off, toggle, and buttons primary (mustard) / secondary (concrete) / danger (red) with pressed states baked from the one grey button. Font: Pixelify Sans (OFL, `assets/play/fonts/`). Item stickers in the game: hoodie, shades, bandana, flame, marker, cap, bucket-hat, gem, coin-stack, sword, bat, shield (`STREET_ICON_BY_ART`, art.ts).

## Known issues (read before wiring)

- 2026-10-11 frame-consistency pass: all 14 template hero Idles re-made (velkhar + void-raven already were); 8 single facings rerolled once (kitsune N, elowen W, kael E/W, morwen E/W, frost-lich E/W). Morwen east idle is a 2-pose loop (her still pose hides the staff, so the model kept popping it in). Leftover PixelLab grey work-background patches cut out of 9 boss-oni frames (Walk/Run/Idle). Raven Attack south last frame (smudged) replaced by its stance frame. Old frames: `games/grove/ref/streetwear-source/rejected/`. Archangel keeps its grey wing feathers (same grey as the work background; never auto-clean it).

- Weapon Attack/Skill clips are redrawn per frame (PixelLab custom v3), so a weapon can wobble slightly between frames. For pixel-perfect weapons long term, PixelLab's own advice is to draw the weapon as a separate layer at runtime.
- Dash and Hurt are still skeleton templates; a few heroes lower or hide the weapon during them.
- North/south clips: the game plays east/west only today; north/south are for a future top-down use.
- Knight creep's side rotations read paler than its front.
- 2026-10-11: the 4 flagged icons were replaced by `ui/icons/leaf.png` (oak leaf), `price-tag.png` (blank), `chain.png` (plain), `boxing-glove.png` (create_1_direction_object, 10 gen, object f8075fcf-57e8-414e-95f2-d899b521eb89, styled on sneaker/cap/spray-can/heart). Old ones in `games/grove/ref/streetwear-source/rejected/v1-icons/`. `props/graffiti-tag-decal.png` and `ui/icons/graffiti-tag.png` are letter-like wildstyle (not readable).
- Map objects (create_map_object) were not used, so nothing here is subject to the 8-hour auto-delete.
- Tower clips are east/west only (all the engine reads for towers). Wiring = point `data/towerSkins.json` `clips` at Idle / Attack / Skill.
- Oni Warlord's east Death ends kneeling; south ends flat. Titan-X swaps its cannon arm between some directions.
- 2026-10-11: `ui/panel-frame.png`, `card-frame.png`, `health-bar.png` re-made with no drips, skull or barcode (create_ui_asset: 8d6f2575-c85d-4792-af75-81a7a184f303, 41c4d8ae-d291-4357-b711-2023ec18d6fa, bf073805-680c-4c9b-8509-05917d042d30 cropped to 591×125; 15+15+25 gen). v1 copies in `games/grove/ref/streetwear-source/rejected/v1-ui/`.
- 2026-10-11: `ui/button-pressed.png` padded locally onto the normal button's 150×68 box (centred, bottom-aligned so it reads as pushed in). Both buttons still carry red paint drips (not re-made yet).
- **Wiring risk:** `scripts/play-art-prep.ts` has `'skins'` in `FAMILIES` and `PACKED_HERO_ART` only excludes `skins/cast/heroes/`. Re-running prep as-is would bundle ~3,180 loose streetwear character frames (plus the other art) into `generated-play-assets.ts`. Widen the exclusion (and pack via `play-art-pack.ts`) in the wiring change.

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
| `fx/elements/<element>/` | 29 (+29 json) | sheets: ember/tide/root/spark/void × shot/hit/burst/status/slash, plain × shot/hit/burst/slash |
| `fx/auras/<style>/` | 8 (+4 json) | blaze/spiky/rune/bubbles × behind.png + front.png, greyscale |
| `ui/rarity/` | 12 (+1 json) | frame-base + 5 tier frames (192x192), 5 gems (48x48), shine sheet |
| `ui/swords/` | 6 | 48x48 greyscale: 5 tier swords + relic |
| `ui/shop/` | 5 | 48x48 shop item icons |
| `fx/shot-mist.png` | 1 | 32x32 |
| `fx/shot-mustard.png` | 1 | 32x32 |
| `fx/shot-red.png` | 1 | 32x32 |
| `fx/shot-white.png` | 1 | 32x32 |
| `ui/button-normal.png` | 1 | 150x68 |
| `ui/button-pressed.png` | 1 | 150x68 |
| `ui/card-frame.png` | 1 | 288x384 |
| `ui/health-bar.png` | 1 | 591x125 |
| `ui/icons/` | 56 | 32x32 |
| `ui/panel-frame.png` | 1 | 384x288 |
| `heroes/archangel/` | 176 | 192x192 — 8 rotations; E, W, N, S each: Attack 8f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `heroes/aurex/` | 176 | 192x192 — 8 rotations; E, W, N, S each: Attack 8f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `heroes/corvus/` | 176 | 192x192 — 8 rotations; E, W, N, S each: Attack 8f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `heroes/cyber-shinobi/` | 176 | 192x192 — 8 rotations; E, W, N, S each: Attack 8f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `heroes/elowen/` | 176 | 192x192 — 8 rotations; E, W, N, S each: Attack 8f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `heroes/frost-lich/` | 176 | 192x192 — 8 rotations; E, W, N, S each: Attack 8f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `heroes/kael/` | 176 | 192x192 — 8 rotations; E, W, N, S each: Attack 8f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `heroes/kitsune/` | 176 | 192x192 — 8 rotations; E, W, N, S each: Attack 8f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `heroes/maldrath/` | 176 | 192x192 — 8 rotations; E, W, N, S each: Attack 8f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `heroes/morwen/` | 176 | 192x192 — 8 rotations; E, W, N, S each: Attack 8f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `heroes/neon-viper/` | 176 | 192x192 — 8 rotations; E, W, N, S each: Attack 8f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `heroes/oni/` | 176 | 192x192 — 8 rotations; E, W, N, S each: Attack 8f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `heroes/raven/` | 168 | 192x192 — 8 rotations; E, W, N, S each: Attack 6f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `heroes/sak/` | 176 | 192x192 — 8 rotations; E, W, N, S each: Attack 8f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `heroes/velkhar/` | 176 | 192x192 — 8 rotations; E, W, N, S each: Attack 8f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `heroes/void-raven/` | 176 | 192x192 — 8 rotations; E, W, N, S each: Attack 8f, Dash 8f, Hurt 6f, Idle 4f, Skill 8f, Walk 8f |
| `towers/ghost/` | 48 | 240x240 — 8 rotations; E, W each: Attack 8f, Idle 4f, Skill 8f |
| `towers/lux/` | 48 | 244x244 — 8 rotations; E, W each: Attack 8f, Idle 4f, Skill 8f |
| `towers/viper/` | 48 | 236x236 — 8 rotations; E, W each: Attack 8f, Idle 4f, Skill 8f |
| `boss/oni/` | 120 | 264x264 — 8 rotations; E, W, N, S each: Death 8f, Idle 4f, Run 8f, Walk 8f |
| `boss/titan-x/` | 8 | 244x244 — 8 rotations |
| `creeps/knight/` | 84 | 96x96 — 8 rotations; E, W, N, S each: Death 7f, Idle 4f, Walk 8f |
| `creeps/village-girl/` | 84 | 96x96 — 8 rotations; E, W, N, S each: Death 7f, Idle 4f, Walk 8f |
| `creeps/wizard/` | 84 | 96x96 — 8 rotations; E, W, N, S each: Death 7f, Idle 4f, Walk 8f |
