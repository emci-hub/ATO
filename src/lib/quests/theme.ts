/** Rajdhani Bold, the same family as `Fonts.displayBold` (not imported: constants/theme pulls in CSS, which the offline check cannot load). */
const DISPLAY_BOLD = 'Rajdhani_700Bold';

/**
 * Quests v3 UI tokens (ATO-BUILD §1.8). Dark in every appearance mode: the
 * Quests screens never read the appearance mode (R06). Nothing here is
 * animated; motion timings come from `motion-tokens.ts`.
 */
export const QT = {
  bg: '#070B16',
  glassFill: 'rgba(16,22,40,0.62)',
  glassBorder: 'rgba(255,255,255,0.09)',
  glassHighlight: 'rgba(255,255,255,0.06)',
  text: '#F2F6FC',
  sub: '#9AA8BF',
  cyan: '#22D3EE',
  sky: '#67E8F9',
  violet: '#6366F1',
  amber: '#F9C22B',
  amberSoft: '#FDE68A',
  rose: '#FF5C7A',
  teal: '#5EEAD4',
  track: 'rgba(255,255,255,0.08)',
} as const;

/** 135° primary gradient stops (drawn with SVG: no gradient library is installed). */
export const QT_GRADIENT = [
  { offset: 0, color: '#5EEAD4' },
  { offset: 0.45, color: '#22D3EE' },
  { offset: 1, color: '#6366F1' },
] as const;

export const QT_RADIUS = { card: 20, choice: 18, stat: 16, tile: 14, pill: 999 } as const;

export const QT_SPACE = { gutter: 16, cardGap: 12, choiceGap: 10, pad: 16 } as const;

export const QT_SHADOW = {
  card: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  glow: { shadowColor: QT.cyan, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  commit: { shadowColor: QT.amber, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
} as const;

/** Type scale. Display, headings and numbers are Rajdhani; narration and UI text are the system font. */
export const QT_TYPE = {
  display: { fontFamily: DISPLAY_BOLD, fontSize: 38, lineHeight: 44 },
  h1: { fontFamily: DISPLAY_BOLD, fontSize: 30, lineHeight: 34 },
  h2: { fontFamily: DISPLAY_BOLD, fontSize: 20, lineHeight: 24 },
  body: { fontSize: 17, lineHeight: 26, fontWeight: '400' as const },
  ui: { fontSize: 16, lineHeight: 20, fontWeight: '600' as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 1.4, textTransform: 'uppercase' as const },
  number: { fontFamily: DISPLAY_BOLD },
} as const;

/** Stat bars: 6 pt tall, radius 99. Renown is a cyan→violet gradient, so it names two colours. */
export const QT_BAR = {
  height: 6,
  radius: 99,
  fill: { supplies: QT.amber, morale: QT.rose, renown: QT.cyan } as const,
  renownEnd: QT.violet,
} as const;

/** The plate (stage) height: 220 pt on a small phone, taller on a big one. */
export function plateHeight(windowHeight: number): number {
  return windowHeight <= 700 ? 220 : Math.min(380, Math.round(windowHeight * 0.4));
}

/** One art pixel is two points (§1.9). */
export const ART_PX = 2;
