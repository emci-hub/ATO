# Art library viewer

## Open it
- Desktop / Windows: double-click `assets/art/_contact/library.html` (file://, no server).
- iPhone: run `npm run art:catalog -- --portable`, then AirDrop / host
  `assets/art/_contact/library-portable.html`. One file; previews are inlined.
  Add to Home Screen from Safari for a full-screen library.

Grid tiles show a **preview**, not the packed sheet:
- Sheets / clips: the best still (Idle frame 0, or Walk S/front for heroes).
  Animation stays off until Play, hover (desktop), or press-and-hold (iPhone).
  “Autoplay previews” (default off) is saved in localStorage.
- Stills: the image, scaled to fit.
- Multi-icon atlases: the sprites individually (mosaic on the tile).

Tap a tile for clip + direction pickers, play/pause (opens paused), a frame
scrubber, swipe through frames and prev/next items, 1×/2×/4× zoom, and a
secondary “show raw sheet” toggle.

This extends the earlier Streetwear Skin artifact at `scripts/sprite-gallery/`
(Claude artifact https://claude.ai/artifact/9wjcLv4FQu4S8dwqT2RBho). That page
is still the live Streetwear *skin* contact sheet. This viewer is the **full**
library: every registry item, decisions, duplicates, memory.

## Decisions
Keep / use / needs-restyle / remove persist in `localStorage`.
Export (Share on iOS, download elsewhere) writes `art-decisions.json`.
Import merges a previously exported file (imported ids win).

Apply on the machine: copy the JSON to `assets/art/art-decisions.json`, then
`npm run art:apply-decisions` (dry-run) or `npm run art:apply-decisions -- --apply`.

Regenerate: `npm run art:catalog` · portable: `npm run art:catalog -- --portable`
