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

/**
 * Platform system families, kept for body text and Zen's serif headings.
 * `mono` is NOT here — it is replaced below by the loaded Space Mono face.
 */
const SYSTEM_FONTS = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
  },
});

/**
 * Loaded in src/app/_layout.tsx via `useFonts` before the navigator paints.
 * Rajdhani carries display / headings (500 / 600 / 700); Space Mono carries
 * mono + HUD numbers (400 / 700). The family names already encode the weight,
 * so consumers must not also set `fontWeight` (it can force a synthetic or
 * system fallback face). Use `monoBold` for heavy HUD numbers.
 */
export const Fonts = {
  ...SYSTEM_FONTS,
  /** Rajdhani Medium — the lightest loaded display face. */
  display: 'Rajdhani_500Medium',
  /** Rajdhani SemiBold — default heading face. */
  displaySemiBold: 'Rajdhani_600SemiBold',
  /** Rajdhani Bold — heaviest display face. */
  displayBold: 'Rajdhani_700Bold',
  /** Space Mono Regular — mono text + HUD numbers. */
  mono: 'SpaceMono_400Regular',
  /** Space Mono Bold — emphasised HUD numbers. */
  monoBold: 'SpaceMono_700Bold',
} as const;

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
