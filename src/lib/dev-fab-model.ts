/**
 * The floating dev button — pure rules (scripts/dev-fab-check.ts pins them).
 *
 * Who sees it is exactly who may open the Dev Tools Hub (`canSeeDevLab`):
 * PRE_LAUNCH_DEV or the session unlock, root, or a granted capability. It is
 * never shown signed out, mid-onboarding, or while the app is still resolving.
 */
import { canSeeDevLab } from '@/lib/dev-access';

export const DEV_FAB_SIZE = 44;
export const DEV_FAB_EDGE = 8;

export function devFabVisible(input: {
  isAuthed: boolean;
  hasMe: boolean;
  devAccessLoading: boolean;
  isDev: boolean;
  isRoot: boolean;
  capabilities: readonly string[];
}): boolean {
  if (!input.isAuthed || !input.hasMe || input.devAccessLoading) return false;
  return canSeeDevLab({ isDev: input.isDev, isRoot: input.isRoot, capabilities: input.capabilities });
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
