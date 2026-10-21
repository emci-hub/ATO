/**
 * The profile character (master-plan step 1, emci 2026-10-20): the first picture
 * of "you", shown once the first read (the 48, sets 1-3) is in. Pure: no network,
 * no storage, no AI — testable under Node (check:profile-history).
 *
 * - The hero is one of the 8 Divecore sprites (reused, no new art), picked by the
 *   core code like the card. What makes it THEIRS is the name (64 types + a third
 *   word), two accent colours from the two strongest leans, and the stats.
 * - Stats are the real tracks at honest confidence (`traitConfidence`): a trait
 *   with under 3 answers is "Still early" and is never turned into a claim.
 * - "Could grow into": only code axes with real answers that sit near the middle,
 *   named as a possibility. The tracks hold no history, so this is closeness to
 *   the line, not a trend; the copy says so ("if ... tips").
 * - Public use (`characterPublicLine`): strength side only, never the weakness or
 *   step lines, and never a private lean (`isShareableLean`).
 */
import { AXIS_POLE_NAME, AXIS_POLES, AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { isShareableLean } from '@/lib/legends64/identity';
import { CORE_AXES, MODIFIER_AXES, THIRD_AXES } from '@/lib/legends64/classify';
import { cardName, cardStrengthWeakness, heroForCode, profileCode, type CardHero, type ProfileValues } from '@/lib/profile-history';
import { traitConfidence, TRAIT_CONFIDENCE_LABEL, type TraitConfidence } from '@/lib/questions/bank-sets';
import { trackFor, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

/** A trait needs this many answers before the character states anything about it. */
export const CHARACTER_MIN_ANSWERS = 3;
/** A code axis this close to the middle (0.5 +/- band) could tip to the other side. */
export const TIP_BAND = 0.08;
/** The most "could grow into" axes named at once. */
export const MAX_TIPS = 2;
/** A lean smaller than this is "right in the middle", not a strength. */
export const CHARACTER_MIN_LEAN = 0.05;

/** One accent per trait (decor only: frame and pedestal, never text). */
export const AXIS_TINT: Readonly<Record<TraitAxis, string>> = {
  openness: '#7c5cff',
  conscientiousness: '#2f8fff',
  extraversion: '#ff9a1f',
  agreeableness: '#3ecf8e',
  steadiness: '#2fd0c8',
  attachment_anxiety: '#c46bff',
  attachment_avoidance: '#8a9bb4',
  conflict_assertiveness: '#ff4d4d',
  conflict_cooperativeness: '#a6d93a',
  autonomy: '#ffd23f',
  competence: '#4d7cff',
  relatedness: '#ff6fa8',
  growth_mindset: '#5fe06a',
  locus_of_control: '#e0a458',
  self_efficacy: '#ff7a3d',
  playfulness: '#ff5cd6',
};

export interface CharacterStat {
  axis: TraitAxis;
  label: string;
  /** null = not enough answers: drawn empty, never guessed. */
  value: number | null;
  confidence: TraitConfidence;
  confidenceLabel: string;
  /** "Leans Outgoing" / "Right in the middle" / "Still early". */
  line: string;
}

export interface CharacterTip {
  axis: TraitAxis;
  /** The side it would tip toward. */
  toward: string;
}

export interface Character {
  hero: CardHero;
  name: string;
  code: string;
  tint: { primary: string; secondary: string };
  stats: CharacterStat[];
  /** Traits with real answers (>= CHARACTER_MIN_ANSWERS). */
  settledCount: number;
  strength: string | null;
  weakness: string | null;
  step: string | null;
  tips: CharacterTip[];
  /** The type it would read as if every tip tipped; null when nothing is near the line. */
  evolveName: string | null;
  evolveLine: string;
}

function statLine(axis: TraitAxis, value: number | null): string {
  if (value == null) return 'Still early';
  if (value > 0.6) return `Leans ${AXIS_POLE_NAME[axis].high}`;
  if (value < 0.4) return `Leans ${AXIS_POLE_NAME[axis].low}`;
  return 'Right in the middle';
}

/** Values the character may state: only traits with enough answers. */
export function characterValues(tracks: readonly TraitTrack[]): ProfileValues {
  const values: ProfileValues = {};
  for (const axis of TRAIT_AXES) {
    const t = trackFor(tracks, axis, 'report');
    values[axis] = t && t.answerCount >= CHARACTER_MIN_ANSWERS && Number.isFinite(t.value) ? t.value : null;
  }
  return values;
}

function flipCode(code: string, axes: readonly TraitAxis[]): string {
  const [core = '', modifier = '', third = ''] = code.split('-');
  const parts = { core: core.split(''), modifier: modifier.split(''), third: third.split('') };
  const flip = (list: string[], group: readonly TraitAxis[]) => {
    group.forEach((g, i) => {
      if (axes.includes(g)) list[i] = list[i] === 'H' ? 'L' : 'H';
    });
  };
  flip(parts.core, CORE_AXES);
  flip(parts.modifier, MODIFIER_AXES);
  flip(parts.third, THIRD_AXES);
  return `${parts.core.join('')}-${parts.modifier.join('')}-${parts.third.join('')}`;
}

export function characterFromTracks(tracks: readonly TraitTrack[], now: Date = new Date()): Character {
  const values = characterValues(tracks);
  const code = profileCode(values);

  const stats: CharacterStat[] = TRAIT_AXES.map((axis) => {
    const confidence = traitConfidence(trackFor(tracks, axis, 'report'), now);
    const value = values[axis] ?? null;
    return {
      axis,
      label: AXIS_SHORT_NAME[axis],
      value,
      confidence,
      confidenceLabel: TRAIT_CONFIDENCE_LABEL[confidence],
      line: statLine(axis, value),
    };
  });
  const settledCount = stats.filter((s) => s.value != null).length;

  // Two strongest leans give the two accents (stable tie-break: trait order).
  const ranked = stats
    .filter((s) => s.value != null && Math.abs(s.value - 0.5) >= CHARACTER_MIN_LEAN)
    .sort((a, b) => Math.abs((b.value as number) - 0.5) - Math.abs((a.value as number) - 0.5));
  const first = ranked[0]?.axis;
  const second = ranked[1]?.axis ?? first;
  const tint = {
    primary: first ? AXIS_TINT[first] : '#8a9bb4',
    secondary: second ? AXIS_TINT[second] : '#8a9bb4',
  };

  const sw = cardStrengthWeakness(values);

  // Could grow into: code axes with real answers, nearest the line first.
  const codeAxes = [...CORE_AXES, ...MODIFIER_AXES, ...THIRD_AXES];
  const near = codeAxes
    .filter((a) => values[a] != null && Math.abs((values[a] as number) - 0.5) < TIP_BAND)
    .sort((a, b) => Math.abs((values[a] as number) - 0.5) - Math.abs((values[b] as number) - 0.5))
    .slice(0, MAX_TIPS);
  const tips: CharacterTip[] = near.map((axis) => ({
    axis,
    toward: (values[axis] as number) >= 0.5 ? AXIS_POLE_NAME[axis].low : AXIS_POLE_NAME[axis].high,
  }));
  const evolveCode = tips.length > 0 && codeAxes.every((a) => values[a] != null) ? flipCode(code, near) : null;
  const evolveName = evolveCode ? cardName(evolveCode) : null;
  const evolveLine =
    !evolveName
      ? 'Nothing is close to the line yet. More answers will show whether that holds.'
      : `If ${tips.map((t) => `${AXIS_SHORT_NAME[t.axis]} tips toward ${t.toward}`).join(' and ')}, you'd read as ${evolveName}.`;

  // A code axis with too few answers would silently count as "low" in the type code,
  // so until all 9 are settled the name is "Still forming" and nothing evolves.
  const formed = codeAxes.every((a) => values[a] != null);
  return {
    hero: heroForCode(code),
    name: formed ? cardName(code) : 'Still forming',
    code,
    tint,
    stats,
    settledCount,
    strength: sw?.strength ?? null,
    weakness: sw?.weakness ?? null,
    step: sw?.step ?? null,
    tips,
    evolveName,
    evolveLine,
  };
}

/**
 * The only character text a public or share surface may use: the strongest
 * SHAREABLE strength, in that end's own words. Never the weakness or step line,
 * and a private lean (attachment, low steadiness/competence/...) is skipped.
 */
export function characterPublicLine(values: ProfileValues): string | null {
  const rows = TRAIT_AXES.flatMap((axis) => {
    const v = values[axis];
    if (v == null || Math.abs(v - 0.5) < CHARACTER_MIN_LEAN) return [];
    const end = v >= 0.5 ? ('high' as const) : ('low' as const);
    return isShareableLean(axis, end) ? [{ axis, end, size: Math.abs(v - 0.5) }] : [];
  }).sort((a, b) => b.size - a.size);
  const top = rows[0];
  if (!top) return null;
  return `${AXIS_POLE_NAME[top.axis][top.end]}: “${AXIS_POLES[top.axis][top.end]}”`;
}
