/**
 * Play → About credits (GAME_SPEC §19). One list so the screen stays a view.
 * Kenney packs are CC0; the avatar/beast packs keep their own pack license.
 */

export interface PlayCredit {
  /** Pack name shown to the player. */
  pack: string;
  /** Creator / studio. */
  author: string;
  /** What Divecore uses it for. */
  usedFor: string;
  /** License note. */
  license: string;
  /** Pack page, when we have one. */
  url?: string;
}

export const PLAY_CC0_LINE =
  'Kenney packs are CC0 (public domain). Attribution is not legally required; credited here anyway.';

export const PLAY_CREDITS: readonly PlayCredit[] = [
  {
    pack: 'Scribble Dungeons (64px)',
    author: 'Kenney',
    usedFor: 'Defend board tiles — floor, walls, path and doorway',
    license: 'CC0',
    url: 'https://kenney.nl/assets/scribble-dungeons',
  },
  {
    pack: 'Fantasy UI Borders',
    author: 'Kenney',
    usedFor: 'Divecore card frames (9-slice)',
    license: 'CC0',
    url: 'https://kenney.nl/assets/fantasy-ui-borders',
  },
  {
    pack: 'Cursor Pack',
    author: 'Kenney',
    usedFor: 'Item and shop icons',
    license: 'CC0',
    url: 'https://kenney.nl/assets/cursor-pack',
  },
  {
    pack: 'Shape Characters',
    author: 'Kenney',
    usedFor: 'Tower sprites and normal puff enemies',
    license: 'CC0',
    url: 'https://kenney.nl/assets/shape-characters',
  },
  {
    pack: 'Masterpiece Fantasy Pixel Art',
    author: 'Pack author',
    usedFor: 'Active Avatar — Breathing Idle, Walking, Iron Slash',
    license: 'Per the pack license included with the download',
  },
  {
    pack: 'Cozy Village Animated Girl',
    author: 'Pack author',
    usedFor: 'Stub Avatar #2',
    license: 'Per the pack license included with the download',
  },
  {
    pack: 'Primal Dynasties — Beast Champions',
    author: 'Pack author',
    usedFor: 'Scout mini, Scout boss, Semi, Final boss and runners',
    license: 'Per the pack license included with the download',
  },
];

export const PLAY_OPTIONAL_LINE =
  'Play is optional — Home, Check and Sage are never gated behind it.';
