/**
 * Insight-changed event. Kept as its own module so the hook and the writer can
 * both import it without a cycle — the same shape the card lane used, renamed
 * with the lane it now serves. The contract survives; only the payload source
 * changed.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function onDailyInsightChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitDailyInsightChanged(): void {
  for (const listener of listeners) listener();
}
