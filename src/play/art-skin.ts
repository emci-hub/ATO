/**
 * Art style the game is drawn in (PlaySettings.artSkin). Paint only — no
 * gameplay, odds or economy ever read this. Kept dependency-free so the pure
 * settings rules (and the Node checks) can import it without pulling art.
 *
 * The Play store sets it whenever a save is loaded or committed
 * (`use-play-store.ts`), before the board mounts; `skin.ts` reads it to put
 * the Streetwear skin in front of the role stack.
 *
 * Classic (`cast`) was retired as a look (emci 2026-10-12): Streetwear is the
 * only game style, in every build. The cast / craftpix-td / kenney-td skins
 * stay in the stack only as fallbacks for roles Streetwear doesn't draw yet
 * (Defend board ground/roads/props, the shot sprite) — see skin.ts.
 */
export type ArtSkinId = 'streetwear';
export const ART_SKINS: readonly ArtSkinId[] = ['streetwear'];

const active: ArtSkinId = 'streetwear';

/** Kept for the store's load/commit calls; an old `cast` save draws Streetwear. */
export function setArtSkin(_id: ArtSkinId | string): void {}

export function artSkin(): ArtSkinId {
  return active;
}
