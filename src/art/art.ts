/**
 * Art library accessors. Code uses ids only: `getArt('hero.kael.streetwear')`
 * / `findArt({ type: 'prop', theme: 'streetwear', placement: 'floor' })`.
 *
 * Image sources come from `generated-art.ts` (literal require()s for Metro).
 */
import type { ImageSourcePropType } from 'react-native';

import registryJson from '../../assets/art/registry.json';
import type { ArtAsset, ArtRegistry } from '@/art/registry.types';
import { ART_SOURCES, type ArtId } from '@/art/generated-art';

const registry = registryJson as ArtRegistry;

const byId = new Map<string, ArtAsset>();
for (const asset of registry.assets) byId.set(asset.id, asset);

export type { ArtId, ArtAsset };

export type ArtQuery = {
  category?: string;
  type?: string;
  theme?: string;
  placement?: string;
  tags?: string[];
  status?: string;
  role?: string;
  inUse?: boolean;
};

export function allArt(): ArtAsset[] {
  return registry.assets;
}

export function getArt(id: ArtId | string): ArtAsset | undefined {
  return byId.get(id);
}

export function getArtSource(id: ArtId | string): ImageSourcePropType | undefined {
  return ART_SOURCES[id];
}

export function findArt(query: ArtQuery): ArtAsset[] {
  return registry.assets.filter((a) => {
    if (a.status === 'archived' || a.status === 'deprecated') return false;
    if (query.category && a.category !== query.category) return false;
    if (query.type && a.type !== query.type) return false;
    if (query.theme && a.theme !== query.theme) return false;
    if (query.placement && a.placement !== query.placement) return false;
    if (query.status && a.status !== query.status) return false;
    if (query.inUse !== undefined && a.inUse !== query.inUse) return false;
    if (query.tags && query.tags.length > 0) {
      const have = new Set(a.tags ?? []);
      if (!query.tags.every((t) => have.has(t))) return false;
    }
    if (query.role && !(a.tags ?? []).includes(`role:${query.role}`)) return false;
    return true;
  });
}

export type ClipFrame = {
  id: string;
  sheet: ImageSourcePropType;
  sheetW: number;
  sheetH: number;
  rect: { x: number; y: number; w: number; h: number };
  trim?: { offsetX: number; offsetY: number; sourceW: number; sourceH: number };
  ms: number;
};

/** Resolve one clip frame from a character/fx atlas entry. */
export function getClip(id: ArtId | string, clip: string, dir: string, frame: number): ClipFrame | undefined {
  const asset = getArt(id);
  const source = getArtSource(id);
  if (!asset || !source || !asset.atlas) return undefined;
  const entry = asset.clips?.[clip];
  if (!entry) return undefined;
  return {
    id: asset.id,
    sheet: source,
    sheetW: asset.size.w,
    sheetH: asset.size.h,
    rect: { x: 0, y: 0, w: asset.size.w, h: asset.size.h },
    trim: asset.trim,
    ms: Array.isArray(entry.ms) ? (entry.ms[frame] ?? entry.ms[0] ?? 100) : entry.ms,
  };
}
