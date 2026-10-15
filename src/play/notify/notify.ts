/**
 * Divecore notices — the store around the ONE pure queue (`queue.ts`). Phase 2, 2026-10-14.
 *
 *   notify({ kind, title, body?, target?, dedupeKey?, priority? })   from anywhere in Play
 *
 * The NoticeLane (`notice-lane.tsx`, drawn by every GameScreen in its fixed notice region)
 * shows `showing`. Only the top-most mounted lane shows it (a pet game over the Hideout wins);
 * with no lane mounted, notices wait. Timers live here, so a notice expires the same on every
 * screen. A tap goes to its target through the handler `play.tsx` registers.
 */
import { useEffect, useSyncExternalStore } from 'react';

import {
  EMPTY_NOTICES,
  dismissNotice,
  enqueueNotice,
  nextNoticeWake,
  tickNotices,
  type Notice,
  type NoticeInput,
  type NoticeMode,
  type NoticeQueue,
  type NoticeTarget,
} from '@/play/notify/queue';

export type { Notice, NoticeInput, NoticeKind, NoticeMode, NoticeTarget } from '@/play/notify/queue';

let queue: NoticeQueue = EMPTY_NOTICES;
let mode: NoticeMode = 'all';
let reduceMotion = false;
let pauses = 0;
/** Mounted lanes, oldest first: the last one is on top and shows the notice. */
let lanes: number[] = [];
let nextLane = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
let onTarget: ((target: Exclude<NoticeTarget, null>) => void) | null = null;
const listeners = new Set<() => void>();

export type NoticeSnapshot = { queue: NoticeQueue; topLane: number | null };
let snap: NoticeSnapshot = { queue, topLane: null };

function emit() {
  snap = { queue, topLane: lanes.length > 0 ? lanes[lanes.length - 1] : null };
  for (const l of listeners) l();
}

function opts() {
  return { paused: pauses > 0, reduceMotion };
}

/** Advance the queue now and arm the timer for the next change. */
function pump() {
  if (timer) clearTimeout(timer);
  timer = null;
  // No lane on screen (loading, a lab): hold everything until one mounts.
  if (lanes.length === 0) return;
  const now = Date.now();
  const next = tickNotices(queue, now, opts());
  if (next !== queue) {
    queue = next;
    emit();
  }
  const wake = nextNoticeWake(queue, now, opts());
  if (wake != null) timer = setTimeout(pump, Math.max(16, wake));
}

/** Raise a notice (word limits: title ≤ 3, body ≤ 10 — check:notify). */
export function notify(input: NoticeInput): void {
  const next = enqueueNotice(queue, input, Date.now(), mode);
  if (next === queue) return;
  queue = next;
  emit();
  pump();
}

/** Close the one showing (tap, or the lane's fade-out finished). */
export function dismissShownNotice(id: number): void {
  const next = dismissNotice(queue, id, Date.now());
  if (next === queue) return;
  queue = next;
  emit();
  pump();
}

/** Tap on a notice: close it, then go where it points. */
export function tapNotice(n: Notice): void {
  dismissShownNotice(n.id);
  if (n.target) onTarget?.(n.target);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function snapshot() {
  return snap;
}

/** The queue + which lane is on top (re-renders when either changes). */
export function useNotices(): NoticeSnapshot {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Notices on/off ("Important only") and Reduce Motion (longer to read). Set once by play.tsx. */
export function useNoticeOptions(next: { mode: NoticeMode; reduceMotion: boolean }): void {
  useEffect(() => {
    mode = next.mode;
    reduceMotion = next.reduceMotion;
    pump();
  }, [next.mode, next.reduceMotion]);
}

/** Where a tapped notice goes (registered by play.tsx). */
export function useNoticeTargets(handler: (target: Exclude<NoticeTarget, null>) => void): void {
  useEffect(() => {
    onTarget = handler;
    return () => {
      if (onTarget === handler) onTarget = null;
    };
  }, [handler]);
}

/** While `active` (a modal over the lane: Settings, haul reveal), only ERROR goes up. */
export function useNoticePause(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    pauses += 1;
    // A notice already up behind the cover goes back to the front of the line (errors stay).
    if (queue.showing && queue.showing.kind !== 'error') {
      queue = { ...queue, showing: null, waiting: [queue.showing, ...queue.waiting] };
      emit();
    }
    pump();
    return () => {
      pauses -= 1;
      pump();
    };
  }, [active]);
}

/** Reduce Motion as play.tsx resolved it (the lane fades gently under it). */
export function noticeReduceMotion(): boolean {
  return reduceMotion;
}

/** A lane mounts: returns its id and an unmount. */
export function mountLane(): { id: number; unmount: () => void } {
  const id = nextLane;
  nextLane += 1;
  lanes = [...lanes, id];
  emit();
  pump();
  return {
    id,
    unmount: () => {
      lanes = lanes.filter((l) => l !== id);
      emit();
      pump();
    },
  };
}

// Dev only: the web preview harness (docs/divecore/tools) raises notices of each kind.
if (typeof __DEV__ !== 'undefined' && __DEV__ && typeof globalThis !== 'undefined') {
  (globalThis as { __divecoreNotify?: typeof notify }).__divecoreNotify = notify;
}
