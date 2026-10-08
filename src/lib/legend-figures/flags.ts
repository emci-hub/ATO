/**
 * Legend figures — review gates (emci, 2026-10-08).
 *
 * The roster, teasers, meanings and the AI prompt ship UNREVIEWED: emci reads
 * `docs/legend-figures-review.md`, ticks every legend, then this flips. Per
 * the insight-bank rule (emci 2026-10-07) the app shows NO draft badge; the
 * flag is listed on the dev hub's copy list.
 */
export const LEGEND_FIGURES_COPY_REVIEWED = false;

/**
 * `pilot` — the first 26 legends: every one of the 32 trait sides needs at
 * least one visible legend. `full` — the ~200 roster: at least 8 per side,
 * plus the spread rules. The check reads this.
 */
export type LegendRosterStage = 'pilot' | 'full';
export const LEGEND_ROSTER_STAGE: LegendRosterStage = 'pilot';
