/**
 * Legends, gamified (ATO-BUILD PHASE-10): the pure maths behind the hall rings,
 * the match overlay and the reveal lock. No model call, nothing stored, and no
 * price, reward or quota in here (§1.6).
 */
import { rankStoryAxes } from '@/lib/story-thread';
import type { TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis } from '@/lib/traits';
import type { LegendFigure } from '@/lib/legend-figures/types';

/** A failsafe: the holo lock never outlives the animation by more than this. */
export const HOLO_GUARD_MS = 2500;

/** 0–1 share of a hall (or the whole museum) met. 0 with an empty hall; never above 1. */
export function ringFraction(met: number, total: number): number {
  if (!(total > 0) || !(met > 0)) return 0;
  return Math.min(1, met / total);
}

/** Whole-number percent for the overall ring. */
export function overallPercent(met: number, total: number): number {
  return Math.round(ringFraction(met, total) * 100);
}

/** strokeDashoffset for a ring: the full circumference is an empty ring. */
export function ringOffset(circumference: number, fraction: number): number {
  return circumference * (1 - Math.min(1, Math.max(0, fraction)));
}

/** The reader's clear leans this legend carries (same side of the same axis). */
export function matchedAxes(legend: LegendFigure, tracks: readonly TraitTrack[]): TraitAxis[] {
  const ranked = rankStoryAxes(tracks);
  const out: TraitAxis[] = [];
  for (const tag of legend.tags) {
    if (ranked.some((row) => row.axis === tag.axis && row.lean === tag.lean) && !out.includes(tag.axis)) {
      out.push(tag.axis);
    }
  }
  return out;
}

/** "Match 67%": the share of the legend's trait tags that sit on the reader's clear side. 0 when none. */
export function matchPercent(legend: LegendFigure, tracks: readonly TraitTrack[]): number {
  if (legend.tags.length === 0) return 0;
  const ranked = rankStoryAxes(tracks);
  const hits = legend.tags.filter((tag) => ranked.some((row) => row.axis === tag.axis && row.lean === tag.lean)).length;
  return Math.round((hits / legend.tags.length) * 100);
}

/** The tracks behind the mini "why this legend fits" constellation: only the matched axes. */
export function matchedTracks(legend: LegendFigure, tracks: readonly TraitTrack[]): TraitTrack[] {
  const axes = new Set(matchedAxes(legend, tracks));
  return tracks.filter((track) => axes.has(track.axis));
}

/**
 * One frame's state. A frame is tappable only when nothing is being written
 * (`busyKey`) AND no holo reveal is still turning (`holoActive`): a second tap
 * during either is ignored (R07).
 */
export function frameState(input: {
  key: string;
  busyKey: string | null;
  canReveal: boolean;
  holoActive: boolean;
}): 'ready' | 'loading' | 'spent' {
  if (input.busyKey === input.key) return 'loading';
  if (input.busyKey != null || input.holoActive) return 'spent';
  return input.canReveal ? 'ready' : 'spent';
}
