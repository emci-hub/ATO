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
 *    crosses the middle by POLE_FLIP_MARGIN. Without this, one answer near the
 *    middle would rename the person from one day to the next.
 */
import { CORE_AXES, MODIFIER_AXES, THIRD_AXES, type Pole } from '@/lib/legends64/classify';
import {
  CORE_ROLES,
  DEFAULT_LEGEND_SKIN,
  MODIFIER_DESCRIPTORS,
  THIRD_WORDS,
  composeName,
  isLegendSkin,
  isThreeWordSkin,
  type LegendSkin,
} from '@/lib/legends64/archetypes';
import { TRAIT_BAND_PHRASES } from '@/lib/trait-bands';
import { isAxisSettled, trackFor, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis, type TraitLean } from '@/lib/traits';

export const IDENTITY_AXES: readonly TraitAxis[] = [...CORE_AXES, ...MODIFIER_AXES, ...THIRD_AXES];
export const POLE_FLIP_MARGIN = 0.05;

export type LockedPoles = Partial<Record<TraitAxis, Pole>>;

function poleWithMemory(value: number, previous: Pole | undefined): Pole {
  if (!previous) return value >= 0.5 ? 'H' : 'L';
  if (previous === 'H') return value < 0.5 - POLE_FLIP_MARGIN ? 'L' : 'H';
  return value >= 0.5 + POLE_FLIP_MARGIN ? 'H' : 'L';
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
): LockedPoles {
  const out: LockedPoles = {};
  for (const axis of IDENTITY_AXES) {
    const row = trackFor(tracks, axis, 'report');
    if (row && isAxisSettled(row, now) && Number.isFinite(row.value)) {
      out[axis] = poleWithMemory(row.value, previous[axis]);
    } else if (previous[axis]) {
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
  return letters.every(Boolean) ? letters.join('') : null;
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
    lockedCount: IDENTITY_AXES.filter((axis) => poles[axis]).length,
    lockedAxes: IDENTITY_AXES.filter((axis) => poles[axis]),
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
 * "Warm Ringmaster" / "Hungry Warm Ringmaster" once every word is locked.
 * Until then each missing stretch shows as one "…", so the name visibly
 * fills in ("… Ringmaster", never "… … Ringmaster").
 */
export function identityTitle(view: IdentityView, skin: LegendSkin): string {
  if (!isLegendSkin(skin)) return IDENTITY_FORMING_TITLE;
  const role = view.coreCode ? CORE_ROLES[skin][view.coreCode] : null;
  const descriptor = view.modifierCode ? MODIFIER_DESCRIPTORS[skin][view.modifierCode] : null;
  const third = view.thirdCode ? (THIRD_WORDS[skin]?.[view.thirdCode] ?? null) : null;
  if (!role && !descriptor && !third) return IDENTITY_FORMING_TITLE;
  // Each unsettled word shows as "…", so the name visibly fills in.
  return composeName(skin, { third, descriptor, role })
    .map((part) => part ?? '…')
    .filter((part, i, all) => !(part === '…' && all[i - 1] === '…'))
    .join(' ');
}

/** How many traits a style's name is made from: 9 for three words, 6 for two. */
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
    if (!row || row.answerCount < 1 || !Number.isFinite(row.value)) continue;
    const strength = Math.abs(row.value - 0.5);
    if (strength < 0.1) continue;
    const lean: TraitLean = row.value >= 0.5 ? 'high' : 'low';
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
