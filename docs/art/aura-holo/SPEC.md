# Aura + holo rework — implementation spec

Written 2026-10-14 for the AI that implements it. Everything decided with emci in the design
session is here; nothing depends on chat history. Branch: `art/aura-holo-pixellab`.

**Read first:** `CLAUDE.md` (art library rules, fixed regions), `docs/art/PIXELLAB_GUIDE.md`,
`docs/GOTCHAS.md`. Mock-ups in this folder (open in a browser, they run offline):

| File | What it shows |
|---|---|
| `holo-mockup.html` | **The holo target.** Live on Kael's real pixels: prism bands, shine sweep + glints, foil rim, holo and reverse-holo combos, every colour picker, Reduce Motion toggle. The script is the reference implementation of every number below. |
| `aura-samples.html` | The 4 aura style samples (PixelLab), the 3 old holo options (superseded by `holo-mockup.html`) and the audit table. |
| `aura-height.html` | The aura raised 0 / 4 / 8 / 12 px. Superseded by the ground-point rule (§2), kept as evidence. |

## 1. Decisions (emci, 2026-10-14)

| # | Decision | Status |
|---|---|---|
| D1 | Auras and every floor effect centre on the pet's **ground point** (§2), not the lowest pixel. | decided |
| D2 | Aura and holo are **their own layers** that follow the pet, clipped so they never draw over UI (§3). | decided |
| D3 | Holo goes **back on the pet** as bling (§5). The card keeps only a quiet foil border. | decided |
| D4 | Holo = prism bands + shine sweep + glints. Reverse holo = foil rim + shine sweep + glints. Glints belong to the sweep only, never the rim. | decided |
| D5 | Glints may sit on the pet and up to **5 px outside it**. | decided |
| D6 | Colour pickers for prism band, foil rim, shine sweep and glint. Two groups: **Single colour** and **Mix** (§6). | decided |
| D7 | Foil rim goes all round: bright on the lit top-left, dimmer shadow rim on the bottom-right. | decided |
| Q1 | Aura look: **bold** (big silhouette shapes; recommended) or **quiet** (floor ring + motes). | **ask emci** |
| Q2 | Aura colour: **recolour** (one greyscale sheet per style, mapped to a palette ramp on device; recommended) or **bake** (style × element sheets, ~6× size). | **ask emci** |
| Q3 | How colours reach players: matched to element / pick any / buy (recommended: single colours free, mixes cost tokens like today's 150-token extra colour). | **ask emci** |

Ask Q1–Q3 in ONE message at the start, with the recommendation first, then build everything.

## 2. Ground point (D1)

Today the "feet" line is the lowest opaque row of the sprite (`footAt` in `src/play/skin.ts`,
`HERO_FOOT_AT`), and floor effects centre on it (`GlimmerGlow`/`ShinyOverlay` in
`src/play/pet-looks.tsx:190,239`, the room floor ring in `pet-room.tsx:122`). In our ¾ low top-down
camera the floor shows at half depth, so the lowest pixel is the **toe edge**; the body's weight
sits at the middle of the footprint, higher up. A ring centred on the toe edge hides its back half
behind the shoes and the pet looks like it floats.

Rule: **ground point = lowest opaque row − ½ × projected foot depth.**
- Measured on Kael (`art-src/pixellab/hero.kael.streetwear/migrated/raw/rotations/south.png`):
  figure 106 px (rows 43–148), toe edge row 147, shoe ≈ 0.28 m → 17 px → 8 px on the floor →
  footprint middle ≈ row 143 = **4 px above the lowest pixel (≈ 4 % of figure height)**.
- Standing heroes/pets: `lowest row − round(0.04 × figure height)`.
- Quadrupeds: midpoint between the front-paw and back-paw contact rows.
- Measure per sprite at pack time (`play-art-pack` / art pipeline) and store it next to `footAt`
  (e.g. `groundAt`); younger stages use the same fraction (code scales them).
- Use it for: aura floor parts, `GlimmerGlow`, `ShinyOverlay` ring, the room floor ring, the
  nameplate offset if it is measured from the ring. Pin it in a check (§8).

## 3. Layers and clipping (D2)

`PetFigure` (`src/play/pet-figure.tsx:146`) renders the box with `overflow: 'visible'`, so a large
aura spills over buttons and bars. Target stack, all inside one container that moves with the pet:

1. aura **behind** layer
2. pet sprite (+ shiny/dye recolour, tints)
3. holo layer (masked to the sprite, §5) — or reverse-holo rim behind the sprite
4. aura **front** layer
5. glints (may extend 5 px past the silhouette)

The container reserves room for the largest aura + glint halo and is **clipped to the game
viewport region** (fixed-regions kit `src/play/fixed-region.tsx`, rule
`.cursor/rules/fixed-regions.mdc`) — never the top bar, bottom panel or overlays. Holo/rim/glints
are additionally bounded by the pet box + 5 px. Content must never resize a region.

## 4. Auras

**Audit (2026-10-14):** cast aura `src/play/aura-view.tsx` `PetAura` (built from the sprite's alpha
at runtime, every pixel an SVG rect, 6–8 frames @ 8 fps via `setInterval`+`setState`, slow JS PNG
decode in `aura-png.ts`, scale `max(1, boxH/20)` = mixed pixel sizes); Streetwear `PetAuraSprite`
(greyscale atlas `assets/play/sheets/streetwear/auras/`, runtime ramp, non-integer scale
`bodyH*px/refBodyPx`); `HideoutAuraStrip` (fixed colour, `box*84/64`). Styles in
`src/play/data/auras.json`: blaze (8 f), spiky, rune, bubbles (6 f). Elements: ember, tide, root,
spark, void (+ plain); `AURA_COLORS` picker also allows sword colour / free hex. All freeze fully
when the game's Motion is off. Scores 4–6/10 look, 3–5/10 perf. Total aura+holo files ≈ 32 KB.

**New auras (PixelLab `vfx_workbench`, free):** samples saved in emci's PixelLab "My effects",
built around character `dc37a135-5822-46d1-b3a8-022ccc7c2b12` (sw-kael):

| Style | Effect id | Built from | Notes |
|---|---|---|---|
| blaze | `fb4821ec-2e9c-40a5-989a-c844b59ae7dd` | `flame_aura` height 100, width 34 | strongest; 8 f |
| rune | `82e3cd72-585c-4e2e-bbea-33b8275507b5` | `rune_circle` ×0.75 glow 0 + `rune_orbit` | disc a bit bright — lower it |
| bubbles | `cd4b16a5-542b-4c97-92be-71399437365e` | `bubble_shield` ×1.75 + `bubbles_rise` | 16 f → cut to 8 |
| spiky | `3b079883-5dad-4205-966f-d96aefdff7f3` | `lightning_arcs` + `flame_aura` | **not solved**: reads as a yellow blaze; needs a custom jagged layer (render patch) |

Build rules:
- Re-place every floor part on the **ground point** (§2), then export with `--game-pack` to get the
  behind/front pieces **without the hero**.
- Q2 = recolour: author in 4 grey steps (or recolour on export), map to a 4-colour ramp per element
  taken from `docs/art/palette-streetwear-night.png`. Max two neon hues, no black outline on glows.
- 8 frames, 8 fps, loop. Draw at integer scale only (1:1 with the 128 hero; no fractional scale).
- Render from an atlas with `ClipImage`, frame index driven on the UI thread (Reanimated), not
  per-pixel SVG rects and not `setState` per frame. Retire `aura-png.ts` decoding if unused.
- Reduce Motion: keep moving gently (slow 2-frame breathe), never fully still. Motion Off in the
  game's own setting: same gentle loop.
- Size budget: at or below today's ≈ 32 KB for aura + holo art. If the new sheets cannot fit,
  stop and tell emci the number before going over.
- Import through the art library (`npm run art:import`, `art:pack`, `art:sync`), slots via
  `src/art/skeletons.ts` (`SHEET.aura.<style>.<behind|front>`), old atlases `replaces` → archived.
  Critique ≥ 22/28, `pixelart_workbench score` ≥ 90, scale sheet next to the grown hero.

## 5. Holo on the pet (D3, D4, D5, D7)

**History:** until `69b39285` (2026-10-04, Cursor, "add a pet aura slot beside the card finish")
`PetFigure` drew `FinishSheen` on the sprite. That commit removed it ("Finishes paint the card,
never the sprite", `pet-figure.tsx:134`). The removed code (`git show 69b39285^:src/play/finish-foil.tsx`,
`FinishSheen`) proves the masking technique works with installed libs: a react-native-svg
`<Mask maskType="alpha">` built from the sprite's own drawable, content animated via
`useAnimatedProps`. Its look was weak (a soft radial blob); keep the mask, replace the look.

Card today: `src/play/finish-foil.tsx` `FinishPlate`/`FoilTexture` (SVG stripes, 28 glitter dots,
radial glare, gyro). Keep only a quiet border foil on the card; remove the art-window/face foil.

### Layers (all pixel-true: whole art pixels, no blur, no soft gradients)

| Layer | Look | Full motion | Reduce Motion |
|---|---|---|---|
| Prism bands | diagonal bands 3 art px wide, direction x+y (down-right, away from the top-left key light), coloured from the chosen ramp; strength grows with pixel lightness; near-black outline (luma < 0.07) untouched | shift 1 px every 4 ticks @ 24 fps (≈ 1/6 s) | 1 px every 16 ticks (≈ 2/3 s) |
| Shine sweep | 3-step band on `x + 0.7y`: core (72 % mix), ±1 (50 %), ±2 (24 %) | 24-tick (1 s) ease-in-out pass + 48-tick (2 s) rest | 48-tick pass + 144-tick rest |
| Glints | 7-frame 4-point star (below), fire when the sweep crosses their spot | each frame held 2 ticks (12 fps) | fade only: dot → plus(1) → dot, no pop |
| Foil rim | 1 px outside the silhouette: lit side (neighbour right or below is opaque) = ramp colour, alpha 255; shadow side (neighbour left or above) = ramp colour mixed 50 % with `#181224`, alpha 150; bands 4 px, same drift | as prism | as prism |

Holo = prism (strength ×0.26 when combined) + sweep + glints. Reverse holo = rim + sweep + glints
(the body keeps its own colours). Prism alone in the mock uses ×0.42.

**Prism strength** per pixel = `k × (0.4 + 0.6 × min(1, luma × 2.2))`. In React Native the closest
match without per-pixel code is the band layer with `mixBlendMode: 'overlay'` (or `soft-light`)
inside the sprite mask — light pixels take colour, dark outlines stay dark. Fabric supports blend
modes (`BLEND_SUPPORTED` in `src/play/pet-looks.tsx`); fallback = low-opacity wash. Compare against
`holo-mockup.html` on a device and tune opacity until it matches.

**Band ramps:** single colours (4 steps) play `0,1,2,3,3,2,1,0`; mixes play each colour twice in
order then back (`seqFor` in the mock), so nothing ever jumps from last to first.

**Glint spots** (precompute per sprite at pack time, per facing): 4 on bright pixels
(luma > 0.42) + 4 in the halo ring 2–5 px outside the silhouette, ≥ 12 px apart (Manhattan),
deterministic seed. A spot fires when the sweep line passes its `x + 0.7y` between two ticks
(not "lands exactly on" — that bug made glints invisible in v2). Cool-down 24 ticks per spot.

**Glint frames** (centre + offsets; role 0 core, 1 arm, 2 tip): f1 dot(arm) · f2 plus r1 ·
f3 plus r2 · f4 plus r3 + diagonals r1 (peak) · f5 same (held peak) · f6 plus r2 · f7 plus r1 ·
f8 dot(tip). Outer pixel of an arm longer than 1 = tip. Make the sheet in PixelLab
(`pixelart_workbench` exact drawing, or `vfx_workbench` `item_glint` as a start) as a 9×9 greyscale
3-role sheet, recoloured per glint colour. Tips over transparent ground at alpha 190.

**Implementation shape:** one `PetHolo` component in its own file (e.g. `src/play/pet-holo.tsx`),
pure maths in `src/play/pet-holo-model.ts` (ramps, sequences, sweep easing, spot picking, glint
frames) so a check can pin it. Animation on the UI thread (one shared clock, `useAnimatedProps`
translating patterns by whole art px). The mask follows the current animation frame's drawable.
Shiny/dye recolour stays; holo sits on top as it did before `69b39285`.

## 6. Colours (D6)

Prism band and foil rim (same list for both):

| id | group | name | colours (dark → light / in order) |
|---|---|---|---|
| `opal` | Single colour | Opal (default) | #d6d0f0 #e8e2fa #f4f0ff #fffcff |
| `chrome` | Single colour | Chrome | #6e7688 #aab4c6 #dce6f5 #ffffff |
| `gold` | Single colour | Gold · spark | #96601e #d29428 #ffd23f #fff2b0 |
| `ember` | Single colour | Ember | #8c3018 #d25a24 #ff9646 #ffdeb0 |
| `tide` | Single colour | Tide | #185480 #2296c8 #60d8f0 #d0f6ff |
| `root` | Single colour | Root | #225c3a #38a062 #78e09c #d6ffe2 |
| `void` | Single colour | Void | #482880 #7848c8 #b084ff #e6d8ff |
| `rose` | Single colour | Rose | #80245c #c43a8a #ff6cbe #ffd2ec |
| `spectrum` | Mix | Spectrum | #ff5cb8 #ffaa5a #fae66e #6ee6aa #4fd6ea #9678ff |
| `neon` | Mix | Neon | #ff3ea5 #b05cff #3fd0e6 |
| `oil` | Mix | Oil slick | #5c34aa #267caa #34b68c #deaa46 #cc4080 |
| `aurora` | Mix | Aurora | #3cdc96 #28bec8 #5a78e6 #aa64f0 |
| `sunset` | Mix | Sunset | #ff5a8c #ff825a #ffbe50 #ffe896 |
| `candy` | Mix | Cotton candy | #ffaad7 #e2b4ff #aad2ff #befaf0 |
| `galaxy` | Mix | Galaxy | #4632a0 #8c46dc #e65ac8 #5ac8ff |
| `fireopal` | Mix | Fire opal | #e63c46 #ff823c #ffc85a #ff96be |
| `toxic` | Mix | Toxic | #aaff3c #50e66e #28d2be |
| `pearl` | Mix | Pearl | #ffe1eb #ebf5ff #e6fff0 #fff8e1 |

Shine sweep:

| id | group | name | core | mid | outer |
|---|---|---|---|---|---|
| `white` | Single colour | White (default) | #ffffff | #fffaeb | #ebf0ff |
| `gold` | Single colour | Gold | #fff8d2 | #ffd65a | #d29428 |
| `ice` | Single colour | Ice | #f0fcff | #96e8ff | #3caadc |
| `rose` | Single colour | Rose | #fff0f8 | #ff96ce | #c84696 |
| `match` | Single colour | Match band | #ffffff | prism lightest | prism 3rd-from-last |
| `iris` | Mix | Iridescent | spectrum colour by position `floor((x − 0.4y)/5)`: core = 70 % white, mid = colour, outer = 20 % toward #1e1428 |
| `neon` | Mix | Neon edge | #ffffff | #ff5ab4 | #3fd0e6 |

Glint:

| id | name | core | arm | tip |
|---|---|---|---|---|
| `white` | White (default) | #ffffff | #fff6dc | #c8bea0 |
| `match` | Match band | #ffffff | prism lightest | prism 3rd-from-last |
| `gold` | Gold | #ffffff | #ffd65a | #be821e |
| `ice` | Ice | #ffffff | #aaf0ff | #3ca0c8 |
| `rose` | Rose | #ffffff | #ffaad6 | #c8468c |

Move all of this into data (`src/play/data/finishes.json` or a new `holo.json`), not code. Saved
pets keep working: map today's `finish_kind`/`finish_color` (moonpearl, reefglow, rosedusk,
limewake, scarab, quicksilver, starpearl) to the nearest new colour (suggested: moonpearl → opal,
reefglow → tide, rosedusk → rose, limewake → root, scarab → oil, quicksilver → chrome,
starpearl → pearl; check each against its stops) — a save migration, never a wipe. Prices and Tide Pass rules follow emci's Q3 answer.

## 7. Constraints

- OTA only: **no new native dependencies** (installed: react-native-svg 15.12.1, reanimated ~4.1.1,
  expo-image ~3.0.11; no Skia). Dependency changes need emci's ok.
- Performance on iPhone 16 Pro Max: no per-pixel React re-render; one UI-thread clock; atlases.
- Art library rules in `CLAUDE.md` (library first, import/pack/sync, skeleton slots, critique gate,
  never hand-edit generated files, archive don't delete).
- `PRE_LAUNCH_DEV` / `check:release-mode`: any dev toggle goes in the existing dev panels.
- One draft PR with before/after GIFs. **Do not merge. Do not publish an OTA.** Never print
  `EXPO_TOKEN` or any key.

## 8. Checks (all in `check:ota-gate`)

- Update `check:auras` and `check:finishes` for the new data and layers.
- New `check:pet-holo` (pure model): sequences never jump last→first; sweep easing ends at 0/1;
  glint frames match §5; every palette id has the right length and valid hex; glint spot picker is
  deterministic, ≥ 12 px apart, 4 on / 4 halo within 5 px; Reduce Motion never yields a still loop.
- Ground point: every bundled pet/hero has a measured `groundAt`, and aura floor parts +
  glimmer/shiny rings use it (not `footAt`).
- Clip: the pet layer container is inside the viewport region and has no `overflow: 'visible'`
  escape (extend `check:fixed-regions`).
- Size: aura + holo art bytes ≤ budget (§4).

## 9. Sources (research)

Pixel highlight sweep masked to a sprite: godotshaders.com "2D Highlight Improved – Pixel Perfect"
and "Highlight CanvasItem (+Sprite adaptation)"; html5gamedevs "masking a shine image".
Colour cycling: Wikipedia "Color cycling"; 80.lv on Mark Ferrari. Prismatic sprites: Stardew
Valley wiki "Prismatic Shard"; godotshaders "Sprite Sheet Compatible Rainbow Effect". Foil on
light vs dark colours: The Game Crafter "Designing for Foil". Thin-film colour order: Harvard
Science Demonstrations "Thin Film Interference". Holographic palettes: media.io, Piktochart.
Foil families: Bulbapedia "Cosmos Holofoil". Auras as their own layer, 6–8 frame loops:
Paint.NET forum, Aseprite community, Sanctum Pixel aura pack.
