import { findNudgeSignal } from '@/lib/voice/nudge';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
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

/**
 * 2–3 traits only when a recent signal ties at least one filled axis.
 * No signal → one filled trait, or the 9 chips. Never a combo from unused axes.
 */
export function pickExploreFocus(me: VoiceMe, history: CheckHistory[]): ExploreFocus {
  const filled = filledAxes(me);
  const chips = namedChips(me);
  const signal = exploreSignalFromNudge({
    knocksYouOff: me.knocks_you_off,
    facts: me.facts ?? [],
    history,
  });

  if (!signal) {
    if (filled.length > 0) return { traits: [filled[0]!], chips: [], signal: null };
    return { traits: [], chips, signal: null };
  }

  const tied = tiedToSignal(signal, filled);
  if (tied.length === 0) {
    if (filled.length > 0) return { traits: [filled[0]!], chips: [], signal };
    return { traits: [], chips, signal };
  }

  const extras = filled.filter((axis) => !tied.includes(axis));
  const combo = dropsAgencyTriple([...tied, ...extras]);
  return { traits: combo, chips: [], signal };
}

/** Three focuses for one pack: rotate extras; each combo still signal-tied. */
export function pickExplorePackFocuses(me: VoiceMe, history: CheckHistory[]): ExploreFocus[] {
  const base = pickExploreFocus(me, history);
  if (!base.signal || base.traits.length < 2) {
    if (base.traits.length !== 1) return [base];
    const singles: ExploreFocus[] = [base];
    for (const axis of filledAxes(me)) {
      if (axis === base.traits[0]) continue;
      singles.push({ traits: [axis], chips: [], signal: null });
      if (singles.length >= 3) break;
    }
    return singles;
  }

  const filled = filledAxes(me);
  const tied = tiedToSignal(base.signal, filled);
  const extras = filled.filter((axis) => !tied.includes(axis));
  const focuses: ExploreFocus[] = [base];
  for (let i = 0; i < extras.length && focuses.length < 3; i += 1) {
    const combo = dropsAgencyTriple([tied[0]!, extras[i]!]);
    if (combo.length >= 2) {
      focuses.push({ traits: combo, chips: [], signal: base.signal });
    }
  }
  return focuses.slice(0, 3);
}

export function exploreFingerprint(
  me: VoiceMe,
  history: CheckHistory[],
  traitTouchedAt?: Record<string, string>,
): string {
  const facts = (me.facts ?? []).map((fact) => fact.trim()).filter(Boolean).join('|');
  const skips = history.slice(-7).filter((row) => row.status === 'skipped').length;
  const touched = Object.keys(traitTouchedAt ?? {})
    .sort()
    .map((key) => `${key}:${traitTouchedAt?.[key] ?? ''}`)
    .join('|');
  return `${facts}::${me.knocks_you_off}::${skips}::${touched}`;
}
