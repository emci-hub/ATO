/**
 * The guide's inputs, read from the live view (Divecore finish step 5). Kept apart from `guide.ts` so that file
 * stays free of the store. Every signal is state the game already saves — nothing new is stored.
 */
import type { GuideInput } from '@/play/guide';
import { canStartBuild } from '@/play/hideout-progress';
import { canClaimResearch, type PlayView } from '@/play/playStore';

export function guideInputOf(view: PlayView): GuideInput {
  const pv = view.pet;
  const pet = pv.state;
  const h = view.hideout.state;
  const catchPassed = Object.values(pv.records.catch).some((level) => level.best > 0);
  return {
    eggPicked: pet.egg != null,
    // A hatched egg, or any later proof (a Hall entry, a rebirth): a veteran is never asked to hatch again.
    hatched: pet.stage !== 'egg' || view.stats.eggs_hatched > 0 || pv.hall.length > 0 || pv.rebirths > 0,
    petOut: pet.stage !== 'egg',
    fed: catchPassed,
    dived: view.stats.dives > 0 || h.lifetime_deep_surfaces > 0,
    claimed: h.tend_days > 0,
    researchReady: canClaimResearch(view),
    wonTrial: view.lifetimeWavesCleared >= 1,
    powerWorn: view.wornPowers > 0,
    hasPower: view.bagPowers > 0,
    loftBuilt: h.rooms_unlocked.loft,
    loftBuildable: canStartBuild('loft', h, view.hideout.progress, view.tokens).ok,
    tripped: view.stats.expeditions > 0,
    tripReady: pv.expedition === 'ready',
  };
}
