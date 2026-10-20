---
name: newbie-guide-signals-facts
description: Saved "step done" signals for a newbie guide bubble, settings sheet wiring, float/hide conditions (2026-10-19)
metadata:
  type: project
---

- play_stats (play-settings.ts:263) has NO claims/defends/feeds counters: eggs_hatched, dives, surfaces, busts, best_depth, expeditions, releases, days_played. Counted from v24 only (older saves = 0).
- resetDivecore (playStore.ts:3176) = defaultPlayStore + keeps only play_settings. rebirthPetDoc (3353) keeps stats/campaign/hideout/gear/records.
- Signals: feed=game_records.catch any best>0 (or pet.care_acts&1); claim=hideout.tend_days>0 (claimResearch 5032); Turf T1=lifetime_waves_cleared>=1 or campaign.phase==='main'/wave_in_phase>1; loft=hideout.rooms_unlocked.loft; expedition=play_stats.expeditions>0; Power-worn has no counter (wornItemCount counts Looks too, playStore.ts:500).
- Settings sheet: src/play/divecore-settings.tsx (Help section ~276-293), opened from play.tsx hubSettingsOpen; onReplayTips handler play.tsx:989.
- Coach tip state is local to pet-screen.tsx:934 (shownTip) and GameScreen tipShown (stage-layout.tsx:122); no exported flag.
