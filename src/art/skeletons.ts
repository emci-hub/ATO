/**
 * Art skeletons: the fixed slots every item of one kind has, like a rig.
 *
 * `npm run art:registry` builds the typed `SHEET` / `ROOM` maps in
 * `generated-art.ts` from the packed art, and REFUSES art whose part is not a
 * slot here — so a new hero, enemy, effect or menu piece either fits its
 * skeleton or the sync names exactly what to add. An item may leave slots
 * empty (the plain effect has no `status`); it may never invent one.
 *
 * To add a slot: add it here, re-run `npm run art:sync`, then use it as
 * `SHEET.<family>.<item>.<slot>` (or `ROOM.<room>.<slot>`).
 */
import { HERO_CLIPS } from '@/play/heroes-data';

/** Characters: one packed sheet per action (+ the 8-way still `rotations`). */
export const HERO_SLOTS = ['rotations', ...HERO_CLIPS] as const;
export const ENEMY_SLOTS = ['rotations', 'idle', 'walk', 'run', 'death'] as const;
export const TOWER_SLOTS = ['rotations', 'idle', 'attack', 'skill'] as const;

/** Element effects (ember, root, spark, tide, void, plain): one sheet per beat. */
export const FX_SLOTS = ['shot', 'hit', 'burst', 'slash', 'status'] as const;
/** Auras and Hideout glow loops: drawn behind and in front of the body. */
export const AURA_SLOTS = ['behind', 'front'] as const;
/** One sword strip per rarity (frames inside = elements). */
export const SWORD_SLOTS = ['common', 'rare', 'epic', 'legendary', 'divine'] as const;

/** Room / map layers, back to front. Every room fills the same slots. */
export const ROOM_SLOTS = [
  'back',
  'floor',
  'props',
  'neonA',
  'neonB',
  'occluderDayA',
  'occluderDayB',
  'occluderNightA',
  'occluderNightB',
  'windowDay',
  'windowNight',
  'glow',
] as const;

/**
 * Menu / HUD kit (one packed piece each), grouped by job. A screen picks a
 * piece by name: `SHEET.ui['button-primary']`.
 */
export const UI_SLOTS = {
  frame: ['panel', 'header', 'sheet', 'sheet-handle', 'toast', 'tabbar', 'resbar', 'portrait', 'alert'],
  button: [
    'button-primary',
    'button-primary-pressed',
    'button-secondary',
    'button-secondary-pressed',
    'button-danger',
    'button-danger-pressed',
    'back',
    'pause',
    'toggle',
    'chip-on',
    'chip-off',
  ],
  nav: ['nav-settings', 'nav-tab-block', 'nav-tab-hideout', 'nav-tab-locker', 'nav-tab-store', 'nav-tab-turf'],
  currency: ['nav-cur-caps', 'nav-cur-prism', 'nav-cur-shine', 'nav-cur-token'],
  ambient: [
    'amb-drip',
    'amb-moth',
    'amb-note',
    'amb-note2',
    'amb-pigeon',
    'amb-pigeon-peck',
    'amb-plane',
    'amb-rat',
    'amb-rat-run',
    'amb-spark',
    'amb-star',
    'amb-steam',
    'amb-wisp',
  ],
  stop: ['stop-core', 'stop-ghost', 'stop-platform', 'stop-sewers', 'stop-train', 'stop-tunnels'],
  /** Old iso room cards still drawn by the street shell; replaced by ROOM art later. */
  room: [
    'room-hideout-iso',
    'room-hideout-iso-bowl',
    'room-hideout-iso-cushion',
    'room-hideout-iso-front',
    'room-hideout-iso-manhole',
    'room-hideout-iso-mask',
    'room-locker',
    'room-underground',
  ],
} as const;

/** Grouped families: item → slot. The generator checks parts against these. */
export const SHEET_SKELETONS = {
  hero: HERO_SLOTS,
  enemy: ENEMY_SLOTS,
  tower: TOWER_SLOTS,
  fx: FX_SLOTS,
  aura: AURA_SLOTS,
  hideoutFx: AURA_SLOTS,
} as const;

/** Flat families: name → sheet. `board` is open (one per map id). */
export const FLAT_SKELETONS = {
  ui: Object.values(UI_SLOTS).flat() as readonly string[],
  sword: SWORD_SLOTS as readonly string[],
  board: null,
} as const;
