# Quests art credits (PixelLab generations)

| Date | Batch | Before | After | Used | Notes |
|---|---|---|---|---|---|
| 2026-10-28 | test plate 01 (pixflux 194×100, seed 4101, forced palette) | 3040.95 | 3039.95 | 1 | 1 rejected call (odd width 195) was not billed |
| 2026-10-28 | test plate 02 (create_image_pro 194×100, seed 4101, style_image dive-ruins, hex palette; emci approved) | 3039.95 | 3029.95 | 10 | receipt: 10 gens, 1 candidate |
| 2026-10-28 | batch 1: fork far plate (Pro, style_image = approved plate 02) + 2 gate mid-layer explores (pixflux no_background, init = far, strength 450 / 350, seeds 4101/4102) | 3029.95 | 3017.95 | 12 | 10 + 1 + 1; none usable, see critique.md |
| 2026-10-28 | batch 2: 4 far plates (Pro, dive-ground style image) + 2 mid + 2 ground explores | 3017.95 | 2973.95 | 44 | 40 + 4 |
| 2026-10-28 | batch 3: 6 props (pixflux), Rook + Vey (v3 64 px, 2 each), 8 Pro 16x16 icon sets (10 each) | 2973.95 | ~2881 | ~92 | icons 80 + props 6 + NPCs 4 + portraits (pixflux, wrong person) 2 |
| 2026-10-28 | batch 4: NPC idle + talk (4 x 1), 4 Pro icon fixes (40), 2 Pro portraits with sprite ref (20), 3 hero imports (3), 9 hero clips (9) | ~2881 | 2805.95 | ~75 | |
| 2026-10-28 | batch 5: 7 other heroes, import (7) + idle (7) | 2805.95 | 2791.95 | 14 | |
| 2026-10-28 | batch 6: 4 mid layers + 4 ground strips (8), fix rounds: lake mid x4, shore ground, raft/crystal/crate x2 (11) | 2791.95 | 2772.95 | 19 | |
| 2026-10-28 | batch 7 (after review): 5 ground strips Pro with far plate as reference (50), 2 ground retries (20), raft + crate x2 seeds (4) | 2772.95 | 2698.95 | 74 | |
| 2026-10-29 | PHASE-21 test clip: H4 druid walk east (animate_character template walking-8-frames, 88 px canvas) | 2698.95 | 2697.95 | 1 | frames in heroes/test-h4/; feet drift rows 79-82, needs a per-frame foot anchor at install |
| 2026-10-29 | PHASE-21 (emci approved up to 500): 10 far plates (Pro 194×100, dive-ground style image, hex palette) | 2697.95 | 2597.95 | 100 | 10 each, first try kept |
| 2026-10-29 | 10 mid layers (pixflux) + 14 props (pixflux) + 7 prop fixes (wine table x2, phone x2, gold mask x2, umbrella) | 2597.95 | 2566.95 | 31 | 10 + 14 + 7 |
| 2026-10-29 | 6 NPCs v3 64 px (12), 6 idle (6), 6 talk (6) | 2566.95 | 2542.95 | 24 | east only |
| 2026-10-29 | ambient first frames x3 + animate_image x3 (curtain, dancers, train) + dancers fix round | 2542.95 | 2535.95 | 7 | 3 + 3 + 1 |
| 2026-10-29 | 10 emblems (pixen) + d20 + 3 badges + 8 emblem fixes + 2 d20 fixes + 2 badge fixes + 8f tumble | 2535.95 | 2508.95 | 27 | intermediate balances are rebuilt from the receipts; only the start and the end were read live |
| 2026-10-29 | H4 walk x2, H5 triumph x3 (5 gens), Corvin redo (create 2 + idle 1 + talk 1), 12 ending cards (9 + 3 tests, 1 each; 192×116) | 2508.95 | 2485.95 | 23 | |
| 2026-10-29 | 6 NPC portraits (Pro 64×64 with the sprite as reference, 16 candidates each) | 2485.95 | 2425.95 | 60 | |
| 2026-10-29 | City NPC redo (Mara nurse, Theo busker, Dee cab driver, as in `last-train.ts`): 3 x v3 create (6) + idle (3) + talk (3) + 3 Pro portraits (30) + 4 City ending cards (4) | 2425.95 | 2379.95 | 46 | the first City set (commuter / courier / vendor) did not match the story; its frames are kept in `npcs/city-r0/` |

**PHASE-21 total: 319 generations (2698.95 -> 2379.95) incl. the 1-gen test walk, inside the 500 emci approved (181 left). The candle flame, rain tile and palette snaps are free scripts (0 gens). Per-asset `gens` in params.json add up to 320 because a shared first frame is counted twice; the balance is the source of truth.**

**Total Lantern phase: 342 generations (3040.95 -> 2698.95), inside the 450 emci approved (108 left). VFX, the drip and the palette snaps are free scripts (0 gens).** The batch 3/4 rows are split from the receipts and the running balance, not individually re-read.

Balance at start of PHASE-15: 3,040.95 / 5,000 (Tier 2, resets 2026-11-11).
