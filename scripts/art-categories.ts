/**
 * Top-level art library folders. Classify by what the file is, not the old path.
 *
 *   assets/art/<category>/in-use/<set>/<variant>/…   referenced by code
 *   assets/art/<category>/unused/<set>/<variant>/…   not referenced
 *   set = family (kitsune, lightning, cyberpunk); variant = look/part (streetwear, walls, default)
 *   assets/art/rooms/<room>/         live Hideout packs (equivalent in-use split;
 *                                   hideout-art.ts + room-map checks import these)
 *   assets/art/rooms/unused/…        unused room stills
 *   misc/ last resort (aim ~0)
 */
import type { ArtCategory, ArtType } from '../src/art/registry.types';
import { ART_CATEGORIES } from '../src/art/registry.types';

export { ART_CATEGORIES };

export type ClassifiedArt = {
  dest: string;
  category: ArtCategory;
  type: ArtType;
};

const KNOWN = new Set<string>(ART_CATEGORIES);

const TOWERS = new Set(['ghost', 'lux', 'viper']);
const BOSSES = new Set(['oni', 'titan-x', 'abyssal-demon-guardian']);
const CREEPS = new Set(['knight', 'village-girl', 'wizard']);

/** Scribble cells that are furniture/decor, not floor/wall tiles. */
const SCRIBBLE_PROP =
  /^(floor-)?(barrels?(?:-stacked)?|bed(?:-luxurious)?|campfire|carpet|cart|chair|chest|coffin|crate(?:-small)?|dragon|plants|table|tree|track-cart)$/i;

const UI_BUTTON_BAR = /^(button-|health-bar|card-frame|panel-frame)/i;
const TAB_ICON = /^(explore|home)(-[23]x)?$/i;
const BRAND_TMPL = /^(expo-badge|react-logo|tutorial-web)/i;
const RARITY_FRAME = /^frame-/i;
const RARITY_GEM = /^gem-/i;
const CURRENCY = /^cur-/i;
const NAV_TAB = /^(tab-|settings$)/i;

function stem(rel: string): string {
  const base = rel.split('/').pop() ?? rel;
  return base.replace(/\.[^.]+$/, '');
}

function join(parts: (string | undefined)[]): string {
  return parts.filter((p) => p != null && p !== '').join('/');
}

function stripLegendPrefix(name: string): string {
  return name.replace(/^\d+-/, '').replace(/^free-bonus-/, '');
}

function enemyType(slug: string): ArtType {
  if (TOWERS.has(slug)) return 'tower';
  if (BOSSES.has(slug) || /demon|guardian|boss/.test(slug)) return 'boss';
  if (CREEPS.has(slug)) return 'creep';
  return 'boss';
}

function heroType(theme: string): ArtType {
  if (theme === 'primal') return 'pet';
  if (theme === 'dungeon-legends') return 'npc';
  return 'character';
}

export function stripUsageFolder(rel: string): string {
  const parts = rel.split('/');
  if (parts[1] === 'in-use' || parts[1] === 'unused') {
    return [parts[0], ...parts.slice(2)].join('/');
  }
  return rel;
}

export function usageFolderOf(rel: string): 'in-use' | 'unused' | null {
  const p = rel.split('/')[1];
  if (p === 'in-use' || p === 'unused') return p;
  return null;
}

/** Core dest (no in-use/unused) + usage folder. Live room packs stay at rooms/<room>/. */
export function placeWithUsage(coreRel: string, inUse: boolean): string {
  const parts = coreRel.split('/');
  const category = parts[0] ?? 'misc';
  const rest = parts.slice(1).join('/');
  if (category === 'rooms' && inUse) return coreRel;
  return join([category, inUse ? 'in-use' : 'unused', rest]);
}

/** Classify a path relative to `assets/art/`. Idempotent on the new layout. */
export function classifyArt(input: string): ClassifiedArt {
  const rel = stripUsageFolder(input);
  const parts = rel.split('/');
  const top = parts[0] ?? '';
  const file = parts[parts.length - 1] ?? '';

  if (top === 'shared' || top === '_contact') {
    return { dest: rel, category: 'misc', type: 'ui' };
  }

  if (top === 'brand' || top === 'branding') {
    const rest = top === 'brand' ? parts.slice(1).join('/') : parts.slice(1).join('/');
    return { dest: join(['branding', rest]), category: 'branding', type: 'brand' };
  }

  if (top === 'backgrounds') {
    return { dest: rel, category: 'backgrounds', type: 'background' };
  }

  if (top === 'tiles') {
    const name = stem(rel);
    if (rel.includes('scribble') && SCRIBBLE_PROP.test(name)) {
      return { dest: join(['props', 'scribble-dungeons', file]), category: 'props', type: 'prop' };
    }
    return { dest: rel, category: 'tiles', type: 'tile' };
  }

  if (top === 'props') {
    return { dest: rel, category: 'props', type: 'prop' };
  }

  if (top === 'fx') {
    return { dest: rel, category: 'fx', type: 'fx' };
  }

  if (top === 'icons') {
    return { dest: rel, category: 'icons', type: 'icon' };
  }

  if (top === 'rooms') {
    const name = stem(rel);
    if (name === 'bar-hideout' || /^bar-/.test(name)) {
      return { dest: join(['ui', 'markers', 'streetwear', file]), category: 'ui', type: 'ui' };
    }
    if (name === 'loft-bed' || name === 'loft-lamp') {
      return { dest: join(['props', 'loft', file]), category: 'props', type: 'prop' };
    }
    return { dest: rel, category: 'rooms', type: /^zzz-/.test(name) ? 'fx' : 'room-layer' };
  }

  if (top === 'heroes') {
    const theme = parts[2] ?? 'streetwear';
    return { dest: rel, category: 'heroes', type: heroType(theme) };
  }

  if (top === 'enemies-bosses') {
    const slug = parts[1] ?? 'unknown';
    return { dest: rel, category: 'enemies-bosses', type: enemyType(slug) };
  }

  if (top === 'misc') {
    return { dest: rel, category: 'misc', type: 'ui' };
  }

  if (top === 'characters') {
    return classifyCharacters(parts, file);
  }

  if (top === 'ui') {
    return classifyUi(parts, file);
  }

  if (KNOWN.has(top)) {
    return { dest: rel, category: top as ArtCategory, type: 'ui' };
  }

  return { dest: join(['misc', rel]), category: 'misc', type: 'ui' };
}

function classifyCharacters(parts: string[], file: string): ClassifiedArt {
  const group = parts[1] ?? '';
  if (group === 'heroes') {
    const theme = parts[2] ?? 'streetwear';
    const slug = parts[3] ?? 'unknown';
    const rest = parts.slice(4).join('/');
    return { dest: join(['heroes', slug, theme, rest]), category: 'heroes', type: 'character' };
  }
  if (group === 'pets') {
    const theme = parts[2] ?? 'primal';
    const slug = parts[3] ?? 'unknown';
    const rest = parts.slice(4).join('/');
    return { dest: join(['heroes', slug, theme, rest]), category: 'heroes', type: 'pet' };
  }
  if (group === 'npcs') {
    const folder = parts[parts[3] === 'dungeon-legends' ? 4 : 3] ?? parts[parts.length - 2] ?? 'unknown';
    const raw = folder;
    const slug = stripLegendPrefix(raw);
    const idx = parts.indexOf(raw);
    const rest = idx >= 0 ? parts.slice(idx + 1).join('/') : file;
    const boss = /demon|guardian/.test(slug);
    if (boss) {
      return {
        dest: join(['enemies-bosses', slug, 'dungeon-legends', rest]),
        category: 'enemies-bosses',
        type: 'boss',
      };
    }
    return { dest: join(['heroes', slug, 'dungeon-legends', rest]), category: 'heroes', type: 'npc' };
  }
  const theme = parts[2] ?? 'cast';
  const slug = parts[3] ?? 'unknown';
  const rest = parts.slice(4).join('/');
  return {
    dest: join(['enemies-bosses', slug, theme, rest]),
    category: 'enemies-bosses',
    type: enemyType(slug),
  };
}

function classifyUi(parts: string[], file: string): ClassifiedArt {
  const name = stem(file);
  const sub = parts[1] ?? '';
  const nested = parts[2] ?? '';

  if (sub === 'markers' || sub === 'kit' || sub === 'frames') {
    return { dest: join(parts), category: 'ui', type: 'ui' };
  }

  if (sub === 'template') {
    if (TAB_ICON.test(name)) {
      return { dest: join(['icons', 'tabs', 'template', file]), category: 'icons', type: 'icon' };
    }
    if (BRAND_TMPL.test(name)) {
      return { dest: join(['branding', 'template', file]), category: 'branding', type: 'brand' };
    }
    return { dest: join(['ui', 'template', file]), category: 'ui', type: 'ui' };
  }

  if (sub === 'streetwear') {
    if (nested === 'kit') {
      return { dest: join(['ui', 'kit', 'streetwear', file]), category: 'ui', type: 'ui' };
    }
    if (nested === 'icons') {
      return { dest: join(['icons', 'streetwear', file]), category: 'icons', type: 'icon' };
    }
    if (nested === 'nav') {
      if (CURRENCY.test(name)) {
        return { dest: join(['icons', 'currency', 'streetwear', file]), category: 'icons', type: 'icon' };
      }
      if (NAV_TAB.test(name)) {
        return { dest: join(['icons', 'tabs', 'streetwear', file]), category: 'icons', type: 'icon' };
      }
      return { dest: join(['icons', 'streetwear', file]), category: 'icons', type: 'icon' };
    }
    if (nested === 'shop') {
      return { dest: join(['icons', 'shop', 'streetwear', file]), category: 'icons', type: 'icon' };
    }
    if (nested === 'swords') {
      return { dest: join(['icons', 'swords', 'streetwear', file]), category: 'icons', type: 'icon' };
    }
    if (nested === 'rarity') {
      if (RARITY_FRAME.test(name)) {
        return { dest: join(['ui', 'frames', 'streetwear', file]), category: 'ui', type: 'ui' };
      }
      if (RARITY_GEM.test(name)) {
        return { dest: join(['icons', 'rarity', 'streetwear', file]), category: 'icons', type: 'icon' };
      }
      if (name === 'shine') {
        return { dest: join(['fx', 'streetwear', file]), category: 'fx', type: 'fx' };
      }
      return { dest: join(['icons', 'rarity', 'streetwear', file]), category: 'icons', type: 'icon' };
    }
    if (nested === 'rooms') {
      let room = 'hideout';
      if (name.startsWith('loft')) room = 'loft';
      else if (name.startsWith('rooftop')) room = 'rooftop';
      else if (name.startsWith('underground') || name === 'locker') room = name === 'locker' ? 'locker' : 'underground';
      return { dest: join(['rooms', room, file]), category: 'rooms', type: 'room-layer' };
    }
    if (nested === 'ambient') {
      return { dest: join(['fx', 'streetwear', file]), category: 'fx', type: 'fx' };
    }
    if (nested === 'stops') {
      return { dest: join(['rooms', 'stops', file]), category: 'rooms', type: 'room-layer' };
    }
    if (!nested && UI_BUTTON_BAR.test(name)) {
      return { dest: join(['ui', 'streetwear', file]), category: 'ui', type: 'ui' };
    }
    if (!nested) {
      return { dest: join(['ui', 'streetwear', file]), category: 'ui', type: 'ui' };
    }
  }

  if (relIncludesKenney(parts)) {
    return { dest: join(['icons', 'third-party-kenney', file]), category: 'icons', type: 'icon' };
  }

  return { dest: join(parts), category: 'ui', type: 'ui' };
}

function relIncludesKenney(parts: string[]): boolean {
  return parts.some((p) => p.includes('kenney'));
}

export function categoryFromPath(rel: string): ArtCategory {
  return classifyArt(rel).category;
}

export function charArtRel(theme: string, group: string, slug: string): string {
  const core =
    group === 'heroes' || group === 'pets' || group === 'hero' || group === 'pet'
      ? join(['heroes', slug, theme])
      : join(['enemies-bosses', slug, theme]);
  return placeWithUsage(core, true);
}
