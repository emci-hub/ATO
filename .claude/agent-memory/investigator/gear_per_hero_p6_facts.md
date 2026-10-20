---
name: gear-per-hero-p6-facts
description: Where gear/equipped lives (Legend records, NOT hero-keyed), how it feeds Turf buckets, Locker UI, checks pinning v33
metadata:
  type: project
---

- Gear is `AvatarRecord.equipped` (playStore.ts:675), records keyed by 5 elemental LEGEND ids (avatars.ts: legend_root/ember/tide/spark/void), not hero ids. Free stub unlock -> up to 5 loadouts. No Avatar<->hero relation; leader hero = `normalizedAvatarHeroId` (active pet's hero).
- Writers all use `activeAvatarOf`/`patchActiveAvatar`: equipItem/unequipItem (~5185/5217), merge (5296-5376), devOvergear/devClearEquipped, gearScoreOf (4417), nextDeeperBustPct (1668), playView (1517-1562).
- Turf: defend-screen.tsx:1526 buckets from view.statSums (active Legend gear) -> defend.ts boardMult (937) is BOARD-WIDE (towers, hero towers, bound bosses, leader, helper power at 1431). towerSpeed bucket 1044. Sword = leader aura only.
- Save: `version: 33` literal at playStore 883/1390/5949/5815; ~15 checks assert 33; additive fields (leader_folded 5980, turf_helpers 5981). Cloud save is generic JSON (cloud-save-model.ts), only 1 MB cap.
- Hideout name tag: StreetStatusStrip street-room.tsx:454, fixed 36px nowrap row pinned by check-fixed-regions:83 + check-pet-status-badge:78.
- Items: 13 in data/items.json (8 Looks... actually 6 Looks + 7 Powers incl 3 item_uni_ember_* from boss bands). token_earn/research_yield only summed in equippedStatSums (playStore 4851) + shown in dress-screen; NO consumer = do nothing. Item icons: art.ts ITEM_ICON_BY_ART (Kenney) + STREET_ICON_BY_ART (stickers, reused: shield x3, hoodie etc); no worn sprite. No per-item "works in" field; derive from stat.
- Locker = DressScreen (dress-screen.tsx:180), mode 'dress'; AvatarPicker (Legends) decides whose gear; HeroGrid only sets Avatar hero.
