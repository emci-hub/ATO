/**
 * Event-gesture fan-out. Screens (dawn, sage, you, scan-sheet) call
 * triggerGesture(action) at their real event hooks; every mounted animated
 * face registers itself here and receives the call. This is deliberately tiny
 * and framework-free — no context, no provider, just a mutable Set of
 * callbacks. The renderer is what decides whether a gesture is allowed.
 *
 * CRISIS HARD RULE: while a crisis card is showing, gestures are HARD-DISABLED
 * — hands stay hidden, no pose, no exception. This is an intentional gate at
 * the fan-out level (not a missed case): the crisis UI calls
 * `setCrisisActive(true)` on show and `false` on dismiss, and triggerGesture
 * returns early. Even a stray call from another screen cannot show hands
 * during a crisis.
 */
import { manifestFor } from './registry';

export type GestureAction = 'checkDone' | 'talkReply' | 'circleConnected' | 'posterShared';

type GestureHandler = (state: string) => void;

const handlers = new Set<GestureHandler>();

let crisisActive = false;

/** Sets the crisis gate. Call with true when a crisis card is shown, false on dismiss. */
export function setCrisisActive(active: boolean): void {
  crisisActive = active;
}

export function isCrisisActive(): boolean {
  return crisisActive;
}

export function registerGestureHandler(handler: GestureHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

/**
 * Fan out an event gesture to every mounted animated face. Each handler is the
 * per-component `gesture(state)` closure from useKenneyAnimation; it ignores
 * the call when the renderer is disabled (e.g. static Share poster).
 *
 * Returns early (no-op) while a crisis is active — the hard rule.
 */
export function triggerGesture(action: GestureAction): void {
  // CRISIS HARD RULE: never gesture while a crisis card is showing.
  if (crisisActive) return;
  // The active family's manifest maps the action → hand state id.
  const gesture = manifestFor('shape').eventGestures?.[action];
  if (!gesture) return;
  for (const handler of handlers) handler(gesture.state);
}
