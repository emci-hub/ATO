# Art library viewer

## Open it
- Desktop / Windows: double-click `assets/art/_contact/library.html` (file://, no server).
- iPhone: run `npm run art:catalog -- --portable`, then AirDrop / host
  `assets/art/_contact/library-portable.html`. One file; thumbs are inlined.
  Add to Home Screen from Safari for a full-screen library.

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
