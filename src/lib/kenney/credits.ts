import { KENNEY_REGISTRY } from './registry';

export const KENNEY_SITE_URL = 'https://kenney.nl';

/** Pack page per registered family. A family with no URL here must not ship. */
const PACK_PAGES: Record<string, string> = {
  shape: 'https://kenney.nl/assets/shape-characters',
};

export interface KenneyCredit {
  family: string;
  pack: string;
  creator: 'Kenney';
  siteUrl: string;
  packUrl: string;
}

/**
 * Credits for Kenney families that are actually registered (and therefore
 * bundled). Modular / Toon / 1-Bit / Animal Remastered / Fantasy UI / Monster
 * Builder are not listed until they land in KENNEY_REGISTRY.
 */
export function kenneyCredits(): KenneyCredit[] {
  return Object.values(KENNEY_REGISTRY).map((manifest) => {
    const packUrl = PACK_PAGES[manifest.family];
    if (!packUrl) {
      throw new Error(
        `Kenney family "${manifest.family}" is registered but has no credits pack URL`,
      );
    }
    return {
      family: manifest.family,
      pack: manifest.label,
      creator: 'Kenney',
      siteUrl: KENNEY_SITE_URL,
      packUrl,
    };
  });
}

export const KENNEY_CC0_LINE =
  'CC0 (public domain). Attribution is not legally required; credited here anyway.';
