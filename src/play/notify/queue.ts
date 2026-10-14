/**
 * Divecore notices — the ONE queue (spec: docs/divecore-ui-spec.md §Notices).
 *
 * Pure, so `check:notify` can hold every rule. The renderer (`notice-lane.tsx`) shows
 * `q.showing` in the NoticeLane — never over the Stage.
 *
 * Only three kinds are banners. The other four never reach this queue:
 *   FEEDBACK (result of your own tap)  → on the control (`useControlFeedback`)
 *   STATUS   (ongoing state)           → HUD badge / pip
 *   HELP     (coach tips)              → FloatLayer tip anchored to the control
 *   CONFIRM  (needs a decision)        → ModalLayer sheet, one at a time
 */

export type NoticeKind = 'celebrate' | 'notify' | 'error';
export type NoticePriority = 'high' | 'normal' | 'low';
/** Where a tap on the notice goes (null = it just closes). */
export type NoticeTarget = 'pet' | 'journal' | 'dive' | null;

export type NoticeInput = {
  kind: NoticeKind;
  /** ≤ 3 words. */
  title: string;
  /** ≤ 10 words, one line. ERROR bodies say the fix. */
  body?: string;
  target?: NoticeTarget;
  /** Repeats with the same key merge into one notice with a ×N counter. */
  dedupeKey?: string;
  priority?: NoticePriority;
};

export type Notice = {
  id: number;
  kind: NoticeKind;
  title: string;
  body: string;
  target: NoticeTarget;
  key: string;
  priority: NoticePriority;
  /** How many times it was raised (shown as ×N when > 1). */
  count: number;
  /** When it was raised (ms). */
  at: number;
};

export type NoticeMode = 'all' | 'important';

export type NoticeQueue = {
  showing: Notice | null;
  /** When `showing` went up (ms) — its timer runs from here. */
  shownAt: number;
  waiting: Notice[];
  nextId: number;
  /** Last notice that left the lane: its kind, key and when it left. */
  last: { kind: NoticeKind; key: string; at: number } | null;
};

export const EMPTY_NOTICES: NoticeQueue = { showing: null, shownAt: 0, waiting: [], nextId: 1, last: null };

/* ---------------------------------------------------------------- rules --- */

export const NOTICE_MAX_WAITING = 4;
/** A repeat of the same kind + title (or dedupeKey) inside this window merges. */
export const NOTICE_DEDUPE_MS = 10_000;
/** Never two of the same kind back to back closer than this. */
export const NOTICE_SAME_KIND_GAP_MS = 1_000;
/** Reduce Motion gets longer to read (gentle, never rushed). */
export const NOTICE_REDUCE_MOTION_EXTRA_MS = 1_000;

export const NOTICE_MS: Record<NoticeKind, number> = {
  celebrate: 3_500,
  notify: 3_000,
  /** ERROR stays until tapped or this long, whichever first. */
  error: 5_000,
};

export const NOTICE_DEFAULT_PRIORITY: Record<NoticeKind, NoticePriority> = {
  celebrate: 'high',
  notify: 'normal',
  error: 'high',
};

export const NOTICE_TITLE_MAX_WORDS = 3;
export const NOTICE_BODY_MAX_WORDS = 10;

const RANK: Record<NoticePriority, number> = { high: 0, normal: 1, low: 2 };

export function noticeWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Null when the copy fits the limits, else why not. */
export function noticeCopyProblem(input: Pick<NoticeInput, 'title' | 'body'>): string | null {
  const t = noticeWords(input.title);
  const b = noticeWords(input.body ?? '');
  if (t === 0) return 'title is empty';
  if (t > NOTICE_TITLE_MAX_WORDS) return `title is ${t} words (max ${NOTICE_TITLE_MAX_WORDS})`;
  if (b > NOTICE_BODY_MAX_WORDS) return `body is ${b} words (max ${NOTICE_BODY_MAX_WORDS})`;
  return null;
}

/** How long a notice stays (ms). */
export function noticeDuration(kind: NoticeKind, reduceMotion: boolean): number {
  return NOTICE_MS[kind] + (reduceMotion ? NOTICE_REDUCE_MOTION_EXTRA_MS : 0);
}

/** "Important only" shows ERROR and CELEBRATE; "All" shows everything. */
export function noticeAllowed(kind: NoticeKind, mode: NoticeMode): boolean {
  return mode === 'all' || kind !== 'notify';
}

/** The text a screen reader hears when it shows. */
export function noticeAnnouncement(n: Pick<Notice, 'title' | 'body' | 'count'>): string {
  const count = n.count > 1 ? ` ×${n.count}` : '';
  return n.body ? `${n.title}${count}. ${n.body}` : `${n.title}${count}`;
}

/* ---------------------------------------------------------------- queue --- */

function keyOf(input: NoticeInput): string {
  return input.dedupeKey ?? `${input.kind}|${input.title}`;
}

/** Drop the oldest lowest-priority waiting ones until the cap holds. */
function capWaiting(waiting: Notice[]): Notice[] {
  const out = [...waiting];
  while (out.length > NOTICE_MAX_WAITING) {
    let drop = 0;
    for (let i = 1; i < out.length; i += 1) {
      // Lower priority loses; within a priority the oldest (earliest) loses.
      if (RANK[out[i].priority] > RANK[out[drop].priority]) drop = i;
    }
    out.splice(drop, 1);
  }
  return out;
}

/**
 * Raise a notice. A repeat of one still on screen or waiting merges into it (×N). A
 * repeat of one that left the lane less than 10 s ago comes back as one notice with the
 * total count. Over the cap, the oldest low-priority waiting notice drops.
 */
export function enqueueNotice(q: NoticeQueue, input: NoticeInput, now: number, mode: NoticeMode = 'all'): NoticeQueue {
  if (!noticeAllowed(input.kind, mode)) return q;
  const key = keyOf(input);
  if (q.showing && q.showing.key === key && now - q.showing.at < NOTICE_DEDUPE_MS) {
    // Same notice is up: bump the counter and restart its timer so the ×N can be read.
    return { ...q, showing: { ...q.showing, count: q.showing.count + 1, body: input.body ?? q.showing.body }, shownAt: now };
  }
  const waitingIdx = q.waiting.findIndex((n) => n.key === key);
  if (waitingIdx >= 0) {
    const waiting = [...q.waiting];
    waiting[waitingIdx] = { ...waiting[waitingIdx], count: waiting[waitingIdx].count + 1, body: input.body ?? waiting[waitingIdx].body };
    return { ...q, waiting };
  }
  const recentRepeat = q.last && q.last.key === key && now - q.last.at < NOTICE_DEDUPE_MS;
  const notice: Notice = {
    id: q.nextId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? '',
    target: input.target ?? null,
    key,
    priority: input.priority ?? NOTICE_DEFAULT_PRIORITY[input.kind],
    count: recentRepeat ? 2 : 1,
    at: now,
  };
  return { ...q, waiting: capWaiting([...q.waiting, notice]), nextId: q.nextId + 1 };
}

/** The waiting notice that should go up next (priority, then first in). */
function pickNext(waiting: Notice[], last: NoticeQueue['last'], now: number, paused: boolean): number {
  let best = -1;
  for (let i = 0; i < waiting.length; i += 1) {
    const n = waiting[i];
    if (paused && n.kind !== 'error') continue;
    if (last && last.kind === n.kind && now - last.at < NOTICE_SAME_KIND_GAP_MS) continue;
    if (best < 0 || RANK[n.priority] < RANK[waiting[best].priority]) best = i;
  }
  return best;
}

/**
 * Advance the queue at `now`: expire the one showing when its time is up, then put the
 * next one up. While `paused` (a modal / sheet / coach tip is open, or a Turf War
 * wave-critical moment) only ERROR goes up. Returns the same object when nothing changed.
 */
export function tickNotices(q: NoticeQueue, now: number, opts: { paused: boolean; reduceMotion: boolean }): NoticeQueue {
  let next = q;
  if (next.showing && now - next.shownAt >= noticeDuration(next.showing.kind, opts.reduceMotion)) {
    next = dismissNotice(next, next.showing.id, now);
  }
  if (next.showing || next.waiting.length === 0) return next;
  const i = pickNext(next.waiting, next.last, now, opts.paused);
  if (i < 0) return next;
  const waiting = [...next.waiting];
  const [up] = waiting.splice(i, 1);
  return { ...next, showing: up, shownAt: now, waiting };
}

/** Close the one showing (timeout, swipe, tap). Any other id is ignored. */
export function dismissNotice(q: NoticeQueue, id: number, now: number): NoticeQueue {
  if (!q.showing || q.showing.id !== id) return q;
  return { ...q, showing: null, last: { kind: q.showing.kind, key: q.showing.key, at: now } };
}

/** Ms until the next tick can change anything (for the renderer's timer); null = idle. */
export function nextNoticeWake(q: NoticeQueue, now: number, opts: { paused: boolean; reduceMotion: boolean }): number | null {
  if (q.showing) return Math.max(0, q.shownAt + noticeDuration(q.showing.kind, opts.reduceMotion) - now);
  if (q.waiting.length === 0) return null;
  if (pickNext(q.waiting, q.last, now, opts.paused) >= 0) return 0;
  // Blocked only by the same-kind gap → wake when it opens; blocked by pause → idle.
  if (q.last && now - q.last.at < NOTICE_SAME_KIND_GAP_MS) return q.last.at + NOTICE_SAME_KIND_GAP_MS - now;
  return null;
}
