/**
 * Event-gesture fan-out. Screens (dawn, sage, you, scan-sheet) call
 * triggerGesture(action) at their real event hooks; every mounted animated
 * face registers itself here and receives the call. This is deliberately tiny
 * and framework-free — no context, no provider, just a mutable Set of
 * callbacks. The renderer is what decides whether a gesture is allowed.
 *
 * The crisis gate that used to sit here was removed with the crisis system
 * (2026-10-14): it only existed because Sage read what people typed.
 */
import { manifestFor } from './registry';

export type GestureAction = 'checkDone' | 'talkReply' | 'circleConnected' | 'posterShared';

type GestureHandler = (state: string) => void;

const handlers = new Set<GestureHandler>();

export function registerGestureHandler(handler: GestureHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

/**
 * Fan out an event gesture to every mounted animated face. Each handler is the
 * per-component `gesture(state)` closure from useKenneyAnimation; it ignores
 * the call when the renderer is disabled (e.g. static Share poster).
 */
export function triggerGesture(action: GestureAction): void {
  // The active family's manifest maps the action → hand state id.
  const gesture = manifestFor('shape').eventGestures?.[action];
  if (!gesture) return;
  for (const handler of handlers) handler(gesture.state);
}
