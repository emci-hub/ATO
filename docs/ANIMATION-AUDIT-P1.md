# Animation Audit — Phase 1 (glitch audit)

Scope: every multi-frame clip in `legacy-play-sheets.json` that has a real animation (577 clip×direction rows: streetwear heroes/creeps/towers/bosses/auras/fx/swords/board-ambient, plus the old Cast skin). Full scores: `docs/animation-audit/scores.csv`. Worst-10 GIFs (1× and 3×, nearest-neighbour, magenta line = median baseline, green tick = that frame's foot row) + contact sheets: `docs/animation-audit/worst10/`. Tools: `scripts/animation-audit/{analyze,score,render}.py` (read-only, run `python3 scripts/animation-audit/analyze.py out.json` from the repo root).

## 1. Honest summary

**The art itself is in much better shape than expected; the real problems are systemic (timing, code, scale, motion-safety, missing clips).**

| Skin | ok (≥4) | ugly (2.5–3.5) | broken (≤2) | Mean |
|---|---|---|---|---|
| Streetwear (355 rows) | 299 | 48 | 0 | 4.4 / 5 |
| Cast (old, 221 rows) | 215 | 2 | 4 | — |

- **Frame sizes:** 0 clips with mismatched frame sizes or wrong slicing. 0 cropped limbs. **Alpha is binary everywhere** (no halo/partial alpha). Slicing/trim offsets are correct.
- **Palette:** streetwear clips use ≤187 colours (palette-locked). The Cast skin has up to **28,762 colours** per clip — off-palette, as already flagged `needs-restyle`.
- **Duplicate frames:** only 3 (`archangel/Faint east`, `fx/spark/burst`, `auras/thunder/behind`). 22 FX/aura clips have empty frames — mostly intentional fade-out/blink tails, so not penalised; needs a look only for `auras/thunder/behind` (4 empty + 1 duplicate).
- **Loop seam:** only `archangel/Divine_Flight` (Cast) pops at the loop seam.
- **Baseline jitter:** streetwear idles hold the baseline within 0–2 px. The 48 "ugly" rows are almost all the same two issues: **idle has only 4 frames** and **timing is flat**.
- **What the scorer cannot judge:** my first pass flagged Oni Run "foot drift" and Velkhar Idle "x drift"; the contact sheets showed those are a natural run lift and floating particles. I switched to a feet-only measure. Remaining "feet slide" flags (Morwen, Maldrath, Sak idle) look like small boot shifts, not glitches — treat scores as a triage list, the GIFs as the verdict. Hover/flying heroes (archangel, frost-lich) legitimately float.

## 2. Worst 10 (by triage score; all mild — see §1)

| # | Clip | Score | What I see | GIF |
|---|---|---|---|---|
| 1 | Cast `elowen/Forest_Idle` E | 2.0 | foot row drifts 5 px, feet slide 2.8 px (13 frames, off-palette skin) | #9 |
| 2 | Cast `frost-lich/Hover_Idle` E | 2.0 | 4 px vertical drift (hover — possibly intentional), off-palette | #10 |
| 3 | Streetwear `boss/oni/Idle` E | 2.5 | 4 frames, feet slide 2.9 px, flat 120 ms | #6 |
| 4 | Streetwear `heroes/archangel/Idle` E | 2.5 | 4 frames; hover so drift expected | #4 |
| 5 | Streetwear `heroes/maldrath/Idle` E | 2.5 | baseline locked, but the body is almost frozen (~1 px bob) — reads as a still | #2 |
| 6 | Streetwear `heroes/morwen/Idle` E | 2.5 | same: locked baseline, near-static | #1 |
| 7 | Streetwear `heroes/sak/Idle` E | 2.5 | feet slide 3.6 px, 4 frames | #3 |
| 8 | Streetwear `heroes/void-raven/Idle` E | 2.5 | feet slide 3.3 px, 4 frames | #5 |
| 9 | Streetwear `heroes/elowen/Idle` W | 2.5 | 2 px baseline drift | #7 |
| 10 | Streetwear `creeps/knight/Death` E | 3.5 | baseline moves 9 px across the fall (probably fine for a collapse) | #8 |

GIF file names are `worst10/NN_<skin>_<char>_<clip>_<dir>_{1x,3x}.gif` + `_sheet.png`; the number in the last column is the file prefix.

## 3. Timing audit

- Streetwear character clips: **one flat value per mode**, no per-frame holds. `CAST_ACTOR_FRAME_MS`: idle 120 · walk 100 · dash 50 · attack 65 · skill 70 · hurt 140 · death 70 · faint 110. Attack/skill have no anticipation hold or impact hold.
- Idle at 4 frames × 120 ms = a 480 ms loop. Reads as a twitch or a still, not breathing.
- Cast clips: 100 ms flat.

## 4. Code bugs and leads

| # | Finding | Evidence | Severity |
|---|---|---|---|
| C1 | **Pet frames are skipped.** The shared clock ticks every 100 ms (`pet-anim-sprite.tsx:43`) but `PET_FRAME_MS` is 60/80/85/110/140 ms (`pet-actor.ts:86`). Simulated: dash (60 ms) shows frames 0,1,3,5,6,8… (skips 2,4,7); attack (80 ms) skips 4; hurt (140 ms) holds 2,1,1,… unevenly. | arithmetic on `petFrameAt` | **broken** for dash/attack |
| C2 | Pet stage size = `Math.round(baseBox × PET_STAGE_SCALE)` (`pet-figure.tsx:69`), scales 0.55/0.75/0.9/1.15/1.45 → not integer multiples of the art. `sharpPetBox` fixes this only at 2 call sites (`finish-picker`, `pet-screen`). | `PET_STAGE_SCALE` comment: "Soft (smooth) enlarging" | ugly |
| C3 | `imageRendering: pixelated` is web-only; native relies on integer sizes (`pixel-theme.ts` says so). `SheetSprite` scales by `size / rect.w` in SVG units — non-integer unless the caller passes a multiple. Needs a device check. | `sheet-sprite.tsx:118` | lead |
| C4 | Reduce-motion missing in the looping components listed in the Phase 0 audit §6. | grep | ugly |
| C5 | `pet-anim-sprite` clock is cleared when the last listener leaves ✔ (no leak). `turf-ambient` and `pet-games` pair `setInterval`/`clearInterval` ✔. **Not verified:** whether each Reanimated loop is cancelled when its screen is covered. | read | lead |
| C6 | Avatar mode in `cast-actor.ts` has no death/faint slot, though all 16 heroes ship a Faint clip — shipped art is unreachable by the Avatar. | `CAST_ACTOR_CLIPS` | missing feature |

Not animation-related, noted only: none found.

## 5. Proposed single animation library (your request)

**Goal:** one library, every animation sorted **character → category → clip → direction**, usable from any screen with one call, no duplicate sheets.

Today the data is split three ways: `legacy-play-sheets.json` (rects), `meta.json` (anchors, FX fps) and per-component constants (`PET_FRAME_MS`, `CAST_ACTOR_FRAME_MS`, ambient clips) — and the Cast skin duplicates every hero. The registry (`registry.json`) has 0 clip entries.

**Proposal (data first, no behaviour change in step 1):**

```
assets/art/animations/            ← generated by `npm run art:sync` (never hand-edited)
  library.json                    one manifest, one entry per character
  heroes/<hero>/
    idle/        breathe, fight-stance, fidget
    locomotion/  walk, run, dash, hop
    combat/      attack, special, hit
    reaction/    hurt, death, victory, emote
  pets/<line>/<stage>/
    idle/        breathe, blink, sleep
    locomotion/  walk, hop
    reaction/    happy, eat, level-up
  minions/<id>/  idle, move, attack, hit, death, spawn
  fx/<kind>/     shot, hit, burst, status, slash
  world/<scene>/ ambient loops (flame, smoke, steam, neon A/B)
  ui/            press, open, reward, tick
```

Each clip entry: `id`, `category`, `frames`, per-frame `ms` (holds allowed), `loop`, `dirs`, `anchor` (foot/pivot), `cell`, `sheet`, `reducedMotion` (`hold-first` | `slow` | `skip`), `status`, `source` (PixelLab gen id), `critiqueScore`.

One resolver replaces the per-component lookups: `anim('heroes.kael.combat.attack', { dir, t })` → `{ sheet, rect, anchor, frame }`, plus a single shared clock that honours the per-frame `ms`, pauses off-screen and respects reduce-motion. Existing code keeps working through an adapter (`PLAY_SHEETS` is derived from the library), so migration is per-screen, not big-bang. This also fixes C1 (one clock, real per-frame timing).

Cost/risk: touches `art:sync`, `skeletons.ts` and the art checks (`check:art-registry`) — shared files, so I'd make the smallest change and flag it. Step 1 would be read-only: generate `library.json` from existing data and add a check that no clip exists outside it.

## 6. Proposed Phase 2 order (for your approval)

1. **C1:** drive pet frames from per-frame time rather than the 100 ms tick (or tick at 16–33 ms only while a sprite is on screen).
2. **C4:** reduce-motion paths for the unguarded loops (smallest per-file changes).
3. **C2/C3:** snap pet stage boxes to integer multiples of `cellPx`.
4. **C6:** expose Faint/death in Avatar mode (needs game-code review — flag, probably not mine to change).
5. Retime idles with per-frame holds once the library carries `ms[]`; regenerate only the clips that cannot be retimed (the near-static idles, via PixelLab).

Nothing in `src/` or `assets/` has been changed so far.
