/**
 * Turf War map themes (step T8, emci 2026-10-17) — pure data, no React Native (check:turf-war-layout runs it in Node).
 * A theme is a different painting of the SAME `ato` board: same grid, path, 15 pads, tower cap 6, same rewards.
 * The painter (scripts/turf-board-art.ts TURF_THEMES) packs each theme as its own board sheet; the player picks one
 * in the Setup sheet (turf-theme-store.ts, device-local). Neon Maze has no themes.
 */
export const TURF_THEME_IDS = ['alley', 'rooftop', 'underpass', 'court', 'docks'] as const;
export type TurfThemeId = (typeof TURF_THEME_IDS)[number];

export const DEFAULT_TURF_THEME: TurfThemeId = 'alley';

export const TURF_THEME_LABEL: Record<TurfThemeId, string> = {
  alley: 'Alley',
  rooftop: 'Rooftop',
  underpass: 'Underpass',
  court: 'Court',
  docks: 'Docks',
};

export function isTurfThemeId(value: unknown): value is TurfThemeId {
  return typeof value === 'string' && (TURF_THEME_IDS as readonly string[]).includes(value);
}

/** Only the `ato` board is themed. */
export function boardHasThemes(boardId: string): boolean {
  return boardId === 'ato';
}

/** The packed board id a board + theme paints with: `ato` (alley), `ato-rooftop`, …; any other board keeps its own id. */
export function turfBoardArtId(boardId: string, theme: TurfThemeId): string {
  return boardHasThemes(boardId) && theme !== DEFAULT_TURF_THEME ? `${boardId}-${theme}` : boardId;
}

/** Every packed board id the themes add (art-pack writes these; the checks walk them). */
export function themedBoardArtIds(boardId = 'ato'): string[] {
  return TURF_THEME_IDS.map((t) => turfBoardArtId(boardId, t));
}
