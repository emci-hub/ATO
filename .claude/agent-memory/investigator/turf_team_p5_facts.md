---
name: turf-team-p5-facts
description: Turf War sim/avatar facts for helper-pet work (no Avatar HP, pounce, bound-hero tower reuse, save field precedent)
metadata:
  type: reference
---

- Avatar has NO sim state besides avatarCooldownMs; position is passed into stepDefendLive (defend.ts:786) from avatarPosRef (defend-screen.tsx:1205). Enemies never damage anything (defend.ts:1205 comment); lose = leak only (1235). No boss-hit event.
- Hero-bound tower (defend.ts:1072-1200) already fires hero.kit via fireKit; helper reuse = same call with a free (x,y) instead of pad. Avatar attack = AVATAR_BASE_ATTACK 12 / RANGE 15 (127-129, 999-1064).
- Pounce: castPetPounce defend.ts:1306, petPounceUsed reset by createDefendLive (544) = per-wave hook; startWave defend-screen.tsx:1680. Sim 100ms (DEFEND_TICK_MS defend.ts:497), no Math.random in defend.ts; headless users: check-kits.ts, check-pet.ts, play-balance-sim.ts, check-turf-war-layout.ts.
- Setup body = PlaySheet "Setup" (defend-screen.tsx:4107) + inline cards 4255+; board region fixed. check-fixed-regions.ts pins Turf only at lines 60-64.
- Save v33 additive field precedent: leader_folded (playStore.ts:941, default 1401, load 5932 `=== true`). pets: PetState (pet.ts:281) uid/hero/grade/shiny/stage; Den = doc.pet_den; copies via heroBookOf (playStore.ts:1762) + heroStars.
- Checks auto-collected: ota-gate.ts reads package.json check:* names; naming mixed check-*.ts and *-check.ts.
