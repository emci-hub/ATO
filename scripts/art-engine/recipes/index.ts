/** Recipe registry. A recipe turns a hero rotation + rig into clip frames. Add new recipes here only. */
import type { PNG } from 'pngjs';

import type { DirectionRig, Rig } from '../rig';
import { applyBreathingIdle, type RecipeClip } from './breathing-idle';

export type Recipe = {
  id: string;
  /** Tier A recipes cost 0 PixelLab generations. */
  tier: 'A';
  apply: (rotation: PNG, rig: Rig, dir: DirectionRig) => RecipeClip;
};

export const RECIPES: Record<string, Recipe> = {
  'breathing-idle': { id: 'breathing-idle', tier: 'A', apply: applyBreathingIdle },
};

export function getRecipe(id: string): Recipe {
  const r = RECIPES[id];
  if (!r) throw new Error(`unknown recipe "${id}" (have: ${Object.keys(RECIPES).join(', ')})`);
  return r;
}
