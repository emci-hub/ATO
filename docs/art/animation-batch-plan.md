# Animation batch plan (2026-10-22)

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
