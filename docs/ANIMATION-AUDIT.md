# ATO Play / Divecore — Animation Audit

**Phase 0 — inventory (read-only).** Branch `claude/happy-fermi-k9x2um`. Nothing in `src/` or `assets/` was changed.
Generated from `assets/art/legacy-play-sheets.json`, `assets/play/sheets/streetwear/meta.json`, `assets/art/registry.json` and the renderer source. Every number below is read from those files, not guessed. Items marked **lead** are suspicions from reading code; Phase 1 will confirm them by rendering.

## 0. Headline findings

1. **Two parallel sprite systems.** 16 streetwear heroes + 3 creeps + 3 towers + 2 bosses use packed atlases (`PLAY_SHEETS`); a second, older **Cast** skin (105 hero, 14 creep, 6 boss, 3 tower atlas entries incl. rotations) is still bundled and flagged `needs-restyle` in CLAUDE.md. `registry.json` has **0 entries with `clips`** — animation data lives only in `legacy-play-sheets.json` + `meta.json`, so the art registry cannot answer "what animates".
2. **Every streetwear hero has an identical kit**: Idle 4f · Walk 8f × 4 dirs (N/E/S/W) · Attack 8f · Skill 8f · Dash 8f · Hurt 6f · Faint 7f, all combat clips **east/west only**. Only outlier: `raven` Attack is 6f (others 8). Idle is just 4 frames.
3. **Pets have no animations of their own.** A pet is a hero or creep (`petLookFor`) played through the hero clip kit (idle/walk/dash/attack/skill/hurt). No blink, eat, sleep, react, hop, or evolve clip exists; "sleep" is the idle slowed 3× (`PET_SLEEP_SLOWDOWN`); egg is a vector shape. Growth stages differ only by scale (`PET_STAGE_SCALE` 0.55 → 1.45, non-integer).
4. **Flat timing.** Streetwear character clips carry one uniform value per mode (`CAST_ACTOR_FRAME_MS`: idle 120, walk 100, dash 50, attack 65, skill 70, hurt 140; pets 140/110/60/80/85/140). No per-frame holds anywhere in the data format.
5. **Pet clock mismatch (lead, real code issue).** `pet-anim-sprite.tsx` ticks a shared clock every **100 ms** but `PET_FRAME_MS` asks for 60/80/85/110/140 ms frames. `petFrameAt` samples wall-clock on those ticks, so a 60 ms dash advances ~1.7 frames per tick → **skipped frames**, and 110/140 ms frames show uneven holds.
6. **No loop flag for characters.** Loop vs one-shot is decided in code by clip name/mode; only FX/auras/ambient carry `loop` in `meta.json`.
7. ~~`reduceMotion` coverage is patchy~~ **Corrected in Phase 2:** my grep only looked for the words `reduceMotion`/`reducedMotion`. The repo's policy (`play-motion.ts`: `vestibularSafe` / `cosmeticsStill`) is plumbed through props (`alive`, `still`, `animate`, `mode`) from each parent screen, so `pixel-fx`, `pixel-ambient`, `turf-ambient`, `street-ambient`, `dive-street`, `dive-world`, `turf-combat-fx`, `turf-beat-fx`, `score-burst` and `pet-games` are all covered. Not a defect.
8. **`titan-x` boss and `towers` have rotations only / no walk** — titan-x has zero animation clips.
9. **Pixel-crisp rendering is web-only (lead).** `pixelRenderStyle = { imageRendering: 'pixelated' }` is a CSS property; on native iOS `expo-image` / `react-native-svg <Image>` ignore it. `SheetSprite` also scales by `size / rect.w` (non-integer). Phase 1 must check what actually renders on device.
10. **Parallel work to coordinate:** remote branches `origin/art/aura-holo-impl` and `origin/art/aura-holo-pixellab` are not in master — they likely touch auras / `pet-holo`. I will not edit those areas without checking them first.

## 1. Rendering pipeline (who plays what)

| Layer | File | How it animates | Clock / timing |
|---|---|---|---|
| Atlas data | `assets/art/legacy-play-sheets.json` → `src/play/generated-play-sheets.ts` | frame rects (`east/frame_000`…) per clip; trim offset per clip | `ms` (100) only on 128 streetwear combat entries |
| Char meta | `assets/play/sheets/streetwear/meta.json` | `footAt`, `groundAt`, `bodyRatio`, clip frame counts, `walkOrder` | — |
| Frame draw (SVG board) | `src/play/sheet-sprite.tsx` `SheetSprite`/`ClipSprite` | translate+scale+clip of the whole atlas inside react-native-svg | scale = size/rect.w (non-integer) |
| Frame draw (overlay) | same file, `ClipImage` | expo-image, % crop inside overflow-hidden View | `contentFit="fill"`, `pixelRenderStyle` |
| Clip player | `src/play/cast-actor.ts` | priority ladder, wall-clock one-shots, idle phase seed; modes avatar / path / tower | `CAST_ACTOR_FRAME_MS` |
| Pet player | `src/play/pet-actor.ts` + `pet-anim-sprite.tsx` | `petFrameAt(kit, pose, elapsed, loop, slow)` | one shared `setInterval` 100 ms; cleared when last listener leaves ✔ |
| Role/clip resolve | `src/play/skin.ts` | roles, `directionalClipDrawable`, walk-dir snap (`skin-walk-dir.ts`) | — |
| Skeleton/art lookup | `src/art/skeletons.ts` | names art by slot | — |
| FX | `fx-layer.tsx`, `pixel-fx.tsx`, `turf-combat-fx.tsx`, `turf-beat-fx.tsx`, `score-burst.tsx`, `dev-fx-stress.tsx` | atlas clips + Reanimated | `meta.json › fx` fps |
| Auras | `aura-view.tsx`, `aura-png.ts`, `auras.ts` | `withRepeat(withTiming(frames…))` frame stepping | `meta.json › auras` fps; GENTLE reduce path ✔ |
| Ambient (board) | `turf-ambient.tsx`, `street-ambient.tsx`, `pixel-ambient.tsx` | clips + Reanimated loops | `meta.json › boards` fps |

## 2. Per-character summary (streetwear, one row per character)

| Character | Idle | Walk (N/E/S/W) | Attack | Skill | Dash | Hurt | Faint/Death | Run | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 16 heroes: archangel, aurex, corvus, cyber-shinobi, elowen, frost-lich, kael, kitsune, maldrath, morwen, neon-viper, oni, raven, sak, velkhar, void-raven | 4f (E/W) | 8f ×4 | 8f E/W (**raven 6f**) | 8f E/W | 8f E/W | 6f E/W | Faint 7f E/W | — | no victory, no fight-stance, no run, no special/throw distinct from Skill |
| creeps: knight, village-girl, wizard | 4f | 8f E/W only | — | — | — | — | Death 7f | — | no attack/hit/spawn; wizard/village-girl have 2 atlas pages |
| towers: ghost, lux, viper | 4f | — | 8f | 8f | — | — | — | — | no hit/death/spawn |
| boss/oni | 4f | 8f E/W | — | — | — | — | Death 8f | Run 8f | |
| boss/titan-x | — | — | — | — | — | — | — | — | **no clips at all (rotations atlas only)** |

Frames per direction. "E/W" = east+west only (west is mirrored art packed separately, not a runtime flip).

## 3. Character clips (legacy PLAY_SHEETS — `assets/art/legacy-play-sheets.json`)

Loop mode is **inferred from the clip name** (the sheet data has no loop flag for characters; `cast-actor.ts` loops `idle`/`walk` and plays the rest once). Treat `one-shot?` as unknown.

### 3a. Streetwear skin (heroes, creeps, towers, boss)

| Asset | Clip | Sheet | Packed frame (w×h) | Cell (src, offset) | Frames/dir | Dirs | ms/frame (fps) | Loop | Anchor (foot / ground) | Renderer |
|---|---|---|---|---|---|---|---|---|---|---|
| boss/oni | Death | `sheets/streetwear/boss/oni/atlas.png` | 264×264 | — | 8 | east,west | — | one-shot | 0.8523 / 0.8258 | defend-screen / cast-actor |
| boss/oni | Idle | `sheets/streetwear/boss/oni/atlas.png` | 264×264 | — | 4 | east,west | — | loop | 0.8523 / 0.8258 | defend-screen / cast-actor |
| boss/oni | Run | `sheets/streetwear/boss/oni/atlas.png` | 264×264 | — | 8 | east,west | — | loop | 0.8523 / 0.8258 | defend-screen / cast-actor |
| boss/oni | Walk | `sheets/streetwear/boss/oni/atlas.png` | 264×264 | — | 8 | east,west | — | loop | 0.8523 / 0.8258 | defend-screen / cast-actor |
| boss/oni | rotations | `sheets/streetwear/boss/oni/atlas.png` | 264×264 | — | 8 | — | — | n/a (static rotation) | 0.8523 / 0.8258 | defend-screen / cast-actor |
| boss/titan-x | rotations | `sheets/streetwear/boss/titan-x/atlas.png` | 244×244 | — | 8 | — | — | n/a (static rotation) | 0.7787 / 0.7582 | defend-screen / cast-actor |
| creeps/knight | Death | `sheets/streetwear/creeps/knight/atlas.png` | 96×96 | — | 7 | east,west | — | one-shot | 0.7292 / 0.7083 | defend-screen / cast-actor |
| creeps/knight | Idle | `sheets/streetwear/creeps/knight/atlas.png` | 96×96 | — | 4 | east,west | — | loop | 0.7292 / 0.7083 | defend-screen / cast-actor |
| creeps/knight | Walk | `sheets/streetwear/creeps/knight/atlas.png` | 96×96 | — | 8 | east,west | — | loop | 0.7292 / 0.7083 | defend-screen / cast-actor |
| creeps/knight | rotations | `sheets/streetwear/creeps/knight/atlas.png` | 96×96 | — | 8 | — | — | n/a (static rotation) | 0.7292 / 0.7083 | defend-screen / cast-actor |
| creeps/village-girl | Death | `sheets/streetwear/creeps/village-girl/atlas.png` | 96×96 | — | 7 | east,west | — | one-shot | 0.7708 / 0.75 | defend-screen / cast-actor |
| creeps/village-girl | Idle | `sheets/streetwear/creeps/village-girl/atlas.png` | 96×96 | — | 4 | east,west | — | loop | 0.7708 / 0.75 | defend-screen / cast-actor |
| creeps/village-girl | Walk | `sheets/streetwear/creeps/village-girl/atlas.png` | 96×96 | — | 8 | east,west | — | loop | 0.7708 / 0.75 | defend-screen / cast-actor |
| creeps/village-girl | rotations | `sheets/streetwear/creeps/village-girl/atlas.png` | 96×96 | — | 8 | — | — | n/a (static rotation) | 0.7708 / 0.75 | defend-screen / cast-actor |
| creeps/wizard | Death | `sheets/streetwear/creeps/wizard/atlas.png` | 96×96 | — | 7 | east,west | — | one-shot | 0.7396 / 0.7188 | defend-screen / cast-actor |
| creeps/wizard | Idle | `sheets/streetwear/creeps/wizard/atlas.png` | 96×96 | — | 4 | east,west | — | loop | 0.7396 / 0.7188 | defend-screen / cast-actor |
| creeps/wizard | Walk | `sheets/streetwear/creeps/wizard/atlas.png` | 96×96 | — | 8 | east,west | — | loop | 0.7396 / 0.7188 | defend-screen / cast-actor |
| creeps/wizard | rotations | `sheets/streetwear/creeps/wizard/atlas.png` | 96×96 | — | 8 | — | — | n/a (static rotation) | 0.7396 / 0.7188 | defend-screen / cast-actor |
| heroes/archangel | Attack | `art/heroes/in-use/archangel/streetwear/hero_archangel_streetwear.combat.png` | 132×122 | 192×192 @(25,36) | 8 | east,west | 100 (10) | one-shot | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/archangel | Dash | `art/heroes/in-use/archangel/streetwear/hero_archangel_streetwear.combat.png` | 157×119 | 192×192 @(22,44) | 8 | east,west | 100 (10) | one-shot | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/archangel | Faint | `art/heroes/in-use/archangel/streetwear/hero_archangel_streetwear.combat.png` | 141×130 | 192×192 @(19,28) | 7 | east,west | 100 (10) | one-shot | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/archangel | Hurt | `art/heroes/in-use/archangel/streetwear/hero_archangel_streetwear.combat.png` | 124×111 | 192×192 @(31,48) | 6 | east,west | 100 (10) | one-shot | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/archangel | Idle | `art/heroes/in-use/archangel/streetwear/hero_archangel_streetwear.core.png` | 105×109 | 192×192 @(43,49) | 4 | east,west | 150 (7) | loop | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/archangel | Skill | `art/heroes/in-use/archangel/streetwear/hero_archangel_streetwear.combat.png` | 127×122 | 192×192 @(33,37) | 8 | east,west | 100 (10) | one-shot | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/archangel | Walk | `art/heroes/in-use/archangel/streetwear/hero_archangel_streetwear.core.png` | 159×113 | 192×192 @(19,47) | 8 | north,east,south,west | 100 (10) | loop | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/archangel | rotations | `art/heroes/in-use/archangel/streetwear/hero_archangel_streetwear.core.png` | 118×110 | 192×192 @(37,48) | 8 | — | 100 (10) | n/a (static rotation) | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/aurex | Attack | `art/heroes/in-use/aurex/streetwear/hero_aurex_streetwear.combat.png` | 131×113 | 192×192 @(30,41) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/aurex | Dash | `art/heroes/in-use/aurex/streetwear/hero_aurex_streetwear.combat.png` | 131×119 | 192×192 @(28,41) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/aurex | Faint | `art/heroes/in-use/aurex/streetwear/hero_aurex_streetwear.combat.png` | 130×120 | 192×192 @(33,34) | 7 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/aurex | Hurt | `art/heroes/in-use/aurex/streetwear/hero_aurex_streetwear.combat.png` | 114×124 | 192×192 @(42,30) | 6 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/aurex | Idle | `art/heroes/in-use/aurex/streetwear/hero_aurex_streetwear.core.png` | 92×113 | 192×192 @(51,41) | 4 | east,west | 150 (7) | loop | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/aurex | Skill | `art/heroes/in-use/aurex/streetwear/hero_aurex_streetwear.combat.png` | 115×116 | 192×192 @(36,38) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/aurex | Walk | `art/heroes/in-use/aurex/streetwear/hero_aurex_streetwear.core.png` | 127×118 | 192×192 @(36,40) | 8 | north,east,south,west | 100 (10) | loop | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/aurex | rotations | `art/heroes/in-use/aurex/streetwear/hero_aurex_streetwear.core.png` | 109×109 | 192×192 @(41,45) | 8 | — | 100 (10) | n/a (static rotation) | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/corvus | Attack | `art/heroes/in-use/corvus/streetwear/hero_corvus_streetwear.combat.png` | 116×119 | 192×192 @(38,38) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/corvus | Dash | `art/heroes/in-use/corvus/streetwear/hero_corvus_streetwear.combat.png` | 112×122 | 192×192 @(44,39) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/corvus | Faint | `art/heroes/in-use/corvus/streetwear/hero_corvus_streetwear.combat.png` | 133×110 | 192×192 @(34,45) | 7 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/corvus | Hurt | `art/heroes/in-use/corvus/streetwear/hero_corvus_streetwear.combat.png` | 101×117 | 192×192 @(41,39) | 6 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/corvus | Idle | `art/heroes/in-use/corvus/streetwear/hero_corvus_streetwear.core.png` | 85×114 | 192×192 @(48,41) | 4 | east,west | 150 (7) | loop | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/corvus | Skill | `art/heroes/in-use/corvus/streetwear/hero_corvus_streetwear.combat.png` | 126×124 | 192×192 @(34,36) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/corvus | Walk | `art/heroes/in-use/corvus/streetwear/hero_corvus_streetwear.core.png` | 120×115 | 192×192 @(31,43) | 8 | north,east,south,west | 100 (10) | loop | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/corvus | rotations | `art/heroes/in-use/corvus/streetwear/hero_corvus_streetwear.core.png` | 107×114 | 192×192 @(42,41) | 8 | — | 100 (10) | n/a (static rotation) | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/cyber-shinobi | Attack | `art/heroes/in-use/cyber-shinobi/streetwear/hero_cyber-shinobi_streetwear.combat.png` | 114×113 | 192×192 @(35,40) | 8 | east,west | 100 (10) | one-shot | 0.7865 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/cyber-shinobi | Dash | `art/heroes/in-use/cyber-shinobi/streetwear/hero_cyber-shinobi_streetwear.combat.png` | 93×117 | 192×192 @(50,41) | 8 | east,west | 100 (10) | one-shot | 0.7865 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/cyber-shinobi | Faint | `art/heroes/in-use/cyber-shinobi/streetwear/hero_cyber-shinobi_streetwear.combat.png` | 132×110 | 192×192 @(37,43) | 7 | east,west | 100 (10) | one-shot | 0.7865 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/cyber-shinobi | Hurt | `art/heroes/in-use/cyber-shinobi/streetwear/hero_cyber-shinobi_streetwear.combat.png` | 87×113 | 192×192 @(52,41) | 6 | east,west | 100 (10) | one-shot | 0.7865 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/cyber-shinobi | Idle | `art/heroes/in-use/cyber-shinobi/streetwear/hero_cyber-shinobi_streetwear.core.png` | 55×113 | 192×192 @(70,40) | 4 | east,west | 150 (7) | loop | 0.7865 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/cyber-shinobi | Skill | `art/heroes/in-use/cyber-shinobi/streetwear/hero_cyber-shinobi_streetwear.combat.png` | 114×114 | 192×192 @(38,39) | 8 | east,west | 100 (10) | one-shot | 0.7865 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/cyber-shinobi | Walk | `art/heroes/in-use/cyber-shinobi/streetwear/hero_cyber-shinobi_streetwear.core.png` | 85×118 | 192×192 @(55,38) | 8 | north,east,south,west | 100 (10) | loop | 0.7865 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/cyber-shinobi | rotations | `art/heroes/in-use/cyber-shinobi/streetwear/hero_cyber-shinobi_streetwear.core.png` | 80×115 | 192×192 @(58,39) | 8 | — | 100 (10) | n/a (static rotation) | 0.7865 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/elowen | Attack | `art/heroes/in-use/elowen/streetwear/hero_elowen_streetwear.combat.png` | 127×123 | 192×192 @(32,35) | 8 | east,west | 100 (10) | one-shot | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/elowen | Dash | `art/heroes/in-use/elowen/streetwear/hero_elowen_streetwear.combat.png` | 128×111 | 192×192 @(24,52) | 8 | east,west | 100 (10) | one-shot | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/elowen | Faint | `art/heroes/in-use/elowen/streetwear/hero_elowen_streetwear.combat.png` | 130×124 | 192×192 @(39,34) | 7 | east,west | 100 (10) | one-shot | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/elowen | Hurt | `art/heroes/in-use/elowen/streetwear/hero_elowen_streetwear.combat.png` | 98×112 | 192×192 @(46,48) | 6 | east,west | 100 (10) | one-shot | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/elowen | Idle | `art/heroes/in-use/elowen/streetwear/hero_elowen_streetwear.core.png` | 97×118 | 192×192 @(49,40) | 4 | east,west | 150 (7) | loop | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/elowen | Skill | `art/heroes/in-use/elowen/streetwear/hero_elowen_streetwear.combat.png` | 130×124 | 192×192 @(34,34) | 8 | east,west | 100 (10) | one-shot | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/elowen | Walk | `art/heroes/in-use/elowen/streetwear/hero_elowen_streetwear.core.png` | 131×117 | 192×192 @(32,45) | 8 | north,east,south,west | 100 (10) | loop | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/elowen | rotations | `art/heroes/in-use/elowen/streetwear/hero_elowen_streetwear.core.png` | 108×113 | 192×192 @(48,45) | 8 | — | 100 (10) | n/a (static rotation) | 0.8177 / 0.7969 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/frost-lich | Attack | `art/heroes/in-use/frost-lich/streetwear/hero_frost-lich_streetwear.combat.png` | 131×116 | 192×192 @(27,37) | 8 | east,west | 100 (10) | one-shot | 0.7917 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/frost-lich | Dash | `art/heroes/in-use/frost-lich/streetwear/hero_frost-lich_streetwear.combat.png` | 153×117 | 192×192 @(13,41) | 8 | east,west | 100 (10) | one-shot | 0.7917 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/frost-lich | Faint | `art/heroes/in-use/frost-lich/streetwear/hero_frost-lich_streetwear.combat.png` | 144×125 | 192×192 @(25,28) | 7 | east,west | 100 (10) | one-shot | 0.7917 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/frost-lich | Hurt | `art/heroes/in-use/frost-lich/streetwear/hero_frost-lich_streetwear.combat.png` | 96×117 | 192×192 @(49,37) | 6 | east,west | 100 (10) | one-shot | 0.7917 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/frost-lich | Idle | `art/heroes/in-use/frost-lich/streetwear/hero_frost-lich_streetwear.core.png` | 101×118 | 192×192 @(44,35) | 4 | east,west | 150 (7) | loop | 0.7917 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/frost-lich | Skill | `art/heroes/in-use/frost-lich/streetwear/hero_frost-lich_streetwear.combat.png` | 123×132 | 192×192 @(31,37) | 8 | east,west | 100 (10) | one-shot | 0.7917 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/frost-lich | Walk | `art/heroes/in-use/frost-lich/streetwear/hero_frost-lich_streetwear.core.png` | 139×121 | 192×192 @(20,36) | 8 | north,east,south,west | 100 (10) | loop | 0.7917 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/frost-lich | rotations | `art/heroes/in-use/frost-lich/streetwear/hero_frost-lich_streetwear.core.png` | 121×116 | 192×192 @(36,37) | 8 | — | 100 (10) | n/a (static rotation) | 0.7917 / 0.7656 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kael | Attack | `art/heroes/in-use/kael/streetwear/hero_kael_streetwear.combat.png` | 135×111 | 192×192 @(35,41) | 8 | east,west | 100 (10) | one-shot | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kael | Dash | `art/heroes/in-use/kael/streetwear/hero_kael_streetwear.combat.png` | 121×106 | 192×192 @(25,48) | 8 | east,west | 100 (10) | one-shot | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kael | Faint | `art/heroes/in-use/kael/streetwear/hero_kael_streetwear.combat.png` | 127×105 | 192×192 @(36,46) | 7 | east,west | 100 (10) | one-shot | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kael | Hurt | `art/heroes/in-use/kael/streetwear/hero_kael_streetwear.combat.png` | 87×108 | 192×192 @(51,43) | 6 | east,west | 100 (10) | one-shot | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kael | Idle | `art/heroes/in-use/kael/streetwear/hero_kael_streetwear.core.png` | 75×109 | 192×192 @(61,42) | 4 | east,west | 150 (7) | loop | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kael | Skill | `art/heroes/in-use/kael/streetwear/hero_kael_streetwear.combat.png` | 112×110 | 192×192 @(36,41) | 8 | east,west | 100 (10) | one-shot | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kael | Walk | `art/heroes/in-use/kael/streetwear/hero_kael_streetwear.core.png` | 121×115 | 192×192 @(36,39) | 8 | north,east,south,west | 100 (10) | loop | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kael | rotations | `art/heroes/in-use/kael/streetwear/hero_kael_streetwear.core.png` | 95×110 | 192×192 @(49,41) | 8 | — | 100 (10) | n/a (static rotation) | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kitsune | Attack | `art/heroes/in-use/kitsune/streetwear/hero_kitsune_streetwear.combat.png` | 99×116 | 192×192 @(49,38) | 8 | east,west | 100 (10) | one-shot | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kitsune | Dash | `art/heroes/in-use/kitsune/streetwear/hero_kitsune_streetwear.combat.png` | 109×112 | 192×192 @(41,44) | 8 | east,west | 100 (10) | one-shot | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kitsune | Faint | `art/heroes/in-use/kitsune/streetwear/hero_kitsune_streetwear.combat.png` | 121×112 | 192×192 @(38,41) | 7 | east,west | 100 (10) | one-shot | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kitsune | Hurt | `art/heroes/in-use/kitsune/streetwear/hero_kitsune_streetwear.combat.png` | 84×114 | 192×192 @(60,39) | 6 | east,west | 100 (10) | one-shot | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kitsune | Idle | `art/heroes/in-use/kitsune/streetwear/hero_kitsune_streetwear.core.png` | 83×114 | 192×192 @(54,39) | 4 | east,west | 150 (7) | loop | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kitsune | Skill | `art/heroes/in-use/kitsune/streetwear/hero_kitsune_streetwear.combat.png` | 85×114 | 192×192 @(53,39) | 8 | east,west | 100 (10) | one-shot | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kitsune | Walk | `art/heroes/in-use/kitsune/streetwear/hero_kitsune_streetwear.core.png` | 112×117 | 192×192 @(40,37) | 8 | north,east,south,west | 100 (10) | loop | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kitsune | rotations | `art/heroes/in-use/kitsune/streetwear/hero_kitsune_streetwear.core.png` | 111×114 | 192×192 @(43,39) | 8 | — | 100 (10) | n/a (static rotation) | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/maldrath | Attack | `art/heroes/in-use/maldrath/streetwear/hero_maldrath_streetwear.combat.png` | 120×118 | 192×192 @(33,36) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/maldrath | Dash | `art/heroes/in-use/maldrath/streetwear/hero_maldrath_streetwear.combat.png` | 153×116 | 192×192 @(11,40) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/maldrath | Faint | `art/heroes/in-use/maldrath/streetwear/hero_maldrath_streetwear.combat.png` | 155×122 | 192×192 @(17,32) | 7 | east,west | 100 (10) | one-shot | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/maldrath | Hurt | `art/heroes/in-use/maldrath/streetwear/hero_maldrath_streetwear.combat.png` | 103×121 | 192×192 @(48,35) | 6 | east,west | 100 (10) | one-shot | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/maldrath | Idle | `art/heroes/in-use/maldrath/streetwear/hero_maldrath_streetwear.core.png` | 103×118 | 192×192 @(44,36) | 4 | east,west | 150 (7) | loop | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/maldrath | Skill | `art/heroes/in-use/maldrath/streetwear/hero_maldrath_streetwear.combat.png` | 128×118 | 192×192 @(26,36) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/maldrath | Walk | `art/heroes/in-use/maldrath/streetwear/hero_maldrath_streetwear.core.png` | 140×122 | 192×192 @(29,34) | 8 | north,east,south,west | 100 (10) | loop | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/maldrath | rotations | `art/heroes/in-use/maldrath/streetwear/hero_maldrath_streetwear.core.png` | 124×118 | 192×192 @(34,36) | 8 | — | 100 (10) | n/a (static rotation) | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/morwen | Attack | `art/heroes/in-use/morwen/streetwear/hero_morwen_streetwear.combat.png` | 112×111 | 192×192 @(43,41) | 8 | east,west | 100 (10) | one-shot | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/morwen | Dash | `art/heroes/in-use/morwen/streetwear/hero_morwen_streetwear.combat.png` | 98×110 | 192×192 @(40,43) | 8 | east,west | 100 (10) | one-shot | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/morwen | Faint | `art/heroes/in-use/morwen/streetwear/hero_morwen_streetwear.combat.png` | 128×106 | 192×192 @(32,45) | 7 | east,west | 100 (10) | one-shot | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/morwen | Hurt | `art/heroes/in-use/morwen/streetwear/hero_morwen_streetwear.combat.png` | 97×110 | 192×192 @(50,42) | 6 | east,west | 100 (10) | one-shot | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/morwen | Idle | `art/heroes/in-use/morwen/streetwear/hero_morwen_streetwear.core.png` | 71×110 | 192×192 @(62,41) | 4 | east,west | 150 (7) | loop | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/morwen | Skill | `art/heroes/in-use/morwen/streetwear/hero_morwen_streetwear.combat.png` | 123×109 | 192×192 @(34,42) | 8 | east,west | 100 (10) | one-shot | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/morwen | Walk | `art/heroes/in-use/morwen/streetwear/hero_morwen_streetwear.core.png` | 89×112 | 192×192 @(52,42) | 8 | north,east,south,west | 100 (10) | loop | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/morwen | rotations | `art/heroes/in-use/morwen/streetwear/hero_morwen_streetwear.core.png` | 87×111 | 192×192 @(53,42) | 8 | — | 100 (10) | n/a (static rotation) | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/neon-viper | Attack | `art/heroes/in-use/neon-viper/streetwear/hero_neon-viper_streetwear.combat.png` | 96×110 | 192×192 @(49,43) | 8 | east,west | 100 (10) | one-shot | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/neon-viper | Dash | `art/heroes/in-use/neon-viper/streetwear/hero_neon-viper_streetwear.combat.png` | 79×108 | 192×192 @(57,49) | 8 | east,west | 100 (10) | one-shot | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/neon-viper | Faint | `art/heroes/in-use/neon-viper/streetwear/hero_neon-viper_streetwear.combat.png` | 111×103 | 192×192 @(38,48) | 7 | east,west | 100 (10) | one-shot | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/neon-viper | Hurt | `art/heroes/in-use/neon-viper/streetwear/hero_neon-viper_streetwear.combat.png` | 96×110 | 192×192 @(51,44) | 6 | east,west | 100 (10) | one-shot | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/neon-viper | Idle | `art/heroes/in-use/neon-viper/streetwear/hero_neon-viper_streetwear.core.png` | 63×109 | 192×192 @(63,42) | 4 | east,west | 150 (7) | loop | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/neon-viper | Skill | `art/heroes/in-use/neon-viper/streetwear/hero_neon-viper_streetwear.combat.png` | 120×111 | 192×192 @(38,43) | 8 | east,west | 100 (10) | one-shot | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/neon-viper | Walk | `art/heroes/in-use/neon-viper/streetwear/hero_neon-viper_streetwear.core.png` | 74×112 | 192×192 @(59,42) | 8 | north,east,south,west | 100 (10) | loop | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/neon-viper | rotations | `art/heroes/in-use/neon-viper/streetwear/hero_neon-viper_streetwear.core.png` | 61×108 | 192×192 @(64,43) | 8 | — | 100 (10) | n/a (static rotation) | 0.7813 / 0.7604 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/oni | Attack | `art/heroes/in-use/oni/streetwear/hero_oni_streetwear.combat.png` | 123×117 | 192×192 @(34,37) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/oni | Dash | `art/heroes/in-use/oni/streetwear/hero_oni_streetwear.combat.png` | 139×109 | 192×192 @(27,45) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/oni | Faint | `art/heroes/in-use/oni/streetwear/hero_oni_streetwear.combat.png` | 142×125 | 192×192 @(24,29) | 7 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/oni | Hurt | `art/heroes/in-use/oni/streetwear/hero_oni_streetwear.combat.png` | 119×108 | 192×192 @(32,47) | 6 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/oni | Idle | `art/heroes/in-use/oni/streetwear/hero_oni_streetwear.core.png` | 111×108 | 192×192 @(40,46) | 4 | east,west | 150 (7) | loop | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/oni | Skill | `art/heroes/in-use/oni/streetwear/hero_oni_streetwear.combat.png` | 114×117 | 192×192 @(38,37) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/oni | Walk | `art/heroes/in-use/oni/streetwear/hero_oni_streetwear.core.png` | 157×110 | 192×192 @(16,45) | 8 | north,east,south,west | 100 (10) | loop | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/oni | rotations | `art/heroes/in-use/oni/streetwear/hero_oni_streetwear.core.png` | 118×107 | 192×192 @(38,47) | 8 | — | 100 (10) | n/a (static rotation) | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/raven | Attack | `art/heroes/in-use/raven/streetwear/hero_raven_streetwear.combat.png` | 120×116 | 192×192 @(35,34) | 6 | east,west | 100 (10) | one-shot | 0.776 / 0.7552 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/raven | Dash | `art/heroes/in-use/raven/streetwear/hero_raven_streetwear.combat.png` | 102×115 | 192×192 @(43,40) | 8 | east,west | 100 (10) | one-shot | 0.776 / 0.7552 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/raven | Faint | `art/heroes/in-use/raven/streetwear/hero_raven_streetwear.combat.png` | 143×111 | 192×192 @(19,39) | 7 | east,west | 100 (10) | one-shot | 0.776 / 0.7552 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/raven | Hurt | `art/heroes/in-use/raven/streetwear/hero_raven_streetwear.combat.png` | 98×112 | 192×192 @(40,40) | 6 | east,west | 100 (10) | one-shot | 0.776 / 0.7552 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/raven | Idle | `art/heroes/in-use/raven/streetwear/hero_raven_streetwear.core.png` | 76×109 | 192×192 @(60,41) | 4 | east,west | 150 (7) | loop | 0.776 / 0.7552 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/raven | Skill | `art/heroes/in-use/raven/streetwear/hero_raven_streetwear.combat.png` | 128×108 | 192×192 @(33,42) | 8 | east,west | 100 (10) | one-shot | 0.776 / 0.7552 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/raven | Walk | `art/heroes/in-use/raven/streetwear/hero_raven_streetwear.core.png` | 108×114 | 192×192 @(41,40) | 8 | north,east,south,west | 100 (10) | loop | 0.776 / 0.7552 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/raven | rotations | `art/heroes/in-use/raven/streetwear/hero_raven_streetwear.core.png` | 107×110 | 192×192 @(42,41) | 8 | — | 100 (10) | n/a (static rotation) | 0.776 / 0.7552 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/sak | Attack | `art/heroes/in-use/sak/streetwear/hero_sak_streetwear.combat.png` | 127×114 | 192×192 @(35,40) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/sak | Dash | `art/heroes/in-use/sak/streetwear/hero_sak_streetwear.combat.png` | 127×122 | 192×192 @(36,36) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/sak | Faint | `art/heroes/in-use/sak/streetwear/hero_sak_streetwear.combat.png` | 159×122 | 192×192 @(16,32) | 7 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/sak | Hurt | `art/heroes/in-use/sak/streetwear/hero_sak_streetwear.combat.png` | 130×116 | 192×192 @(41,39) | 6 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/sak | Idle | `art/heroes/in-use/sak/streetwear/hero_sak_streetwear.core.png` | 114×116 | 192×192 @(40,38) | 4 | east,west | 150 (7) | loop | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/sak | Skill | `art/heroes/in-use/sak/streetwear/hero_sak_streetwear.combat.png` | 128×114 | 192×192 @(31,40) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/sak | Walk | `art/heroes/in-use/sak/streetwear/hero_sak_streetwear.core.png` | 154×115 | 192×192 @(18,40) | 8 | north,east,south,west | 100 (10) | loop | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/sak | rotations | `art/heroes/in-use/sak/streetwear/hero_sak_streetwear.core.png` | 114×116 | 192×192 @(40,38) | 8 | — | 100 (10) | n/a (static rotation) | 0.7969 / 0.776 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/velkhar | Attack | `art/heroes/in-use/velkhar/streetwear/hero_velkhar_streetwear.combat.png` | 108×121 | 192×192 @(37,33) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/velkhar | Dash | `art/heroes/in-use/velkhar/streetwear/hero_velkhar_streetwear.combat.png` | 108×120 | 192×192 @(42,39) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/velkhar | Faint | `art/heroes/in-use/velkhar/streetwear/hero_velkhar_streetwear.combat.png` | 130×127 | 192×192 @(26,27) | 7 | east,west | 100 (10) | one-shot | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/velkhar | Hurt | `art/heroes/in-use/velkhar/streetwear/hero_velkhar_streetwear.combat.png` | 110×129 | 192×192 @(43,27) | 6 | east,west | 100 (10) | one-shot | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/velkhar | Idle | `art/heroes/in-use/velkhar/streetwear/hero_velkhar_streetwear.core.png` | 100×115 | 192×192 @(42,39) | 4 | east,west | 150 (7) | loop | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/velkhar | Skill | `art/heroes/in-use/velkhar/streetwear/hero_velkhar_streetwear.combat.png` | 127×130 | 192×192 @(32,31) | 8 | east,west | 100 (10) | one-shot | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/velkhar | Walk | `art/heroes/in-use/velkhar/streetwear/hero_velkhar_streetwear.core.png` | 113×134 | 192×192 @(37,21) | 8 | north,east,south,west | 100 (10) | loop | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/velkhar | rotations | `art/heroes/in-use/velkhar/streetwear/hero_velkhar_streetwear.core.png` | 108×119 | 192×192 @(42,35) | 8 | — | 100 (10) | n/a (static rotation) | 0.7969 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/void-raven | Attack | `art/heroes/in-use/void-raven/streetwear/hero_void-raven_streetwear.combat.png` | 114×118 | 192×192 @(34,35) | 8 | east,west | 100 (10) | one-shot | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/void-raven | Dash | `art/heroes/in-use/void-raven/streetwear/hero_void-raven_streetwear.combat.png` | 102×129 | 192×192 @(45,30) | 8 | east,west | 100 (10) | one-shot | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/void-raven | Faint | `art/heroes/in-use/void-raven/streetwear/hero_void-raven_streetwear.combat.png` | 158×114 | 192×192 @(13,39) | 7 | east,west | 100 (10) | one-shot | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/void-raven | Hurt | `art/heroes/in-use/void-raven/streetwear/hero_void-raven_streetwear.combat.png` | 98×112 | 192×192 @(45,41) | 6 | east,west | 100 (10) | one-shot | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/void-raven | Idle | `art/heroes/in-use/void-raven/streetwear/hero_void-raven_streetwear.core.png` | 94×113 | 192×192 @(47,40) | 4 | east,west | 150 (7) | loop | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/void-raven | Skill | `art/heroes/in-use/void-raven/streetwear/hero_void-raven_streetwear.combat.png` | 122×110 | 192×192 @(33,43) | 8 | east,west | 100 (10) | one-shot | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/void-raven | Walk | `art/heroes/in-use/void-raven/streetwear/hero_void-raven_streetwear.core.png` | 107×115 | 192×192 @(40,41) | 8 | north,east,south,west | 100 (10) | loop | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| heroes/void-raven | rotations | `art/heroes/in-use/void-raven/streetwear/hero_void-raven_streetwear.core.png` | 108×111 | 192×192 @(41,42) | 8 | — | 100 (10) | n/a (static rotation) | 0.7917 / 0.7708 | defend-screen / cast-actor / pet-anim-sprite |
| towers/ghost | Attack | `sheets/streetwear/towers/ghost/atlas-0.png` | 240×240 | — | 8 | east,west | — | one-shot | 0.7667 / 0.7458 | defend-screen / cast-actor |
| towers/ghost | Idle | `sheets/streetwear/towers/ghost/atlas-0.png` | 240×240 | — | 4 | east,west | — | loop | 0.7667 / 0.7458 | defend-screen / cast-actor |
| towers/ghost | Skill | `sheets/streetwear/towers/ghost/atlas-1.png` | 240×240 | — | 8 | east,west | — | one-shot | 0.7667 / 0.7458 | defend-screen / cast-actor |
| towers/ghost | rotations | `sheets/streetwear/towers/ghost/atlas-2.png` | 240×240 | — | 8 | — | — | n/a (static rotation) | 0.7667 / 0.7458 | defend-screen / cast-actor |
| towers/lux | Attack | `sheets/streetwear/towers/lux/atlas-0.png` | 244×244 | — | 8 | east,west | — | one-shot | 0.7664 / 0.7459 | defend-screen / cast-actor |
| towers/lux | Idle | `sheets/streetwear/towers/lux/atlas-1.png` | 244×244 | — | 4 | east,west | — | loop | 0.7664 / 0.7459 | defend-screen / cast-actor |
| towers/lux | Skill | `sheets/streetwear/towers/lux/atlas-0.png` | 244×244 | — | 8 | east,west | — | one-shot | 0.7664 / 0.7459 | defend-screen / cast-actor |
| towers/lux | rotations | `sheets/streetwear/towers/lux/atlas-1.png` | 244×244 | — | 8 | — | — | n/a (static rotation) | 0.7664 / 0.7459 | defend-screen / cast-actor |
| towers/viper | Attack | `sheets/streetwear/towers/viper/atlas-0.png` | 236×236 | — | 8 | east,west | — | one-shot | 0.7542 / 0.7331 | defend-screen / cast-actor |
| towers/viper | Idle | `sheets/streetwear/towers/viper/atlas-0.png` | 236×236 | — | 4 | east,west | — | loop | 0.7542 / 0.7331 | defend-screen / cast-actor |
| towers/viper | Skill | `sheets/streetwear/towers/viper/atlas-1.png` | 236×236 | — | 8 | east,west | — | one-shot | 0.7542 / 0.7331 | defend-screen / cast-actor |
| towers/viper | rotations | `sheets/streetwear/towers/viper/atlas-2.png` | 236×236 | — | 8 | — | — | n/a (static rotation) | 0.7542 / 0.7331 | defend-screen / cast-actor |

### 3b. Cast skin (older/off-style; `needs-restyle` per CLAUDE.md)

| Asset | Clip | Sheet | Packed frame (w×h) | Cell (src, offset) | Frames/dir | Dirs | ms/frame (fps) | Loop | Anchor (foot / ground) | Renderer |
|---|---|---|---|---|---|---|---|---|---|---|
| boss/oni | Breathing_Idle | `sheets/cast/boss/oni/atlas.png` | 188×188 | — | 4 | east,west | — | loop | — | defend-screen / cast-actor |
| boss/oni | EPIC_DEATH_FALL_OF_THE_CRIMSON_LEGEND | `sheets/cast/boss/oni/atlas.png` | 188×188 | — | 9 | east,west | — | one-shot | — | defend-screen / cast-actor |
| boss/oni | Running | `sheets/cast/boss/oni/atlas.png` | 188×188 | — | 8 | east,west | — | loop | — | defend-screen / cast-actor |
| boss/oni | Walking | `sheets/cast/boss/oni/atlas.png` | 188×188 | — | 8 | east,west | — | loop | — | defend-screen / cast-actor |
| boss/oni | rotations | `sheets/cast/boss/oni/atlas.png` | 188×188 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor |
| boss/titan-x | rotations | `sheets/cast/boss/titan-x/atlas.png` | 244×244 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor |
| creeps/knight | Breathing_Idle | `sheets/cast/creeps/knight/atlas.png` | 40×40 | — | 4 | east,north,south,west | — | loop | — | defend-screen / cast-actor |
| creeps/knight | Iron_Slash | `sheets/cast/creeps/knight/atlas.png` | 40×40 | — | 9 | east,north,south,west | — | one-shot | — | defend-screen / cast-actor |
| creeps/knight | Walking | `sheets/cast/creeps/knight/atlas.png` | 40×40 | — | 6 | east,north,south,west | — | loop | — | defend-screen / cast-actor |
| creeps/knight | rotations | `sheets/cast/creeps/knight/atlas.png` | 40×40 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor |
| creeps/village-girl | Breathing_Idle | `sheets/cast/creeps/village-girl/atlas-0.png` | 44×44 | — | 4 | east,north,south,west | — | loop | — | defend-screen / cast-actor |
| creeps/village-girl | Flower_Wave | `sheets/cast/creeps/village-girl/atlas-1.png` | 44×44 | — | 9 | south | — | one-shot | — | defend-screen / cast-actor |
| creeps/village-girl | Pick_Up_item | `sheets/cast/creeps/village-girl/atlas-0.png` | 44×44 | — | 9 | east,north,south,west | — | one-shot | — | defend-screen / cast-actor |
| creeps/village-girl | Walk | `sheets/cast/creeps/village-girl/atlas-0.png` | 44×44 | — | 6 | east,north,south,west | — | loop | — | defend-screen / cast-actor |
| creeps/village-girl | rotations | `sheets/cast/creeps/village-girl/atlas-0.png` | 44×44 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor |
| creeps/wizard | Breathing_Idle | `sheets/cast/creeps/wizard/atlas-0.png` | 40×40 | — | 4 | east,south,west | — | loop | — | defend-screen / cast-actor |
| creeps/wizard | attack | `sheets/cast/creeps/wizard/atlas-1.png` | 40×40 | — | 9 | east,west | — | one-shot | — | defend-screen / cast-actor |
| creeps/wizard | death | `sheets/cast/creeps/wizard/atlas-0.png` | 40×40 | — | 9 | east,south,west | — | one-shot | — | defend-screen / cast-actor |
| creeps/wizard | rotations | `sheets/cast/creeps/wizard/atlas-0.png` | 40×40 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor |
| creeps/wizard | walk | `sheets/cast/creeps/wizard/atlas-1.png` | 40×40 | — | 9 | east,west | — | loop | — | defend-screen / cast-actor |
| heroes/archangel | Angelic_Flinch | `sheets/cast/heroes/archangel/atlas.png` | 128×128 | — | 9 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/archangel | Attack_01_Seraph_Strike | `sheets/cast/heroes/archangel/atlas.png` | 128×128 | — | 11 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/archangel | Celestial_Drift | `sheets/cast/heroes/archangel/atlas.png` | 128×128 | — | 11 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/archangel | Celestial_Rush | `sheets/cast/heroes/archangel/atlas.png` | 128×128 | — | 11 | east,west | — | one-shot? | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/archangel | Divine_Flight | `sheets/cast/heroes/archangel/atlas.png` | 128×128 | — | 12 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/archangel | Hover_Idle | `sheets/cast/heroes/archangel/atlas.png` | 128×128 | — | 11 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/archangel | Ultimate_Final_Judgment | `sheets/cast/heroes/archangel/atlas.png` | 128×128 | — | 17 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/archangel | rotations | `sheets/cast/heroes/archangel/atlas.png` | 128×128 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/aurex | DRAGON_SLASH | `sheets/cast/heroes/aurex/atlas.png` | 128×128 | — | 11 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/aurex | FIRE_WAVE | `sheets/cast/heroes/aurex/atlas.png` | 128×128 | — | 13 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/aurex | FLAME_DASH | `sheets/cast/heroes/aurex/atlas.png` | 128×128 | — | 9 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/aurex | HURT | `sheets/cast/heroes/aurex/atlas.png` | 128×128 | — | 5 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/aurex | rotations | `sheets/cast/heroes/aurex/atlas.png` | 128×128 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/corvus | BLACK_DEATH_RITUAL | `sheets/cast/heroes/corvus/atlas.png` | 120×120 | — | 17 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/corvus | DOCTOR_WALK | `sheets/cast/heroes/corvus/atlas.png` | 120×120 | — | 9 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/corvus | HURT | `sheets/cast/heroes/corvus/atlas.png` | 120×120 | — | 5 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/corvus | PESTILENCE_WAVE | `sheets/cast/heroes/corvus/atlas.png` | 120×120 | — | 13 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/corvus | PLAGUE_IDLE | `sheets/cast/heroes/corvus/atlas.png` | 120×120 | — | 13 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/corvus | SHADOW_DASH | `sheets/cast/heroes/corvus/atlas.png` | 120×120 | — | 9 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/corvus | rotations | `sheets/cast/heroes/corvus/atlas.png` | 120×120 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/cyber-shinobi | Attack_11_frames | `sheets/cast/heroes/cyber-shinobi/atlas.png` | 116×116 | — | 11 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/cyber-shinobi | Dash_11_frames | `sheets/cast/heroes/cyber-shinobi/atlas.png` | 116×116 | — | 11 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/cyber-shinobi | Hurt_7_frames | `sheets/cast/heroes/cyber-shinobi/atlas.png` | 116×116 | — | 7 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/cyber-shinobi | Idle_11_frames | `sheets/cast/heroes/cyber-shinobi/atlas.png` | 116×116 | — | 11 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/cyber-shinobi | Skill_17_frames | `sheets/cast/heroes/cyber-shinobi/atlas.png` | 116×116 | — | 17 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/cyber-shinobi | Walk_11_frames | `sheets/cast/heroes/cyber-shinobi/atlas.png` | 116×116 | — | 11 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/cyber-shinobi | rotations | `sheets/cast/heroes/cyber-shinobi/atlas.png` | 116×116 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/elowen | Crescent_Bloom | `sheets/cast/heroes/elowen/atlas.png` | 128×128 | — | 13 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/elowen | Forest_Idle | `sheets/cast/heroes/elowen/atlas.png` | 128×128 | — | 13 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/elowen | Moonlit_Walk | `sheets/cast/heroes/elowen/atlas.png` | 128×128 | — | 17 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/elowen | Nature_Slash | `sheets/cast/heroes/elowen/atlas.png` | 128×128 | — | 17 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/elowen | rotations | `sheets/cast/heroes/elowen/atlas.png` | 128×128 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/frost-lich | Frost_Nova | `sheets/cast/heroes/frost-lich/atlas.png` | 124×124 | — | 17 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/frost-lich | Frozen_Drift | `sheets/cast/heroes/frost-lich/atlas.png` | 124×124 | — | 11 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/frost-lich | Hover_Idle | `sheets/cast/heroes/frost-lich/atlas.png` | 124×124 | — | 11 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/frost-lich | Royal_Cleave | `sheets/cast/heroes/frost-lich/atlas.png` | 124×124 | — | 13 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/frost-lich | Soul_Stagger | `sheets/cast/heroes/frost-lich/atlas.png` | 124×124 | — | 9 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/frost-lich | rotations | `sheets/cast/heroes/frost-lich/atlas.png` | 124×124 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kael | DASH_BOOST | `sheets/cast/heroes/kael/atlas.png` | 124×124 | — | 9 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kael | EMP_BURST | `sheets/cast/heroes/kael/atlas.png` | 124×124 | — | 9 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kael | ENERGY_SLASH | `sheets/cast/heroes/kael/atlas.png` | 124×124 | — | 11 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kael | HURT | `sheets/cast/heroes/kael/atlas.png` | 124×124 | — | 5 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kael | Idle | `sheets/cast/heroes/kael/atlas.png` | 124×124 | — | 13 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kael | TACTICAL_WALK | `sheets/cast/heroes/kael/atlas.png` | 124×124 | — | 9 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kael | rotations | `sheets/cast/heroes/kael/atlas.png` | 124×124 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kitsune | Attack_01_Scarlet_Moon_Slash | `sheets/cast/heroes/kitsune/atlas.png` | 156×156 | — | 9 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kitsune | Breathing_Idle | `sheets/cast/heroes/kitsune/atlas.png` | 156×156 | — | 4 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kitsune | Crimson_Run | `sheets/cast/heroes/kitsune/atlas.png` | 156×156 | — | 9 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kitsune | Death_Animation_Fallen_Empress | `sheets/cast/heroes/kitsune/atlas.png` | 156×156 | — | 11 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kitsune | Sexy_Walk | `sheets/cast/heroes/kitsune/atlas.png` | 156×156 | — | 9 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kitsune | Special_Skill_Foxfire_Step | `sheets/cast/heroes/kitsune/atlas.png` | 156×156 | — | 17 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/kitsune | rotations | `sheets/cast/heroes/kitsune/atlas.png` | 156×156 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/maldrath | CURSED_WALK | `sheets/cast/heroes/maldrath/atlas.png` | 128×128 | — | 9 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/maldrath | DARK_IDLE | `sheets/cast/heroes/maldrath/atlas.png` | 128×128 | — | 13 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/maldrath | GREATSWORD_SLASH | `sheets/cast/heroes/maldrath/atlas.png` | 128×128 | — | 11 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/maldrath | HURT | `sheets/cast/heroes/maldrath/atlas.png` | 128×128 | — | 5 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/maldrath | SHADOW_DASH | `sheets/cast/heroes/maldrath/atlas.png` | 128×128 | — | 9 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/maldrath | SOUL_NOVA | `sheets/cast/heroes/maldrath/atlas.png` | 128×128 | — | 17 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/maldrath | rotations | `sheets/cast/heroes/maldrath/atlas.png` | 128×128 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/morwen | ARCANE_BLAST | `sheets/cast/heroes/morwen/atlas.png` | 124×124 | — | 13 | east,west | — | one-shot? | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/morwen | ARCANE_IDLE | `sheets/cast/heroes/morwen/atlas.png` | 124×124 | — | 13 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/morwen | HURT | `sheets/cast/heroes/morwen/atlas.png` | 124×124 | — | 5 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/morwen | MOON_RITUAL | `sheets/cast/heroes/morwen/atlas.png` | 124×124 | — | 17 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/morwen | TELEPORT | `sheets/cast/heroes/morwen/atlas.png` | 124×124 | — | 11 | east,west | — | one-shot? | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/morwen | rotations | `sheets/cast/heroes/morwen/atlas.png` | 124×124 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/neon-viper | Breathing_Idle | `sheets/cast/heroes/neon-viper/atlas.png` | 128×128 | — | 4 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/neon-viper | Cross_Punch | `sheets/cast/heroes/neon-viper/atlas.png` | 128×128 | — | 6 | east,west | — | one-shot? | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/neon-viper | Falling_Back_Death | `sheets/cast/heroes/neon-viper/atlas.png` | 128×128 | — | 7 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/neon-viper | Jumping | `sheets/cast/heroes/neon-viper/atlas.png` | 128×128 | — | 9 | east,west | — | one-shot? | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/neon-viper | Surprise_Uppercut | `sheets/cast/heroes/neon-viper/atlas.png` | 128×128 | — | 7 | east,west | — | one-shot? | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/neon-viper | Walking | `sheets/cast/heroes/neon-viper/atlas.png` | 128×128 | — | 6 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/neon-viper | rotations | `sheets/cast/heroes/neon-viper/atlas.png` | 128×128 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/oni | ATTACK_01_Swift_Crescent_Slash | `sheets/cast/heroes/oni/atlas.png` | 188×188 | — | 9 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/oni | BLOOD_MOON_IAIJUTSU | `sheets/cast/heroes/oni/atlas.png` | 188×188 | — | 9 | east,west | — | one-shot? | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/oni | Breathing_Idle | `sheets/cast/heroes/oni/atlas.png` | 188×188 | — | 4 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/oni | DASH_Phantom_Step | `sheets/cast/heroes/oni/atlas.png` | 188×188 | — | 9 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/oni | Walking | `sheets/cast/heroes/oni/atlas.png` | 188×188 | — | 8 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/oni | rotations | `sheets/cast/heroes/oni/atlas.png` | 188×188 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/raven | Attack_11_frames | `sheets/cast/heroes/raven/atlas.png` | 128×128 | — | 11 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/raven | Dash_11_frames | `sheets/cast/heroes/raven/atlas.png` | 128×128 | — | 11 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/raven | Heavy_attack_11_frames | `sheets/cast/heroes/raven/atlas.png` | 128×128 | — | 11 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/raven | Hurt_7_frames | `sheets/cast/heroes/raven/atlas.png` | 128×128 | — | 7 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/raven | Idle_11_frames | `sheets/cast/heroes/raven/atlas.png` | 128×128 | — | 11 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/raven | Walking_11_frames | `sheets/cast/heroes/raven/atlas.png` | 128×128 | — | 11 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/raven | rotations | `sheets/cast/heroes/raven/atlas.png` | 128×128 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/sak | Cat_Walk | `sheets/cast/heroes/sak/atlas.png` | 120×120 | — | 11 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/sak | Feline_Rush | `sheets/cast/heroes/sak/atlas.png` | 120×120 | — | 13 | east,west | — | one-shot? | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/sak | Kingdom_of_Cats | `sheets/cast/heroes/sak/atlas.png` | 120×120 | — | 17 | east,west | — | one-shot? | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/sak | Moonfang_Slash | `sheets/cast/heroes/sak/atlas.png` | 120×120 | — | 11 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/sak | Royal_Idle | `sheets/cast/heroes/sak/atlas.png` | 120×120 | — | 13 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/sak | rotations | `sheets/cast/heroes/sak/atlas.png` | 120×120 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/velkhar | BONE_SPEAR | `sheets/cast/heroes/velkhar/atlas.png` | 124×124 | — | 11 | east,west | — | one-shot? | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/velkhar | DARK_IDLE | `sheets/cast/heroes/velkhar/atlas.png` | 124×124 | — | 13 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/velkhar | HURT | `sheets/cast/heroes/velkhar/atlas.png` | 124×124 | — | 5 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/velkhar | NECROMANCER_WALK | `sheets/cast/heroes/velkhar/atlas.png` | 124×124 | — | 13 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/velkhar | SOUL_DASH | `sheets/cast/heroes/velkhar/atlas.png` | 124×124 | — | 9 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/velkhar | SOUL_DRAIN | `sheets/cast/heroes/velkhar/atlas.png` | 124×124 | — | 13 | east,west | — | one-shot? | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/velkhar | rotations | `sheets/cast/heroes/velkhar/atlas.png` | 124×124 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/void-raven | Attack_11_frames | `sheets/cast/heroes/void-raven/atlas.png` | 128×128 | — | 11 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/void-raven | Dash_11_frames | `sheets/cast/heroes/void-raven/atlas.png` | 128×128 | — | 11 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/void-raven | Heavy_attack_11_frames | `sheets/cast/heroes/void-raven/atlas.png` | 128×128 | — | 11 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/void-raven | Hurt_7_frames | `sheets/cast/heroes/void-raven/atlas.png` | 128×128 | — | 7 | east,west | — | one-shot | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/void-raven | Idle_11_frames | `sheets/cast/heroes/void-raven/atlas.png` | 128×128 | — | 11 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/void-raven | Walk_11_frames | `sheets/cast/heroes/void-raven/atlas.png` | 128×128 | — | 11 | east,west | — | loop | — | defend-screen / cast-actor / pet-anim-sprite |
| heroes/void-raven | rotations | `sheets/cast/heroes/void-raven/atlas.png` | 128×128 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor / pet-anim-sprite |
| towers/ghost | rotations | `sheets/cast/towers/ghost/atlas.png` | 240×240 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor |
| towers/lux | rotations | `sheets/cast/towers/lux/atlas.png` | 244×244 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor |
| towers/viper | rotations | `sheets/cast/towers/viper/atlas.png` | 236×236 | — | 8 | — | — | n/a (static rotation) | — | defend-screen / cast-actor |

## 4. FX, auras, board ambient, UI kit sheets

### 4a. Combat FX (`meta.json › fx`, atlas `sheets/streetwear/fx/atlas.png`)

| FX | Frames | fps | ms/frame | Loop | Cell (px) | Anchor (x,y) | Renderer |
|---|---|---|---|---|---|---|---|
| archer/shot | 4 | 12 | 83 | loop | 29² | 0.7586, 0.4138 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| archer/hit | 6 | 16 | 62 | one-shot | 45² | 0.4667, 0.5111 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| bossko/burst | 14 | 12 | 83 | one-shot | 136² | 0.5, 0.5221 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| cheer/burst | 10 | 12 | 83 | one-shot | 68² | 0.5, 0.5147 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| ember/shot | 8 | 12 | 83 | loop | 54² | 0.7593, 0.4815 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| ember/hit | 5 | 16 | 62 | one-shot | 64² | 0.5, 0.5 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| ember/burst | 12 | 12 | 83 | one-shot | 87² | 0.5287, 0.6207 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| ember/status | 12 | 12 | 83 | loop | 47² | 0.4894, 0.8936 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| ember/slash | 7 | 16 | 62 | one-shot | 96² | 0.5, 0.5 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| enrage/burst | 12 | 12 | 83 | one-shot | 74² | 0.5, 0.5 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| gate/burst | 14 | 12 | 83 | one-shot | 80² | 0.5, 0.575 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| plain/shot | 4 | 12 | 83 | loop | 43² | 0.7907, 0.4651 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| plain/hit | 6 | 16 | 62 | one-shot | 45² | 0.4667, 0.5111 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| plain/burst | 8 | 14 | 71 | one-shot | 112² | 0.5, 0.5714 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| plain/slash | 7 | 16 | 62 | one-shot | 96² | 0.5, 0.5 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| pop/burst | 13 | 12 | 83 | one-shot | 36² | 0.5, 0.5278 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| root/shot | 8 | 12 | 83 | loop | 54² | 0.7593, 0.4815 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| root/hit | 8 | 11 | 90 | one-shot | 67² | 0.5224, 0.5672 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| root/burst | 12 | 12 | 83 | one-shot | 116² | 0.5, 0.5431 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| root/status | 13 | 12 | 83 | one-shot | 59² | 0.4915, 0.6949 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| root/slash | 7 | 16 | 62 | one-shot | 96² | 0.5, 0.5 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| spark/shot | 4 | 12 | 83 | loop | 43² | 0.7907, 0.4651 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| spark/hit | 8 | 16 | 62 | one-shot | 67² | 0.4925, 0.5075 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| spark/burst | 10 | 14 | 71 | one-shot | 128² | 0.5, 0.8594 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| spark/status | 12 | 12 | 83 | loop | 44² | 0.4773, 1.0909 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| spark/slash | 7 | 16 | 62 | one-shot | 96² | 0.5, 0.5 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| summon/burst | 10 | 12 | 83 | one-shot | 85² | 0.4941, 0.8118 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| tide/shot | 8 | 12 | 83 | loop | 54² | 0.7593, 0.4815 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| tide/hit | 8 | 11 | 90 | one-shot | 70² | 0.5, 0.5 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| tide/burst | 8 | 14 | 71 | one-shot | 112² | 0.5, 0.5714 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| tide/status | 12 | 10 | 100 | loop | 37² | 0.4595, 0.8378 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| tide/slash | 7 | 16 | 62 | one-shot | 96² | 0.5, 0.5 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| void/shot | 8 | 12 | 83 | loop | 54² | 0.7593, 0.4815 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| void/hit | 8 | 16 | 62 | one-shot | 67² | 0.4925, 0.4925 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| void/burst | 8 | 14 | 71 | one-shot | 116² | 0.5, 0.6552 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| void/status | 12 | 6 | 166 | loop | 54² | 0.5, 0.9444 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |
| void/slash | 7 | 16 | 62 | one-shot | 96² | 0.5, 0.5 | fx-layer / pixel-fx / turf-combat-fx / turf-beat-fx |

### 4b. Auras (`meta.json › auras`)

| Aura | Frames | fps | ms/frame | Loop | Cell | Anchor | refBodyPx | Renderer |
|---|---|---|---|---|---|---|---|---|
| earth | 8 | 5 | 200 | loop | 123² | 0.5285, 0.9106 | 106 | aura-view / aura-png |
| fire | 8 | 4 | 250 | loop | 160² | 0.5, 0.7063 | 106 | aura-view / aura-png |
| rune | 8 | 4 | 250 | loop | 173² | 0.4971, 0.7341 | 106 | aura-view / aura-png |
| thunder | 8 | 4 | 250 | loop | 130² | 0.5077, 0.9 | 106 | aura-view / aura-png |
| water | 8 | 6 | 166 | loop | 91² | 0.4945, 0.8462 | 106 | aura-view / aura-png |

### 4c. Board ambient clips (`meta.json › boards.*.ambient.clips`)

| Board | Clip | Frames | fps | ms/frame | Cell w×h | Anchor (ax,ay) | Loop | Renderer |
|---|---|---|---|---|---|---|---|---|
| ato (and any board sharing it) | flame | 8 | 12 | 83 | 17×28 | 8,24 | loop | turf-ambient / street-ambient |
| ato (and any board sharing it) | smoke | 16 | 10 | 100 | 16×29 | 7,26 | loop | turf-ambient / street-ambient |
| ato (and any board sharing it) | steam | 12 | 12 | 83 | 16×36 | 6,32 | loop | turf-ambient / street-ambient |
| ato (and any board sharing it) | pigeon | 5 | 12 | 83 | 20×26 | 12,25 | loop | turf-ambient / street-ambient |

## 5. Pets (all growth stages)

| Item | Source art | Frames / dirs | Timing | Loop | Anchor | Renderer |
|---|---|---|---|---|---|---|
| Egg | vector (no sprite) | n/a | `pet-egg-sheets.tsx`, `pet-reveal.tsx` motion | n/a | n/a | `pet-figure.tsx` |
| Baby / Child (3 themed lines) | creep roles `unit.tank` (Knight), `unit.runner` (Wizard), `unit.puff` (Village Girl) — Idle 4f, Walk 8f E/W, Death 7f | no attack/skill/hurt | `PET_FRAME_MS` idle 140 / walk 110 | idle, walk | creep `footAt` | `pet-anim-sprite` → `PetFigure` |
| Teen / Adult / God (themed) | hero `raven`, `maldrath`, `elowen` streetwear kit | idle 4f, walk 8f×4, dash/attack/skill/hurt 6–8f E/W | dash 60, attack 80, skill 85, hurt 140 | idle, walk loop; rest one-shot (hold last) | hero `footAt` | same |
| Solo lines (all 16 heroes, every stage) | hero kit; same sprite at every stage | same | same | same | same | same |
| Stage size | `PET_STAGE_SCALE`: egg .6, baby .55, child .75, teen .9, adult 1.15, god 1.45 | — | — | — | non-integer scale; code comment says "soft (smooth) enlarging" | `pet-figure.tsx` |
| Sleep | idle × `PET_SLEEP_SLOWDOWN` (3) + squash | — | 420 ms/frame | loop | — | `pet-actor.ts` |
| Registry pet stills | 78 `pet.*` assets (10 species × 8 dirs, 252×252, **primal** off-style, `needs-restyle`) | static | — | — | — | not animated |

Missing for the Phase 3 standard set: blink, hop, happy/react, eat, level-up/evolve (no clip), distinct sleep pose.

## 6. Code-driven (non-sprite) motion — Reanimated/timers

`rm` = references reduce-motion; `rep` = `withRepeat` loops; `tmr` = setInterval/setTimeout; `clr` = clearInterval present.

| File | What moves | withTiming | rep | tmr | clr | rm |
|---|---|---|---|---|---|---|
| `src/play/pixel-fx.tsx` | FX bursts, shake, flash | 14 | 4 | 1 | — | gated by parent (see correction §0.7) |
| `src/play/pixel-ambient.tsx` | ambient sin loops | 10 | 8 | 0 | — | gated by parent (see correction §0.7) |
| `src/play/turf-ambient.tsx` | fires/smoke/pigeons/steam ticker | 9 | 6 | 3 | 1 | gated by parent (see correction §0.7) |
| `src/play/street-ambient.tsx` | street ambient | 3 | 3 | 0 | — | gated by parent (see correction §0.7) |
| `src/play/aura-view.tsx` | aura frame stepping | 3 | 3 | 0 | — | via GENTLE path |
| `src/play/dive-street.tsx` / `dive-world.tsx` | street/world scroll & loops | 12 / 2 | 4 / 2 | 1 / 0 | — | gated by parent (see correction §0.7) |
| `src/play/pet-room.tsx` | pet roam, hop, bowl, zzz | 24 | 4 | 15 | 4 | yes (23) |
| `src/play/dive-scene.tsx` | dive scene | 31 | 6 | 9 | 2 | yes (15) |
| `src/play/hideout-zzz.tsx` | sleep Zs | 11 | 4 | 0 | — | yes |
| `src/play/hideout-rails.tsx`, `street-room.tsx` | rails, room | 3 / 4 | 2 / 3 | 0 | — | yes |
| `src/play/turf-combat-fx.tsx`, `turf-beat-fx.tsx` | hit flashes, beats | 9 / 8 | 0 | 2 / 0 | — | gated by parent (see correction §0.7) |
| `src/play/score-burst.tsx` | score pop (rAF ×2) | 2 | 0 | 0 | — | gated by parent (see correction §0.7) |
| `src/play/finish-motion.tsx` | foil/finish shimmer | 2 | 2 | 1 | — | yes |
| `src/play/pet-reveal.tsx`, `merge-row.tsx`, `pet-card.tsx` | reveal, merge, card | 7 / 8 / 3 | 0 / 2 / 3 | 2 / 4 / 0 | — | yes |
| `src/play/pet-games.tsx` | mini-games | 5 | 0 | 6 | 2 | gated by parent (see correction §0.7) |
| `src/play/pixel-ui.tsx` | pixel buttons/frames | 6 | 2 | 0 | — | yes |
| `src/components/motion.tsx`, `milestone-toast.tsx`, `set-done-moment.tsx`, `check-milestone-badge.tsx`, `week-strip.tsx`, `sage-eight-ball.tsx`, `themed-pressable.tsx` | app (non-game) UI motion | — | — | — | — | yes |
| `src/play/play-motion.ts` | shared reduce-motion helpers (9 refs) | — | — | — | — | helper |

Off-screen pausing: only files importing `useIsFocused`/`AppState`/`cancelAnimation` pause (`aura-view`, `defend-screen`, `dive-*`, `hideout-*`, `pet-card/looks/room`, `pixel-ambient`, `pixel-fx`, `street-*`…). Whether a *specific* loop stops when covered is a Phase 1 check.

## 7. Static art that should probably animate (candidate list for Phase 4)

`registry.json` props: 76 (streetwear 32, scribble-dungeons 26 off-style, hideout 15) — e.g. `prop.hideout.streetwear.arcade` / `arcade-off` (an A/B pair, no code-driven flicker found yet); 17 `fx.*` (drip, moth, note, pigeon, rat, plane, spark, star, steam, wisp — 32×32 sheet singles); `ui-kit` has 57 frames, **0 multi-frame** UI animations; board has `ato-flame` (8f), `ato-pigeon` (5f), `ato-smoke` (16f), `ato-steam` (12f) clips + still glow/fire overlays.

## 8. Gap vs. the standard animation set (input to Phase 3)

| Need | Heroes (have → need) | Pets | Minions |
|---|---|---|---|
| idle breathe | Idle 4f ✔ (thin) | uses hero idle | Idle 4f ✔ |
| fight-stance idle | ✗ | — | — |
| walk 6f / run 8f | Walk 8f ✔ / Run ✗ (only boss/oni) | walk ✔ / hop ✗ | Walk 8f E/W ✔ |
| attack | Attack 8f ✔ | ✗ | ✗ |
| special | Skill 8f ✔ | ✗ | ✗ |
| hit | Hurt 6f ✔ | ✗ | ✗ |
| death | Faint 7f ✔ (not exposed in avatar mode) | ✗ | creeps ✔, towers ✗ |
| victory/emote | ✗ | happy/react ✗ | — |
| blink / eat / sleep / level-up | — | all ✗ | — |
| spawn | — | — | ✗ |
| 4-dir | walk only; combat is E/W | E/W | E/W |

## 9. Reproduce

Tables in §3–§4 are generated by a small script over the JSON files (no image decoding yet). Phase 1 adds image-level checks (alpha bbox per frame, foot-row drift, duplicate/seam frames, partial alpha, palette) and GIF/contact-sheet output.
