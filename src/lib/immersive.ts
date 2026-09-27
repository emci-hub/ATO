/**
 * Immersive mode bookkeeping — shared by `useImmersiveMode` / `ImmersiveScreen`.
 *
 * Several screens (or a screen and a nested overlay) may want the system bars
 * hidden at once. A plain "hide on mount / show on unmount" would let the first
 * one to close bring the bars back while another still wants them hidden. So
 * this is a reference count: the bars hide when the count goes 0 → 1 and come
 * back only when it returns to 0. Releases are idempotent per holder, so a
 * double cleanup can never drive the count negative.
 *
 * Pure (no React Native imports) so `scripts/check-immersive.ts` can pin it;
 * the platform calls are injected by the hook.
 */

export type ImmersiveApply = (hidden: boolean) => void;

export type ImmersiveCounter = {
  /** Take a hold; returns the release function (safe to call twice). */
  acquire: () => () => void;
  /** Re-assert the current state (e.g. Android re-shows bars on resume). */
  reapply: () => void;
  /** Current number of active holds. */
  count: () => number;
};

export function createImmersiveCounter(apply: ImmersiveApply): ImmersiveCounter {
  let holds = 0;
  return {
    acquire() {
      holds += 1;
      if (holds === 1) apply(true);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        holds = Math.max(0, holds - 1);
        if (holds === 0) apply(false);
      };
    },
    reapply() {
      apply(holds > 0);
    },
    count() {
      return holds;
    },
  };
}
