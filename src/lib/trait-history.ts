/**
 * Append-only growth timeline for numeric trait writes.
 * Inserts go through the existing mergeTraitWrite persist path — no second writer.
 */
import { TRAIT_BAND_PHRASES } from '@/lib/trait-bands';
import { TRAIT_AXES, isTraitSource, type TraitAxis, type TraitSource, type TraitState } from '@/lib/traits';
import { trackFor, type EvidenceEntry, type TraitTrack } from '@/lib/trait-stability';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

export interface TraitHistoryRow {
  id: string;
  axis: TraitAxis;
  value: number;
  source: TraitSource;
  createdAt: string;
}

export const TRAIT_SHIFT_LABEL = 'How this has shifted';
export const TRAIT_SHIFT_EMPTY = 'Nothing recorded here yet.';
export const TRAIT_FIRST_READING = 'First reading landed.';

export function historyDiff(
  previous: TraitState,
  next: TraitState,
): Array<{ axis: TraitAxis; value: number; source: TraitSource }> {
  const out: Array<{ axis: TraitAxis; value: number; source: TraitSource }> = [];
  for (const axis of TRAIT_AXES) {
    const value = next.values[axis];
    const source = next.sources[axis];
    if (value == null || !Number.isFinite(value) || !isTraitSource(source)) continue;
    const prev = previous.values[axis];
    if (prev != null && Number.isFinite(prev) && Math.round(prev * 100) === Math.round(value * 100)) {
      continue;
    }
    out.push({ axis, value, source });
  }
  return out;
}

export function historyForAxis(
  rows: readonly TraitHistoryRow[],
  axis: TraitAxis,
): TraitHistoryRow[] {
  return rows.filter((row) => row.axis === axis);
}

/**
 * Attaches this axis+track's write history (already-fetched `trait_history`
 * rows) to a `TraitTrack` as `evidenceHistory` — read-side only, no schema
 * change, no new fetch: reuses `fetchTraitHistory`'s existing output. Report
 * vs game rows are told apart the same way `divergingAxes` already does
 * (`self_game` source vs every other known source). Nothing calls this yet —
 * groundwork for later phases.
 */
export function attachEvidenceHistory(
  row: TraitTrack,
  allHistory: readonly TraitHistoryRow[],
): TraitTrack {
  const wantGame = row.track === 'game';
  const evidenceHistory: EvidenceEntry[] = historyForAxis(allHistory, row.axis)
    .filter((entry) => (entry.source === 'self_game') === wantGame)
    .map((entry) => ({ value: entry.value, source: entry.source, createdAt: entry.createdAt }));
  return { ...row, evidenceHistory };
}

/** Latest self-report (IQ / ranking / slider / settings) vs latest gut-call. */
export interface AxisDivergence {
  axis: TraitAxis;
  report: number;
  game: number;
}

const REPORT_SOURCES: readonly TraitSource[] = [
  'self_slider',
  'self_tap',
  'self_confirm',
  'self_settings',
  'self_scenario',
  'self_grid',
  'self_situation',
];

export function formatDivergenceNote(rows: readonly AxisDivergence[]): string | null {
  if (rows.length === 0) return null;
  const first = rows[0]!;
  const phrases = TRAIT_BAND_PHRASES[first.axis];
  return `What they told us and a gut-call they played don't quite match on the stretch between "${phrases.low}" and "${phrases.high}".`;
}

export function divergingAxesFromTracks(rows: readonly TraitTrack[]): AxisDivergence[] {
  const out: AxisDivergence[] = [];
  for (const axis of TRAIT_AXES) {
    const report = trackFor(rows, axis, 'report');
    const game = trackFor(rows, axis, 'game');
    if (!report || !game) continue;
    if (report.answerCount < 1 || game.answerCount < 1) continue;
    if (Math.abs(report.value - game.value) < 0.25) continue;
    out.push({ axis, report: report.value, game: game.value });
  }
  return out;
}

/** Latest self-report vs latest gut-call in history. Prefer divergingAxesFromTracks. */
export function divergingAxes(rows: readonly TraitHistoryRow[]): AxisDivergence[] {
  const out: AxisDivergence[] = [];
  for (const axis of TRAIT_AXES) {
    const forAxis = historyForAxis(rows, axis);
    const report = [...forAxis].reverse().find((row) => REPORT_SOURCES.includes(row.source));
    const game = [...forAxis].reverse().find((row) => row.source === 'self_game');
    if (!report || !game) continue;
    if (Math.abs(report.value - game.value) < 0.25) continue;
    out.push({ axis, report: report.value, game: game.value });
  }
  return out;
}

function towardPhrase(axis: TraitAxis, previous: number | null, next: number): string {
  const phrases = TRAIT_BAND_PHRASES[axis];
  if (previous == null) return TRAIT_FIRST_READING;
  if (next > previous) return `Moved toward ${phrases.high}.`;
  if (next < previous) return `Moved toward ${phrases.low}.`;
  return TRAIT_FIRST_READING;
}

export function shiftLine(
  axis: TraitAxis,
  previous: number | null,
  next: number,
  iso: string,
  timeZone: string = 'UTC',
): string {
  const at = new Date(iso);
  const stamp = Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone,
      });
  const body = towardPhrase(axis, previous, next);
  return stamp ? `${stamp} — ${body}` : body;
}

export function shiftCopyClean(): boolean {
  const lines = [TRAIT_SHIFT_LABEL, TRAIT_SHIFT_EMPTY, TRAIT_FIRST_READING];
  return lines.every((line) => !containsFrameworkTerm(line));
}

/** 5–10s mis-tap window. No history write if undone in-window. */
export const TRAIT_UNDO_MS = 8000;
export const TRAIT_UNDO_LABEL = 'Undo';
