/**
 * Inline Merge — the pure half (no react-native / expo imports), so
 * `scripts/check-merge-inline.ts` can run it in plain Node.
 *
 * Merge lives on the item's own row in Dress (2026-09-27, emci): no detached
 * confirm card. A miss permanently spends the fuel copy (the main is never
 * lost — see `mergeItem` in playStore.ts), so the row's Merge button takes TWO
 * taps: the first arms it ("Tap again · 55%") and the arm lapses after
 * `MERGE_ARM_MS`; the second rolls. The result shows on the row itself.
 */
import type { ItemSlot } from '@/play/items';
import type { MergeOutcome, MergeTarget } from '@/play/playStore';

/** How long an armed Merge button waits for its confirming second tap. */
export const MERGE_ARM_MS = 3500;
/** How long the success / miss feedback stays on the row. */
export const MERGE_RESULT_MS = 1800;

/**
 * Row identity for a Worn slot AND the item in it. Keyed on the item id too,
 * so equipping a different item into the slot (or swapping Avatar) drops an
 * arm left on the old item — one tap must never roll an item the player
 * didn't arm. The star is deliberately NOT in the key: a worn merge upgrades
 * in place, and its result must land on this same row.
 */
export function wornRowKey(slot: ItemSlot, itemId: string | null): string {
  return `worn:${slot}:${itemId ?? ''}`;
}

/** Stable row identity for one bag stack (one id at one star tier). */
export function bagRowKey(id: string, star: number): string {
  return `bag:${id}@${star}`;
}

/** Where a Merge button currently is in its two-tap flow. */
export type MergeButtonState = 'idle' | 'armed' | 'rolling';

/** The Merge button's label — the success % is always on the button. */
export function mergeButtonLabel(state: MergeButtonState, pct: number): string {
  if (state === 'rolling') return 'Rolling…';
  if (state === 'armed') return `Tap again · ${pct}%`;
  return `Merge · ${pct}%`;
}

/** Screen-reader label matching `mergeButtonLabel`, naming the item. */
export function mergeButtonA11y(state: MergeButtonState, name: string, pct: number): string {
  if (state === 'rolling') return `Merging ${name}`;
  if (state === 'armed') return `Confirm merge ${name}, ${pct} percent chance. Misses spend one spare.`;
  return `Merge ${name}, ${pct} percent chance`;
}

/**
 * Which row should show a merge's result. Usually the row that was tapped —
 * EXCEPT a successful bag-main merge: the upgraded copy moves to the NEXT
 * star's stack (`bag:id@star+1`), so the success belongs on that row, where
 * the new ★ actually appears. A worn main upgrades in place (same slot row);
 * a miss leaves the main where it was.
 */
export function mergeResultRowKey(
  tappedKey: string,
  target: MergeTarget,
  outcome: MergeOutcome,
): string {
  if (outcome.success && target.main === 'bag') return bagRowKey(target.id, outcome.toStar);
  return tappedKey;
}

/** A merge result pinned to one row. `seq` makes every result unique, so a
 * second identical result on the same row still replays its feedback. */
export type MergeRowFeedback = {
  key: string;
  success: boolean;
  toStar: number | null;
  seq: number;
};

/** Short on-row result text. */
export function mergeFeedbackLabel(feedback: MergeRowFeedback): string {
  if (feedback.success) return `✓ Merged ★${feedback.toStar ?? ''}`;
  return '✗ Missed · spare spent';
}
