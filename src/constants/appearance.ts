/**
 * Five appearance modes. The previous named palette is discarded. Soft is the default.
 *
 * Structural rules (all modes):
 * - Tokens always include background, surface, border, text, textSecondary, accents.
 * - Muted/secondary text is never placed on a saturated accent fill.
 * - Filled accent surfaces always pair with onAccent (white / near-white).
 */

export const APPEARANCE_IDS = ['soft', 'zen', 'quest', 'neon', 'anime'] as const;
export type AppearanceId = (typeof APPEARANCE_IDS)[number];

export const APPEARANCE_LABELS: Record<AppearanceId, string> = {
  soft: 'Soft',
  zen: 'Zen',
  quest: 'Quest',
  neon: 'Neon',
  anime: 'Anime',
};

export type AppearanceScheme = 'light' | 'dark';

export type AppearanceTokens = {
  id: AppearanceId;
  scheme: AppearanceScheme;
  /** Page background. */
  background: string;
  /** Cards / surfaces. Aliased as backgroundElement for existing screens. */
  backgroundElement: string;
  /** Inputs, selected rows, avatars. */
  backgroundSelected: string;
  /** Hairline / panel border. Transparent when the mode uses shadow instead. */
  border: string;
  /** Primary text. */
  text: string;
  /** Muted text — only on neutral backgrounds, never on accent fills. */
  textSecondary: string;
  /** Primary accent (borders, focus, glow). */
  accent: string;
  accentSecondary: string;
  accentTertiary: string;
  /** Filled-button background — always paired with onAccent. May differ from accent when the raw accent is too light to sit under white text (Neon cyan, Zen moss). */
  accentFill: string;
  /** Text/icons on a filled accent surface. Always white / near-white. */
  onAccent: string;
  /** Title/emphasis color when it differs from body (Quest gold). */
  emphasis: string;
  radius: number;
  cardBorderWidth: number;
  /** Extra padding added to surface cards (Zen is the most generous). */
  cardPadExtra: number;
  headingLetterSpacing: number;
  headingTransform: 'none' | 'uppercase';
  headingWeight: '300' | '400' | '600' | '700';
  useSerifHeadings: boolean;
  /** Monospace only for data-like elements, and only in Neon / Anime / Quest. */
  useMono: boolean;
  motionMs: number;
  pressScale: number;
  liftOnHover: boolean;
  glowPulse: boolean;
  scanlines: boolean;
  hudFrames: 'none' | 'ornament' | 'bracket';
  cutCorners: boolean;
  hpMpBars: boolean;
};

const ON_ACCENT = '#FFFFFF';

export const APPEARANCES: Record<AppearanceId, AppearanceTokens> = {
  soft: {
    id: 'soft',
    scheme: 'light',
    background: '#F8FAFC',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F6F8FC',
    border: 'transparent',
    text: '#1F2937',
    textSecondary: '#6B7280',
    accent: '#4F46E5',
    accentSecondary: '#EC4899',
    accentTertiary: '#10B981',
    accentFill: '#4F46E5',
    onAccent: ON_ACCENT,
    emphasis: '#1F2937',
    radius: 24,
    cardBorderWidth: 0,
    cardPadExtra: 0,
    headingLetterSpacing: 0,
    headingTransform: 'none',
    headingWeight: '600',
    useSerifHeadings: false,
    useMono: false,
    motionMs: 250,
    pressScale: 1,
    liftOnHover: true,
    glowPulse: false,
    scanlines: false,
    hudFrames: 'none',
    cutCorners: false,
    hpMpBars: false,
  },
  zen: {
    id: 'zen',
    scheme: 'light',
    background: '#F5F3EE',
    backgroundElement: '#EDE9E1',
    // Light enough that secondary #6B6356 still clears 4.5:1 (input placeholders, selected rows).
    backgroundSelected: '#E8E3DA',
    // Moss at ~30% opacity — accent/border only, never text, never a fill behind text.
    border: 'rgba(138, 154, 123, 0.3)',
    text: '#4A5548',
    textSecondary: '#6B6356',
    accent: '#8A9A7B',
    accentSecondary: '#C4BBA8',
    accentTertiary: '#8A9A7B',
    // Moss/sand are border/accent only — never a fill behind text.
    accentFill: '#4A5548',
    onAccent: ON_ACCENT,
    emphasis: '#4A5548',
    radius: 2,
    cardBorderWidth: 1,
    cardPadExtra: 8,
    headingLetterSpacing: 1.4,
    headingTransform: 'none',
    headingWeight: '300',
    useSerifHeadings: true,
    useMono: false,
    motionMs: 750,
    pressScale: 1,
    liftOnHover: false,
    glowPulse: false,
    scanlines: false,
    hudFrames: 'none',
    cutCorners: false,
    hpMpBars: false,
  },
  quest: {
    id: 'quest',
    scheme: 'dark',
    background: '#0F172A',
    backgroundElement: '#1E293B',
    backgroundSelected: '#162032',
    border: '#1E40AF',
    text: '#F0F9FF',
    // Gold is titles/emphasis only — body secondary is a muted ice so paragraphs stay readable.
    textSecondary: '#94A3B8',
    accent: '#1E40AF',
    accentSecondary: '#FBBF24',
    accentTertiary: '#22C55E',
    accentFill: '#1E40AF',
    onAccent: ON_ACCENT,
    emphasis: '#FBBF24',
    radius: 6,
    cardBorderWidth: 2,
    cardPadExtra: 0,
    headingLetterSpacing: 0.6,
    headingTransform: 'none',
    headingWeight: '600',
    useSerifHeadings: false,
    useMono: true,
    motionMs: 120,
    pressScale: 0.97,
    liftOnHover: false,
    glowPulse: false,
    scanlines: false,
    hudFrames: 'ornament',
    cutCorners: false,
    hpMpBars: true,
  },
  neon: {
    id: 'neon',
    scheme: 'dark',
    background: '#0A0A0F',
    backgroundElement: '#0D0D12',
    backgroundSelected: '#16161F',
    // Thin accent border at ~30% — glow is a separate shadow layer.
    border: 'rgba(0, 255, 255, 0.3)',
    text: '#FFFFFF',
    textSecondary: '#A5F3FC',
    accent: '#00FFFF',
    accentSecondary: '#FF00FF',
    accentTertiary: '#00FFFF',
    // Raw cyan is too light under white; darker cyan fill keeps the neon read and AA.
    accentFill: '#0E7490',
    onAccent: ON_ACCENT,
    emphasis: '#FFFFFF',
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
  },
  anime: {
    id: 'anime',
    scheme: 'dark',
    background: '#0F0F1A',
    backgroundElement: 'rgba(15, 15, 26, 0.9)',
    backgroundSelected: '#1A1A2E',
    border: 'rgba(124, 58, 237, 0.55)',
    text: '#E0E0FF',
    textSecondary: '#06D6A0',
    accent: '#7C3AED',
    accentSecondary: '#06D6A0',
    accentTertiary: '#FF006E',
    accentFill: '#7C3AED',
    onAccent: ON_ACCENT,
    emphasis: '#E0E0FF',
    radius: 0,
    cardBorderWidth: 1,
    cardPadExtra: 0,
    headingLetterSpacing: 2,
    headingTransform: 'uppercase',
    headingWeight: '700',
    useSerifHeadings: false,
    useMono: true,
    motionMs: 220,
    pressScale: 0.98,
    liftOnHover: true,
    glowPulse: true,
    scanlines: true,
    hudFrames: 'bracket',
    cutCorners: true,
    hpMpBars: false,
  },
};

export const DEFAULT_APPEARANCE: AppearanceId = 'soft';

export function isAppearanceId(value: string | null | undefined): value is AppearanceId {
  return value === 'soft' || value === 'zen' || value === 'quest' || value === 'neon' || value === 'anime';
}

/** Keys ThemedText/ThemedView already understand. */
export type ThemeColor =
  | 'text'
  | 'background'
  | 'backgroundElement'
  | 'backgroundSelected'
  | 'textSecondary';
