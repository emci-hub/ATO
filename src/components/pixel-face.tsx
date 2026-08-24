import { useMemo } from 'react';

import { accentFromShowUp } from '@/lib/color';
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
}

/**
 * The app-facing face component. All rendering now flows through the generic
 * Kenney pipeline — the recipe is family-agnostic and the manifest does the
 * rest. The old per-family renderers are gone.
 */
export function PixelFace({ recipe, size = 96, showUp, animated = true }: PixelFaceProps) {
  // Memoize so the animation layer's effect deps stay stable across parent
  // re-renders (otherwise the blink/gesture timers would keep resetting).
  const effective = useMemo(() => {
    const palette = recipe.palette ?? (showUp ? accentFromShowUp(showUp).light : null);
    return palette && palette !== recipe.palette ? { ...recipe, palette } : recipe;
  }, [recipe, showUp]);

  return animated ? (
    <AnimatedKenneyCharacter recipe={effective} size={size} />
  ) : (
    <KenneyCharacter recipe={effective} size={size} />
  );
}
