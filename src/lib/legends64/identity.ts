/**
 * The identity card's logic: which of the six archetype letters are locked,
 * what name that gives, and the three trait phrases that go under it. Pure —
 * the check script runs it directly.
 *
 * Built on the 64-archetype content that already existed (classify.ts,
 * archetypes.ts) but was shown nowhere. Two rules are added here because this
 * is the first place a person actually sees their archetype:
 *
 * 1. A LETTER ONLY LOCKS ONCE ITS TRAIT IS SETTLED. Until then the card says
 *    "forming". The straight midpoint split in classify.ts gives every account
 *    a code on day one, which is fine for storage and wrong for a name someone
 *    is meant to send to a friend.
 * 2. A LOCKED LETTER DOES NOT FLIP ON A WOBBLE. It changes only when the trait
 *    crosses out of the middle zone (about 45–55%). A trait that has never
 *    left that zone stays middle, and the name becomes a balanced variant
 *    or a choice between the two nearest existing legends.
 */
import {
  closestArchetypes,
  CORE_AXES,
  LEGEND_FLIP_MARGIN,
  midpointHighLow,
  MODIFIER_AXES,
  THIRD_AXES,
  type LegendPole,
  type LegendValues,
  type Pole,
} from '@/lib/legends64/classify';
import {
  archetypeName,
  CORE_ROLES,
  DEFAULT_LEGEND_SKIN,
  MODIFIER_DESCRIPTORS,
  THIRD_WORDS,
  composeName,
  isLegendSkin,
  isThreeWordSkin,
  joinFormingName,
  legendaryName,
  type LegendSkin,
} from '@/lib/legends64/archetypes';
import { TRAIT_BAND_PHRASES } from '@/lib/trait-bands';
import { isAxisSettled, LABEL_MIN_ANSWERS, trackFor, traitScore, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis, type TraitLean, type TraitSource } from '@/lib/traits';

export const IDENTITY_AXES: readonly TraitAxis[] = [...CORE_AXES, ...MODIFIER_AXES, ...THIRD_AXES];
/** Same margin `classify.ts` uses for the 45–55% middle zone. */
export const POLE_FLIP_MARGIN = LEGEND_FLIP_MARGIN;

export type LockedPoles = Partial<Record<TraitAxis, LegendPole>>;

const NAME_AXES: readonly TraitAxis[] = [...CORE_AXES, ...MODIFIER_AXES];

function isLetter(pole: LegendPole | undefined): pole is Pole {
  return pole === 'H' || pole === 'L';
}

/**
 * The locked letters after looking at the current tracks. An axis that was
 * locked and has since gone unsettled (long idle) keeps its letter: a name
 * that was earned does not quietly dissolve.
 */
export function nextLockedPoles(
  tracks: readonly TraitTrack[],
  previous: LockedPoles,
  now: Date = new Date(),
  sources?: Partial<Record<TraitAxis, TraitSource>>,
): LockedPoles {
  const out: LockedPoles = {};
  for (const axis of IDENTITY_AXES) {
    const row = trackFor(tracks, axis, 'report');
    const score = traitScore(row, sources?.[axis]);
    if (row && isAxisSettled(row, now) && score != null) {
      const prior = previous[axis];
      out[axis] = midpointHighLow(score, prior === 'U' ? null : prior);
    } else if (row && row.answerCount >= 1 && previous[axis] && previous[axis] !== 'U') {
      // A name that was earned does not dissolve while the trait is idle.
      // An unanswered trait is not kept as a fake low.
      out[axis] = previous[axis];
    }
  }
  return out;
}

export function samePoles(a: LockedPoles, b: LockedPoles): boolean {
  return IDENTITY_AXES.every((axis) => a[axis] === b[axis]);
}

function codeFor(poles: LockedPoles, axes: readonly TraitAxis[]): string | null {
  const letters = axes.map((axis) => poles[axis]);
  return letters.every((letter) => letter === 'H' || letter === 'L') ? letters.join('') : null;
}

export interface IdentityView {
  lockedCount: number;
  total: number;
  /** Null until all three of that half's letters are locked. */
  coreCode: string | null;
  modifierCode: string | null;
  /** The three-word styles' extra word (Growth x Composure x Playfulness). */
  thirdCode: string | null;
  /** Which identity traits have a locked letter. */
  lockedAxes: readonly TraitAxis[];
  /** The two-word name is settled (core + modifier). */
  complete: boolean;
}

export function identityView(poles: LockedPoles): IdentityView {
  const coreCode = codeFor(poles, CORE_AXES);
  const modifierCode = codeFor(poles, MODIFIER_AXES);
  return {
    lockedCount: IDENTITY_AXES.filter((axis) => isLetter(poles[axis])).length,
    lockedAxes: IDENTITY_AXES.filter((axis) => isLetter(poles[axis])),
    total: IDENTITY_AXES.length,
    coreCode,
    modifierCode,
    thirdCode: codeFor(poles, THIRD_AXES),
    // The two-word name: the 6 core + modifier traits. The third word fills
    // in on its own as Growth, Composure and Playfulness settle.
    complete: coreCode != null && modifierCode != null,
  };
}

export const IDENTITY_FORMING_TITLE = 'Still forming';

/**
 * "Grinning Pathfinder, Hungry" / "Paladin of the Tavern" once every word
 * is locked. Legendary ★ replaces the all-High (all-Low for Mythic and
 * Anime) combo. Until then each missing stretch shows as one "…", so the
 * name visibly fills in ("Paladin of the …", never "… … Paladin").
 */
export function identityTitle(view: IdentityView, skin: LegendSkin): string {
  if (!isLegendSkin(skin)) return IDENTITY_FORMING_TITLE;
  const legendary = legendaryName(skin, view.coreCode, view.modifierCode, view.thirdCode);
  if (legendary) return legendary;
  const role = view.coreCode ? CORE_ROLES[skin][view.coreCode] : null;
  const descriptor = view.modifierCode ? MODIFIER_DESCRIPTORS[skin][view.modifierCode] : null;
  const third = view.thirdCode ? (THIRD_WORDS[skin]?.[view.thirdCode] ?? null) : null;
  if (!role && !descriptor && !third) return IDENTITY_FORMING_TITLE;
  return joinFormingName(skin, composeName(skin, { third, descriptor, role }));
}

/** How many traits a style's name is made from: 9 for three words, 6 for two. */
export type LegendKind = 'exact' | 'balanced' | 'choice' | 'forming';

export interface LegendChoiceView {
  code: string;
  title: string;
}

export interface LegendHeadline {
  kind: LegendKind;
  title: string;
  /** One line under the title. Null when the name is exact. */
  flavour: string | null;
  /** The two nearest existing legends, when the reading is borderline. */
  choices: readonly LegendChoiceView[];
}

function scoreValues(
  tracks: readonly TraitTrack[],
  sources?: Partial<Record<TraitAxis, TraitSource>>,
): LegendValues {
  const values: Partial<Record<TraitAxis, number | null>> = {};
  for (const axis of IDENTITY_AXES) {
    values[axis] = traitScore(trackFor(tracks, axis, 'report'), sources?.[axis]);
  }
  return values;
}

/**
 * What the card says.
 *
 * - exact: every name trait is high or low, so the existing 64-name is used.
 * - balanced: the role (core) is settled and a modifier is in the middle.
 *   The title is "Balanced {role}" — no new legend is authored. The flavour
 *   names the two existing legends on either side.
 * - choice: the role itself is in the middle. The two nearest existing
 *   names are offered; until one is picked the title is "Between A and B".
 * - forming: a name trait is still unanswered (unknown, not low) or not
 *   settled. The old filling-in title is used.
 */
export function legendHeadline(
  tracks: readonly TraitTrack[],
  poles: LockedPoles,
  skin: LegendSkin,
  pickedCode?: string | null,
  sources?: Partial<Record<TraitAxis, TraitSource>>,
): LegendHeadline {
  const view = identityView(poles);
  const formingTitle = identityTitle(view, skin);
  if (!isLegendSkin(skin)) {
    return { kind: 'forming', title: formingTitle, flavour: null, choices: [] };
  }
  const unknown = NAME_AXES.some((axis) => poles[axis] == null || poles[axis] === 'U');
  if (unknown) {
    return { kind: 'forming', title: formingTitle, flavour: null, choices: [] };
  }
  const values = scoreValues(tracks, sources);
  const nearest = closestArchetypes(values, poles);
  const choices: LegendChoiceView[] = nearest.flatMap((row) => {
    const title = archetypeName(row.code, skin);
    return title ? [{ code: row.code, title }] : [];
  });
  const coreSettled = CORE_AXES.every((axis) => isLetter(poles[axis]));
  const modifierSettled = MODIFIER_AXES.every((axis) => isLetter(poles[axis]));
  if (coreSettled && modifierSettled) {
    return { kind: 'exact', title: formingTitle, flavour: null, choices: [] };
  }
  const picked = pickedCode ? choices.find((choice) => choice.code === pickedCode) : undefined;
  if (coreSettled && view.coreCode) {
    const role = CORE_ROLES[skin][view.coreCode];
    const title = role ? `Balanced ${role}` : formingTitle;
    const flavour =
      choices.length >= 2 ? `Between ${choices[0]!.title} and ${choices[1]!.title}.` : null;
    if (picked) {
      return { kind: 'balanced', title: picked.title, flavour, choices };
    }
    return { kind: 'balanced', title, flavour, choices };
  }
  const flavour = 'Two names fit. Pick the one that sounds like you.';
  if (picked) return { kind: 'choice', title: picked.title, flavour, choices };
  if (choices.length >= 2) {
    return {
      kind: 'choice',
      title: `Between ${choices[0]!.title} and ${choices[1]!.title}`,
      flavour,
      choices,
    };
  }
  return { kind: 'forming', title: formingTitle, flavour: null, choices: [] };
}

export function identityTraitCount(skin: LegendSkin): number {
  return isThreeWordSkin(skin) ? IDENTITY_AXES.length : CORE_AXES.length + MODIFIER_AXES.length;
}

/** Whether every word of the name in this style is settled. */
export function identityCompleteFor(view: IdentityView, skin: LegendSkin): boolean {
  return view.complete && (!isThreeWordSkin(skin) || view.thirdCode != null);
}

export function identityProgressLine(view: IdentityView, skin: LegendSkin = DEFAULT_LEGEND_SKIN): string | null {
  if (identityCompleteFor(view, skin)) return null;
  const axes = isThreeWordSkin(skin) ? IDENTITY_AXES : [...CORE_AXES, ...MODIFIER_AXES];
  const locked = axes.filter((axis) => view.lockedAxes.includes(axis)).length;
  return `${locked} of ${axes.length} settled. Answer more questions to finish the name.`;
}

/**
 * Leans that are fine to print on an image other people will see. Left out on
 * purpose: both closeness-and-worry axes entirely, and the low side of the
 * axes whose low phrase reads as a struggle ("doubts they can pull a hard
 * thing off"). The card is for showing off, not for disclosure.
 */
const PRIVATE_LEANS: ReadonlySet<string> = new Set([
  'attachment_anxiety:high',
  'attachment_anxiety:low',
  'attachment_avoidance:high',
  'attachment_avoidance:low',
  'steadiness:low',
  'competence:low',
  'self_efficacy:low',
  'growth_mindset:low',
  'locus_of_control:low',
]);

export function isShareableLean(axis: TraitAxis, lean: TraitLean): boolean {
  return !PRIVATE_LEANS.has(`${axis}:${lean}`);
}

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The strongest shareable leans as short phrases, strongest first. */
export function topTraitPhrases(tracks: readonly TraitTrack[], count = 3): string[] {
  const rows: { strength: number; phrase: string }[] = [];
  for (const axis of TRAIT_AXES) {
    const row = trackFor(tracks, axis, 'report');
    if (!row || row.answerCount < LABEL_MIN_ANSWERS || !Number.isFinite(row.value)) continue;
    const score = traitScore(row);
    if (score == null) continue;
    const strength = Math.abs(score - 0.5);
    if (strength < 0.1) continue;
    const lean: TraitLean = score >= 0.5 ? 'high' : 'low';
    if (!isShareableLean(axis, lean)) continue;
    rows.push({ strength, phrase: sentenceCase(TRAIT_BAND_PHRASES[axis][lean]) });
  }
  return rows
    .sort((a, b) => b.strength - a.strength)
    .slice(0, count)
    .map((row) => row.phrase);
}

export const SKIN_LABEL: Record<LegendSkin, string> = {
  primal: 'Primal Genius',
  highFantasy: 'High Fantasy',
  corporate: 'Corporate Realist',
  oxymoron: 'Oxymoron',
  gaming: 'Gaming',
  godType: 'Mythic',
  anime: 'Anime',
  funny: 'Funny',
  dark: 'Dark',
};
