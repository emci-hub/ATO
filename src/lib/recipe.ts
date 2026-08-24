import { ImageSourcePropType } from 'react-native';

import { ShapeBaseId } from '@/lib/skeleton';

export type RecipeSource = 'shape' | 'monster';
export type RecipeSlot = 'base' | 'top' | 'hair';

/** A look swaps ONLY the face sprite. Body and hands stay fixed. */
export const LOOKS = ['even', 'tired', 'set', 'listen', 'glow'] as const;
export type Look = (typeof LOOKS)[number];

/** A sprite plus its native size in pack pixels, from spritesheet_default.xml. */
export interface Sprite {
  image: ImageSourcePropType;
  size: { w: number; h: number };
}

interface LabelledSprite extends Sprite {
  label: string;
}

/** A composable recipe: {base, hair, top, palette}, one source per recipe. */
export interface ShapeRecipe {
  source: 'shape';
  base: ShapeBaseId;
  /** Which look to wear; resolves to a single face sprite. */
  top: Look;
  /** Shape Characters faces already include brows, so this slot is unused. */
  hair: null;
  palette: string | null;
}

export interface MonsterRecipe {
  source: 'monster';
  base: string;
  top: string;
  hair: string | null;
  palette: string | null;
}

export type Recipe = ShapeRecipe | MonsterRecipe;

export const DEFAULT_RECIPE: ShapeRecipe = {
  source: 'shape',
  base: 'circle',
  top: 'even',
  hair: null,
  palette: null,
};

// --- Shape Characters -------------------------------------------------------

export const SHAPE_BODIES: Record<ShapeBaseId, LabelledSprite> = {
  circle: { label: 'Circle', image: require('@/assets/kenney/shape/body/circle.png'), size: { w: 80, h: 80 } },
  rhombus: { label: 'Rhombus', image: require('@/assets/kenney/shape/body/rhombus.png'), size: { w: 80, h: 80 } },
  square: { label: 'Square', image: require('@/assets/kenney/shape/body/square.png'), size: { w: 80, h: 80 } },
  squircle: { label: 'Squircle', image: require('@/assets/kenney/shape/body/squircle.png'), size: { w: 80, h: 80 } },
};

/** Each look points at one face sprite; sizes are the atlas sizes. */
export const SHAPE_FACES: Record<Look, LabelledSprite> = {
  // face_a: open eyes, level mouth.
  even: { label: 'Even', image: require('@/assets/kenney/shape/face/face_a.png'), size: { w: 50, h: 29 } },
  // face_h: heavy lids, slack mouth.
  tired: { label: 'Tired', image: require('@/assets/kenney/shape/face/face_h.png'), size: { w: 55, h: 36 } },
  // face_f: lowered brows, set jaw.
  set: { label: 'Set', image: require('@/assets/kenney/shape/face/face_f.png'), size: { w: 55, h: 33 } },
  // face_c: raised brows, attentive.
  listen: { label: 'Listen', image: require('@/assets/kenney/shape/face/face_c.png'), size: { w: 59, h: 30 } },
  // face_l: closed eyes, easy smile.
  glow: { label: 'Glow', image: require('@/assets/kenney/shape/face/face_l.png'), size: { w: 53, h: 37 } },
};

/** Hands are part of the skeleton, not the recipe: looks never change them. */
export const SHAPE_HAND: Sprite = {
  image: require('@/assets/kenney/shape/hand/hand_open.png'),
  size: { w: 34, h: 38 },
};

export const SHAPE_BASE_IDS = Object.keys(SHAPE_BODIES) as ShapeBaseId[];

function isShapeBaseId(value: unknown): value is ShapeBaseId {
  return typeof value === 'string' && value in SHAPE_BODIES;
}

function isLook(value: unknown): value is Look {
  return typeof value === 'string' && (LOOKS as readonly string[]).includes(value);
}

/** Face ids stored before looks existed. */
const LEGACY_FACE_LOOKS: Record<string, Look> = {
  face_a: 'even',
  face_b: 'tired',
  face_c: 'listen',
  face_d: 'set',
};

// --- Monster Builder --------------------------------------------------------

export const MONSTER_OPTIONS: Record<RecipeSlot, { id: string; label: string; image: ImageSourcePropType }[]> = {
  base: [
    { id: 'body_blueA', label: 'Blue A', image: require('@/assets/kenney/monster/body/body_blueA.png') },
    { id: 'body_blueB', label: 'Blue B', image: require('@/assets/kenney/monster/body/body_blueB.png') },
    { id: 'body_blueC', label: 'Blue C', image: require('@/assets/kenney/monster/body/body_blueC.png') },
    { id: 'body_yellowA', label: 'Yellow A', image: require('@/assets/kenney/monster/body/body_yellowA.png') },
    { id: 'body_yellowB', label: 'Yellow B', image: require('@/assets/kenney/monster/body/body_yellowB.png') },
    { id: 'body_yellowC', label: 'Yellow C', image: require('@/assets/kenney/monster/body/body_yellowC.png') },
  ],
  top: [
    { id: 'horn_large', label: 'Horn large', image: require('@/assets/kenney/monster/detail/detail_blue_horn_large.png') },
    { id: 'horn_small', label: 'Horn small', image: require('@/assets/kenney/monster/detail/detail_blue_horn_small.png') },
    { id: 'antenna_large', label: 'Antenna', image: require('@/assets/kenney/monster/detail/detail_blue_antenna_large.png') },
    { id: 'ear', label: 'Ear', image: require('@/assets/kenney/monster/detail/detail_blue_ear.png') },
    { id: 'ear_round', label: 'Ear round', image: require('@/assets/kenney/monster/detail/detail_blue_ear_round.png') },
  ],
  hair: [
    { id: 'eyebrowA', label: 'Brow A', image: require('@/assets/kenney/monster/eyebrow/eyebrowA.png') },
    { id: 'eyebrowB', label: 'Brow B', image: require('@/assets/kenney/monster/eyebrow/eyebrowB.png') },
    { id: 'eyebrowC', label: 'Brow C', image: require('@/assets/kenney/monster/eyebrow/eyebrowC.png') },
  ],
};

/**
 * Monster bodies ship with their face already drawn in, so they get overlays
 * placed on the body canvas rather than a face skeleton. Sizes and positions
 * are fractions of the 192x192 body sprite.
 */
export const MONSTER_LAYOUT: Record<RecipeSlot, { w: number; h: number; x: number; y: number }> = {
  base: { w: 1, h: 1, x: 0, y: 0 },
  top: { w: 0.21, h: 0.22, x: 0.4, y: 0.02 },
  hair: { w: 0.27, h: 0.17, x: 0.36, y: 0.3 },
};

function monsterOption(slot: RecipeSlot, id: string | null | undefined) {
  return id ? MONSTER_OPTIONS[slot].find((option) => option.id === id) : undefined;
}

/** Resolves a monster overlay image, falling back to the first option. */
export function monsterAssetFor(slot: RecipeSlot, id: string | null | undefined): ImageSourcePropType {
  return (monsterOption(slot, id) ?? MONSTER_OPTIONS[slot][0]).image;
}

// --- Normalisation ----------------------------------------------------------

/**
 * Coerces a stored `me.recipe` value into a valid Recipe. Handles the jsonb
 * object as well as the legacy text column, whose values were look names.
 * Anything unrecognised falls back to the DEFAULT_RECIPE equivalent.
 */
export function normalizeRecipe(raw: unknown): Recipe {
  if (typeof raw === 'string') {
    return isLook(raw) ? { ...DEFAULT_RECIPE, top: raw } : DEFAULT_RECIPE;
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return DEFAULT_RECIPE;
  }

  const maybe = raw as Record<string, unknown>;
  const palette =
    typeof maybe.palette === 'string' && /^#[0-9a-fA-F]{6}$/.test(maybe.palette) ? maybe.palette : null;

  if (maybe.source === 'monster') {
    return {
      source: 'monster',
      base: monsterOption('base', maybe.base as string)?.id ?? MONSTER_OPTIONS.base[0].id,
      top: monsterOption('top', maybe.top as string)?.id ?? MONSTER_OPTIONS.top[0].id,
      hair: monsterOption('hair', maybe.hair as string)?.id ?? null,
      palette,
    };
  }

  const top = isLook(maybe.top)
    ? maybe.top
    : (LEGACY_FACE_LOOKS[maybe.top as string] ?? DEFAULT_RECIPE.top);

  return {
    source: 'shape',
    base: isShapeBaseId(maybe.base) ? maybe.base : DEFAULT_RECIPE.base,
    top,
    hair: null,
    palette,
  };
}
