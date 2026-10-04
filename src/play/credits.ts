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
    pack: 'Fields Tileset',
    author: 'Craftpix',
    usedFor: 'Defend board terrain — grass floor, road, tower pads and prop garnish',
    license: 'Craftpix file license (see assets/play/licenses/craftpix-fields-License.txt)',
    url: 'https://craftpix.net/file-licenses/',
  },
  {
    pack: 'Tower Defense',
    author: 'Kenney',
    usedFor: 'Board cast — tower sprites, Avatar, units and bosses',
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
  {
    pack: 'Underwater Diving',
    author: 'Luis Zuno (ansimuz)',
    usedFor: 'Dive water, ruins, seaweed, coral, fish and bubbles',
    license: 'CC0 / public domain (assets/play/licenses/ansimuz-underwater-public-domain.txt)',
    url: 'https://opengameart.org/content/underwater-diving-pack',
  },
  {
    pack: 'Ninja Adventure',
    author: 'Pixel-Boy & AAA',
    usedFor: 'Pet room floor tile, bush, potted plant and heart',
    license: 'CC0 (assets/play/licenses/ninja-adventure-cc0.txt)',
    url: 'https://pixel-boy.itch.io/ninja-adventure-asset-pack',
  },
  {
    pack: 'Resurrect 64',
    author: 'Kerrie Lake',
    usedFor: 'Palette the Dive art was recolored toward',
    license: 'CC0 (lospec)',
    url: 'https://lospec.com/palette-list/resurrect-64',
  },
  {
    pack: 'Divecore room props',
    author: 'Divecore',
    usedFor: 'Pet room window, lamp, shelf, rug, bed, bowl and picture; Dive sky, chests, rays and motes',
    license: 'Original, made for this app',
  },
  {
    pack: 'Tiny5',
    author: 'Thomas Jockin',
    usedFor: 'Pixel labels',
    license: 'OFL (assets/play/fonts/OFL-Tiny5.txt)',
    url: 'https://fonts.google.com/specimen/Tiny5',
  },
  {
    pack: 'Inter',
    author: 'Rasmus Andersson',
    usedFor: 'Body text',
    license: 'OFL (assets/play/fonts/OFL-Inter.txt)',
    url: 'https://rsms.me/inter/',
  },
];

export const PLAY_OPTIONAL_LINE =
  'Play is optional — Home, Check and Sage are never gated behind it.';
