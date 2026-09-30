/**
 * Play banner queue (v25, 2026-09-30) — every in-app notice across Divecore
 * (pet back, hatched, revealed, odds updated, milestone ready, surface / bust,
 * claims, shop, TD milestones) goes through ONE floating banner: one shown at a
 * time, the rest wait in order. Pure, so `check:play-banner` can hold it.
 */
export type BannerTarget = 'pet' | 'journal' | 'dive' | null;

export type Banner = {
  id: number;
  title: string;
  body: string;
  /** Tapping the banner goes here (null = just dismiss). */
  target: BannerTarget;
};

export type BannerQueue = { items: Banner[]; nextId: number };

export const EMPTY_BANNERS: BannerQueue = { items: [], nextId: 1 };
/** How long a banner stays before it slides away on its own. */
export const BANNER_MS = 3200;
/** A queue longer than this drops the oldest waiting ones (never the one showing). */
export const BANNER_MAX_WAITING = 5;

/** Add a banner (an exact repeat of one already queued is skipped). */
export function enqueueBanner(q: BannerQueue, b: Omit<Banner, 'id'>): BannerQueue {
  if (q.items.some((it) => it.title === b.title && it.body === b.body)) return q;
  let items = [...q.items, { ...b, id: q.nextId }];
  if (items.length > BANNER_MAX_WAITING + 1) items = [items[0], ...items.slice(items.length - BANNER_MAX_WAITING)];
  return { items, nextId: q.nextId + 1 };
}

/** The one banner on screen (the oldest). */
export function currentBanner(q: BannerQueue): Banner | null {
  return q.items[0] ?? null;
}

/** Dismiss the showing banner (timeout, swipe up, or tap) → the next one. */
export function dismissBanner(q: BannerQueue, id: number): BannerQueue {
  if (q.items[0]?.id !== id) return q;
  return { ...q, items: q.items.slice(1) };
}

/* -------------------------------------------- events worth a banner --- */

/** What the Play screen compares between two renders to spot news. */
export type BannerWatch = {
  stage: string;
  /** Egg/Baby with the grade still hidden. */
  oddsOpen: boolean;
  /** Milestones done but not yet claimed. */
  milestonesReady: number;
};

/**
 * News since the last render → banners. The Pet screen shows hatching and the
 * reveal itself, so those two only banner when you're elsewhere in Play; a
 * newly ready milestone banners everywhere and taps through to the Journal.
 * No previous snapshot (first load) = no banners.
 */
export function bannerEvents(
  prev: BannerWatch | null,
  next: BannerWatch,
  onPetScreen: boolean,
): Omit<Banner, 'id'>[] {
  if (!prev) return [];
  const out: Omit<Banner, 'id'>[] = [];
  if (!onPetScreen && prev.stage === 'egg' && next.stage !== 'egg') {
    out.push({ title: 'Your egg hatched', body: 'Say hi to your new Baby — tap to visit.', target: 'pet' });
  }
  if (!onPetScreen && prev.oddsOpen && !next.oddsOpen && next.stage !== 'egg' && next.stage !== 'baby') {
    out.push({ title: 'Grade revealed', body: 'Your pet grew up — tap to see its grade.', target: 'pet' });
  }
  if (next.milestonesReady > prev.milestonesReady) {
    out.push({ title: 'Milestone ready', body: 'Claim it in the Journal — tap to open.', target: 'journal' });
  }
  return out;
}
