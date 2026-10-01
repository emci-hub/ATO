/**
 * Dev slot (dev builds only) — lets a Play screen keep its dev buttons next to
 * the state they act on, while the floating DEV kit is where they SHOW.
 *
 *   <DevSlotFill>…buttons…</DevSlotFill>   in the screen: renders nothing there,
 *                                          hands its children to the slot.
 *   <DevSlotOutlet />                      in the floating kit: draws them.
 *
 * The children are re-sent after every render of the owning screen, so their
 * handlers always see that screen's live state. One slot: the screen on show.
 */
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';

let slot: ReactNode = null;
const listeners = new Set<() => void>();

function setSlot(next: ReactNode) {
  slot = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const get = () => slot;

export function DevSlotFill({ children }: { children: ReactNode }) {
  // No dependency list on purpose: every render carries fresh handlers.
  useEffect(() => {
    setSlot(children);
  });
  useEffect(() => () => setSlot(null), []);
  return null;
}

/** The current screen's dev buttons, or nothing. */
export function DevSlotOutlet() {
  return <>{useSyncExternalStore(subscribe, get, get)}</>;
}

/** True when the screen on show has handed over dev buttons. */
export function useDevSlotFilled(): boolean {
  return useSyncExternalStore(subscribe, get, get) != null;
}
