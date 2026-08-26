/**
 * WCAG contrast helpers. Kept free of React Native so Node checks can import it.
 */

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** WCAG contrast ratio between two hex colors. */
export function contrastRatio(foreground: string, background: string): number | null {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  if (l1 == null || l2 == null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsAa(foreground: string, background: string, min = 4.5): boolean {
  const ratio = contrastRatio(foreground, background);
  return ratio != null && ratio >= min;
}
