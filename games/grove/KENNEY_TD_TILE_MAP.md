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

- **Tower upgrade = scale only.** Lv1 `0.70` · Lv2 `0.85` · Lv3 `1.0` (max).
  No level-number badges on pads.
- **Path painting:** all path cells `050`, all floor cells `024`. No corner
  autotile in this pass.
- **Combat math unchanged** — waypoints, pads, scrap, levels, ranges and
  damage are untouched; this is an art + tower-scale swap only.
- Nearest-neighbor scaling only (no blurry upscale).
- Scribble Dungeons / Primal Dynasties / Dungeon Legends / Masterpiece / Cozy
  Village are **no longer loaded for the board**; their files stay on disk.

## Where it is wired

- Tile ids: `TD_TILE` in `src/play/art.ts`
- Terrain layout: `src/play/board-decor.ts`
- Tower scale: `towerLevelScale()` in `src/play/defend-screen.tsx`
- Enemy/boss roles: `ENEMY_CAST` in `src/play/art.ts`

## Regenerating the art registry

```
npx tsx scripts/play-art-prep.ts
```
