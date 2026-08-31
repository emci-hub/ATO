/**
 * You-tab Full Profile. Private inventory of the 15 axes — invitation, not
 * a score of a person. Completeness is "N of 15 answered" only. Never a
 * percent. Never on Home, Explore, Talk, widget, or push.
 *
 * Display grouping is what the person did, not merge rank: a type-grid or
 * situation tap is still "you told us." Gut-call is the only inferred-from-
 * play source stored (`self_game`). Ranking writes `self_tap` (told).
 * Sage-knows correction writes `self_settings`; Still fits writes `self_confirm`.
 * Only the last source is stored — there is no per-axis history log.
 */

import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import {
  TRAIT_AXES,
  emptyTraitValues,
  isTraitSource,
  type TraitSource,
  type TraitValues,
} from '@/lib/traits';

export const FULL_PROFILE_LABEL = "How you're currently leaning";
export const FULL_PROFILE_LEDE =
  'This can change. It is how you are leaning right now — not a type, not a diagnosis.';
export const NOT_ANSWERED_YET = 'Not answered yet';
export const TRAIT_AXIS_TOTAL = TRAIT_AXES.length;

export type ProvenanceKind = 'told' | 'inferred' | 'corrected' | 'confirmed';

export interface AxisProvenance {
  kind: ProvenanceKind;
  line: string;
}

const TOLD_LINE: Record<
  Exclude<TraitSource, 'self_game' | 'self_settings' | 'self_confirm'>,
  string
> = {
  self_slider: 'You told us directly — a vibe-check you tapped.',
  self_grid: 'You told us directly — a type you already knew.',
  self_situation: 'You told us directly — a situation you picked.',
  self_tap: 'You told us directly — a ranking you sorted.',
};

export function answeredAxisCount(values: TraitValues): number {
  let n = 0;
  for (const axis of TRAIT_AXES) {
    const value = values[axis];
    if (value != null && Number.isFinite(value)) n += 1;
  }
  return n;
}

export function answeredAxisLabel(values: TraitValues): string {
  return `${answeredAxisCount(values)} of ${TRAIT_AXIS_TOTAL} answered`;
}

/** Last stored source only. Null axis / unknown token → nothing to show. */
export function sourceProvenance(source: unknown): AxisProvenance | null {
  if (!isTraitSource(source)) return null;
  if (source === 'self_game') {
    return { kind: 'inferred', line: 'Inferred from a gut-call you played.' };
  }
  if (source === 'self_settings') {
    return { kind: 'corrected', line: 'You corrected this after Sage checked in.' };
  }
  if (source === 'self_confirm') {
    return { kind: 'confirmed', line: 'You said this still fits.' };
  }
  return { kind: 'told', line: TOLD_LINE[source] };
}

export function formatTraitTouchedAt(
  iso: string | undefined,
  timeZone: string = 'UTC',
): string | null {
  if (!iso || !iso.trim()) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const stamp = at.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  });
  return `Last updated ${stamp}`;
}

export function profileCopyClean(): boolean {
  const lines = [
    FULL_PROFILE_LABEL,
    FULL_PROFILE_LEDE,
    NOT_ANSWERED_YET,
    answeredAxisLabel(emptyTraitValues()),
    ...Object.values(TOLD_LINE),
    'Inferred from a gut-call you played.',
    'You corrected this after Sage checked in.',
    'You said this still fits.',
  ];
  return lines.every((line) => !containsFrameworkTerm(line));
}
