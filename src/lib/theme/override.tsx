import { createContext, useContext, type ReactNode } from 'react';

import type { AppearanceTokens } from '@/constants/appearance';

/**
 * Subtree appearance override.
 *
 * The app-wide mode lives in `AppearanceProvider` (Soft / Zen / Quest / Neon /
 * Anime). A mini-app inside the app — Divecore Play — must NOT inherit the
 * viewer's mode and must NOT call `setAppearance` to change it, so it shadows
 * `useTheme()` for its own subtree instead. `useTheme` prefers this value when
 * present; everything below the provider (ThemedText / ThemedView / play
 * screens) then reads the forced tokens with no per-component changes.
 */
const ThemeOverrideContext = createContext<AppearanceTokens | null>(null);

export function ThemeOverrideProvider({
  tokens,
  children,
}: {
  tokens: AppearanceTokens;
  children: ReactNode;
}) {
  return <ThemeOverrideContext.Provider value={tokens}>{children}</ThemeOverrideContext.Provider>;
}

/** The forced tokens for this subtree, or null when the app mode applies. */
export function useThemeOverride(): AppearanceTokens | null {
  return useContext(ThemeOverrideContext);
}
