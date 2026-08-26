type Listener = () => void;

const listeners = new Set<Listener>();

export function onTodayCardChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitTodayCardChanged(): void {
  for (const listener of listeners) listener();
}
