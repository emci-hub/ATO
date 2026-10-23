# Turf War T8 — more map themes (notes)

Branch `feature/turf-war-t8-themes`. Same board for every theme: 16×16 grid, `ATO_PATH`, 15 pads, tower cap 6. A theme
changes the painting only: no play, balance, economy or reward change.

## Decisions (emci, 2026-10-17)
- T7 phone check (Box 33) **passed**, no changes wanted.
- **Stop 0 → option A: a picker in Setup.** One row of theme cards inside the existing "Maps" card of the Setup sheet,
  shown on Trial and Main (Trial gets a theme-only card). Nothing new floats over the regions. Default stays the alley.
  The row is hidden while Neon Maze is picked (that board keeps its old paint).
- **New saved setting OK:** device-local `ato.play.boardTheme.v1` (AsyncStorage, same pattern as `fx-quality.ts`). No
  server, account or cloud-save change. A theme is NOT a new `boardId`, so saved tower layouts (`ato.play.layouts.v1`,
  keyed `phase:boardId`) stay shared across themes.
- A theme never changes rewards.

## Stop 1 — samples (2026-10-17)
- `scripts/turf-board-art.ts` is theme-driven: `TURF_THEMES` (one `TurfThemeSpec` per theme: art folder, tileset,
  variant skips, pad, props + ambient roles, centre dashes, light pools, vent, pigeons, `propFallback`). `alley` paints
  **byte-identical** to T3/T4 (md5 of board / glow / fire / ambient / props checked before and after).
- Raw parts: `art-src/pixellab/board.streetwear.<theme>/gen-20261017-pixellab-1/` (`raw/tileset` = pro, `raw/tileset-b`
  = standard, `raw/props`, `gen.json` with every id, prompt, score and reject).
- Sheets: `samples/stop1-<theme>.png` (alley · A · B · C at 414 px + greyscale), `samples/scale-sheet.png`, single boards
  in `samples/boards/` (`-units` = with creeps + hero, `-grey`), `samples/boards/report.json` (road vs kerb luma, props).
- PixelLab: **79 generations** (4 pro tilesets 60, 4 standard ~12, 14 props ~7); 3,806 left this cycle.
- Workbench: pro tilesets 90.5 / 96.5 / 95.1 / 99.2. Props (raw, before lock + repair): lamp 94.9, bollard 92.1,
  bench 85.8, ac 85.0, boxes 80.3, ball-rack 78.0, crate 76.0, roof-vent 66.9, bin 65.6 — picked ones go through
  palette lock + `repair` to ≥ 90 at stop 2, or are regenerated.
- Scale (vs 62 px hero, ±10 %): bollard, crate, lamp height OK; ac −23 % h, roof-vent +56 % w, bin +33 % w,
  bench −49 % h (no backrest seen), boxes −16 % h, ball-rack −12 % h → fix the picked ones before build.
- Known: the library's concrete-X pad reads as a red "no" mark (do not use it); the AC unit and the wide bin rarely fit a
  1-cell sidewalk, so the painter's `propFallback` places the next prop instead.

## Stop 1 picks (emci, 2026-10-17)
All four themes: **Rooftop C** (tar walkway + gravel, manhole pads, warm lights), **Underpass A** (damp concrete +
pale tiles, yellow safety edge, splat pads, dashes), **Court C** (asphalt path + teal hardcourt, manhole pads, cool
lights), **Docks A** (dark pier planks + concrete quay, manhole pads, dashes). "Fix the off-scale props on the way."

## Stop 2 — build
- Prop fixes (7 more generations, 86 total): roof-vent, bin, boxes, bench, ball-rack regenerated (v1 → `rejected/`);
  AC: a taller try lost its fan and a third drew a side face (wrong camera), so the compact frontal AC stays.
  Final boxes vs real size (35 px/m): bin 19×43 (0.55×0.9 m bin), roof-vent 16×36 (0.8 m vent pipe), boxes 26×22
  (two-high stack), ball-rack 29×36 (0.8 m rack), bollard 12×26, crate 26×41, lamp 15×35 — all within ±10 %;
  AC 24×30 vs a low 0.7 m condenser (−4 % w, −12 % h) and bench 46×24 front-on (−14 % h) are the known misses.
- Palette lock (local nearest-colour snap) + stray-pixel cleanup; workbench on the locked files: ac 97.0, boxes 100,
  bin 96.0, bench 96.0, ball-rack 98.7, crate 96.0, lamp 95.7, bollard 95.7, roof-vent 90.7 (before its cleanup).
  Unpicked B tilesets moved to `rejected/`.
- Packed boards (`npm run art:pack -- --skin streetwear --boards-only` + `art:sync`): `ato`, `ato-rooftop`,
  `ato-underpass`, `ato-court`, `ato-docks` (+ `-glow` / `-fire` each; flame / smoke / steam / pigeon clips shared).
  Streetwear art 7.8 MB of the 10 MB budget.
- Code: `src/play/turf-theme.ts` (ids, labels, `turfBoardArtId`), `turf-theme-store.ts` (`ato.play.boardTheme.v1`),
  `turf-theme-picker.tsx` (chips ≥ 44 pt), `defend-screen.tsx` (board image + ambient follow the theme; picker in the
  Maps card on Main, own card on Trial), `turf-ambient.tsx` (light layers per art id).
- Checks: `check:streetwear-assets` — 5 themes baked at 512 with 15 pads; T3 pixel test per theme (road / kerb luma:
  alley 30/93, rooftop 26/110, underpass 29/100, court 37/75, docks 44/95; all pad centres on pad art).
  `check:turf-war-layout` — ambient sprites clear of pads and road on every theme + a T8 group (store key, default,
  fallback, picker placement + tap size, rules / rewards files never read the theme).
- Previews (static web export, served on a fresh port with one listener, served bundle = export 10,359,655 B; theme
  seeded via localStorage; preview CSS `svg[viewBox="0 0 100 100"]{position:relative}`; SE Call wave by keyboard):
  `<theme>-max|se-setup|wave.png` for all five themes; `picker-max|se.png` (Theme row in the Setup sheet, Trial) and
  `picker-*-court.png` (tap Court → saved `court`, board switches). Wave frame time (avg rAF, 3 s, wave 1):
  430×932 alley 4.8 · rooftop 4.7 · underpass 4.7 · court 4.9 · docks 4.9 ms; 375×667 4.5 / 4.6 / 4.6 / 4.6 / 4.6 ms
  (T7 alley ≈ 4.8: no change).
- Props placed (painter, after review): rooftop ac 2 · vent 3 · lamp 2; underpass boxes 5 · bin 1 (order changed to
  cone → bin → boxes after the reviewer saw boxes only; the cone still fits no clear spot); court bench 3 · bin 3 ·
  ball-rack 1; docks bollard 6 · crate 2 (no barrel fits, so `ato-docks-fire` is an empty layer).
- Ambient per theme (meta.json): alley 3 barrels + 2 cone lamps + vent + 4 pigeons; rooftop 2 lamps + vent + 4 pigeons;
  underpass vent steam only (no pigeons by design, no cone placed); court and docks 4 pigeons each. Neon pools flicker
  on all five (4–5 pools each). Rooftop / underpass / court / docks ship an empty `-fire` layer (no barrels; harmless).
- Review (reviewer PASS): fixed the mis-encoded characters in `turf-board-art.ts` (an earlier PowerShell re-save; pixels
  unaffected, alley md5 re-checked), the underpass prop order and this note. Left as is: the tiny load-vs-tap race in
  `turf-theme-store.ts` (same pattern as `fx-quality.ts`).
