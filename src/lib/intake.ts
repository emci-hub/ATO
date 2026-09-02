/**
 * Wave 1.5 Stage 9 — core intake.
 *
 * Self-report only. These are tappable answers the person chose, never a
 * diagnosis or assessment. Stored values are closed chip ids (or the person's
 * own cue phrase), not framework labels (no MBTI / Big Five / attachment
 * names). Public surfaces (poster, Circle, /@handle) must not show the
 * psych-adjacent fields (energy_pattern, support_style, current_focus).
 */

import { sanitizeFacts } from '@/lib/voice/framework-fence';
import { voicePresetOf } from '@/lib/voice/preset';
import type { VoiceMe } from '@/lib/voice/types';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

type TalkStyle = 'quiet' | 'even' | 'loud';

export type EnergyPattern = 'morning' | 'afternoon' | 'evening' | 'night_owl';
export type SupportStyle = 'nudge' | 'space' | 'listen' | 'plan';
export type CurrentFocus = 'habit' | 'through_it' | 'like_yourself' | 'show_up';
export type KnocksChip =
  | 'sleep'
  | 'workload'
  | 'people/conflict'
  | 'health'
  | 'money'
  | 'something else';

export interface IntakeChip<T extends string = string> {
  value: T;
  label: string;
}

export interface CoreIntakeAnswers {
  talk_style: TalkStyle;
  show_up: string;
  knocks_you_off: KnocksChip[];
  morning_cue: string;
  evening_wind_down: string;
  energy_pattern: EnergyPattern;
  support_style: SupportStyle;
  current_focus: CurrentFocus;
}

export const KNOCKS_DELIMITER = ', ';

export const TALK_STYLE_CHIPS: IntakeChip<TalkStyle>[] = [
  { value: 'quiet', label: 'Quiet' },
  { value: 'even', label: 'Even' },
  { value: 'loud', label: 'Loud' },
];

/** Cosmetic sample under the You-tab picker. Static local strings — never a model call. */
export const TALK_STYLE_PREVIEWS: Record<TalkStyle, string> = {
  quiet: 'Three days now. Not loud about it, just there.',
  even: "Three days in a row. That's a start worth noticing.",
  loud: "Three days! That's the kind of streak worth bragging about.",
};

/** Color-seed vibes. Stored on existing `show_up` (still a string). */
export const SHOW_UP_CHIPS: IntakeChip[] = [
  { value: 'building something', label: 'Building something' },
  { value: 'getting through it', label: 'Getting through it' },
  { value: 'finding my feet', label: 'Finding my feet' },
  { value: 'showing up anyway', label: 'Showing up anyway' },
  { value: 'clearing space', label: 'Clearing space' },
  { value: 'running hot', label: 'Running hot' },
];

export const KNOCKS_CHIPS: IntakeChip<KnocksChip>[] = [
  { value: 'sleep', label: 'Sleep' },
  { value: 'workload', label: 'Workload' },
  { value: 'people/conflict', label: 'People / conflict' },
  { value: 'health', label: 'Health' },
  { value: 'money', label: 'Money' },
  { value: 'something else', label: 'Something else' },
];

/**
 * Infinitive phrases that drop into first_cards.md: "After you {morning_cue}, …"
 * Chip label is the "After I …" shape from the spec; stored value is the cue.
 */
export const MORNING_CUE_CHIPS: IntakeChip[] = [
  { value: 'make coffee', label: 'After I make coffee' },
  { value: 'brush my teeth', label: 'After I brush my teeth' },
  { value: 'check my phone', label: 'After I check my phone' },
  { value: 'get out of bed', label: 'After I get out of bed' },
  { value: 'pour water', label: 'After I pour water' },
  { value: 'put on music', label: 'After I put on music' },
  { value: 'take a shower', label: 'After I take a shower' },
];

export const EVENING_WIND_DOWN_CHIPS: IntakeChip[] = [
  { value: 'put my phone down', label: 'When I put my phone down' },
  { value: 'shut off the lights', label: 'When I shut off the lights' },
  { value: 'get in bed', label: 'When I get in bed' },
  { value: 'wash up', label: 'When I wash up' },
  { value: 'stretch', label: 'When I stretch' },
  { value: 'watch one thing', label: 'When I watch one thing' },
];

export const ENERGY_PATTERN_CHIPS: IntakeChip<EnergyPattern>[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'night_owl', label: 'Night owl' },
];

export const SUPPORT_STYLE_CHIPS: IntakeChip<SupportStyle>[] = [
  { value: 'nudge', label: 'A bump to keep going' },
  { value: 'space', label: 'Space to sit with it' },
  { value: 'listen', label: 'Someone to listen' },
  { value: 'plan', label: 'A plan to fix it' },
];

export const CURRENT_FOCUS_CHIPS: IntakeChip<CurrentFocus>[] = [
  { value: 'habit', label: 'Build a habit' },
  { value: 'through_it', label: 'Get through something hard' },
  { value: 'like_yourself', label: 'Feel more like myself' },
  { value: 'show_up', label: 'Just show up' },
];

export const ENERGY_PATTERN_VALUES: EnergyPattern[] = ENERGY_PATTERN_CHIPS.map((c) => c.value);
export const SUPPORT_STYLE_VALUES: SupportStyle[] = SUPPORT_STYLE_CHIPS.map((c) => c.value);
export const CURRENT_FOCUS_VALUES: CurrentFocus[] = CURRENT_FOCUS_CHIPS.map((c) => c.value);
export const KNOCKS_CHIP_VALUES: KnocksChip[] = KNOCKS_CHIPS.map((c) => c.value);

/**
 * Chip ids that must never appear in Sage copy or model prompts as snake_case.
 * Morning/evening cues stay out — their stored values are already phrases
 * ("make coffee"), and the chip labels are "After I …" / "When I …" shapes
 * that do not drop into a Read sentence.
 */
const SIGNAL_PHRASE_BY_VALUE: Record<string, string> = Object.fromEntries(
  [
    ...TALK_STYLE_CHIPS,
    ...SHOW_UP_CHIPS,
    ...KNOCKS_CHIPS,
    ...ENERGY_PATTERN_CHIPS,
    ...SUPPORT_STYLE_CHIPS,
    ...CURRENT_FOCUS_CHIPS,
  ].map((chip) => [chip.value, chip.label]),
);

/** Map a stored chip id to the words on the chip. Facts / custom cues pass through. */
export function phraseForStoredChip(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  return SIGNAL_PHRASE_BY_VALUE[trimmed] ?? trimmed;
}

export type CoreIntakeField =
  | 'talk_style'
  | 'show_up'
  | 'knocks_you_off'
  | 'morning_cue'
  | 'evening_wind_down'
  | 'energy_pattern'
  | 'support_style'
  | 'current_focus';

export interface CoreIntakeQuestion {
  field: CoreIntakeField;
  /** 1-based index in the 8. */
  n: number;
  prompt: string;
  /** Optional second line under the question. */
  helper?: string;
  multi?: boolean;
  chips: IntakeChip[];
}

export const CORE_INTAKE_TOTAL = 8;

/**
 * One question per screen, in spec order. Why is baked into the prompt,
 * not a separate explainer. No framework names.
 */
export const CORE_INTAKE_QUESTIONS: CoreIntakeQuestion[] = [
  {
    field: 'talk_style',
    n: 1,
    prompt: 'Quiet, even, or a bit more direct — you already picked this, editable anytime.',
    chips: TALK_STYLE_CHIPS,
  },
  {
    field: 'show_up',
    n: 2,
    prompt: "What's this week feel like? This colors your face on Home.",
    chips: SHOW_UP_CHIPS,
  },
  {
    field: 'knocks_you_off',
    n: 3,
    prompt: "What actually gets in the way of a good day? Pick everything that's true, not just one.",
    multi: true,
    chips: KNOCKS_CHIPS,
  },
  {
    field: 'morning_cue',
    n: 4,
    prompt: 'The one thing you already do every morning — your daily bump hangs off this.',
    chips: MORNING_CUE_CHIPS,
  },
  {
    field: 'evening_wind_down',
    n: 5,
    prompt: 'What already happens at the end of your day? The evening Check bump hangs off this.',
    chips: EVENING_WIND_DOWN_CHIPS,
  },
  {
    field: 'energy_pattern',
    n: 6,
    prompt: 'When do you have the most energy during the day?',
    helper: 'Helps us pick a good time to check in with you.',
    chips: ENERGY_PATTERN_CHIPS,
  },
  {
    field: 'support_style',
    n: 7,
    prompt: "When you're in it, what helps more?",
    chips: SUPPORT_STYLE_CHIPS,
  },
  {
    field: 'current_focus',
    n: 8,
    prompt: "Right now you're mostly trying to…",
    chips: CURRENT_FOCUS_CHIPS,
  },
];

export function joinKnocks(selected: KnocksChip[]): string {
  return selected.join(KNOCKS_DELIMITER);
}

export function parseKnocks(raw: string | null | undefined): KnocksChip[] {
  if (!raw) return [];
  const allowed = new Set<string>(KNOCKS_CHIP_VALUES);
  return raw
    .split(KNOCKS_DELIMITER)
    .map((part) => part.trim())
    .filter((part): part is KnocksChip => allowed.has(part));
}

export function chipLabel(chips: IntakeChip[], value: string | null | undefined): string {
  if (!value) return '';
  return chips.find((c) => c.value === value)?.label ?? value;
}

/** You-tab labels. Same 8 fields as onboarding, shorter than the prompt. */
export const INTAKE_SETTINGS_LABELS: Record<CoreIntakeField, string> = {
  talk_style: 'How Sage talks to you',
  show_up: 'Show up',
  knocks_you_off: 'What actually throws off your day',
  morning_cue: 'Your morning anchor',
  evening_wind_down: 'Evening wind-down',
  energy_pattern: 'Most energy',
  support_style: 'What helps',
  current_focus: 'Right now',
};

type IntakeMeSlice = {
  talk_style: string | null;
  show_up: string | null;
  knocks_you_off: string | null;
  morning_cue: string | null;
  evening_wind_down?: string | null;
  energy_pattern?: string | null;
  support_style?: string | null;
  current_focus?: string | null;
};

export function selectedIntakeValues(field: CoreIntakeField, me: IntakeMeSlice): string[] {
  switch (field) {
    case 'talk_style':
      return me.talk_style ? [me.talk_style] : [];
    case 'show_up':
      return me.show_up ? [me.show_up] : [];
    case 'knocks_you_off':
      return parseKnocks(me.knocks_you_off);
    case 'morning_cue':
      return me.morning_cue ? [me.morning_cue] : [];
    case 'evening_wind_down':
      return me.evening_wind_down ? [me.evening_wind_down] : [];
    case 'energy_pattern':
      return me.energy_pattern ? [me.energy_pattern] : [];
    case 'support_style':
      return me.support_style ? [me.support_style] : [];
    case 'current_focus':
      return me.current_focus ? [me.current_focus] : [];
  }
}

export function displayIntakeValue(field: CoreIntakeField, me: IntakeMeSlice): string {
  const question = CORE_INTAKE_QUESTIONS.find((q) => q.field === field);
  if (!question) return '';
  if (field === 'knocks_you_off') {
    const selected = parseKnocks(me.knocks_you_off);
    if (selected.length === 0) return me.knocks_you_off || '—';
    return selected.map((value) => chipLabel(question.chips, value)).join(', ');
  }
  const raw = me[field];
  if (!raw) return '—';
  return chipLabel(question.chips, raw);
}

/** One-page onboarding counter: "answered 3 of 8". */
export function coreIntakeAnsweredLabel(answered: number, total = CORE_INTAKE_TOTAL): string {
  return `answered ${answered} of ${total}`;
}

/**
 * Pick which first_cards.md style slot to use for check_count < 3.
 *
 * support_style is the primary "how to meet you" axis (sharper than talk_style).
 * energy_pattern shifts one step: morning more activating, evening/night owl
 * gentler. Pre-intake rows (both null) fall back to talk_style so existing
 * accounts keep their current Day 1–3 cards.
 *
 * Product choice — flagged in the Stage 9 handoff, not a clinical mapping.
 */
export function bankStyleFor(me: {
  talk_style: TalkStyle;
  energy_pattern?: EnergyPattern | null;
  support_style?: SupportStyle | null;
}): TalkStyle {
  const support = me.support_style;
  const energy = me.energy_pattern;
  if (!support && !energy) return me.talk_style;

  const fromSupport: Record<SupportStyle, TalkStyle> = {
    space: 'quiet',
    listen: 'even',
    plan: 'even',
    nudge: 'loud',
  };
  let style: TalkStyle = support ? fromSupport[support] : me.talk_style;

  if (energy === 'night_owl' || energy === 'evening') {
    if (style === 'loud') style = 'even';
    else if (style === 'even') style = 'quiet';
  } else if (energy === 'morning') {
    if (style === 'quiet') style = 'even';
    else if (style === 'even') style = 'loud';
  }

  return style;
}

export function isEnergyPattern(value: string | null | undefined): value is EnergyPattern {
  return !!value && (ENERGY_PATTERN_VALUES as string[]).includes(value);
}

export function isSupportStyle(value: string | null | undefined): value is SupportStyle {
  return !!value && (SUPPORT_STYLE_VALUES as string[]).includes(value);
}

export function isCurrentFocus(value: string | null | undefined): value is CurrentFocus {
  return !!value && (CURRENT_FOCUS_VALUES as string[]).includes(value);
}

/** Neutral fallbacks so a skipped intake field never renders as broken copy. */
const DEFAULT_TALK_STYLE: TalkStyle = 'even';
const DEFAULT_MORNING_CUE = 'getting up';

/** Slice of ME the router needs, including intake fields used for bank pick. */
export function voiceMeFrom(
  me: {
    name: string;
    show_up: string | null;
    talk_style: TalkStyle | null;
    knocks_you_off: string | null;
    morning_cue: string | null;
    evening_wind_down?: string | null;
    energy_pattern?: string | null;
    support_style?: string | null;
    current_focus?: string | null;
    facts?: string[] | unknown;
    voice_preset?: string | null;
  } & Partial<Record<TraitAxis, number | null>>,
): VoiceMe {
  const num = (value: number | null | undefined): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;
  const traits = {} as Partial<Record<TraitAxis, number | null>>;
  for (const axis of TRAIT_AXES) {
    traits[axis] = num(me[axis]);
  }
  return {
    name: me.name,
    show_up: me.show_up ?? '',
    talk_style: me.talk_style ?? DEFAULT_TALK_STYLE,
    knocks_you_off: me.knocks_you_off ?? '',
    morning_cue: (me.morning_cue && me.morning_cue.trim()) || DEFAULT_MORNING_CUE,
    evening_wind_down: me.evening_wind_down ?? null,
    energy_pattern: isEnergyPattern(me.energy_pattern) ? me.energy_pattern : null,
    support_style: isSupportStyle(me.support_style) ? me.support_style : null,
    current_focus: isCurrentFocus(me.current_focus) ? me.current_focus : null,
    voice_preset: voicePresetOf(me.voice_preset),
    ...traits,
    facts: sanitizeFacts(me.facts),
  };
}
