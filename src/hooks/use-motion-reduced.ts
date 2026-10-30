import { useReducedMotion } from 'react-native-reanimated';

import { useAppearance } from '@/lib/theme/context';

/**
 * Reduce Motion for the motion primitives: the phone's setting (Reanimated)
 * or the app's own read of it (`useAppearance`), or a preview override
 * (`force`, used by the theme lab). Both hooks always run, in a fixed order.
 */
export function useMotionReduced(force = false): boolean {
  const system = useReducedMotion();
  const { reduceMotion } = useAppearance();
  return force || system || reduceMotion;
}
