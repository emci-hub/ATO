import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import type { AppearanceTokens } from '@/constants/appearance';

/**
 * React Navigation (and NativeTabs on iOS) paint the tab screen / bar from
 * `colors.background` and `colors.card`. Stock DefaultTheme.card is white, so
 * Zen (and any light mode that isn't Soft-white) used to show a system-white
 * bar. DarkTheme is near-black, not Quest/Neon/Anime. Always pass the live
 * appearance tokens through.
 */
export function navigationTheme(theme: AppearanceTokens): Theme {
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const border = theme.border === 'transparent' ? theme.background : theme.border;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.accent,
      background: theme.background,
      card: theme.background,
      text: theme.text,
      border,
      notification: theme.accentSecondary,
    },
  };
}
