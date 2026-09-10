# Kenney Tower Defense — locked tile map (§19 supersede board cast)

Source pack: `assets/play/incoming/kenney-tower-defense.zip` (Kenney, CC0) →
`assets/play/kenney-td/towerDefense_tileNNN.png` (PNG / Default size, 64px).

Every sprite is a single **top-down** tile — no 8-way sheets — so facing is a
render transform, not a different image.

**Wayne locked these ids. Do not guess or re-pick.**

| Role | Tile | Notes |
|---|---|---|
| Grass floor | `024` | Painted under every board cell |
| Dirt path | `050` | Painted on every path cell (no corner autotile this pass) |
| Pad marker | `181` | Slot marker on each of the 6 tower pads |
| Archer tower | `249` | Art only — job/range/math unchanged |
| Vine tower | `206` | Art only |
| Crystal tower | `250` | Art only |
| Avatar | `247` | Rotated toward the nearest foe |
| Puff (normal enemy) | `245` | |
| Runner | `248` | Fast band |
| Tank | `268` | Scout / scout-mini boss bands |
| Tank alt | `269` | Semi-boss band |
| Final boss | `271` | Heavy/highest band |
| Coin | `272` | Reward FX (optional) |
| Projectile | `273` | Shot FX (optional) |

## Rules

- **Tower upgrade = scale only.** Scales live on the tower skin roles:
  Lv1 `0.70` · Lv2 `0.85` · Lv3 `1.0` (max). No level-number badges on pads.
- **Path painting:** all path cells `050`, all floor cells `024`. No corner
  autotile in this pass.
- **Align to one world space:** 0..1 path fractions and 0..100 board units
  everywhere; every sprite draws through `skinDrawBox()` (centre or feet pivot)
  so pad marker + tower + enemy + avatar + range ring + projectile share a
  centre.
- **Combat math unchanged** — waypoints, pads, scrap, levels, ranges and
  damage are untouched; this is an art + presentation swap only. Shot FX are
  display-only (the engine already applies the damage).
- Nearest-neighbor scaling only (no blurry upscale).
- Scribble Dungeons / Primal Dynasties / Dungeon Legends / Masterpiece / Cozy
  Village are **no longer loaded for the board**; their files stay on disk.

## Where it is wired

- **Skin contract:** `assets/play/skins/kenney-td/skin.json` — role → art keys +
  `dirs` / `pivot` / `units` / `scales`. Read via `getSkinRole()` / `skinArt()`
  in `src/play/skin.ts`. **Code reads roles only** (`tower.archer`, `unit.puff`,
  `fx.shot`, …) — no raw `towerDefense_tileNNN` outside this contract.
- Terrain layout: `src/play/board-decor.ts` (`map.grass` / `map.path` /
  `map.pad` roles; pad marker is CENTER-anchored on `pad.x/pad.y`).
- Entity presenter: `src/play/defend-screen.tsx` — towers turn toward their
  target (`atan2`) and fire the `fx.shot` sprite; enemies/avatar rotate by
  `skinFacingDeg`; every layer draws through `skinDrawBox()` so the pad marker,
  tower, enemy, avatar, range ring and projectile share one centre.
- Tower level scale: `scales: [0.7, 0.85, 1]` on the tower roles (`skinScale`).
- Enemy/boss roles: `BAND_UNIT_ROLE` / `bandUnitRole()` in `src/play/skin.ts`.

### Roles

`map.grass` `map.path` `map.pad` · `tower.archer` `tower.vine` `tower.crystal` ·
`unit.avatar` `unit.puff` `unit.runner` `unit.tank` `unit.tank_alt` `unit.final` ·
`fx.shot` `fx.coin`

## Regenerating the art registry

```
npx tsx scripts/play-art-prep.ts
```
