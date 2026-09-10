# CAST_DROP — how to add art to the Defend cast (no per-unit TS)

The board reads **roles only** — `tower.archer`, `unit.puff`, `fx.shot`, … — from
the skin stack in `src/play/skin.ts`. Adding a new hero / unit / tower / FX (or
swapping the active pack) is content + one skin file, never new TypeScript.

## The 5-step drop recipe (hero / unit / tower / fx)

1. **Drop PNGs** into `assets/play/<pack>/…` — one file per direction/frame.
   Never feed a raw mega-sheet to the renderer: slice it into per-dir or
   per-frame PNGs first (32–64px for towers, 64–128px for units, any for FX).
2. **Register the keys** — add the pack folder to `FAMILIES` in
   `scripts/play-art-prep.ts` and run `npx tsx scripts/play-art-prep.ts`. Keys
   become `assets/play/<pack>/…` POSIX paths (extension stripped).
3. **Add a role** in the active skin `assets/play/skins/<id>/skin.json`:
   ```json
   "tower.archer": {
     "keys": ["craftpix-td/towers/archer"],
     "dirs": 1,           // 1 = rotate the PNG; 4/8 = per-dir frames
     "pivot": "center",   // or "feet"
     "units": 13,         // drawn box edge, board units (0..100 space)
     "scales": [0.7, 0.85, 1],   // per-level size (towers only)
     "clips": { "idle": 1, "walk": 4, "attack": 8 }  // frame counts
   }
   ```
   - `dirs === 1` → the renderer rotates the single PNG by
     `facingDeg + artBaseFacingDeg` (Kenney/Craftpix art faces UP).
   - `dirs === 4/8` → facing buckets to N/E/S/W (+ diagonals if 8), picks that
     dir's frame, `rotateDeg = 0`. If a pack claims 8 but a diagonal is missing,
     fall back to the nearest of 4 — always.
   - `clips.idle` required; `walk` / `attack` optional (fall back to idle).
4. **Make code read the role** — every render path already calls `skinArt(role)`
   / `skinDrawBox(role, …)`. Towers are `TOWER_ROLE` in `defend-screen.tsx`;
   units map through `BAND_UNIT_ROLE` / `bandUnitRole()`; the Avatar is
   `unit.avatar`; shots are `fx.shot`. No one-off rotate paths remain.
5. **Ship the credits line** — add the pack to `src/play/credits.ts`
   (Craftpix / Kenney / pack author, per the pack license).

## Skin stack (partial skins OK)

`SKIN_STACK = [craftpix-td, kenney-td]`. Resolution walks the stack per role, so
the active skin may define only **map + props** and everything else falls
through to `kenney-td` (which stays loadable as a complete fallback). When the
next job adds Craftpix units/towers, those roles just appear in
`craftpix-td/skin.json` and light up with no code change.

## Map roles (already dropped)

- `map.grass` — `FieldsTile_38` (olive floor), grid-tiled 8×8.
- `map.path` — ribbon stroked along the waypoint polyline, tinted with the
  role's `tone` / `casing` (FieldsTile_15 dirt).
- `map.pad` — `PlaceForTower1`, centred on each pad's world point.
- `prop.tree` / `prop.bush` / `prop.stone` / `prop.grass` / `prop.fence` —
  ground garnish from `board-decor.ts` (`MAP_PROPS`), capped ~12, verified
  ≥8 board units off the road and off pads. Props render in the `boardTiles`
  layer, under the gameplay SVG.

## Out of scope (this pass)

Craftpix units/towers/heroes (Kenney cast until map smoke passes), TMX import,
Pixel Crawler, new skill primitives, hero shop / roster UI.
