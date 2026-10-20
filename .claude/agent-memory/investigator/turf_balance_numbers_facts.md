---
name: turf-balance-numbers-facts
description: Turf War numbers (waves, HP, scrap, rewards), stale Main 1-20 copy, balance report age, helper daze/leash/splash seams
metadata:
  type: reference
---

- MAIN_WAVE_COUNT = 10 (playStore.ts:420), TRIAL 5; wave-tables.json + waves.json only cover Main 1-10 (bosses Trial5/Main5/Main10). UI copy defend-screen.tsx:4392 still says "Main 1-20" (stale). waveSpeedMult (>10) is dead.
- games/grove/BALANCE_REPORT.md dated 2026-09-30, pre-helper/pet/per-hero-gear; `npm run sim:balance` WRITES that file (don't run). Sim has no helper model.
- Puff HP = 40*(1+0.12*(wave-1))*cyclePower (defend.ts:947, tune.ts:97); boss mult 6/10/16; scrap 3/kill, start 80, towers 40, upgrades 40/90, cap 6 (defend.ts:247-291). Hero towers cost 0 and dominate sims.
- Helper daze: constants turf-team.ts:49-53; logic defend.ts:1364-1418; swing timer resets to 5s at getup (1385). Proof 10_000 exactly still dazes at 10s (same-tick); needs >10_000. Pins: check-turf-team.ts:104,416.
- Damage numbers = HP diff per puff (defend-screen.tsx diffPuffEvents 472), not hit events; legendary splash (defend.ts:1445) not in hits[] so no colour/hit FX, MAX_FLOATERS 8 (430).
- Follow spot fallback chain turf-team.ts:261-291; last line snapHelperSpot goes past leash; check allows <2*leash (check-turf-team.ts:188-199).
