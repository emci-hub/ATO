/**
 * Tiny pub/sub for "the user logged a check." Dawn emits after a successful
 * recordCheck; useGrowth subscribes so the header avatar's growth tiers (and
 * any pending milestone celebration) refresh without a manual foreground/
 * navigation event. Deliberately framework-free.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribe to check-logged events. Returns an unsubscribe fn. */
export function onChecksChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Emit after a check is successfully logged. */
export function emitChecksChanged(): void {
  for (const listener of listeners) listener();
}
