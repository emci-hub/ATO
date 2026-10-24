# Glitch fixes + 5 mecha ninjas: plan (emci, 2026-10-24)

State of this plan lives HERE, never only in chat. Update the status column at the end of every step.
One chat per step (CLAUDE.md). Play scope (assets/play, art registry, animation library, src/play, art-src, art-engine scripts)
never in the same commit as app or docs. No 1.3 native bump (every step below is JS/assets, OTA on runtime 1.2.0).
PixelLab: 0 generations unless emci approves; any batch over ~20 or any Pro call asks first (PIXELLAB_ANIMATION.md section 0).
App Store review submission is on hold until emci says so.

## Decisions (emci, 2026-10-24)
- 5 mecha ninjas, "make it cool", samples shown before any build. Defaults below stand unless emci changes them.
- Defaults chosen by Fable (emci may override): no Faint clip (heroes have no Faint slot in play today); unlock = the existing
  free_farm path used by other heroes, stated per hero in M3; style A (native 128, about 100-108 px tall grown, mech cues:
  wide shoulders, visor, backpack), scale-checked against grown Kael (H about 106).
- Glitch fixing is free (Tier A, 0 generations). Paid redo only for a clip that Tier A cannot save (Oni Run worst case about 6).

## Step status
| Step | What | Cost | Who/Model | Status |
|---|---|---|---|---|
| G1 | Fix the ~12 glitchy clips (Tier A), emci eyeballs sheets first | 0 gens | Sonnet | DONE 2026-10-24 (commit 4c8376b2, not published as OTA). Fixed: ghost Attack E f5 + W f7 stray streaks erased (originals in art-src/archive/2026-10/tower.ghost.streetwear-Attack-pre-edgefix-20261024). Left on purpose: Walk drift 4-6 px (gait bob, lifted foot, no planted-foot slide on sheets), archangel Faint E (identical end-pose frames already one 310 ms hold, no visual change), Oni Run (real leap; not listed by emci), lunges. |
| M0 | emci fixes the PixelLab MCP connector (401 Invalid API token) | 0 | emci | DONE 2026-10-24 (connector works) |
| M1 | Pre-flight (docs + search_help + get_balance) and 5 concept sketches as samples + scale sheet next to Kael | est 20-40 gens, ask first (Pro) | Sonnet | DONE 2026-10-24: 5 south-facing 128 sketches (Pro Flash, 6 gens each = 30, balance 3,515.95 -> 3,485.95, Kael cropped as style image with colours off, seeds 11-15). Files + scale sheet in `docs/art/mecha-m1/`. Waiting for emci's picks (M2). Heights vs Kael 106: Kabuto 117, Shade 111, Kabuki 118, Hush 100, Gearbreaker 116 (wide: Kabuto 100, Kabuki 105, Gearbreaker 113 px); three are at the +10% limit, so M2 decides keep or regenerate smaller. |
| M2 | emci picks/edits the 5 (or swaps); lock names, element/behavior, palette | 0 | emci | - |
| M3 | Build heroes one per chat: rotation, Walk/Dash/Attack/Skill/Hurt, free engine Idle, rig, install, art:sync, gate, reviewer | about 25 gens per hero (est) | Sonnet | - |
| M4 | One Play-only OTA on runtime 1.2.0 for all five (or per hero), phone check box | 0 | Sonnet | - |

## The 5 concepts (from the library check: no mecha exists; do NOT recolor Cyber-Shinobi / Neon-Viper)
1. Ironclad Kabuto: bulky samurai-armour mech, huge shoulder plates, nodachi, steel blue + white. tide + chain.
2. Zipline Shade: thin stealth drone-ninja, scarf cables, twin shuriken launchers, black/violet/lime. void + splash.
3. Kabuki Gear: tall masked animatronic, spinning tessen blade-fan arms, red/white face plate, orange cables. ember + chain.
4. Hush Bot: small quick toy-mecha, backpack scroll cannon, grapple chain, big visor eye. root + pull.
5. Gearbreaker: hunched brute, piston gauntlets, horned helm, grey-teal + amber. ember or tide + pull/burst (pick for balance in M2).
Roster gaps these fill: chain only spark/void today; pull only tide/void; no root+pull etc. (src/play/data/heroes.json).

## G1 detail: the glitch list (from the 2026-10-24 scan; sheets were scratch only, re-run to regenerate)
Scan tool: `scripts/animation-audit/analyze.py` + `score.py` (run read-only through a wrapper; they write only to argv).
Real defects, worst first, all Tier A unless noted:
1. boss/oni Run E 14 px and W 17 px foot drift (wrong baseline or size pop). Tier B only if the pose pops: about 6 gens.
2. towers/ghost Attack E+W: opaque pixels touch the frame edge on 1 frame (clipped). Re-pad or re-crop.
3. frost-lich Walk S 4 px; Walk drift 4-6 px on about 15 hero directions (archangel E 5, aurex S 4, corvus E 5,
   cyber-shinobi N 5 / E 6, elowen E 5 / S,W 4, frost-lich N,E 4, kitsune E,S 4, morwen E 5, neon-viper S 4, raven S 6,
   velkhar S 4, void-raven N,E,W 5). Check on the sheets first whether it is real foot slide or gait; shift per frame.
4. archangel Faint E: 1 duplicate frame (hold in ms.json or drop the frame).
5. Eyeball only (lunges, probably fine): neon-viper Attack E 43 / W 23 px, frost-lich Skill W 17, ghost Skill W 24, lux Skill W 16,
   corvus and raven Dash E 12, creep knight Death E 9. Shift only if it reads as hopping.
Not scored: cape/hair, pose snaps, head/weapon jitter, true foot planting, palette: emci's eyes (sheets).
Method per fix: edit the clip's frames/ms under `art-src/pixellab/<id>.streetwear/migrated/raw/animations/<Clip>/`
(archive the old, delete nothing), `art-pack --id <type>_<slug>_streetwear`, `npm run art:sync`, `anim:library`,
`check:art-registry --fresh`, `npm run check:ota-gate`, reviewer, commit (Play only), ask before the OTA.

## Token savers
- Each step in a fresh chat from the prompt at the end of the previous one; read this doc + PROJECT_CONTEXT.md only.
- Free work (G1) before any paid work (M1+). Investigator subagent for all scans; never paste sheets into the main chat.
- One test sample per concept first (M1), no animation until emci picks (M2). Idle is free (engine).
- One OTA at the end (M4), not per hero.
