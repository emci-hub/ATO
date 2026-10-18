# Turf War — art loose ends (2026-10-18)

emci's picks from `samples/index.html` (stop 1): **sign size A (24 px)**, bolt by the cyan pool + heart by the magenta pool; **pigeon A**; **card icons A**.

- **Neon signs** — new (the library had none). PixelLab `create_1_direction_object` size 24 (object `c9020419…`, candidates 0 and 1), palette-locked to
  `docs/art/palette-streetwear-night.png`, then `pixelart_workbench repair`: heart 97.7, bolt 88.2 (lint 0 errors; the gap is 1–2 px specks of its faded
  frame). 20 × 20 art px against the 21 × 21 target (0.6 m at the 62 px board hero). Baked by `scripts/turf-board-art.ts` (alley only): unlit (× 0.45)
  into the board, lit into the glow layer inside its pool's crop, so it flickers with that pool at no runtime cost. Placed on the free sidewalk spot
  nearest the pool (no road cell within 2 px, clear of pads and props, no random calls). Landed: bolt on the top sidewalk by the cyan pool, heart on the
  bottom sidewalk by the magenta pool (the magenta corner itself is road + a pad + a barrel, so the search reaches 1.75 × the pool radius).
  `crop-*-lit.png` / `crop-cyan-unlit.png` = 3× crops of the painted board; `board-lit.png` = the whole board with the glow layer on.
- **Pigeon wings** — an edit of the existing pigeon (`animate_image`, 1 generation): `ato-pigeon` is now 5 frames (perch + 4 wing frames, 20 × 26,
  anchor = the perch's feet). `turf-ambient.tsx` plays frames 1–4 at 12 fps while it flies off; the old squash is gone. Reduce Motion = fade only,
  quality Off / Motion Off = perched. Wing frames were brightness-mapped onto the perch's own colours.
- **Card icons** — no new art: each chip crops the role's own board sprite (south) to head + shoulders, 18 pt with a 2 pt role-colour underline; the
  role word stays. Figure boxes per unit live in `turf-wave-peek.ts` (`WAVE_PEEK_FIGURE`) and are pinned against the packed atlas by
  `check:turf-war-layout`. The semi boss (kenney art) keeps its swatch.
- Web preview (430 × 932): both signs show on the board; the card shows the Village Girl and Wizard faces on "Next · wave 2". Not shot: a pigeon
  mid-flap (needs a creep to pass close) and a boss / 3-role card. Not device-verified.
- PixelLab generations: 23 (signs 20, pigeon 3).
