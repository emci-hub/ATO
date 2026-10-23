# Animation batch plan (2026-10-22)

> **Superseded by the anchored-rig plan below (emci, 2026-10-22).** The ~84-generation skeleton-v3 batch is
> replaced by Tier A (procedural, 0 generations) from `docs/art/animation-pipeline-research.md`. Kept for the
> inventory and the audit facts.

Source: `assets/art/animations/library.json` (23 characters, 289 clips) + `docs/animation-audit/scores.csv`
(streetwear: 347 clip-directions scored, 299 ok, 48 "ugly"). Method: `PIXELLAB_ANIMATION.md` §4b.

## What exists (streetwear, played east/west unless noted)
| Group | Characters | Clips each |
|---|---|---|
| Heroes (16) | archangel, aurex, corvus, cyber-shinobi, elowen, frost-lich, kael, kitsune, maldrath, morwen, neon-viper, oni, raven, sak, velkhar, void-raven | Idle 4f · Walk 8f (E/N/S/W) · Dash 8f · Attack 8f (raven 6f) · Skill 8f · Hurt 6f · Faint 7f |
| Creeps (3) | knight, village-girl, wizard | Idle 4f · Walk 8f · Death 7f |
| Boss (1) | oni | Idle 4f · Run 8f · Walk 8f · Death 8f |
| Towers (3) | ghost, lux, viper | Idle 4f · Attack 8f · Skill 8f |

## What the audit says needs generating
- **Idle is the only clip class flagged "ugly"**: 4 frames, flat timing (avg score 3.3 vs 4.5 for everything else).
- Every other clip (Walk, Run, Dash, Attack, Skill, Hurt, Faint, Death) scores 4.5 with one issue, **flat timing**.
  That is fixed in our library with per-frame `ms[]` (free, no PixelLab), not by regenerating frames.
- So the generation batch = **hero Idle**, nothing else.

## Status of hero Idle
| State | Heroes |
|---|---|
| Live | kael (template), morwen (skeleton-v3 E+W) |
| East test done, west + install pending | maldrath (drift: sword lower, cape softer, chest rig lost) |
| Not started (13) | archangel, aurex, corvus, cyber-shinobi, elowen, frost-lich, kitsune, neon-viper, oni, raven, sak, velkhar, void-raven |

## Cost (192² canvas; import 0.25 + per direction: template 1, skeleton-v3 3)
| Option | Per hero (E+W) | 13 heroes | + Maldrath west |
|---|---|---|---|
| Template only | 2.25 | 29.3 | — |
| skeleton-v3 only (identity-safe) | 6.25 | **81.3** | **+3 → ~84** |
Balance 3,521.95 (this cycle, resets 2026-11-11); 84 ≈ 2.4 % of it. No Pro calls. Over the ~20-generation
limit, so it needs emci's ok. Tier 2 runs 10 jobs at once; jobs take ~3–15 min.

## One-pass flow
1. emci OKs the budget and the tool rule (below).
2. One chat: for each remaining hero, import (wait for `completed`), then animate E+W; submit in waves of ~10 jobs.
3. Download all, compute height / foot row / changed px, build ONE contact sheet (identity 4x per hero, current vs new)
   and one GIF per hero. Push as a test only (nothing installed).
4. emci marks each hero approve / keep current on that one sheet.
5. A second chat installs every approved hero in one pack (archive old Idle, shift feet, `art-pack` per hero,
   `art:sync`, `anim:library`, gate, push). emci checks on a phone.

## Open decisions (emci)
1. Tool rule: skeleton-v3 for all (identity-safe, ~81) or silhouette-based (template for plain ones, ~30–81,
   with some re-runs when identity drifts).
2. Maldrath: accept the east drift (then west, 3) or keep his current Idle.
3. Free follow-up, no generation: per-frame `ms[]` timing for the other clips (the audit's "flat timing").
4. Out of this batch unless asked: creeps / boss / tower Idles (7 characters) — same method, ~44 more with skeleton-v3.

## Replan: animation track (anchored rig), one chat per step
Play-scope work (`assets/play/**`, packs): never in the same commit as app/docs (`check:play-isolation`).
Independent of the ATO finish roadmap (app work), so it can run between those steps without blocking them.

| Step | What | PixelLab | Needs first | Ships |
|---|---|---|---|---|
| AN0 | emci reviews and merges PR 82 (this branch) so master has Kael + Morwen Idles, the docs, the research | 0 | emci | — (**done 2026-10-23**) |
| AN1 | **Art engine v1** (build tooling only, `scripts/` + `art-src/`, never in the app bundle; see below). First user: rig format + recipe engine (`art-src/rigs/<hero>.json`, `breathing-idle` recipe, per-part masks, gates: foot row, height, silhouette overlap, palette, prop pixels, loop seam). Pilot Maldrath E+W incl. sword mask; GIF vs current vs skeleton-v3 | 0 | AN0 | test only |
| AN2 | Rigs for all heroes (auto-guessed lines, hand-checked prop/cape masks), Idle for every hero, one contact sheet, emci marks approve/keep per hero, install approved, Idle `ms[]` holds | 0 | AN1 ok | 1 OTA + phone box |
| AN3 | Timing pass for the other clips (per-frame holds; clears the audit's "flat timing"). Check first whether play code reads `ms[]` or still uses flat fps — if code must change, it is its own Play step | 0 | AN2 | 1 OTA + phone box |
| AN4 | Optional: creeps / boss / tower Idles with the same rigs | 0 | AN2 | with AN3 or own OTA |
| AN5 | Optional, credits: Tier B anchored AI (`animate_with_skeleton_v3`, pinned joints, fixed seed, lock pass) only for clips emci wants with real motion (cape sway, attacks) | ~3 / direction | emci picks clips; token-secret decision | per batch |

Credits: AN1–AN4 spend 0 PixelLab generations (vs ~84 in the old plan). AN5 is the only paid step and is opt-in.

**AN1 built 2026-10-23 (test only):** engine in `scripts/art-engine/`, rigs in `art-src/rigs/`, one PixelLab config
`scripts/art-engine/pixellab.config.json`, `npm run art:engine -- --hero <name>`, `check:art-engine`. Maldrath E+W incl.
the sword mask pass all seven gates (six from the plan + no-tears); the live Idle and the skeleton-v3 east test fail the same gates (sword and silhouette
drift). GIFs: `docs/art/animation-tests/maldrath-engine/`. Next: emci's go / no-go for AN2. Status block:
`docs/ato-finish-roadmap.md` "Step AN1 status".

## Art engine (emci 2026-10-22): one structure for every future asset
Goal: every new character, UI piece or object enters through the same structure, so nothing PixelLab makes is wasted
and everything looks consistent. Lives in build tooling (`scripts/art-engine/`, specs in `art-src/`), feeds the
existing registry / `art:sync` / gates; the app only ever sees packed sheets (no PixelLab call or key in the app).

| Part | Characters | UI | Objects / props |
|---|---|---|---|
| Spec file (once per asset) | rig: foot row, hip/shoulder lines, anchor skeleton, part masks (prop, cape, head) | frame/slice spec: 9-slice insets, states (idle/press/disabled), target size on the ladder | footprint tiles, height vs hero (guide §2 table), occluder line, states |
| Recipes (shared, in repo) | breathing-idle, blink, hit-flash… (procedural first); AI motion via `animate_with_skeleton_v3` with the spec's pinned joints + fixed seed | press/hover offsets, glow pulse | idle flicker, open/close states |
| Gates (automatic) | foot row, height band, silhouette overlap, palette ⊆ hero atlas, prop pixels, loop seam | size on ladder, 9-slice edges clean, palette | scale check vs hero, footprint, palette |
| PixelLab path | import 0.25 → only AI for real motion | PixelLab UI tools → slice spec | map objects / object states → spec |

Keeping it current with PixelLab: `PIXELLAB_ANIMATION.md` §0 pre-flight (`search_help`) + `npm run pixellab:watch`
already detect tool changes; the engine keeps tool names, costs and limits in ONE config file that the pre-flight
updates, so a PixelLab change is a one-file edit, not a hunt through scripts.
Build order: characters first (AN1 pilot), then props/objects, then UI — each added when its first real asset needs it.
