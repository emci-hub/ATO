/**
 * What the mini guy (NavPixel, top right of every tab) has to say.
 *
 * He is the app's one notification character (emci, 2026-10-02). Anything that
 * wants to tell the person something calls `pushBuddyNote`; `BuddyBubble`
 * shows it as a speech bubble pinned beside him — the same pinned toast the
 * Questions screen had before it was parked, moved up to the tab shell so it
 * works on every tab.
 *
 * Two kinds of note:
 * - loud: pops up by itself (a round finished, a milestone, a name locked in).
 * - quiet: waits. He shows a dot, and says it when tapped.
 * With nothing waiting, a tap gets a small idle line instead (idle.ts).
 *
 * One at a time, in order, at most MAX_WAITING held, and the same note id is
 * never said twice in an app run. In memory only: a note is a moment, not a
 * record — the lasting record of a milestone is `me.celebrated_milestone_ids`.
 *
 * The reducer is pure so the check script can run it.
 */
import { useSyncExternalStore } from 'react';

export interface BuddyNote {
  /** Stable per event, so the same event is not announced twice. */
  id: string;
  title: string;
  /** May be empty for a one-line note. */
  body: string;
  loud: boolean;
}

export interface BuddyState {
  showing: BuddyNote | null;
  /** Bumped every time `showing` changes, so the bubble restarts its fade. */
  shownCount: number;
  waiting: BuddyNote[];
  /** Ids already said or queued this run. */
  seen: string[];
}

/** Idle lines carry this id prefix (lib/buddy/idle.ts); everything else is news. */
export const IDLE_NOTE_PREFIX = 'idle:';

export function isIdleNote(note: BuddyNote): boolean {
  return note.id.startsWith(IDLE_NOTE_PREFIX);
}

export const MAX_WAITING = 5;
const SEEN_CAP = 60;

export const EMPTY_BUDDY_STATE: BuddyState = { showing: null, shownCount: 0, waiting: [], seen: [] };

export type BuddyAction =
  | { type: 'push'; note: BuddyNote }
  | { type: 'done' }
  | { type: 'tap'; idle: BuddyNote | null }
  | { type: 'reset' };

function show(state: BuddyState, note: BuddyNote, waiting: BuddyNote[]): BuddyState {
  return { ...state, showing: note, shownCount: state.shownCount + 1, waiting };
}

export function buddyReduce(state: BuddyState, action: BuddyAction): BuddyState {
  switch (action.type) {
    case 'reset':
      return EMPTY_BUDDY_STATE;
    case 'push': {
      const { note } = action;
      if (state.seen.includes(note.id)) return state;
      const seen = [...state.seen, note.id].slice(-SEEN_CAP);
      if (note.loud && !state.showing) return { ...show(state, note, state.waiting), seen };
      // Full: the oldest waiting note makes room. Newer news matters more.
      const waiting = [...state.waiting, note].slice(-MAX_WAITING);
      return { ...state, waiting, seen };
    }
    case 'done': {
      if (!state.showing) return state;
      // A loud note that arrived while he was talking is said next, by itself.
      const nextLoud = state.waiting.findIndex((note) => note.loud);
      if (nextLoud < 0) return { ...state, showing: null };
      const waiting = state.waiting.filter((_, i) => i !== nextLoud);
      return show(state, state.waiting[nextLoud]!, waiting);
    }
    case 'tap': {
      // Real news on screen is never cut short by a tap: a milestone is said
      // once, so replacing it would lose it for good.
      if (state.showing && !isIdleNote(state.showing)) return state;
      const [next, ...rest] = state.waiting;
      if (next) return show(state, next, rest);
      // Nothing waiting: a small thing to say (replacing an earlier idle line).
      return action.idle ? show(state, action.idle, []) : state;
    }
  }
}

let state: BuddyState = EMPTY_BUDDY_STATE;
const listeners = new Set<() => void>();

function dispatch(action: BuddyAction): void {
  const next = buddyReduce(state, action);
  if (next === state) return;
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function pushBuddyNote(note: BuddyNote): void {
  dispatch({ type: 'push', note });
}

export function buddyNoteDone(): void {
  dispatch({ type: 'done' });
}

export function tapBuddy(idle: BuddyNote | null): void {
  dispatch({ type: 'tap', idle });
}

/** Sign-out: the next account must not hear the previous one's news. */
export function resetBuddy(): void {
  dispatch({ type: 'reset' });
}

export function useBuddy(): BuddyState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
