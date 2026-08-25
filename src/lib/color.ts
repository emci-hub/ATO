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
 * Derives a stable accent color from the user's "show_up" answer.
 * Same answer always maps to the same hue.
 */
export function accentFromShowUp(showUp: string | null | undefined): AccentColor {
  if (!showUp || !showUp.trim()) return DEFAULT_ACCENT;

  const hue = hashString(showUp.trim().toLowerCase()) % 360;
  return {
    light: `hsl(${hue}, 65%, 50%)`,
    dark: `hsl(${hue}, 70%, 62%)`,
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
