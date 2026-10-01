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
