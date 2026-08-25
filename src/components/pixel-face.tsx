import { useMemo, type RefObject } from 'react';

import { resolveFacePalette } from '@/lib/color';
import { AnimatedKenneyCharacter, KenneyCharacter } from '@/components/kenney-character';
import type { KenneyRecipe } from '@/lib/kenney/types';

interface PixelFaceProps {
  recipe: KenneyRecipe;
  /** Side of the body's bounding box in px. Hands render outside it. */
  size?: number;
  /** Used as the palette source when the recipe has none (keeps "their color"). */
  showUp?: string | null;
  /** Set false for deterministic stills (e.g. the captured Share poster). */
  animated?: boolean;
  /** Receives the milestone celebration callback when animated. */
  celebrateRef?: RefObject<(() => void) | null>;
}

/**
 * The app-facing face component. All rendering now flows through the generic
 * Kenney pipeline — the recipe is family-agnostic and the manifest does the
 * rest. The old per-family renderers are gone.
 */
export function PixelFace({ recipe, size = 96, showUp, animated = true, celebrateRef }: PixelFaceProps) {
  // Memoize so the animation layer's effect deps stay stable across parent
  // re-renders (otherwise the blink/gesture timers would keep resetting).
  const effective = useMemo(() => {
    const palette = resolveFacePalette(recipe.palette, showUp);
    return palette && palette !== recipe.palette ? { ...recipe, palette } : recipe;
  }, [recipe, showUp]);

  return animated ? (
    <AnimatedKenneyCharacter recipe={effective} size={size} celebrateRef={celebrateRef} />
  ) : (
    <KenneyCharacter recipe={effective} size={size} />
  );
}
