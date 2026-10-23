---
name: turf-elements-fx-facts
description: Divecore elements (tide/ember/root/spark/void) vs aura styles (rune/fire/water/earth/thunder); where element fx render; auras are PetFigure-only
metadata:
  type: project
---

- Elements = `TYPE_TAGS` tide/ember/root/spark (+void) in `src/play/engine/type-match.ts`, `kits.ts` Element/ELEMENT_COLOR. Towers: archer null, vine root, crystal spark. Heroes in `data/heroes.json` kit.element.
- Aura styles (rune/fire/water/earth/thunder) are a SEPARATE cosmetic system (`auras.ts`, `aura-view.tsx` PetAuraSprite), drawn only inside `PetFigure` (pet-figure.tsx:159,196). Turf/defend-screen never uses PetFigure or auras -> auras never show in Turf.
- Element fx sheets `sheets/streetwear/fx/<el>/{shot,hit,burst,slash,status}` are in generated-play-sheets.ts (play-art pack), NOT in registry.json (only fx.shine/spark/etc ambient there). `status` slot is never read by fx-layer (kinds used: shot/hit/burst/slash).
- fx-layer.tsx renderSprite handles all KitHit sources (tower/hero/avatar/helper/pounce) via defend-screen spawnHitFx; chain behavior stays vector; default fx quality full, cap 12.
