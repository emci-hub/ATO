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

/** Convert HSL (h in 0–359, s/l in 0–100) to a #rrggbb hex string. */
function hslToHex(h: number, s: number, l: number): string {
  const S = s / 100;
  const L = l / 100;
  const C = (1 - Math.abs(2 * L - 1)) * S;
  const hp = (((h % 360) + 360) % 360) / 60;
  const X = C * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) {
    r = C;
    g = X;
  } else if (hp < 2) {
    r = X;
    g = C;
  } else if (hp < 3) {
    g = C;
    b = X;
  } else if (hp < 4) {
    g = X;
    b = C;
  } else if (hp < 5) {
    r = X;
    b = C;
  } else {
    r = C;
    b = X;
  }
  const m = L - C / 2;
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Derives a stable accent color from the user's "show_up" answer.
 * Same answer always maps to the same hue. Returns hex (#rrggbb) so the same
 * value can drive CSS (poster accent) AND the Kenney color-variant matcher,
 * which only parses hex.
 */
export function accentFromShowUp(showUp: string | null | undefined): AccentColor {
  const hue = colorHueFromShowUp(showUp);
  if (hue == null) return DEFAULT_ACCENT;

  return {
    light: hslToHex(hue, 65, 50),
    dark: hslToHex(hue, 70, 62),
  };
}

/**
 * The palette a pixel face actually renders with: the recipe's explicit hex
 * palette, or the stable accent derived from `show_up`. Single source of truth
 * so the growth glow uses the exact same color as the character underneath.
 * Returns hex so `nearestVariant` can match it to the pack's color variants.
 */
export function resolveFacePalette(
  recipePalette: string | null | undefined,
  showUp: string | null | undefined,
): string {
  if (recipePalette) return recipePalette;
  return accentFromShowUp(showUp).light;
}
