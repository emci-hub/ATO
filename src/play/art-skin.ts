/**
 * Art style the game is drawn in (PlaySettings.artSkin). Paint only — no
 * gameplay, odds or economy ever read this. Kept dependency-free so the pure
 * settings rules (and the Node checks) can import it without pulling art.
 *
 * The Play store sets it whenever a save is loaded or committed
 * (`use-play-store.ts`), before the board mounts; `skin.ts` reads it to put
 * the Streetwear skin in front of the role stack.
 */
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';

export type ArtSkinId = 'cast' | 'streetwear';
export const ART_SKINS: readonly ArtSkinId[] = ['cast', 'streetwear'];

let active: ArtSkinId = 'cast';

export function setArtSkin(id: ArtSkinId): void {
  // Streetwear is a pre-launch preview: a public build always draws cast,
  // even if an old save still says streetwear (the toggle is dev-only).
  active = PRE_LAUNCH_DEV && id === 'streetwear' ? 'streetwear' : 'cast';
}

export function artSkin(): ArtSkinId {
  return active;
}
