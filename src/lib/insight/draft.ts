/**
 * The daily insight's stored shape: the five fields and their length caps.
 *
 * The AI writer that lived in `generate-insight.ts` (prompt, parser,
 * DAILY_INSIGHT_COPY_REVIEWED) was removed in roadmap A5 (2026-10-23): the daily insight is
 * picked from the hand-written insight bank (`src/lib/insight-bank/`) and never calls a
 * model. What stays is the shape the store saves and the caps that must match the database.
 */

/**
 * Per-field character caps. These are mirrored by the CHECK constraints in
 * supabase/migrations/wave69_daily_insights.sql (title: wave87, raised to 120
 * for the stored focus sentences, emci 2026-10-07); scripts/insight-check.ts
 * parses both and fails if they drift apart.
 */
export const INSIGHT_FIELD_CAPS = {
  theme: 60,
  title: 120,
  reflection: 400,
  tryToday: 200,
  watchFor: 200,
} as const;

export interface DailyInsightDraft {
  theme: string;
  title: string;
  reflection: string;
  tryToday: string;
  watchFor: string;
}
