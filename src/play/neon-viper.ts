/**
 * Neon Viper — the forced appearance for Divecore Play.
 *
 * Play is a mini-app: once inside, the viewer's app-wide mode (Soft / Zen /
 * Quest / Anime) is ignored and everything renders as Neon Viper Command Hub.
 * Values are COPIED from the reference sketch under
 * `games/grove/ref/neon-viper-hub/` — that folder is reference-only and is
 * never imported into the app.
 *
 * `id: 'neon'` is deliberate: the shared neon surface shadow (`lib/theme/chrome`)
 * and the cyan heading glow in `ThemedText` key off it, so Play gets the same
 * treatment with no bespoke styling.
 */
import type { AppearanceTokens } from '@/constants/appearance';

/** Raw palette for chrome the token set does not cover (borders, watermark). */
export const NEON = {
  ink: '#05070D',
  nearBlack: '#03060D',
  panel: '#090F1C',
  cyan: '#00EAFF',
  cyanDim: 'rgba(0, 234, 255, 0.18)',
  cyanBorder: 'rgba(0, 234, 255, 0.55)',
  cyanSoft: 'rgba(0, 234, 255, 0.06)',
  cyanGhost: 'rgba(0, 234, 255, 0.06)',
  pink: '#FF23C9',
  violet: '#8D5BFF',
  textPrimary: '#F1FBFF',
  textMuted: '#8FA3BF',
  hudLabel: '#5A6F88',
} as const;

/** Forced Play tokens. Same hue as the app's Neon mode, tuned to the Command Hub. */
export const NEON_VIPER_TOKENS: AppearanceTokens = {
  id: 'neon',
  scheme: 'dark',
  background: NEON.ink,
  backgroundElement: NEON.panel,
  backgroundSelected: '#121A2B',
  border: NEON.cyanDim,
  controlBorder: NEON.cyanBorder,
  text: NEON.textPrimary,
  textSecondary: NEON.textMuted,
  accent: NEON.cyan,
  accentSecondary: NEON.pink,
  accentTertiary: NEON.violet,
  // Raw cyan is too light to sit under white text; the darker cyan keeps the
  // neon read and stays legible on a filled button.
  accentFill: '#0E7490',
  onAccent: '#FFFFFF',
  emphasis: NEON.cyan,
  radius: 8,
  cardBorderWidth: 1,
  cardPadExtra: 0,
  headingLetterSpacing: 0.4,
  headingTransform: 'none',
  headingWeight: '600',
  useSerifHeadings: false,
  useMono: true,
  motionMs: 125,
  pressScale: 1,
  liftOnHover: false,
  glowPulse: true,
  scanlines: false,
  hudFrames: 'none',
  cutCorners: false,
  hpMpBars: false,
};

/** Where a Command Hub tile goes. A subset of Play's route modes. */
export type HubDestination = 'defend' | 'shop' | 'dress' | 'about';

export type HubTile = {
  id: string;
  label: string;
  subtitle: string;
  icon: 'divecore' | 'shop' | 'dress' | 'more';
  to: HubDestination;
};

/**
 * The four Command Hub tiles (visual SoT: `command-hub-target.png`).
 * Divecore opens the Defend map/board. Dive (push-your-luck) is intentionally
 * NOT on the hub for now — its screen stays in `src/app/play.tsx` but has no
 * hub entry point at this stage; it is reached by code/route only.
 */
export const HUB_TILES: HubTile[] = [
  { id: 'divecore', label: 'Divecore', subtitle: 'Enter the map', icon: 'divecore', to: 'defend' },
  { id: 'shop', label: 'Shop', subtitle: 'Spend scrap', icon: 'shop', to: 'shop' },
  { id: 'dress', label: 'Dress', subtitle: 'Customize', icon: 'dress', to: 'dress' },
  { id: 'more', label: 'More', subtitle: 'About & credits', icon: 'more', to: 'about' },
];
