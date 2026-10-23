# Streetwear wiring plan (replaces the missing ATO-streetwear-theme-plan.md)

Written 2026-10-11. The old plan file never existed on disk (it was only named in a pasted prompt).
Art lives in `assets/play/skins/streetwear/` (see its `MANIFEST.md`); nothing is wired yet.
Goal: Streetwear playable as a skin the player (or root) can switch on, shipped by **one OTA**,
with the current cast art staying the default until emci flips it.

## How art ships today (facts from the code)

- Every image is `require()`d, so it ships inside the app bundle and **OTA updates carry it**.
  expo-updates downloads each changed asset once per phone; unchanged assets are skipped later.
- `scripts/play-art-prep.ts` scans `assets/play/{skins,…}` and writes `src/play/generated-play-assets.ts`
  (string key → `require`). It skips only `skins/cast/heroes/**` loose frames (`PACKED_HERO_ART`).
- `scripts/play-art-pack.ts` packs one sheet **per clip** (rows = facings, 1px gutter, ≤4096px) into
  `assets/play/sheets/…` + `src/play/generated-play-sheets.ts`.
- Skins: `src/play/skin.ts` `SKIN_STACK = [cast, craftpix, kenney]`, each `skin.json` maps roles
  (`unit.*`, `tower.*`, `map.*`, `road.*`, `prop.*`, `fx.*`) to keys; `SkinRoleId` is a closed union.
- Tower clips come from `src/play/data/towerSkins.json` (`clips.idle/attack/skill`, E/W only).
- Hits draw as code SVG in `src/play/fx-layer.tsx` (comment already plans a sprite swap); hit point:
  `defend-screen.tsx` `spawnHitFx`. Tower auto-skill (`defend.ts` ~961-988) emits no visual event.
- Pet auras are painted at runtime from the sprite outline (`aura-view.tsx`, SVG); tint = sword /
  element / #hex. Shop icons are MaterialCommunityIcons glyphs (`shop-screen.tsx`).
- `check:ota-gate` has **no asset-size check** today.

## Size budget

| Part | Loose PNG today |
|---|---|
| Everything in `skins/streetwear` | 32.3 MB |
| What the game needs (E/W clips + rotations + fx/ui/map/props) | 17.4 MB |
| North/south clips (future top-down use, NOT shipped) | ~15 MB |

Packed + trimmed + compressed sheets usually land well under the loose size (cast: 19 MB loose → 12 MB
of sheets). Target: **≤ 10 MB first download** for the whole skin; measure with `npx expo export`
before publishing. Fallback if over budget: pack hero/boss frames at half size (the game draws them
far smaller than 192px), roughly a quarter of the bytes.

## Tasks (one build, one gate, one OTA)

1. **Prep safety** — widen `PACKED_HERO_ART` (or add a streetwear exclusion) so prep never `require()`s
   loose `skins/streetwear/**/animations/**` frames; north/south and `_anchor/` never enter the bundle.
2. **Pack** — extend `play-art-pack.ts` with `--skin streetwear`: one sheet per clip, **east/west rows
   only**, trimmed, `deflateLevel 9` (+ optional `npx expo-optimize`). Heroes, creeps, towers, bosses.
   Effects/auras/UI go into one atlas per group (`fx`, `auras`, `ui`) with a JSON frame map.
3. **Skin** — add `skins/streetwear/skin.json` (all roles: units, towers, bosses, map/road/props,
   `fx.shot`), measure `footAt` per character, register in `SKIN_STACK` **behind a switch**
   (default off; a root/dev toggle first, then a player setting).
4. **Towers** — point `towerSkins.json` clips at the streetwear Idle/Attack/Skill for ghost/lux/viper.
5. **Element effects** — add `fx.<element>.<kind>` roles (extend `SkinRoleId`); in `fx-layer.tsx` draw the
   sprite strip when the skin has it, else today's SVG. Per-element projectiles: add `element` to the Shot.
   Emit a `skillCast` visual event from the tower auto-skill so the burst can play. Status loops draw
   behind the unit (anchor = feet).
6. **Auras** — new `aura-sprite.tsx`: behind.png under the pet, front.png over it, coloured by a stepped
   palette map of the greyscale (same as `gradMap` in `scripts/sprite-gallery/build.ts`), keeping all
   tint options. Keep the old SVG path as fallback for low-effects mode.
7. **Shop & rarity** — item cards use `ui/rarity/frame-<tier>` + `gem-<tier>`; swords use the greyscale
   tier sword tinted per element; `shine` loop only on legendary/divine; shop items swap glyphs for
   `ui/shop/*.png`. Rarity colour is never the only signal (gem cut differs per tier).
8. **Map** — map `map.grass`/`map.pad`/`road.*`/`prop.*` to the streetwear tiles/props (board is a road
   ribbon, not Wang tiles; the 18 edge-mask road tiles cover straights + corners).
9. **Gate** — new `check:streetwear-assets`: fails if any loose streetwear frame is `require()`d, if
   north/south leaks into the bundle, or if streetwear sheets exceed the size budget. Add to
   `check:ota-gate`. Typecheck + lint + gate green.
10. **Ship** — `npx expo export` size check, then **one** `npm run ota:publish` (pull first). Device check
    on TestFlight with the switch on and off.

## Risks

- Bundle size growth for every player even with the skin off (assets are bundled, not downloaded on
  demand). If that matters, a later step can move skins to remote download + `expo-image` disk cache.
- Weapon wobble in Attack/Skill clips (redrawn per frame); long-term fix is a separate weapon layer.
- Both UI buttons still carry red drips; titan-x has no game role yet.
