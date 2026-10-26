/**
 * Optional trait backbone (Stage 11 + six extra axes).
 *
 * Self-report coaching scores on a 0–1 scale. Not a clinical inventory.
 * Raw taps (type letters, category names, game choices) are translated here
 * and discarded.
 *
 * Parked, do not block this box: privacy.md naming these fields as coaching
 * self-report. Settings re-tap is the You-tab Full Profile fold (AxisTaps →
 * updateTraits). last_touched is live — unparked for the 3-month re-ask.
 */

import { containsFrameworkTerm, sanitizeFacts } from '@/lib/voice/framework-fence';
import { SCENARIO_QUESTIONS } from '@/lib/vibe-check';

export const TRAIT_AXES = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'steadiness',
  'attachment_anxiety',
  'attachment_avoidance',
  'conflict_assertiveness',
  'conflict_cooperativeness',
  'autonomy',
  'competence',
  'relatedness',
  'growth_mindset',
  'locus_of_control',
  'self_efficacy',
  'playfulness',
] as const;

export type TraitAxis = (typeof TRAIT_AXES)[number];

export const EXTRA_AXES = [
  'autonomy',
  'competence',
  'relatedness',
  'growth_mindset',
  'locus_of_control',
  'self_efficacy',
  'playfulness',
] as const;

/** Direct writes are sticky: inferred sources cannot overwrite them. */
export const DIRECT_TRAIT_SOURCES = [
  'self_slider',
  'self_tap',
  'self_confirm',
  'self_settings',
  'self_scenario',
] as const;

/** Ranked below direct. Last-write-wins among inferred only. */
export const INFERRED_TRAIT_SOURCES = ['self_grid', 'self_situation', 'self_game'] as const;

export const TRAIT_SOURCES = [...DIRECT_TRAIT_SOURCES, ...INFERRED_TRAIT_SOURCES] as const;

export type DirectTraitSource = (typeof DIRECT_TRAIT_SOURCES)[number];
export type InferredTraitSource = (typeof INFERRED_TRAIT_SOURCES)[number];
export type TraitSource = (typeof TRAIT_SOURCES)[number];

export function isTraitSource(value: unknown): value is TraitSource {
  return typeof value === 'string' && (TRAIT_SOURCES as readonly string[]).includes(value);
}

export function isDirectTraitSource(value: unknown): value is DirectTraitSource {
  return typeof value === 'string' && (DIRECT_TRAIT_SOURCES as readonly string[]).includes(value);
}

export function isInferredTraitSource(value: unknown): value is InferredTraitSource {
  return typeof value === 'string' && (INFERRED_TRAIT_SOURCES as readonly string[]).includes(value);
}

export const GRID_AXES = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
] as const;

export const SLIDER_AXES = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'steadiness',
] as const;

export type TraitValues = Record<TraitAxis, number | null>;
export type TraitSources = Partial<Record<TraitAxis, TraitSource>>;
export type TraitTouched = Partial<Record<TraitAxis, string>>;

export interface TraitState {
  values: TraitValues;
  sources: TraitSources;
  /** ISO timestamps. Null axes have no key. */
  touched: TraitTouched;
}

/** 8 two-axis scenario questions — see `SCENARIO_QUESTIONS` in `@/lib/vibe-check`. */
export const OPTIONAL_INTAKE_TOTAL = 8;

export type OptionalScreen = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Axes that optional screen `n` would write. Used to find skipped fill-later screens. */
export function axesWrittenByOptionalScreen(screen: OptionalScreen): readonly TraitAxis[] {
  return SCENARIO_QUESTIONS[screen].axes;
}

/** Optional screens that still have at least one null axis they would write. */
export function unansweredOptionalScreens(values: TraitValues): OptionalScreen[] {
  const out: OptionalScreen[] = [];
  for (let i = 0; i < OPTIONAL_INTAKE_TOTAL; i++) {
    const screen = i as OptionalScreen;
    if (axesWrittenByOptionalScreen(screen).some((axis) => values[axis] == null)) {
      out.push(screen);
    }
  }
  return out;
}

export const SLIDER_STOPS = [0, 0.25, 0.5, 0.75, 1] as const;

function clamp01(value: number): number {
  const n = Math.min(1, Math.max(0, value));
  return Math.round(n * 100) / 100;
}

/** Inferred writes mix the new signal into the stored number instead of replacing it. */
export const INFERRED_SIGNAL_WEIGHT = 0.12;
export const INFERRED_PRIOR_WEIGHT = 0.88;
/** Neutral prior when the axis is still null. */
export const INFERRED_UNSET_PRIOR = 0.5;

export function blendInferredTrait(signal: number, oldValue: number | null | undefined): number {
  const prior =
    oldValue == null || !Number.isFinite(oldValue) ? INFERRED_UNSET_PRIOR : oldValue;
  return clamp01(INFERRED_SIGNAL_WEIGHT * signal + INFERRED_PRIOR_WEIGHT * prior);
}

export function emptyTraitValues(): TraitValues {
  const values = {} as TraitValues;
  for (const axis of TRAIT_AXES) {
    values[axis] = null;
  }
  return values;
}

export function emptyTraitState(): TraitState {
  return { values: emptyTraitValues(), sources: {}, touched: {} };
}

/**
 * Source-aware merge for numeric writes. Direct (slider / tap-form /
 * Settings / scenario) is sticky: a later inferred write (grid / situation /
 * game) cannot overwrite that axis. Direct sources full-replace the 0–1 number.
 * Inferred sources damp toward the signal:
 * `0.12 * signal + 0.88 * old` (null old uses 0.5). Among the same rank,
 * last-write-wins the source token. Incoming null/undefined means "this
 * door did not write that axis." A rejected inferred write does not bump
 * last_touched.
 *
 * Confirm-upgrade is not a numeric write — use `confirmTraitSource`.
 */
export function mergeTraitWrite(
  current: TraitState,
  incoming: Partial<Record<TraitAxis, number | null>>,
  source: Exclude<TraitSource, 'self_confirm'>,
  allowed: readonly TraitAxis[],
  now: string = new Date().toISOString(),
): TraitState {
  if ((source as TraitSource) === 'self_confirm') {
    throw new Error('confirmTraitSource upgrades a source token; mergeTraitWrite cannot write a confirm');
  }
  const values = { ...current.values };
  const sources = { ...current.sources };
  const touched = { ...current.touched };
  for (const axis of allowed) {
    const raw = incoming[axis];
    if (raw == null || !Number.isFinite(raw)) continue;
    // Sticky only while the trait has a value: a leftover direct label on an
    // empty trait (after a reset) must not block it forever (2026-10-03).
    if (current.values[axis] != null && isDirectTraitSource(current.sources[axis]) && !isDirectTraitSource(source)) continue;
    values[axis] = isInferredTraitSource(source)
      ? blendInferredTrait(raw, values[axis])
      : clamp01(raw);
    sources[axis] = source;
    touched[axis] = now;
  }
  return { values, sources, touched };
}

/**
 * Confirm-upgrade. Promotes listed axes to `self_confirm` and bumps
 * last_touched. Never accepts a numeric value — the 0–1 number stays
 * exactly as stored. Null axes are skipped (nothing to confirm).
 */
export function confirmTraitSource(
  current: TraitState,
  axes: readonly TraitAxis[],
  now: string = new Date().toISOString(),
): TraitState {
  const values = { ...current.values };
  const sources = { ...current.sources };
  const touched = { ...current.touched };
  for (const axis of axes) {
    if (current.values[axis] == null) continue;
    sources[axis] = 'self_confirm';
    touched[axis] = now;
  }
  return { values, sources, touched };
}

export function traitStateFromRow(
  row: Partial<Record<TraitAxis, number | null>> & {
    trait_sources?: unknown;
    trait_touched_at?: unknown;
  },
): TraitState {
  const values = emptyTraitValues();
  for (const axis of TRAIT_AXES) {
    const n = row[axis];
    values[axis] = typeof n === 'number' && Number.isFinite(n) ? clamp01(n) : null;
  }
  const sources: TraitSources = {};
  if (row.trait_sources && typeof row.trait_sources === 'object' && !Array.isArray(row.trait_sources)) {
    const raw = row.trait_sources as Record<string, unknown>;
    for (const axis of TRAIT_AXES) {
      const src = raw[axis];
      if (isTraitSource(src)) sources[axis] = src;
    }
  }
  const touched: TraitTouched = {};
  if (row.trait_touched_at && typeof row.trait_touched_at === 'object' && !Array.isArray(row.trait_touched_at)) {
    const raw = row.trait_touched_at as Record<string, unknown>;
    for (const axis of TRAIT_AXES) {
      const at = raw[axis];
      if (typeof at === 'string' && at.trim().length > 0) touched[axis] = at;
    }
  }
  return { values, sources, touched };
}

export function traitPatch(
  state: TraitState,
): TraitValues & { trait_sources: TraitSources; trait_touched_at: TraitTouched } {
  const sources: TraitSources = {};
  const touched: TraitTouched = {};
  for (const axis of TRAIT_AXES) {
    if (state.values[axis] == null) continue;
    if (state.sources[axis]) sources[axis] = state.sources[axis];
    if (state.touched[axis]) touched[axis] = state.touched[axis];
  }
  return { ...state.values, trait_sources: sources, trait_touched_at: touched };
}

export function allowedAxesForSource(source: TraitSource): readonly TraitAxis[] {
  if (source === 'self_grid') return GRID_AXES;
  if (source === 'self_slider') return SLIDER_AXES;
  return TRAIT_AXES;
}

export function optionalProgressLabel(n: number): string {
  return `extra ${n} of ${OPTIONAL_INTAKE_TOTAL}`;
}

/**
 * Selecting an option writes both axes for that screen's scenario question,
 * as self_scenario — direct (full-replace, sticky), not blended toward 0.5
 * like an inferred source would be, and never overwritten by a later
 * inferred write. A later direct edit (e.g. Settings) can still replace it.
 */
export function writeForOptionalScreen(input: {
  screen: OptionalScreen;
  optionId: string | null;
}): {
  incoming: Partial<Record<TraitAxis, number>>;
  source: Exclude<TraitSource, 'self_confirm'>;
  allowed: readonly TraitAxis[];
} | null {
  if (!input.optionId) return null;
  const question = SCENARIO_QUESTIONS[input.screen];
  const option = question?.options.find((item) => item.value === input.optionId);
  if (!option) return null;
  const [axisA, axisB] = question.axes;
  return {
    incoming: { [axisA]: option.axisAValue, [axisB]: option.axisBValue },
    source: 'self_scenario',
    allowed: question.axes,
  };
}

/**
 * You-tab fill-later write. Same sources as onboarding (`writeForOptionalScreen`)
 * then drops any axis that already has a stored number — additive only.
 * Still meant to go through `mergeTraitWrite` / `updateTraits`.
 */
export function optionalFillWrite(
  values: TraitValues,
  input: Parameters<typeof writeForOptionalScreen>[0],
): {
  incoming: Partial<Record<TraitAxis, number>>;
  source: Exclude<TraitSource, 'self_confirm'>;
  allowed: readonly TraitAxis[];
} | null {
  const write = writeForOptionalScreen(input);
  if (!write) return null;
  const incoming: Partial<Record<TraitAxis, number>> = {};
  for (const axis of write.allowed) {
    const value = write.incoming[axis];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    if (values[axis] != null) continue;
    incoming[axis] = value;
  }
  if (Object.keys(incoming).length === 0) return null;
  return { incoming, source: write.source, allowed: write.allowed };
}

export type TraitBand = 'low' | 'mid' | 'high';

/**
 * Band cuts, derived from the question bank's own option midpoints rather
 * than from the raw 0–1 line. Options are 0.2 / 0.5 / 0.8, so the
 * instrument-correct boundaries are (0.2 + 0.5) / 2 and (0.5 + 0.8) / 2.
 *
 * scripts/band-study-check.ts proves a stored value can never leave the
 * convex hull of the signals fed in — [0.2, 0.8] from the bank — so the
 * previous 0.33/0.67 cuts were calibrated to a range the instrument cannot
 * write into, handing `mid` 57% of the reachable line. CATEGORY_FALLBACK_BANDS
 * already used these numbers; both now read from here, so there is one band
 * system rather than two that happen to agree.
 *
 * Interval convention matches CATEGORY_FALLBACK_BANDS exactly — low is
 * [0, 0.35), mid is [0.35, 0.65), high is [0.65, 1]. Both cuts belong to the
 * band above them. Without this, a value of exactly 0.35 would read `low` here
 * and land in the mid lede over there, which is the kind of one-sided
 * disagreement having two band systems caused in the first place.
 */
export const TRAIT_BAND_LOW_CUT = 0.35;
export const TRAIT_BAND_HIGH_CUT = 0.65;

export function traitBand(value: number | null | undefined): TraitBand | null {
  if (value == null) return null;
  if (value < TRAIT_BAND_LOW_CUT) return 'low';
  if (value >= TRAIT_BAND_HIGH_CUT) return 'high';
  return 'mid';
}

export type TraitLean = 'high' | 'low';

/**
 * Binary lean for prompt grounding and fallback copy tables — deliberately
 * NOT `traitBand`. These sites need a pole for every value with no mid case,
 * and an unset axis reads as low. Centralizes the `>= 0.5` literal that was
 * repeated across the prompt builders.
 */
export function leanHighLow(value: number | null | undefined): TraitLean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.5 ? 'high' : 'low';
}

/** Same split, worded for the "Lean higher/lower." prompt lines. */
export function leanComparative(value: number | null | undefined): 'higher' | 'lower' {
  return leanHighLow(value) === 'high' ? 'higher' : 'lower';
}

/**
 * High/low behavioral paraphrases. Sage prompts and Does-Sage-know-you
 * both read from this bank — never a live model call for the check-in.
 * Mid-band lines stay in traitPromptLines only; the check-in surface skips mid.
 */
export const TRAIT_POLE_LINES: Record<TraitAxis, { low: string; high: string }> = {
  openness: {
    high: "They will try something new, even when other people stick with a familiar option.",
    low: "They stick with something already known to be liked.",
  },
  conscientiousness: {
    high: "They finish a plan once it is started.",
    low: "They keep plans loose on purpose.",
  },
  extraversion: {
    high: "They look for time with other people.",
    low: "They recharge with time to themselves.",
  },
  agreeableness: {
    high: "They give the other plan a yes to keep things easy.",
    low: "They state a blunt point and stay with it.",
  },
  steadiness: {
    high: "They shake a bad day off quickly.",
    low: "They feel a bad day for longer.",
  },
  attachment_anxiety: {
    high: "They worry people will pull away.",
    low: "They let a gap in contact pass.",
  },
  attachment_avoidance: {
    high: "They keep some distance once things get close.",
    low: "They stay close once the bond has started.",
  },
  conflict_assertiveness: {
    high: "They put a clear point on the table in a disagreement.",
    low: "They step back in a disagreement.",
  },
  conflict_cooperativeness: {
    high: "They look for an option the other person can live with.",
    low: "They protect a chosen outcome in a disagreement.",
  },
  autonomy: {
    high: "They choose a way of doing the task.",
    low: "They follow a path that is already set.",
  },
  competence: {
    high: "They trust that a hard task can be handled.",
    low: "They doubt a hard task can be pulled off.",
  },
  relatedness: {
    high: "They need a real connection for a day to feel right.",
    low: "They can let a day land without much connection.",
  },
  growth_mindset: {
    high: "They look for what to change after a miss.",
    low: "They can treat a miss as the end of that path.",
  },
  locus_of_control: {
    high: "They look at the part of a problem that could be steered.",
    low: "They figure a bad outcome was bound to happen.",
  },
  self_efficacy: {
    high: "They expect to finish a big task once it is started.",
    low: "They pause before trusting a big task can be finished.",
  },
  playfulness: {
    high: "They look for a lighter take on an ordinary task.",
    low: "They take a situation straight instead of turning it into play.",
  },
};

const TRAIT_MID_LINES: Partial<Record<TraitAxis, string>> = {
  extraversion: "They split time between other people and time to themselves.",
  openness: "They mix a known favorite with a new option.",
  conscientiousness: "They plan some things and leave others open.",
  agreeableness: "They weigh going along against stating a blunt point.",
  steadiness: "They let one setback fade and still sit with another.",
  attachment_anxiety: "They mix a check-in with letting a gap in contact pass.",
  attachment_avoidance: "They mix closeness with a bit of distance.",
  conflict_assertiveness: "They push a point at some times and wait at others.",
  conflict_cooperativeness: "They split attention between a chosen outcome and the other person.",
  autonomy: "They mix a self-chosen way with a path that is already set.",
  competence: "They trust some hard tasks and doubt others.",
  relatedness: "They want connection on some days and not on others.",
  growth_mindset: "They look for a change after some misses and close others.",
  locus_of_control: "They look at a steerable part and at what was outside their hands.",
  self_efficacy: "They expect to finish some tasks and pause on others.",
  playfulness: "They take some tasks straight and turn others into play.",
};

/** High/low bank line, or null when the axis is empty or mid-band. */
export function traitPoleLine(axis: TraitAxis, value: number | null | undefined): string | null {
  const pole = traitBand(value);
  if (pole !== 'low' && pole !== 'high') return null;
  return TRAIT_POLE_LINES[axis][pole];
}

/**
 * Behavioral paraphrase for Sage. Null axes are omitted. Never names a
 * framework, a type code, or a score as identity.
 */
export function traitPromptLines(me: Partial<TraitValues>): string {
  const lines: string[] = [];
  for (const axis of TRAIT_AXES) {
    const pole = traitBand(me[axis]);
    if (pole === 'high' || pole === 'low') lines.push(TRAIT_POLE_LINES[axis][pole]);
    else if (pole === 'mid' && TRAIT_MID_LINES[axis]) lines.push(TRAIT_MID_LINES[axis]);
  }

  const kept = lines.filter((line) => !containsFrameworkTerm(line));
  if (kept.length === 0) return '';
  return `${kept.map((line) => `- ${line}`).join('\n')}\n- Treat the lines above as self-report about how they move, never as a type or a diagnosis.\n`;
}

export { sanitizeFacts };
