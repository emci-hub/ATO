---
name: divecore-economy-facts
description: Divecore currencies, faucets/sinks, drop tables, shop, clock-trust gaps, save v33 location (checked 2026-10-18)
metadata:
  type: project
---

- Save: AsyncStorage `ato.play.store.v1` (playStore.ts:373), doc `version: 33` (:941); mirrored to server `play_saves` via `save_play_doc` (wave96, whole-doc jsonb, <=1 MiB, client-trusted, no economy validation). No ATO-token (AI) link anywhere in src/play (grep clean).
- Currencies on doc: `tokens` (soft), `shells`, `dive_charge` (cap 10, 10 min), shine/prism stones, eggs_today, shards/tickets, avatar_star_tokens, boss frags, sword/relic bag. "scrap" is in-run Turf only (tune startScrap 80), not saved.
- Faucets: recordDefendWin :3588 (50 tok base, half after 5 clears/day or replay, +150 cycle, 4 shells / 1 on replay, 1 drop roll per win incl. replays, hero egg copy on Scout/Final campaign clears, applySpeedup -1h on a room build for non-replay), claimResearch :4932 (15-40 tok per claim regardless of finds count), pet minigames 5/round cap 30/day (pet.ts:178), expeditions, dives, streak/daily.
- Shop: data/shops/token.json (tokens only); paid.json all `available:false` stubs. IAP never charges.
- Clock trust: researchAt/diveChargeAt/recordDefendWin half-cap use raw Date.now (no petDayHolds guard); pet day caps and hideout builds use guards.
- Dup eggs (P1): pet-merge.ts folds into one pet + stars, NO shard/shell refund; shards only on release/rebirth (playStore :2401).
- Bag soft cap 80 only blocks equipping a Power (:5324); drops never blocked.
