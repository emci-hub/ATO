/**
 * Set / variant / part inference for the art library.
 *
 * Conventions (see PR report for sources):
 *   category / set / variant / clips
 *   heroes/kitsune/streetwear  — set = character, variant = skin (Spine + Unity)
 *   tiles/streetwear/road-path — set = theme, variant = part (LDtk/Tiled + Kenney)
 *   fx/rat/default             — set = effect family, variant = default skin
 *   icons/shop/streetwear      — set = pack, variant = look
 *
 * `default` is the Spine fallback skin name when there is no look folder.
 */
import type { ArtCategory } from '../src/art/registry.types';
import { stripUsageFolder } from './art-categories';

export const DEFAULT_VARIANT = 'default';

const LOOKS = new Set([
  'streetwear',
  'cast',
  'primal',
  'dungeon-legends',
  'classic',
  'template',
  'third-party-kenney',
  'third-party-craftpix',
  'third-party-scribble',
  DEFAULT_VARIANT,
]);

function stem(rel: string): string {
  const base = rel.split('/').pop() ?? rel;
  return base.replace(/\.[^.]+$/, '');
}

function isFile(name: string): boolean {
  return /\.(png|json|webp)$/i.test(name);
}

/** rat-run / pigeon-peck / note2 → family name (fx bundles). */
export function familyFromStem(name: string): string {
  return name.replace(/\d+$/, '').replace(/-(run|peck|idle|walk|attack|loop|on|off)$/i, '') || name;
}

export function inferPart(rel: string, id: string): string {
  const file = rel.split('/').pop() ?? id;
  const atlas = /\.(core|combat|ui)\./i.exec(file);
  if (atlas) return atlas[1].toLowerCase();
  return stem(file);
}

export function inferSetVariant(
  rel: string,
  category: ArtCategory,
  id: string,
): { set: string; variant: string; part: string } {
  const core = stripUsageFolder(rel.replace(/^assets\/art\//, ''));
  const parts = core.split('/').filter(Boolean);
  const rest = parts[0] === category ? parts.slice(1) : parts;
  const folders = rest.filter((p) => !isFile(p));
  const file = rest[rest.length - 1] ?? id;
  const part = inferPart(core, id);

  if (category === 'heroes' || category === 'enemies-bosses') {
    return {
      set: folders[0] || familyFromStem(stem(file)),
      variant: folders[1] || DEFAULT_VARIANT,
      part,
    };
  }
  if (category === 'rooms') {
    return { set: folders[0] || 'room', variant: DEFAULT_VARIANT, part };
  }
  if (category === 'tiles') {
    return {
      set: folders[0] || 'tiles',
      variant: folders[1] || DEFAULT_VARIANT,
      part,
    };
  }
  if (category === 'icons' || category === 'ui' || category === 'props') {
    const look = folders.find((p) => LOOKS.has(p));
    const set = folders.find((p) => !LOOKS.has(p)) || folders[0] || familyFromStem(stem(file));
    return { set, variant: look || DEFAULT_VARIANT, part };
  }
  if (category === 'fx') {
    const look = folders.find((p) => LOOKS.has(p));
    const named = folders.find((p) => !LOOKS.has(p));
    return { set: named || familyFromStem(stem(file)), variant: look || DEFAULT_VARIANT, part };
  }
  if (category === 'backgrounds' || category === 'branding') {
    const look = folders.find((p) => LOOKS.has(p));
    return { set: familyFromStem(stem(file)), variant: look || DEFAULT_VARIANT, part };
  }
  return {
    set: folders[0] || familyFromStem(stem(file)),
    variant: folders[1] || folders.find((p) => LOOKS.has(p)) || DEFAULT_VARIANT,
    part,
  };
}

export function setKey(category: string, set: string): string {
  return `${category}/${set}`;
}

export function pickMainVariant(variants: string[], inUseVariant?: string | null): string {
  if (inUseVariant && variants.includes(inUseVariant)) return inUseVariant;
  if (variants.includes('streetwear')) return 'streetwear';
  if (variants.includes(DEFAULT_VARIANT)) return DEFAULT_VARIANT;
  return [...variants].sort((a, b) => a.localeCompare(b))[0] ?? DEFAULT_VARIANT;
}
