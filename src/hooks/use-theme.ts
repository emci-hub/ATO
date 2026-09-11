import type { AppearanceTokens } from '@/constants/appearance';
import { useAppearance } from '@/lib/theme/context';
import { useThemeOverride } from '@/lib/theme/override';

/**
 * The tokens a component paints with.
 *
 * A `ThemeOverrideProvider` in the tree (Divecore Play forces Neon Viper) wins
 * over the app-wide appearance mode, so a mini-app can own its chrome without
 * mutating the viewer's chosen mode.
 *
 * Both hooks are always called (never `override ?? useAppearance()`), so the
 * hook order stays stable across renders.
 */
export function useTheme(): AppearanceTokens {
  const override = useThemeOverride();
  const { tokens } = useAppearance();
  return override ?? tokens;
}
