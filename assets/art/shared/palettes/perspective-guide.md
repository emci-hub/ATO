# Perspective guide — one camera for everything

ATO rooms, props, heroes and pets share **one camera**: `td-3q-low` (Layout A).

- **View:** 3/4 low top-down. Draw the **top + front**. Never a side face, never a true isometric diamond.
- **Light:** from the top-left. Shadow falls down-right.
- **Footprint = collision.** A prop's floor contact is the tile footprint the walker collides with (`footprintTiles`, 12 px tiles).
- **Tall props get occluders.** Anything a hero can walk behind needs an occluder layer (front-occluder).
- **Size to the FINAL hero.** The grown (god) hero is **53 art px** tall. Props do not scale with pet/hero evolution stage. `heroRelativeHeight` is bbox height / 53.
- **Streetwear palette** on streetwear screens. ≤256 colours per sheet (PNG-8). Off-style packs (kenney, craftpix, scribble, primal, dungeon-legends, classic) are `needs-restyle` — do not place them in new streetwear rooms; regenerate in PixelLab.
- **Art is 1×.** Display at integer multiples of art px. Never ship @2x/@3x pixel art.

See `assets/art/registry.json` and `ART_LIBRARY.md` before making anything new.
