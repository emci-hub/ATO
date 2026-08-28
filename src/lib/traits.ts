/**
 * Stage 11 — optional fast-entry backbone.
 *
 * Self-report coaching scores on a 0–1 scale. Not a clinical inventory.
 * Raw taps (type letters, category names) are translated here and discarded.
 *
 * Parked, do not block this box: Settings re-tap so a close-pattern can be
 * updated later; a traits_updated_at / per-axis timestamp; privacy.md naming
 * these fields as coaching self-report.
 */

import { containsFrameworkTerm, sanitizeFacts } from '@/lib/voice/framework-fence';

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
] as const;

export type TraitAxis = (typeof TRAIT_AXES)[number];

/** Who wrote the axis. self_slider always wins over a later inferred grid. */
export type TraitSource = 'self_grid' | 'self_slider' | 'self_situation';

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

export const CLOSE_AXES = ['attachment_anxiety', 'attachment_avoidance'] as const;

export const DISAGREE_AXES = [
  'conflict_assertiveness',
  'conflict_cooperativeness',
] as const;

export type TraitValues = Record<TraitAxis, number | null>;
export type TraitSources = Partial<Record<TraitAxis, TraitSource>>;

export interface TraitState {
  values: TraitValues;
  sources: TraitSources;
}

export const OPTIONAL_INTAKE_TOTAL = 4;

export const TYPE_CODES = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
] as const;

export type TypeCode = (typeof TYPE_CODES)[number];

/** Behavioral close-pattern ids. Internal only — never stored, never shown as labels. */
export const CLOSE_PATTERN_IDS = [
  'close_steady',
  'worry_pull_away',
  'keep_distance',
  'want_and_pull',
] as const;

export type ClosePatternId = (typeof CLOSE_PATTERN_IDS)[number];

/** Behavioral disagreement ids. Internal only — never stored. */
export const DISAGREE_IDS = [
  'push_my_way',
  'win_we_both',
  'split_difference',
  'step_back',
  'give_ground',
] as const;

export type DisagreeId = (typeof DISAGREE_IDS)[number];

export const SLIDER_STOPS = [0, 0.25, 0.5, 0.75, 1] as const;

/**
 * McCrae & Costa 1989 published |r| with the matching pole.
 * Grid writes only O/C/E/A — no steadiness (known gap).
 */
const TYPE_R = {
  extraversion: 0.74,
  openness: 0.72,
  agreeableness: 0.44,
  conscientiousness: 0.49,
} as const;

function clamp01(value: number): number {
  const n = Math.min(1, Math.max(0, value));
  return Math.round(n * 100) / 100;
}

function pole(high: boolean, r: number): number {
  return clamp01(0.5 + (high ? 1 : -1) * (r / 2));
}

export function emptyTraitValues(): TraitValues {
  return {
    openness: null,
    conscientiousness: null,
    extraversion: null,
    agreeableness: null,
    steadiness: null,
    attachment_anxiety: null,
    attachment_avoidance: null,
    conflict_assertiveness: null,
    conflict_cooperativeness: null,
  };
}

export function emptyTraitState(): TraitState {
  return { values: emptyTraitValues(), sources: {} };
}

export function isTypeCode(value: string): value is TypeCode {
  return (TYPE_CODES as readonly string[]).includes(value);
}

export function isClosePatternId(value: string): value is ClosePatternId {
  return (CLOSE_PATTERN_IDS as readonly string[]).includes(value);
}

export function isDisagreeId(value: string): value is DisagreeId {
  return (DISAGREE_IDS as readonly string[]).includes(value);
}

/** 16-grid → O/C/E/A only. Steadiness stays untouched. */
export function traitsFromTypeCode(code: TypeCode): Partial<Record<TraitAxis, number>> {
  const e = code[0] === 'E';
  const n = code[1] === 'N';
  const f = code[2] === 'F';
  const j = code[3] === 'J';
  return {
    extraversion: pole(e, TYPE_R.extraversion),
    openness: pole(n, TYPE_R.openness),
    agreeableness: pole(f, TYPE_R.agreeableness),
    conscientiousness: pole(j, TYPE_R.conscientiousness),
  };
}

/** Close-pattern tap → anxiety/avoidance only. Never Big Five. */
export function traitsFromClosePattern(
  id: ClosePatternId,
): Partial<Record<TraitAxis, number>> {
  switch (id) {
    case 'close_steady':
      return { attachment_anxiety: 0.2, attachment_avoidance: 0.2 };
    case 'worry_pull_away':
      return { attachment_anxiety: 0.8, attachment_avoidance: 0.2 };
    case 'keep_distance':
      return { attachment_anxiety: 0.2, attachment_avoidance: 0.8 };
    case 'want_and_pull':
      return { attachment_anxiety: 0.8, attachment_avoidance: 0.8 };
  }
}

/** Disagreement tap → assertiveness/cooperativeness only. Never shares a cell with close-pattern. */
export function traitsFromDisagree(id: DisagreeId): Partial<Record<TraitAxis, number>> {
  switch (id) {
    case 'push_my_way':
      return { conflict_assertiveness: 0.8, conflict_cooperativeness: 0.2 };
    case 'win_we_both':
      return { conflict_assertiveness: 0.8, conflict_cooperativeness: 0.8 };
    case 'split_difference':
      return { conflict_assertiveness: 0.5, conflict_cooperativeness: 0.5 };
    case 'step_back':
      return { conflict_assertiveness: 0.2, conflict_cooperativeness: 0.2 };
    case 'give_ground':
      return { conflict_assertiveness: 0.2, conflict_cooperativeness: 0.8 };
  }
}

/**
 * Source-aware merge. Last-write-wins is wrong: a later grid inference must
 * not overwrite an axis already set by a direct slider.
 * Incoming null/undefined means "this door did not write that axis."
 */
export function mergeTraitWrite(
  current: TraitState,
  incoming: Partial<Record<TraitAxis, number | null>>,
  source: TraitSource,
  allowed: readonly TraitAxis[],
): TraitState {
  const values = { ...current.values };
  const sources = { ...current.sources };
  for (const axis of allowed) {
    const raw = incoming[axis];
    if (raw == null || !Number.isFinite(raw)) continue;
    if (current.sources[axis] === 'self_slider' && source !== 'self_slider') continue;
    values[axis] = clamp01(raw);
    sources[axis] = source;
  }
  return { values, sources };
}

export function traitStateFromRow(row: {
  openness?: number | null;
  conscientiousness?: number | null;
  extraversion?: number | null;
  agreeableness?: number | null;
  steadiness?: number | null;
  attachment_anxiety?: number | null;
  attachment_avoidance?: number | null;
  conflict_assertiveness?: number | null;
  conflict_cooperativeness?: number | null;
  trait_sources?: unknown;
}): TraitState {
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
      if (src === 'self_grid' || src === 'self_slider' || src === 'self_situation') {
        sources[axis] = src;
      }
    }
  }
  return { values, sources };
}

export function traitPatch(state: TraitState): TraitValues & { trait_sources: TraitSources } {
  const sources: TraitSources = {};
  for (const axis of TRAIT_AXES) {
    if (state.values[axis] != null && state.sources[axis]) {
      sources[axis] = state.sources[axis];
    }
  }
  return { ...state.values, trait_sources: sources };
}

export function optionalProgressLabel(n: number): string {
  return `extra ${n} of ${OPTIONAL_INTAKE_TOTAL}`;
}

export function writeForOptionalScreen(input: {
  screen: 0 | 1 | 2 | 3;
  typeCode: string | null;
  sliderValues: Partial<Record<(typeof SLIDER_AXES)[number], number>>;
  closeId: string | null;
  disagreeId: string | null;
}): {
  incoming: Partial<Record<TraitAxis, number>>;
  source: TraitSource;
  allowed: readonly TraitAxis[];
} | null {
  if (input.screen === 0) {
    if (!input.typeCode || !isTypeCode(input.typeCode)) return null;
    return { incoming: traitsFromTypeCode(input.typeCode), source: 'self_grid', allowed: GRID_AXES };
  }
  if (input.screen === 1) {
    if (Object.keys(input.sliderValues).length === 0) return null;
    return { incoming: input.sliderValues, source: 'self_slider', allowed: SLIDER_AXES };
  }
  if (input.screen === 2) {
    if (!input.closeId || !isClosePatternId(input.closeId)) return null;
    return {
      incoming: traitsFromClosePattern(input.closeId),
      source: 'self_situation',
      allowed: CLOSE_AXES,
    };
  }
  if (!input.disagreeId || !isDisagreeId(input.disagreeId)) return null;
  return {
    incoming: traitsFromDisagree(input.disagreeId),
    source: 'self_situation',
    allowed: DISAGREE_AXES,
  };
}

function band(value: number | null | undefined): 'low' | 'mid' | 'high' | null {
  if (value == null) return null;
  if (value <= 0.33) return 'low';
  if (value >= 0.67) return 'high';
  return 'mid';
}

/**
 * Behavioral paraphrase for Sage. Null axes are omitted. Never names a
 * framework, a type code, or a score as identity.
 */
export function traitPromptLines(me: {
  openness?: number | null;
  conscientiousness?: number | null;
  extraversion?: number | null;
  agreeableness?: number | null;
  steadiness?: number | null;
  attachment_anxiety?: number | null;
  attachment_avoidance?: number | null;
  conflict_assertiveness?: number | null;
  conflict_cooperativeness?: number | null;
}): string {
  const lines: string[] = [];
  const extraversion = band(me.extraversion);
  if (extraversion === 'high') lines.push('They tend to get energy from being around people.');
  else if (extraversion === 'low') lines.push('They tend to get energy from quieter time.');
  else if (extraversion === 'mid') lines.push('They sit somewhere in the middle on people-time versus quiet time.');

  const openness = band(me.openness);
  if (openness === 'high') lines.push('They tend to like new ideas and untried paths.');
  else if (openness === 'low') lines.push('They tend to prefer the known path over a new one.');
  else if (openness === 'mid') lines.push('They mix familiar routines with the occasional new idea.');

  const conscientiousness = band(me.conscientiousness);
  if (conscientiousness === 'high') lines.push('They tend to follow a plan through.');
  else if (conscientiousness === 'low') lines.push('They tend to keep plans loose and change them as they go.');
  else if (conscientiousness === 'mid') lines.push('They plan some things and leave others open.');

  const agreeableness = band(me.agreeableness);
  if (agreeableness === 'high') lines.push('They tend to go along when it keeps things easy.');
  else if (agreeableness === 'low') lines.push('They tend to hold their own view even when it rubs.');
  else if (agreeableness === 'mid') lines.push('They weigh going along against holding their ground.');

  const steadiness = band(me.steadiness);
  if (steadiness === 'high') lines.push('They tend to stay even when things wobble.');
  else if (steadiness === 'low') lines.push('They tend to feel it strongly when things wobble.');
  else if (steadiness === 'mid') lines.push('Some wobble lands, some they shake off.');

  const anxiety = band(me.attachment_anxiety);
  if (anxiety === 'high') lines.push('They tend to worry people will pull away.');
  else if (anxiety === 'low') lines.push('They tend not to spend much time worrying people will leave.');
  else if (anxiety === 'mid') lines.push('Closeness sometimes brings a worry that people will pull away.');

  const avoidance = band(me.attachment_avoidance);
  if (avoidance === 'high') lines.push('They tend to keep some distance even with people they like.');
  else if (avoidance === 'low') lines.push('They tend to stay close once they are in.');
  else if (avoidance === 'mid') lines.push('They mix closeness with a bit of distance.');

  const assertiveness = band(me.conflict_assertiveness);
  if (assertiveness === 'high') lines.push('In a disagreement they tend to put their own point on the table.');
  else if (assertiveness === 'low') lines.push('In a disagreement they tend to step back rather than push.');
  else if (assertiveness === 'mid') lines.push('In a disagreement they sometimes push and sometimes wait.');

  const coop = band(me.conflict_cooperativeness);
  if (coop === 'high') lines.push('In a disagreement they tend to look for something the other person can live with.');
  else if (coop === 'low') lines.push('In a disagreement they tend to protect their own outcome first.');
  else if (coop === 'mid') lines.push('In a disagreement they split attention between their outcome and the other person.');

  const kept = lines.filter((line) => !containsFrameworkTerm(line));
  if (kept.length === 0) return '';
  return `${kept.map((line) => `- ${line}`).join('\n')}\n- Treat the lines above as self-report about how they tend to move, never as a type or a diagnosis.\n`;
}

export { sanitizeFacts };
