import type { TraitAxis } from '@/lib/traits';
import type { CheckHistory, VoiceMe } from '@/lib/voice/types';

export const EXPLORE_CORE_CHIPS = [
  'talk_style',
  'show_up',
  'knocks_you_off',
  'morning_cue',
  'evening_wind_down',
  'energy_pattern',
  'recovery_style',
  'support_style',
  'current_focus',
] as const;

export type ExploreChip = (typeof EXPLORE_CORE_CHIPS)[number];

export type ExploreSignalKind = 'fact' | 'knock' | 'check';

export type ExploreTrigger = 'first' | 'weekly' | 'signal';

export interface ExploreSignal {
  kind: ExploreSignalKind;
  detail: string;
}

export interface ExploreFocus {
  /** 1 trait with no signal; 2–3 only when a signal ties at least one. */
  traits: TraitAxis[];
  /** 9-core chips when no filled axis is available. */
  chips: ExploreChip[];
  signal: ExploreSignal | null;
}

export interface ExploreDraft {
  body: string;
  traits: TraitAxis[];
  chips: ExploreChip[];
  signalKind: ExploreSignalKind | null;
}

export interface ExploreEntryRow {
  id: string;
  packId: string;
  sortIndex: number;
  body: string;
  traits: string[];
  chips: string[];
  signalKind: ExploreSignalKind | null;
  landed: boolean | null;
}

export interface ExplorePackRow {
  id: string;
  generatedOn: string;
  trigger: ExploreTrigger;
  fingerprint: string;
  createdAt: string;
  entries: ExploreEntryRow[];
}

export interface ExploreMeSlice extends VoiceMe {
  timezone: string;
  traitTouchedAt?: Record<string, string>;
}

export interface RouteExploreInput {
  me: ExploreMeSlice;
  history: CheckHistory[];
  aiConsent?: boolean | null;
  crisisToday?: boolean;
  now?: Date;
}

export type ExploreKind =
  | 'pack'
  | 'cached'
  | 'consent-pending'
  | 'consent-denied'
  | 'crisis'
  | 'quota'
  | 'empty';

export interface RouteExploreResult {
  kind: ExploreKind;
  pack: ExplorePackRow | null;
  trigger?: ExploreTrigger;
}
