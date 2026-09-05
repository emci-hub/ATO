import { updateTraits } from '@/lib/me';
import { insertTraitHistory } from '@/lib/trait-history-store';
import { nudgedSecondaryValue, trackFor, type TraitTrack } from '@/lib/trait-stability';
import { updateTraitTrackValueOnly } from '@/lib/trait-tracks-store';
import type { TraitAxis } from '@/lib/traits';

import { primaryAxesFor, type QuestionDraft, type QuestionOption } from './types';

/**
 * Shared answer-apply for any LOCAL (bank-sourced) `QuestionDraft` — the
 * intake sweep and the Questions-tab category list both answer directly off
 * a `QuestionDraft`, never a persisted `QuestionItemRow`, so both can safely
 * carry `primaryAxes`/`secondaryAxes` (Phase 4). The persisted-pack path
 * (`pick()` in questions-fold.tsx, keyed on `QuestionItemRow`) is NOT covered
 * here — `QuestionItemRow` has no axis-weight fields; wiring it would need a
 * `question_items` schema change, not done, not asked.
 *
 * Primary axes: byte-identical to the pre-Phase-4 single-axis write when a
 * draft sets no `primaryAxes` (`primaryAxesFor` falls back to
 * `[{axis: draft.axis, weight: 1}]`) — weight is not yet applied here,
 * primary evidence always goes through the full existing
 * `mergeTraitWrite`/`applyEwmaAnswer` path unchanged.
 *
 * Secondary axes: a small weight-scaled nudge to `value` only. This does NOT
 * touch stability/answerCount directly — those are the only two fields
 * `effectiveStability` reads, so a secondary write cannot move
 * `isProfileSettled` on its own. It is NOT fully invisible going forward,
 * though: a later PRIMARY answer on that same axis will compare its new
 * signal against the nudged `value`, which is intended (the point of writing
 * `value` at all) but means secondary evidence has a small indirect,
 * delayed effect on that axis's next stability computation — never an
 * immediate one. Also known/accepted: the nudge only updates `trait_tracks`,
 * not `me.<axis>` (the mirrored column `persistMergedTraits` keeps in sync
 * for primary writes) — a secondary-only nudge is invisible to
 * `traitStateFromRow(me)`-based surfaces until a subsequent primary answer
 * on that axis pulls the mirror back in sync.
 *
 * Axes are never double-written: an axis listed in both `primaryAxes` and
 * `secondaryAxes` (a malformed draft) is treated as primary only, and
 * `secondaryAxes` is deduped by axis before writing.
 */
export async function applyQuestionAnswer(
  userId: string,
  draft: QuestionDraft,
  option: QuestionOption,
  tracks: readonly TraitTrack[],
): Promise<void> {
  const primary = primaryAxesFor(draft);
  const incoming: Partial<Record<TraitAxis, number>> = {};
  const allowed: TraitAxis[] = [];
  const primaryAxisSet = new Set<TraitAxis>();
  for (const { axis } of primary) {
    incoming[axis] = option.value;
    allowed.push(axis);
    primaryAxisSet.add(axis);
  }
  await updateTraits(userId, incoming, 'self_situation', allowed);

  const seenSecondary = new Set<TraitAxis>();
  const historyRows: { axis: TraitAxis; value: number; source: 'self_situation' }[] = [];
  for (const { axis, weight } of draft.secondaryAxes ?? []) {
    if (primaryAxisSet.has(axis) || seenSecondary.has(axis)) continue;
    seenSecondary.add(axis);
    // No track yet for this axis = updateTraitTrackValueOnly is a no-op
    // (fails open, no row to create). Nothing actually changed, so there is
    // nothing true to log either — skip entirely rather than writing a
    // trait_history row that claims a move that never happened.
    const current = trackFor(tracks, axis, 'report');
    if (!current) continue;
    // historyDiff (me.ts) always logs the post-merge resulting value, never
    // the raw incoming signal — match that convention so a secondary row
    // reads consistently with every other trait_history row (rendered
    // verbatim as "Moved toward X" via shiftLine on Full Profile).
    const nudged = nudgedSecondaryValue(current.value, option.value, weight);
    await updateTraitTrackValueOnly(userId, axis, 'report', nudged);
    historyRows.push({ axis, value: nudged, source: 'self_situation' });
  }
  if (historyRows.length > 0) {
    // Non-fatal, matching persistMergedTraits' convention (me.ts) — a
    // history-insert failure must not abort the flow after the primary
    // trait write already committed.
    await insertTraitHistory(userId, historyRows).catch((err) => {
      console.log('[questions] secondary-axis history insert error:', err);
    });
  }
}
