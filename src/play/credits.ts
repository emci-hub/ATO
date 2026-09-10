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
    pack: 'Tower Defense',
    author: 'Kenney',
    usedFor: 'Board cast — grass + path terrain, tower sprites, Avatar, units and bosses',
    license: 'CC0',
    url: 'https://kenney.nl/assets/tower-defense-kit',
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
];

export const PLAY_OPTIONAL_LINE =
  'Play is optional — Home, Check and Sage are never gated behind it.';
