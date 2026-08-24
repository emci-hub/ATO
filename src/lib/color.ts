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
