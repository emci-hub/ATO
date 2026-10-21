---
name: turf-war-units-clips-facts
description: Turf War towers/hero-tower/Avatar/pet-pounce wiring, per-unit clip inventory (no death/victory anywhere for heroes), sword meaning, fixed-region pins
metadata:
  type: reference
---

- Towers: defend.ts:196 TowerKind archer|vine|crystal (TOWER_DEFS 232), max lvl 3, MAX_TOWERS 6 (222). Art towers = ghost/lux/viper (rotations+Idle+Attack+Skill, 8 dirs) in assets/play/sheets/streetwear/towers; TOWER_SLOTS skeletons.ts:18.
- A hero-bound tower already exists (defend.ts:394-444, HERO_TOWER_STATS, BOUND_HERO_TOWER_CLIPS idle/attack/skill heroes-data.ts:104; max 2 bound bosses :386). The Avatar (draggable hero, auto attack AVATAR_RANGE 15 defend.ts:129) is drawn defend-screen.tsx:2874-2885 box = max(70, boardSize*0.275) (5121-5123) — scaled with board, NOT 1:1.
- Pet already acts in Turf only as a once/wave "pet pounce" button (castPetPounce defend.ts:1306, defend-screen.tsx:2687); no pet sprite on the board.
- Heroes data src/play/data/heroes.json (16 heroes; clips idle/walk/dash/attack/skill/hurt, 'ew' faces only). HERO_CLIPS heroes-data.ts:85. No death/KO/victory/cast slot anywhere for heroes; creeps/boss have Death. Pets (pet-actor.ts:7-13) are Cast creeps (idle+walk) or Cast heroes; pet.* art in registry (buffalo, cobra, gorilla...) = primal, rotations only, off-style.
- Swords = element swords inventory (swords.json, 48px icons 5 rarities x 21 elements, swords/atlas.png); swordRuntime (swords.ts:792) gives cooldown/strike mult + color for aura/fx in defend-screen:1472,2860. Not held weapon art.
- Fixed regions: stage-frame.ts:43-44 turf-setup/turf-wave REGIONS; check-fixed-regions.ts:35,60-64 pins Turf (one frame for setup+wave, NoticeLane).
