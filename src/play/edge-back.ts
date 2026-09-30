/**
 * "Back one level" inside Play (2026-09-29).
 *
 * Play is ONE route (`src/app/play.tsx`); the hub and its sub-screens (Dive,
 * Defend, Dress, Pet, Shop, About) are a `mode` inside it. The phone's own
 * back (iOS edge swipe, Android back) used to pop the WHOLE route — leaving
 * Play from any sub-screen and skipping Defend's mid-wave Leave confirm. Now:
 *   - On the hub, the phone's own swipe/back leaves Play as before.
 *   - On a sub-screen the native swipe is off; our own left-edge swipe and
 *     Android back step back ONE level (a sub-screen may handle it first, e.g.
 *     close a mini-game or open Defend's Leave confirm).
 *   - A sub-screen can turn the edge swipe off (Defend while a wave runs — the
 *     board is near full width, edge drags must stay board drags; emci). Android
 *     back still works there and opens the same Leave confirm.
 *
 * Pure rules only; the gesture wiring lives in `play.tsx`.
 */

/** A swipe must START within this many points of the left edge… */
export const EDGE_ZONE = 24;
/** …move this far right (mostly sideways) before we claim it from the page… */
export const EDGE_CLAIM_DX = 12;
/** …and end this far right (or flicked) to count as "back". */
export const EDGE_TRIGGER_DX = 60;

/** What a sub-screen tells the Play shell about back. */
export type InnerBack = {
  /** Our left-edge swipe is allowed right now. */
  edgeSwipe: boolean;
  /** Handle one step of back inside the screen; true = handled (stay here). */
  back: () => boolean;
};

/** Claim the touch as an edge swipe? (start at the edge, move right, sideways). */
export function isEdgeSwipeStart(x0: number, dx: number, dy: number): boolean {
  return x0 <= EDGE_ZONE && dx > EDGE_CLAIM_DX && Math.abs(dy) < dx * 0.6;
}

/** Released far enough (or flicked right) to go back? */
export function isEdgeSwipeComplete(dx: number, vx: number): boolean {
  return dx >= EDGE_TRIGGER_DX || (dx >= EDGE_TRIGGER_DX / 2 && vx > 0.5);
}

export type BackSource = 'edge' | 'hardware';
/** native = let the phone leave Play; ignore = swallow it; step = one level
 * (the sub-screen first, else the hub). */
export type BackDecision = 'native' | 'ignore' | 'step';

export function backDecision(
  atHub: boolean,
  inner: Pick<InnerBack, 'edgeSwipe'> | null,
  source: BackSource,
): BackDecision {
  if (atHub) return 'native';
  if (source === 'edge' && inner != null && !inner.edgeSwipe) return 'ignore';
  return 'step';
}

/** Defend's one level of back. Mid-wave never leaves silently: back opens the
 * same Leave confirm the button does (and closes it again if it is open). */
export type DefendBackStep = 'close-confirm' | 'request-leave' | 'hub';
export function defendBackStep(
  phase: 'setup' | 'running' | 'won' | 'lost',
  leaveConfirmOpen: boolean,
): DefendBackStep {
  if (phase !== 'running') return 'hub';
  return leaveConfirmOpen ? 'close-confirm' : 'request-leave';
}

/** Defend allows our edge swipe only when no wave is running. */
export function defendEdgeSwipe(phase: 'setup' | 'running' | 'won' | 'lost'): boolean {
  return phase !== 'running';
}

/** Pet's one level: a running mini-game closes first (the round does not
 * count), then the hub. */
export function petBackStep(gameOpen: boolean): 'close-game' | 'hub' {
  return gameOpen ? 'close-game' : 'hub';
}
