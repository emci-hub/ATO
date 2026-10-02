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
import { CORE_AXES, MODIFIER_AXES, type Pole } from '@/lib/legends64/classify';
import {
  CORE_ROLES,
  MODIFIER_DESCRIPTORS,
  isLegendSkin,
  type LegendSkin,
} from '@/lib/legends64/archetypes';
import { TRAIT_BAND_PHRASES } from '@/lib/trait-bands';
import { isAxisSettled, trackFor, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis, type TraitLean } from '@/lib/traits';

export const IDENTITY_AXES: readonly TraitAxis[] = [...CORE_AXES, ...MODIFIER_AXES];
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
  complete: boolean;
}

export function identityView(poles: LockedPoles): IdentityView {
  const coreCode = codeFor(poles, CORE_AXES);
  const modifierCode = codeFor(poles, MODIFIER_AXES);
  return {
    lockedCount: IDENTITY_AXES.filter((axis) => poles[axis]).length,
    total: IDENTITY_AXES.length,
    coreCode,
    modifierCode,
    complete: coreCode != null && modifierCode != null,
  };
}

export const IDENTITY_FORMING_TITLE = 'Still forming';

/**
 * "People-First Founder" once all six are locked. With only one half locked it
 * shows that half and an ellipsis for the other, so the name visibly fills in.
 */
export function identityTitle(view: IdentityView, skin: LegendSkin): string {
  if (!isLegendSkin(skin)) return IDENTITY_FORMING_TITLE;
  const role = view.coreCode ? CORE_ROLES[skin][view.coreCode] : null;
  const descriptor = view.modifierCode ? MODIFIER_DESCRIPTORS[skin][view.modifierCode] : null;
  if (descriptor && role) return `${descriptor} ${role}`;
  if (role) return `… ${role}`;
  if (descriptor) return `${descriptor} …`;
  return IDENTITY_FORMING_TITLE;
}

export function identityProgressLine(view: IdentityView): string | null {
  if (view.complete) return null;
  return `${view.lockedCount} of ${view.total} settled. Answer more questions to finish the name.`;
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
  real: 'Plain',
  gaming: 'Gaming',
  godType: 'Mythic',
  anime: 'Anime',
  funny: 'Funny',
  dark: 'Dark',
};
