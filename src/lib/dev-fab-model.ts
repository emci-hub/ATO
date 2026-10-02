/**
 * Play floating dev button — pure rules (scripts/dev-fab-check.ts pins them).
 *
 * Shown only inside Divecore/Play, and only when the Play dev kit is unlocked
 * (`PRE_LAUNCH_DEV` plus the session PIN). Release builds strip Play entirely.
 */
export const DEV_FAB_SIZE = 44;
export const DEV_FAB_EDGE = 8;

export function playDevFabVisible(input: {
  preLaunchDev: boolean;
  playDevUnlocked: boolean;
}): boolean {
  return input.preLaunchDev && input.playDevUnlocked;
}

export type FabBounds = { width: number; height: number; top: number; bottom: number };

/* clampFab / snapFabX run inside the drag gesture on the UI thread, so they are
 * worklets: no closures over anything but the two constants above. */

/** Keep the button fully on screen, clear of the status bar and home bar. */
export function clampFab(pos: { x: number; y: number }, b: FabBounds): { x: number; y: number } {
  'worklet';
  const maxX = Math.max(DEV_FAB_EDGE, b.width - DEV_FAB_SIZE - DEV_FAB_EDGE);
  const maxY = Math.max(b.top + DEV_FAB_EDGE, b.height - b.bottom - DEV_FAB_SIZE - DEV_FAB_EDGE);
  return {
    x: Math.min(maxX, Math.max(DEV_FAB_EDGE, pos.x)),
    y: Math.min(maxY, Math.max(b.top + DEV_FAB_EDGE, pos.y)),
  };
}

/** Where it rests when released: the nearer side edge. */
export function snapFabX(x: number, width: number): number {
  'worklet';
  const center = x + DEV_FAB_SIZE / 2;
  return center < width / 2 ? DEV_FAB_EDGE : Math.max(DEV_FAB_EDGE, width - DEV_FAB_SIZE - DEV_FAB_EDGE);
}

/** First rest spot: right edge, a little below the top (clear of the buddy). */
export function defaultFabPosition(b: FabBounds): { x: number; y: number } {
  return clampFab({ x: b.width, y: b.top + 150 }, b);
}

/* ------------------------------------------------------------------------
 * The APP floating dev button (outside Play). Same shell as the Play one; it
 * shows the Dev Tools Hub sections that belong to the screen you are on.
 * ---------------------------------------------------------------------- */

/** Hub sections the app kit can show (each is a component in `app/dev-lab`). */
export type AppDevSection =
  | 'quota'
  | 'explore-regen'
  | 'traits'
  | 'band-stepper'
  | 'jump'
  | 'start-over'
  | 'you-tools'
  | 'ai-consent'
  | 'local-data'
  | 'fence'
  | 'trace'
  | 'inspector';

/** Per screen: its name in the kit and the sections that test it. */
export const APP_DEV_SCREENS: Record<string, { label: string; sections: readonly AppDevSection[] }> = {
  '/': { label: 'Home', sections: ['jump', 'ai-consent'] },
  '/explore': { label: 'Explore', sections: ['traits', 'band-stepper', 'explore-regen'] },
  '/intake-sweep': { label: 'Questions', sections: ['jump', 'start-over'] },
  '/sage': { label: 'Sage', sections: ['quota', 'fence', 'trace'] },
  '/you': { label: 'You', sections: ['you-tools', 'ai-consent', 'local-data'] },
};

/** Useful on any screen; shown under the screen's own tools, collapsed. */
export const APP_DEV_EVERYWHERE: readonly AppDevSection[] = ['inspector', 'quota', 'trace', 'fence'];

/** Screens with their own dev surface — the app button stays out of the way. */
export const APP_DEV_HIDDEN_PATHS: readonly string[] = ['/play', '/dev-lab', '/ai-lab'];

export function appDevScreen(pathname: string): { label: string; sections: readonly AppDevSection[] } | null {
  return APP_DEV_SCREENS[pathname] ?? null;
}

/** "Everywhere" sections not already listed for this screen. */
export function appDevEverywhere(pathname: string): readonly AppDevSection[] {
  const own = appDevScreen(pathname)?.sections ?? [];
  return APP_DEV_EVERYWHERE.filter((s) => !own.includes(s));
}

/**
 * Who sees the app button: exactly who may open the Hub's testing groups
 * (`hubAccess(...) === 'full'`, so nobody at all in a release build) — never
 * signed out, mid-onboarding or while access is loading — and never on a screen
 * that has its own dev surface (Play has its own button).
 */
export function appDevFabVisible(input: {
  isAuthed: boolean;
  hasMe: boolean;
  devAccessLoading: boolean;
  canSeeHub: boolean;
  pathname: string;
}): boolean {
  if (!input.isAuthed || !input.hasMe || input.devAccessLoading) return false;
  if (APP_DEV_HIDDEN_PATHS.includes(input.pathname)) return false;
  return input.canSeeHub;
}
