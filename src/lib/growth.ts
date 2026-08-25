/**
 * Growth tiers on Sage's pixel — two independent visual axes, derived LIVE from
 * existing ME fields (no cached "current tier" that could need reconciling).
 *
 * Tiers only ever increase by construction: each axis is a pure function of a
 * monotonically-increasing count, so there is no demotion logic to write and no
 * decay.
 */

// --- Presence axis (drives glow intensity) --------------------------------

export const PRESENCE_TIERS = [
  { min: 0, level: 0 },
  { min: 3, level: 1 },
  { min: 7, level: 2 },
  { min: 21, level: 3 },
] as const;

/** Presence thresholds that trigger a one-time milestone celebration. */
export const PRESENCE_MILESTONES = [7, 21] as const;

/** Presence tier (0-3) from all-time check count. Monotonic by construction. */
export function presenceTier(checkCount: number): number {
  let level = 0;
  for (const tier of PRESENCE_TIERS) {
    if (checkCount >= tier.min) level = tier.level;
  }
  return level;
}

// --- Depth axis (drives a separate sparkle/spark marker) ------------------

export const DEPTH_TIERS = [
  { min: 0, level: 0 },
  { min: 3, level: 1 },
  { min: 8, level: 2 },
] as const;

/** Depth tier (0-2) from the number of facts the user has told Sage. */
export function depthTier(factCount: number): number {
  let level = 0;
  for (const tier of DEPTH_TIERS) {
    if (factCount >= tier.min) level = tier.level;
  }
  return level;
}

/** Glow opacity per presence tier (0 = none, matching Home's plain look). */
export const PRESENCE_GLOW_ALPHA: readonly number[] = [0, 0.35, 0.55, 0.75];

/** Whether a presence tier shows any glow at all (tier 0 = plain like Home). */
export function hasPresenceGlow(level: number): boolean {
  return level > 0;
}

// --- Neon glow color derivation -------------------------------------------

/** Parse a hex (#rrggbb) or HSL (hsl(h, s%, l%)) color into {h,s,l}. */
function toHsl(color: string): { h: number; s: number; l: number } | null {
  const hex = color.trim().match(/^#?([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    const r = ((n >> 16) & 0xff) / 255;
    const g = ((n >> 8) & 0xff) / 255;
    const b = (n & 0xff) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }
  const m = color.trim().match(/^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i);
  if (m) {
    return { h: parseFloat(m[1]), s: parseFloat(m[2]), l: parseFloat(m[3]) };
  }
  return null;
}

function rgba(h: number, s: number, l: number, a: number): string {
  return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a})`;
}

export interface NeonGlowColors {
  /** Bright near-white core right at the character's edge. */
  core: string;
  /** The character's accent color, softer halo just outside the core. */
  halo: string;
  /** The accent color, faintest and furthest out. */
  outer: string;
}

/**
 * Builds the 3-layer neon glow palette from the character's own resolved color
 * (hex or HSL). The core is a boosted near-white tint of the hue; the halo and
 * outer layers are the accent color boosted in saturation/lightness, so the
 * glow reads as "this character is glowing in their own color." Falls back to a
 * neutral warm white if the color can't be parsed.
 */
export function neonGlowColors(palette: string): NeonGlowColors {
  const parsed = toHsl(palette);
  if (!parsed) {
    return {
      core: 'hsla(45, 90%, 92%, 0.9)',
      halo: 'hsla(45, 90%, 68%, 0.55)',
      outer: 'hsla(45, 90%, 62%, 0.3)',
    };
  }
  const h = parsed.h;
  // Boost saturation/lightness from the character's own color. The halo's
  // saturation is capped ~92 so already-vivid bases (e.g. Kenney blue/pink at
  // ~78% sat) don't wash out to a near-white pastel at the +22 lightness bump.
  const s = Math.min(100, parsed.s + 25);
  const haloSat = Math.min(92, s);
  return {
    core: rgba(h, Math.min(100, s + 5), Math.min(96, parsed.l + 42), 0.95),
    halo: rgba(h, haloSat, Math.min(90, parsed.l + 22), 0.55),
    outer: rgba(h, Math.max(60, parsed.s), Math.min(85, parsed.l + 14), 0.32),
  };
}

/** How many glow layers each tier renders (1-3), plus their scale. */
export const PRESENCE_GLOW_LAYERS: readonly {
  key: 'core' | 'halo' | 'outer';
  scale: number;
  opacity: number;
}[] = [
  { key: 'core', scale: 1.0, opacity: 0.95 },
  { key: 'halo', scale: 1.25, opacity: 0.6 },
  { key: 'outer', scale: 1.55, opacity: 0.35 },
];

/** Layers to show for a given tier: tier 1 = core only, 2 = core+halo, 3 = all. */
export function presenceGlowLayersForTier(level: number): number {
  if (level <= 0) return 0;
  if (level === 1) return 1;
  if (level === 2) return 2;
  return 3;
}

/** Sparkle size/opacity per depth tier (0 = no sparkle). */
export const DEPTH_SPARKLE_ALPHA: readonly number[] = [0, 0.6, 1];

/** Whether a depth tier shows the sparkle marker. */
export function hasDepthSparkle(level: number): boolean {
  return level > 0;
}

// --- Milestone celebration ------------------------------------------------

export interface GrowthState {
  /** Live presence tier (0-3). */
  presence: number;
  /** Live depth tier (0-2). */
  depth: number;
  checkCount: number;
  factCount: number;
}

/** Derives the full live growth state for a user. Pure; no caching. */
export function growthState(
  me: { facts?: string[] | unknown } | null | undefined,
  checkCount: number,
): GrowthState {
  const facts = Array.isArray(me?.facts) ? (me.facts as string[]) : [];
  return {
    presence: presenceTier(checkCount),
    depth: depthTier(facts.length),
    checkCount,
    factCount: facts.length,
  };
}

/** True if the presence threshold is a milestone that hasn't been celebrated yet. */
export function shouldCelebrateMilestone(
  state: GrowthState,
  milestone: number,
  celebrated: Record<string, string> | undefined,
): boolean {
  if (state.checkCount < milestone) return false;
  return !celebrated?.[String(milestone)];
}
