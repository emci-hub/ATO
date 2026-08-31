import { categoriesFingerprint, categoryById, readyCategories, type CategoryId } from '@/lib/categories';
import { findNudgeSignal } from '@/lib/voice/nudge';
import { topicalOverlap } from '@/lib/voice/filters';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import type { TraitTrack } from '@/lib/trait-stability';
import type { CheckHistory, VoiceMe } from '@/lib/voice/types';

import {
  EXPLORE_CORE_CHIPS,
  type ExploreChip,
  type ExploreFocus,
  type ExploreSignal,
} from './types';

export const AGENCY_AXES: readonly TraitAxis[] = [
  'growth_mindset',
  'locus_of_control',
  'self_efficacy',
];

const KNOCK_TRAITS: Record<string, TraitAxis[]> = {
  sleep: ['steadiness'],
  workload: ['conscientiousness', 'competence'],
  'people/conflict': [
    'conflict_assertiveness',
    'conflict_cooperativeness',
    'agreeableness',
    'attachment_anxiety',
    'attachment_avoidance',
  ],
  health: ['steadiness'],
  money: ['conscientiousness'],
};

function filledAxes(me: VoiceMe): TraitAxis[] {
  return TRAIT_AXES.filter((axis) => typeof me[axis] === 'number');
}

export function dropsAgencyTriple(traits: readonly TraitAxis[]): TraitAxis[] {
  const seen = new Set<TraitAxis>();
  const next: TraitAxis[] = [];
  for (const axis of traits) {
    if (seen.has(axis)) continue;
    seen.add(axis);
    next.push(axis);
  }
  const agency = next.filter((axis) => AGENCY_AXES.includes(axis));
  if (agency.length < 3) return next.slice(0, 3);
  const drop = agency[2]!;
  return next.filter((axis) => axis !== drop).slice(0, 3);
}

function namedChips(me: VoiceMe): ExploreChip[] {
  return EXPLORE_CORE_CHIPS.filter((chip) => {
    const value = me[chip];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

export function exploreSignalFromNudge(input: {
  knocksYouOff: string;
  facts: string[];
  history: CheckHistory[];
}): ExploreSignal | null {
  const raw = findNudgeSignal(input);
  if (!raw) return null;
  if (raw.kind === 'skip-pattern') return { kind: 'check', detail: raw.detail };
  if (raw.kind === 'knock') return { kind: 'knock', detail: raw.detail };
  return { kind: 'fact', detail: raw.detail };
}

function tiedToSignal(signal: ExploreSignal, filled: TraitAxis[]): TraitAxis[] {
  if (signal.kind === 'check') {
    return filled.filter(
      (axis) =>
        axis === 'conscientiousness' ||
        axis === 'growth_mindset' ||
        axis === 'self_efficacy',
    );
  }
  if (signal.kind === 'knock') {
    const mapped = KNOCK_TRAITS[signal.detail] ?? [];
    return filled.filter((axis) => mapped.includes(axis));
  }
  const text = signal.detail.toLowerCase();
  const hits: TraitAxis[] = [];
  if (/sleep|tired|night/.test(text) && filled.includes('steadiness')) hits.push('steadiness');
  if (/work|pile|deadline/.test(text)) {
    for (const axis of ['conscientiousness', 'competence'] as const) {
      if (filled.includes(axis)) hits.push(axis);
    }
  }
  if (/text|people|conflict|fight/.test(text)) {
    for (const axis of [
      'attachment_avoidance',
      'attachment_anxiety',
      'conflict_cooperativeness',
      'agreeableness',
    ] as const) {
      if (filled.includes(axis)) hits.push(axis);
    }
  }
  return hits;
}

function readyIds(tracks: readonly TraitTrack[] | undefined): CategoryId[] {
  if (!tracks || tracks.length === 0) return [];
  return readyCategories(tracks).map((row) => row.def.id);
}

function categoriesTiedToSignal(
  signal: ExploreSignal,
  filled: TraitAxis[],
  ready: readonly CategoryId[],
): CategoryId[] {
  const tiedAxes = tiedToSignal(signal, filled);
  const out: CategoryId[] = [];
  for (const id of ready) {
    const def = categoryById(id);
    if (!def) continue;
    if (def.axes.some((axis) => tiedAxes.includes(axis))) out.push(id);
  }
  return out;
}

function emptyFocus(
  chips: ExploreChip[],
  signal: ExploreSignal | null,
  pinnedLines: string[],
): ExploreFocus {
  return { traits: [], chips, categories: [], signal, pinnedLines };
}

function categoryFocus(
  categories: CategoryId[],
  signal: ExploreSignal | null,
  pinnedLines: string[],
): ExploreFocus {
  return { traits: [], chips: [], categories, signal, pinnedLines };
}

/**
 * Categories when any are ready. At most 2, and only when a recent signal
 * ties both — never a default habit. No ready category → chips or one trait.
 * Agency-triple (GM+LC+SE as three raw axes) is still dropped if traits leak.
 */
export function pickExploreFocus(
  me: VoiceMe,
  history: CheckHistory[],
  input: { tracks?: readonly TraitTrack[]; pinnedLines?: string[] } = {},
): ExploreFocus {
  const filled = filledAxes(me);
  const chips = namedChips(me);
  const pinnedLines = input.pinnedLines ?? [];
  const ready = readyIds(input.tracks);
  const signal = exploreSignalFromNudge({
    knocksYouOff: me.knocks_you_off,
    facts: me.facts ?? [],
    history,
  });

  if (ready.length > 0) {
    if (!signal) {
      return categoryFocus([ready[0]!], null, pinnedLines);
    }
    const tied = categoriesTiedToSignal(signal, filled, ready);
    if (tied.length >= 2) {
      return categoryFocus(tied.slice(0, 2), signal, pinnedLines);
    }
    if (tied.length === 1) {
      return categoryFocus([tied[0]!], signal, pinnedLines);
    }
    return categoryFocus([ready[0]!], signal, pinnedLines);
  }

  if (!signal) {
    if (filled.length > 0) {
      return {
        traits: dropsAgencyTriple([filled[0]!]),
        chips: [],
        categories: [],
        signal: null,
        pinnedLines,
      };
    }
    return emptyFocus(chips, null, pinnedLines);
  }

  const tied = tiedToSignal(signal, filled);
  if (tied.length === 0) {
    if (filled.length > 0) {
      return {
        traits: dropsAgencyTriple([filled[0]!]),
        chips: [],
        categories: [],
        signal,
        pinnedLines,
      };
    }
    return emptyFocus(chips, signal, pinnedLines);
  }

  return {
    traits: dropsAgencyTriple([tied[0]!]),
    chips: [],
    categories: [],
    signal,
    pinnedLines,
  };
}

/** Three focuses for one pack: rotate ready categories; each combo still signal-tied. */
export function pickExplorePackFocuses(
  me: VoiceMe,
  history: CheckHistory[],
  input: { tracks?: readonly TraitTrack[]; pinnedLines?: string[] } = {},
): ExploreFocus[] {
  const base = pickExploreFocus(me, history, input);
  const ready = readyIds(input.tracks);
  if (ready.length > 0) {
    const used = new Set(base.categories);
    const focuses: ExploreFocus[] = [base];
    for (const id of ready) {
      if (used.has(id)) continue;
      focuses.push(categoryFocus([id], base.signal, input.pinnedLines ?? []));
      if (focuses.length >= 3) break;
    }
    return focuses;
  }

  if (base.traits.length !== 1) return [base];
  const singles: ExploreFocus[] = [base];
  for (const axis of filledAxes(me)) {
    if (axis === base.traits[0]) continue;
    singles.push({
      traits: dropsAgencyTriple([axis]),
      chips: [],
      categories: [],
      signal: null,
      pinnedLines: input.pinnedLines ?? [],
    });
    if (singles.length >= 3) break;
  }
  return singles;
}

export function exploreFingerprint(
  me: VoiceMe,
  history: CheckHistory[],
  traitTouchedAt?: Record<string, string>,
  tracks?: readonly TraitTrack[],
): string {
  const facts = (me.facts ?? []).map((fact) => fact.trim()).filter(Boolean).join('|');
  const skips = history.slice(-7).filter((row) => row.status === 'skipped').length;
  const touched = Object.keys(traitTouchedAt ?? {})
    .sort()
    .map((key) => `${key}:${traitTouchedAt?.[key] ?? ''}`)
    .join('|');
  const cats = tracks ? categoriesFingerprint(tracks) : '';
  return `${facts}::${me.knocks_you_off}::${skips}::${touched}::${cats}`;
}

const PINNED_REPEAT_THRESHOLD = 0.5;

/** True when the observation restates the pinned Categories card from today. */
export function repeatsPinnedCategories(body: string, pinnedLines: readonly string[]): boolean {
  if (!body.trim() || pinnedLines.length === 0) return false;
  return pinnedLines.some((line) => line.trim() && topicalOverlap(body, line) >= PINNED_REPEAT_THRESHOLD);
}
