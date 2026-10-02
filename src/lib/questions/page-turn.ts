/**
 * "The questions page just changed" event. The pager (PagedQuestions) sits two
 * components below the screen that owns the scroll view, so it announces a page
 * turn here and the Questions screen scrolls back to the top — the next page
 * starts at its first question instead of wherever the last one ended.
 *
 * Same bare-emitter shape as insight/events.ts.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function onQuestionsPageTurned(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitQuestionsPageTurned(): void {
  for (const listener of listeners) listener();
}
