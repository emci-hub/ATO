import '@/global.css';

import { Platform } from 'react-native';

import { APPEARANCES } from '@/constants/appearance';

export type { ThemeColor } from '@/constants/appearance';
export { APPEARANCES, APPEARANCE_IDS, APPEARANCE_LABELS } from '@/constants/appearance';

/** @deprecated System light/dark is superseded by the five appearance modes. Soft/Quest kept as aliases for any leftover scheme reads. */
export const Colors = {
  light: {
    text: APPEARANCES.soft.text,
    background: APPEARANCES.soft.background,
    backgroundElement: APPEARANCES.soft.backgroundElement,
    backgroundSelected: APPEARANCES.soft.backgroundSelected,
    textSecondary: APPEARANCES.soft.textSecondary,
  },
  dark: {
    text: APPEARANCES.quest.text,
    background: APPEARANCES.quest.background,
    backgroundElement: APPEARANCES.quest.backgroundElement,
    backgroundSelected: APPEARANCES.quest.backgroundSelected,
    textSecondary: APPEARANCES.quest.textSecondary,
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
