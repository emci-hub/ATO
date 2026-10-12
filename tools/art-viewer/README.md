# Art library viewer

## Open it
- Desktop / Windows: double-click `assets/art/_contact/library.html` (file://, no server).
- iPhone: run `npm run art:catalog -- --portable`, then AirDrop / host
  `assets/art/_contact/library-portable.html`. One file; previews are inlined.
  Add to Home Screen from Safari for a full-screen library.

Phone-first (research, 440pt iPhone 16 Pro Max):
- 2-column ~200pt sprite grid (Photos image-first; pixel art stays readable —
  3–4 postage stamps do not). 3 columns only ≥600pt.
- Sticky search + category chips on top (itch.io / Unity Asset Store / Figma).
  Photos iOS 26 moved Search to the thumb zone; we keep it up top so chips
  stay next to the query and the dock is not crowded (HIG: tab bars vs tools).
- Bottom dock: All | In use | Unused as peer browse modes (Photos iOS 26
  brought Library/Collections tabs back after the iOS 18 unified layout
  failed; HIG tab bars for parallel sections). Filters + More are sheets.
- Detail is a full-screen large-detent sheet (HIG: full height when the
  content needs the room). Play sits on the preview (Photos video / Aseprite).
  Swipe L/R for next item, swipe down to close. 48pt decision bar stays in
  the thumb zone (HIG 44pt minimum; tagging is the job, so chrome does not fade).

Grid tiles show a **preview**, not the packed sheet:
- Sheets / clips: Idle frame 0 (or Walk S/front). Animate on Play / hover / hold.
- Stills: the image. Icon atlases: sprites, not the packed sheet.
- Autoplay previews (default off) lives in Filters and localStorage.

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
