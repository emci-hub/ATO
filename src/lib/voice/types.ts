import type { VoicePreset } from './preset';
import type { TraitAxis } from '@/lib/traits';
import type { TraitTrack } from '@/lib/trait-stability';
import type { AiProviderId } from '@/lib/ai/types';

export type TalkStyle = 'quiet' | 'even' | 'loud';

/** How today reads, in Sage's register: a win, a nothing-day, or a skipped habit. */
export type Tone = 'lift' | 'even' | 'cut';

/** Where a card's content came from. 'crisis' is the static crisis card. */
export type VoiceSource = 'bank' | 'generated' | 'crisis';

export type ProviderId = AiProviderId;

export type CheckStatus = 'done' | 'skipped';

/** Why a generated card was dropped before it could be shown. */
export type DropReason =
  | 'repeat'
  | 'topic-repeat'
  | 'vague-do'
  | 'cruel-cut'
  | 'cut-after-crisis'
  | 'cut-streak'
  | 'framework-echo';

export interface VoiceCard {
  read: string;
  do: string;
  /** Home-only Nudge. Null/absent when the slot is empty. Never sent to widget/push/Circle. */
  nudge?: string | null;
}

/** A previously logged check, as the router sees it. Oldest first. */
export interface CheckHistory {
  day: number;
  status: CheckStatus;
  read?: string;
  do?: string;
  source?: VoiceSource;
  /** Yesterday's Nudge, for the two-days-in-a-row gate. */
  nudge?: string;
}

/** The slice of `me` the router needs. Kept free of Supabase/RN imports so the
 *  router is unit-testable in Node. Trait numbers come from TRAIT_AXES. */
export type VoiceMe = {
  name: string;
  show_up: string;
  talk_style: TalkStyle;
  knocks_you_off: string;
  morning_cue: string;
  evening_wind_down?: string | null;
  energy_pattern?: 'morning' | 'afternoon' | 'evening' | 'night_owl' | null;
  support_style?: 'nudge' | 'space' | 'listen' | 'plan' | null;
  current_focus?: 'habit' | 'through_it' | 'like_yourself' | 'show_up' | null;
  voice_preset?: VoicePreset | null;
  /** Facts they asked Sage to remember. Nudge signal + optional Home-card angle. Never talk_style. */
  facts?: string[];
} & Partial<Record<TraitAxis, number | null>>;
