/**
 * Legend figures — the museum of legends (emci, 2026-10-08).
 *
 * Every legend is a hand-written museum label, built the way the question bank
 * is: fixed content, permanent ids, a check that pins the rules
 * (`scripts/legend-roster-check.ts`). Nothing here is ever written by a model.
 * The AI only writes the "you" part of a story, from these fields alone
 * (`prompt.ts`), and only after the person picks a legend.
 *
 * Two kinds:
 * - `real`  — a real person, died 2005 or earlier, non-polarizing (no heads of
 *   state or government, no military commanders, no religious founders or
 *   leaders, nobody with credible abuse or eugenics ties). Every fact has a
 *   source URL.
 * - `story` — myth, folklore, ghosts and strange tales. Labelled "Story, not
 *   history". Never a figure sacred in a religion people practise today, never
 *   a tale built on harm to children, never mocking a real culture. Every beat
 *   of the story as told still has a source URL.
 *
 * Not to be confused with the Divecore TD/Dress Legends (`src/play/avatars.ts`)
 * or the 64-archetype names (`src/lib/legends64/`).
 */
import type { TraitAxis, TraitLean } from '@/lib/traits';

export const LEGEND_HALLS = ['history', 'science', 'art', 'explorers', 'sport', 'myth', 'ghosts'] as const;
export type LegendHall = (typeof LEGEND_HALLS)[number];

export const HALL_LABEL: Record<LegendHall, string> = {
  history: 'Hall of history',
  science: 'Hall of science',
  art: 'Hall of art and music',
  explorers: 'Hall of explorers',
  sport: 'Hall of sport',
  myth: 'Hall of myth and folklore',
  ghosts: 'Hall of ghosts and strange tales',
};

export const LEGEND_REGIONS = [
  'europe',
  'africa',
  'middle_east',
  'south_asia',
  'east_asia',
  'americas',
  'oceania',
] as const;
export type LegendRegion = (typeof LEGEND_REGIONS)[number];

export type LegendKind = 'real' | 'story';
export type LegendGender = 'woman' | 'man' | 'none';

/** Where a fact comes from. `check` = phrases that must appear in the source
 * text; `verified` is set by the one-off batch check against the downloaded
 * source (2026-10-08). An unverified fact is never shown and never sent to AI. */
export interface LegendSource {
  url: string;
  check: readonly string[];
  verified: boolean;
}

export interface LegendFact {
  /** f1…f5, permanent within the legend. */
  id: string;
  text: string;
  source: LegendSource;
}

export interface LegendMoment {
  /** m1…m3, permanent within the legend — the AI refers to a moment by id. */
  id: string;
  text: string;
  source: LegendSource;
}

/** One way to tell this legend's story. The teaser is the hook on the label;
 * the meaning is the hand-written "what it means for you" the no-AI fallback
 * shows. */
export interface LegendAngle {
  /** a1…a6, permanent within the legend. */
  id: string;
  name: string;
  teaser: string;
  meaning: string;
}

/** A trait side this legend shows. `them` is the short "their side" phrase in
 * "Where you match" (≤ 6 words); `why` is one sentence of evidence from the
 * entry, used by the fallback and given to the AI as grounding. */
export interface LegendTag {
  axis: TraitAxis;
  lean: TraitLean;
  them: string;
  why: string;
}

export interface LegendFigure {
  /** `lf_<slug>`, permanent forever (pinned in roster-ids.json). */
  id: string;
  name: string;
  kind: LegendKind;
  hall: LegendHall;
  region: LegendRegion;
  /** Shown on the label: "Japan", "Akan folktales, West Africa". */
  place: string;
  /** Shown on the label: "1760–1849" or "Told since the 1700s". */
  era: string;
  /** Real people only: year of death (the check enforces ≤ 2005). */
  died?: number;
  /** Real people only, when the source gives it: MM-DD, for "On this day". */
  birthday?: { md: string; source: LegendSource };
  gender: LegendGender;
  field: string;
  /** One line under the name. */
  essence: string;
  whoTheyWere: string;
  famousFor: string;
  facts: readonly LegendFact[];
  moments: readonly LegendMoment[];
  angles: readonly LegendAngle[];
  tags: readonly LegendTag[];
  /** Hidden legends appear only when every listed trait side is a clear lean. */
  hidden?: { needs: readonly { axis: TraitAxis; lean: TraitLean }[] };
  /** One line on why this figure is safe to include (non-polarizing / myth rules). */
  vetting: string;
}
