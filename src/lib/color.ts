export interface AccentColor {
  light: string;
  dark: string;
}

const DEFAULT_ACCENT: AccentColor = { light: '#3c87f7', dark: '#3c87f7' };

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Discrete hue 0–359 from `show_up`. Same phrase → same hue. Used for Around
 * color blobs (≥3 going of that hue) and the poster accent.
 */
export function colorHueFromShowUp(showUp: string | null | undefined): number | null {
  if (!showUp || !showUp.trim()) return null;
  return hashString(showUp.trim().toLowerCase()) % 360;
}

export function hslForHue(hue: number, dark = false): string {
  return dark ? `hsl(${hue}, 70%, 62%)` : `hsl(${hue}, 65%, 50%)`;
}

/**
 * Derives a stable accent color from the user's "show_up" answer.
 * Same answer always maps to the same hue.
 */
export function accentFromShowUp(showUp: string | null | undefined): AccentColor {
  const hue = colorHueFromShowUp(showUp);
  if (hue == null) return DEFAULT_ACCENT;

  return {
    light: hslForHue(hue, false),
    dark: hslForHue(hue, true),
  };
}

/**
 * The palette a pixel face actually renders with: the recipe's explicit hex
 * palette, or the stable accent derived from `show_up`. Single source of truth
 * so the growth glow uses the exact same color as the character underneath.
 */
export function resolveFacePalette(
  recipePalette: string | null | undefined,
  showUp: string | null | undefined,
): string {
  if (recipePalette) return recipePalette;
  return accentFromShowUp(showUp).light;
}
