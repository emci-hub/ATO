/**
 * Art library registry types (`assets/art/registry.json`).
 *
 * Ids read `<kind>.<set>[.<variant>][.<part>]`; code names them through the
 * generated typed tree (`ART.prop.<set>.<part>`), never as strings.
 * Packed atlases live under `assets/art/`; raw PixelLab output lives in `art-src/`.
 */

export const ART_REGISTRY_VERSION = 1;

/** Final (god) hero visible height in art px — props size against this, never a baby. */
export const HERO_FINAL_HEIGHT_PX = 53;

/** Hideout / room tile size in art px. */
export const ART_TILE_PX = 12;

export type ArtType =
  | 'character'
  | 'pet'
  | 'npc'
  | 'boss'
  | 'creep'
  | 'tower'
  | 'room-layer'
  | 'prop'
  | 'tile'
  | 'background'
  | 'fx'
  | 'ui'
  | 'icon'
  | 'brand';

/** Top-level library folders (`assets/art/<category>/…`). */
export type ArtCategory =
  | 'heroes'
  | 'enemies-bosses'
  | 'ui'
  | 'icons'
  | 'rooms'
  | 'props'
  | 'tiles'
  | 'fx'
  | 'backgrounds'
  | 'branding'
  | 'misc';

export const ART_CATEGORIES: readonly ArtCategory[] = [
  'heroes',
  'enemies-bosses',
  'ui',
  'icons',
  'rooms',
  'props',
  'tiles',
  'fx',
  'backgrounds',
  'branding',
  'misc',
] as const;

export const ART_CATEGORY_LABELS: Record<ArtCategory, string> = {
  heroes: 'Heroes',
  'enemies-bosses': 'Enemies / bosses',
  ui: 'UI',
  icons: 'Icons',
  rooms: 'Rooms',
  props: 'Props',
  tiles: 'Tiles',
  fx: 'FX',
  backgrounds: 'Backgrounds',
  branding: 'Branding',
  misc: 'Misc',
};

export type ArtTheme =
  | 'streetwear'
  | 'cast'
  | 'primal'
  | 'dungeon-legends'
  | 'classic'
  | 'third-party-kenney'
  | 'third-party-craftpix'
  | 'third-party-scribble'
  | 'none';

export type ArtPlacement =
  | 'floor'
  | 'back-wall'
  | 'side-wall'
  | 'wall-mounted'
  | 'ceiling'
  | 'front-occluder'
  | 'near-rim'
  | 'window'
  | 'overlay'
  | 'hud'
  | 'screen-ui'
  | 'world-marker'
  | 'map-tile'
  | 'todo';

export type ArtCamera = 'td-3q-low' | 'iso-legacy' | 'front' | 'flat-ui' | 'todo';

export type ArtStatus =
  | 'approved'
  | 'candidate'
  | 'placeholder'
  | 'alt-skin'
  | 'needs-restyle'
  | 'resource'
  | 'archived'
  | 'deprecated';

export type ArtSourceKind = 'pixellab' | 'hand' | 'pixellab+hand' | 'third-party';

export type ArtFormat = 'png8' | 'png32' | 'webp-lossless';

export type AtlasTier = 'core' | 'combat' | 'ui';

export type ArtDir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export type RestylePriority = 1 | 2 | 3;

export type PixellabPreset = 'prop' | 'tile' | 'icon' | 'char8';

export type ArtRestyle = {
  priority: RestylePriority;
  reason: string;
  pixellabPreset: PixellabPreset;
  refIds: string[];
  blockedBy?: string;
};

export type ArtAtlasRef = {
  file: string;
  json: string;
  tier: AtlasTier;
};

export type ArtClip = {
  dirs: string[];
  frames: number;
  /** Per-frame durations, or one number for every frame. Default 100 walk / 150 idle. */
  ms: number | number[];
  loop: boolean;
  mirrorW?: boolean;
};

export type ArtTrim = {
  offsetX: number;
  offsetY: number;
  sourceW: number;
  sourceH: number;
};

export type ArtAnchor = { x: number; y: number };

export type ArtFootprint = {
  w: number;
  h: number;
  originX: number;
  originY: number;
};

export type ArtSize = { w: number; h: number };

export type ArtLayers = {
  day?: string;
  night?: string;
  neonA?: string;
  neonB?: string;
  occluder?: string;
};

export type ArtAnim = {
  name: string;
  dir: string;
  frames: number;
  ms: number;
  loop: boolean;
  sheet: string;
};

export type ArtAsset = {
  id: string;
  path: string;
  category: ArtCategory;
  type: ArtType;
  theme: ArtTheme | string;
  placement: ArtPlacement | string;
  camera: ArtCamera | string;
  size: ArtSize;
  heroRelativeHeight?: number | 'todo';
  footprintTiles?: ArtFootprint | 'todo';
  sortY?: number;
  occluder?: boolean;
  layers?: ArtLayers;
  anims?: ArtAnim[];
  atlas?: ArtAtlasRef;
  clips?: Record<string, ArtClip>;
  trim?: ArtTrim;
  anchor?: ArtAnchor;
  footY?: number;
  decodedBytes?: number;
  diskBytes?: number;
  format?: ArtFormat;
  palette?: string | null;
  status: ArtStatus;
  critiqueScore?: number | null;
  source: ArtSourceKind;
  sourceRef?: string | null;
  genCount?: number;
  license?: string | null;
  /** Family folder (`heroes/kitsune`, `fx/lightning`, `tiles/streetwear`). */
  set: string;
  /** Look / skin / tileset part (`streetwear`, `cast`, `walls`, `default`). */
  variant: string;
  /** File role inside the variant (`core`, `combat`, `bolt`, stem). */
  part?: string;
  /** True when static requires / getArt / sheet manifests / registry refs point here. Recomputed by art:registry. */
  inUse: boolean;
  usedBy?: string[];
  tags?: string[];
  restyle?: ArtRestyle;
  restyleTarget?: string;
  replaces?: string | null;
  notes?: string;
  /** Old ids this asset had before a rename; getArt resolves them via ART_ALIASES. */
  legacyKeys?: string[];
};

export type ArtRegistry = {
  version: number;
  assets: ArtAsset[];
};

export type AtlasFrame = {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  duration: number;
  dir?: string;
  clip?: string;
};

/** Aseprite / TexturePacker-compatible atlas JSON plus ATO extensions. */
export type AtlasJson = {
  frames: Record<string, AtlasFrame>;
  meta: {
    app: string;
    version: string;
    image: string;
    format: ArtFormat;
    size: { w: number; h: number };
    scale: string;
    frameTags: { name: string; from: number; to: number; direction: string }[];
    anchor?: ArtAnchor;
    footY?: number;
    trim?: ArtTrim;
    dirs?: string[];
    ms?: number | number[];
    decodedBytes?: number;
    diskBytes?: number;
    tier?: AtlasTier;
    id?: string;
  };
};
