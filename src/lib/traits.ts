/**
 * Optional trait backbone (Stage 11 + six extra axes).
 *
 * Self-report coaching scores on a 0–1 scale. Not a clinical inventory.
 * Raw taps (type letters, category names, game choices) are translated here
 * and discarded.
 *
 * Parked, do not block this box: Settings re-tap UI so a close-pattern can be
 * updated later; privacy.md naming these fields as coaching self-report.
 * last_touched is live — unparked for the 3-month re-ask.
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
  'autonomy',
  'competence',
  'relatedness',
  'growth_mindset',
  'locus_of_control',
  'self_efficacy',
] as const;

export type TraitAxis = (typeof TRAIT_AXES)[number];

export const EXTRA_AXES = [
  'autonomy',
  'competence',
  'relatedness',
  'growth_mindset',
  'locus_of_control',
  'self_efficacy',
] as const;

/** Direct writes are sticky: inferred sources cannot overwrite them. */
export const DIRECT_TRAIT_SOURCES = [
  'self_slider',
  'self_tap',
  'self_confirm',
  'self_settings',
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
export type TraitTouched = Partial<Record<TraitAxis, string>>;

export interface TraitState {
  values: TraitValues;
  sources: TraitSources;
  /** ISO timestamps. Null axes have no key. */
  touched: TraitTouched;
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
    autonomy: null,
    competence: null,
    relatedness: null,
    growth_mindset: null,
    locus_of_control: null,
    self_efficacy: null,
  };
}

export function emptyTraitState(): TraitState {
  return { values: emptyTraitValues(), sources: {}, touched: {} };
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
 * Source-aware merge for numeric writes. Direct (slider / tap-form /
 * Settings) is sticky: a later inferred write (grid / situation / game)
 * cannot overwrite that axis. Among the same rank, last-write-wins.
 * Incoming null/undefined means "this door did not write that axis." A
 * rejected inferred write does not bump last_touched.
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
    if (isDirectTraitSource(current.sources[axis]) && !isDirectTraitSource(source)) continue;
    values[axis] = clamp01(raw);
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
  autonomy?: number | null;
  competence?: number | null;
  relatedness?: number | null;
  growth_mindset?: number | null;
  locus_of_control?: number | null;
  self_efficacy?: number | null;
  trait_sources?: unknown;
  trait_touched_at?: unknown;
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
  if (source === 'self_situation') return [...CLOSE_AXES, ...DISAGREE_AXES];
  return TRAIT_AXES;
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
  source: Exclude<TraitSource, 'self_confirm'>;
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

export type TraitBand = 'low' | 'mid' | 'high';

export function traitBand(value: number | null | undefined): TraitBand | null {
  if (value == null) return null;
  if (value <= 0.33) return 'low';
  if (value >= 0.67) return 'high';
  return 'mid';
}

/**
 * High/low behavioral paraphrases. Sage prompts and Does-Sage-know-you
 * both read from this bank — never a live model call for the check-in.
 * Mid-band lines stay in traitPromptLines only; the check-in surface skips mid.
 */
export const TRAIT_POLE_LINES: Record<TraitAxis, { low: string; high: string }> = {
  extraversion: {
    high: 'They tend to get energy from being around people.',
    low: 'They tend to get energy from quieter time.',
  },
  openness: {
    high: 'They tend to like new ideas and untried paths.',
    low: 'They tend to prefer the known path over a new one.',
  },
  conscientiousness: {
    high: 'They tend to follow a plan through.',
    low: 'They tend to keep plans loose and change them as they go.',
  },
  agreeableness: {
    high: 'They tend to go along when it keeps things easy.',
    low: 'They tend to hold their own view even when it rubs.',
  },
  steadiness: {
    high: 'They tend to stay even when things wobble.',
    low: 'They tend to feel it strongly when things wobble.',
  },
  attachment_anxiety: {
    high: 'They tend to worry people will pull away.',
    low: 'They tend not to spend much time worrying people will leave.',
  },
  attachment_avoidance: {
    high: 'They tend to keep some distance even with people they like.',
    low: 'They tend to stay close once they are in.',
  },
  conflict_assertiveness: {
    high: 'In a disagreement they tend to put their own point on the table.',
    low: 'In a disagreement they tend to step back rather than push.',
  },
  conflict_cooperativeness: {
    high: 'In a disagreement they tend to look for something the other person can live with.',
    low: 'In a disagreement they tend to protect their own outcome first.',
  },
  autonomy: {
    high: 'They tend to want to do things their own way.',
    low: 'They tend to be fine following a path someone else already set.',
  },
  competence: {
    high: 'They tend to feel they can handle a hard thing.',
    low: 'They tend to doubt they can pull a hard thing off.',
  },
  relatedness: {
    high: 'They tend to need a real connection with people for a day to land.',
    low: 'They tend to feel a day landed without needing much connection.',
  },
  growth_mindset: {
    high: 'After a miss they tend to look for what went wrong so they can try again.',
    low: 'After a miss they tend to treat it as a sign they are not good at that thing.',
  },
  locus_of_control: {
    high: 'When something falls apart, first thought tends to go to what they might have done differently.',
    low: 'When something falls apart, first thought tends to go to how it was bound to happen.',
  },
  self_efficacy: {
    high: 'Facing a big task they tend to feel they can pull it off.',
    low: 'Facing a big task they tend to feel unsure they can pull it off.',
  },
};

const TRAIT_MID_LINES: Partial<Record<TraitAxis, string>> = {
  extraversion: 'They sit somewhere in the middle on people-time versus quiet time.',
  openness: 'They mix familiar routines with the occasional new idea.',
  conscientiousness: 'They plan some things and leave others open.',
  agreeableness: 'They weigh going along against holding their ground.',
  steadiness: 'Some wobble lands, some they shake off.',
  attachment_anxiety: 'Closeness sometimes brings a worry that people will pull away.',
  attachment_avoidance: 'They mix closeness with a bit of distance.',
  conflict_assertiveness: 'In a disagreement they sometimes push and sometimes wait.',
  conflict_cooperativeness:
    'In a disagreement they split attention between their outcome and the other person.',
  autonomy: 'They mix doing it their way with following a path that is already there.',
  competence: 'Some hard things they feel they can handle, some they do not.',
  relatedness: 'Some days they want connection, some they do not need it.',
  growth_mindset: 'After a miss they sometimes look for what to change and sometimes take it as closed.',
  locus_of_control:
    'When something falls apart they sometimes look at what they might change and sometimes at what was out of their hands.',
  self_efficacy: 'Facing a big task they sometimes feel they can pull it off and sometimes do not.',
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
  return `${kept.map((line) => `- ${line}`).join('\n')}\n- Treat the lines above as self-report about how they tend to move, never as a type or a diagnosis.\n`;
}

export { sanitizeFacts };
