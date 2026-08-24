import type { ImageSourcePropType } from 'react-native';

import { SHAPE_MANIFEST } from './manifests/shape';
import type {
  Anchor,
  KenneyFamilyManifest,
  KenneyPart,
  KenneyPartInstance,
  KenneyRecipe,
  KenneySprite,
} from './types';

/**
 * Registry of Kenney families. Adding a pack = register its manifest here (and
 * run the prep script). No rendering code changes.
 */
export const KENNEY_REGISTRY: Record<string, KenneyFamilyManifest> = {
  [SHAPE_MANIFEST.family]: SHAPE_MANIFEST,
};

export const DEFAULT_RECIPE: KenneyRecipe = {
  source: SHAPE_MANIFEST.family,
  parts: { body: 'circle', face: 'even', hand: 'hidden' },
  palette: null,
};

export function manifestFor(source: string): KenneyFamilyManifest {
  const manifest = KENNEY_REGISTRY[source];
  if (!manifest) return SHAPE_MANIFEST;
  return manifest;
}

/** Picks the pack's color variant nearest the recipe palette (RGB distance). */
export function nearestVariant(
  manifest: KenneyFamilyManifest,
  palette: string | null,
): string {
  if (manifest.colorVariants.length === 0) return 'default';
  if (!palette) return manifest.colorVariants[0].id;

  const hex = palette.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  let best = manifest.colorVariants[0];
  let bestDist = Infinity;
  for (const variant of manifest.colorVariants) {
    const dr = r - variant.rgb[0];
    const dg = g - variant.rgb[1];
    const db = b - variant.rgb[2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = variant;
    }
  }
  return best.id;
}

/** An asset key resolved for one part instance, in body-box units. */
export interface ResolvedInstance {
  key: string;
  sprite: KenneySprite;
  anchor: Anchor;
  flip?: boolean;
  colorable: boolean;
}

export interface ResolvedCharacter {
  manifest: KenneyFamilyManifest;
  /** Per part id, the resolved render layers (z-order, front first is up to caller). */
  layers: ResolvedLayer[];
  variant: string;
}

export interface ResolvedLayer {
  partId: string;
  z: number;
  key: string;
  sprite: KenneySprite;
  instances: { anchor: Anchor; flip?: boolean }[];
  tint?: string;
}/**
 * Resolves a recipe against a manifest into concrete asset keys + placements.
 * Zero family-specific logic: every branch is driven by manifest fields.
 */
export function resolveCharacter(recipe: KenneyRecipe): ResolvedCharacter {
  const manifest = manifestFor(recipe.source);
  const variant = nearestVariant(manifest, recipe.palette);
  const activeStates = new Map<string, string>();

  // Find each part's active state from the recipe (fall back to first state).
  for (const part of manifest.parts) {
    const chosen = recipe.parts[part.id];
    const stateId = chosen && part.states[chosen] ? chosen : Object.keys(part.states)[0];
    if (stateId !== undefined) activeStates.set(part.id, stateId);
  }

  const layers: ResolvedLayer[] = [];

  for (const part of manifest.parts) {
    const stateId = activeStates.get(part.id);
    if (stateId === undefined) continue;
    const sprite = part.states[stateId];

    // Instances come from the part itself, or (body-hosted parts) from the
    // active state of whatever part declares a placement for this part.
    let instances = part.instances;
    if (!instances || instances.length === 0) {
      for (const host of manifest.parts) {
        const hostStateId = activeStates.get(host.id);
        const hostSprite = hostStateId ? host.states[hostStateId] : undefined;
        const placed = hostSprite?.places?.[part.id];
        if (placed) {
          instances = placed;
          break;
        }
      }
    }
    if (!instances || instances.length === 0) continue;

    // `hidden` is a magic rest state: the part contributes no render layer.
    // The renderer also double-guards, but skip the (missing) asset lookup here.
    if (isHiddenState(sprite)) continue;

    const key = assetKey(manifest, part, sprite, variant);
    layers.push({ partId: part.id, z: part.z, key, sprite, instances });
  }

  layers.sort((a, b) => a.z - b.z);
  return { manifest, layers, variant };
}

/** The generated-asset key for a part state (variant applied when colorable). */
export function assetKey(
  manifest: KenneyFamilyManifest,
  part: KenneyPart,
  sprite: KenneySprite,
  variant: string,
): string {
  const fileName = part.colorable ? `${sprite.asset}.${variant}.png` : `${sprite.asset}.png`;
  return `${manifest.family}/${part.id}/${fileName}`;
}

/** True when a state means "render nothing for this part" (hands at rest). */
export function isHiddenState(sprite: KenneySprite): boolean {
  return sprite.asset === 'hidden';
}

const LEGACY_LOOKS: Record<string, string> = {
  face_a: 'even',
  face_b: 'tired',
  face_c: 'listen',
  face_d: 'set',
};

/**
 * Coerces any stored `me.recipe` value into a KenneyRecipe. Handles the new
 * {source, parts, palette} shape, migrates the legacy shape/monster recipes,
 * and the even-older string look names. Unknown values fall back to the
 * default shape recipe.
 */
export function normalizeRecipe(raw: unknown): KenneyRecipe {
  if (typeof raw === 'string') {
    const look = LEGACY_LOOKS[raw] ?? raw;
    const facePart = SHAPE_MANIFEST.parts.find((p) => p.id === 'face');
    const face = facePart?.states[look] ? look : DEFAULT_RECIPE.parts.face;
    return {
      source: SHAPE_MANIFEST.family,
      parts: { ...DEFAULT_RECIPE.parts, face },
      palette: null,
    };
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return DEFAULT_RECIPE;
  }

  const maybe = raw as Record<string, unknown>;
  const palette =
    typeof maybe.palette === 'string' && /^#[0-9a-fA-F]{6}$/.test(maybe.palette)
      ? maybe.palette.toLowerCase()
      : null;

  // New shape: { source, parts, palette }.
  if (maybe.source === SHAPE_MANIFEST.family && typeof maybe.parts === 'object' && maybe.parts) {
    const parts = maybe.parts as Record<string, unknown>;
    const out = { ...DEFAULT_RECIPE.parts };
    for (const [partId, stateId] of Object.entries(parts)) {
      if (typeof stateId !== 'string') continue;
      const part = SHAPE_MANIFEST.parts.find((p) => p.id === partId);
      if (part && part.states[stateId]) out[partId] = stateId;
    }
    return { source: SHAPE_MANIFEST.family, parts: out, palette };
  }

  // Legacy shape: { source: 'shape', base, top, hair, palette }.
  if (maybe.source === 'shape') {
    const base = typeof maybe.base === 'string' ? maybe.base : 'circle';
    const top = typeof maybe.top === 'string' ? maybe.top : 'even';
    const part = SHAPE_MANIFEST.parts.find((p) => p.id === 'body');
    const facePart = SHAPE_MANIFEST.parts.find((p) => p.id === 'face');
    const bodyState = part && part.states[base] ? base : DEFAULT_RECIPE.parts.body;
    const faceState =
      facePart && (facePart.states[top] ?? facePart.states[LEGACY_LOOKS[top] ?? ''])
        ? (facePart.states[top] ? top : (LEGACY_LOOKS[top] ?? DEFAULT_RECIPE.parts.face))
        : DEFAULT_RECIPE.parts.face;
    return {
      source: SHAPE_MANIFEST.family,
      parts: { ...DEFAULT_RECIPE.parts, body: bodyState, face: faceState },
      palette,
    };
  }

  // Legacy monster recipes have no manifest yet — swap to the default shape look.
  return DEFAULT_RECIPE;
}

export type { KenneyRecipe, KenneyPartInstance, ImageSourcePropType };
