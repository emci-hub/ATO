export type TalkStyle = 'quiet' | 'even' | 'loud';

/** How today reads, in Sage's register: a win, a nothing-day, or a skipped habit. */
export type Tone = 'lift' | 'even' | 'cut';

/** Where a card's content came from. 'crisis' is the static crisis card. */
export type VoiceSource = 'bank' | 'generated' | 'crisis';

export type ProviderId = 'gemini' | 'local';

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
 *  router is unit-testable in Node. */
export interface VoiceMe {
  name: string;
  show_up: string;
  talk_style: TalkStyle;
  knocks_you_off: string;
  morning_cue: string;
  evening_wind_down?: string | null;
  energy_pattern?: 'morning' | 'afternoon' | 'evening' | 'night_owl' | null;
  recovery_style?: 'movement' | 'sleep' | 'talking' | 'alone_time' | 'music' | null;
  support_style?: 'nudge' | 'space' | 'listen' | 'plan' | null;
  current_focus?: 'habit' | 'through_it' | 'like_yourself' | 'show_up' | null;
  openness?: number | null;
  conscientiousness?: number | null;
  extraversion?: number | null;
  agreeableness?: number | null;
  steadiness?: number | null;
  attachment_anxiety?: number | null;
  attachment_avoidance?: number | null;
  conflict_assertiveness?: number | null;
  conflict_cooperativeness?: number | null;
  /** Facts they asked Sage to remember. Nudge signal + optional Home-card angle. Never talk_style. */
  facts?: string[];
}

export interface RouteVoiceCardInput {
  me: VoiceMe;
  /** Number of checks logged so far (done + skipped). Day = checkCount + 1 unless `day` is set. */
  checkCount: number;
  /**
   * Calendar journey day this card is for. Defaults to checkCount + 1.
   * Pass this when backfilling a missed day so the bank/generated copy
   * matches that day, not the next sequential stall-day.
   */
  day?: number;
  /** Completed checks, oldest first. */
  history: CheckHistory[];
  /** If set, no cut may be shown today (Sage rule: no cut after crisis). */
  crisisToday?: boolean;
  /**
   * AI consent gate (Apple 5.1.2). The router never calls a model unless this
   * is true. null → never asked (result.consent = 'pending'). false → bank
   * content only forever (result.consent = 'denied').
   */
  aiConsent?: boolean | null;
  /**
   * Crisis short-circuit (plan: crisis spec). When true the router returns a
   * static crisis result and never touches a provider. Computed by the caller
   * via detectCrisis() before calling this router.
   */
  crisisDetected?: boolean;
  /** Previous local calendar day logged a crisis flag — Nudge stays empty. */
  crisisYesterday?: boolean;
}

/**
 * Dev-only provenance, so a developer can confirm content came from
 * first_cards.md rather than a model call (specifically for check_count < 2).
 */
export interface DevTrace {
  fromBankFile: boolean;
  fromModel: boolean;
  providerLabel: string;
  checkCount: number;
}

export interface VoiceCardResult {
  /** 'card' = normal read/do; 'crisis' = static crisis card, no model involved. */
  kind: 'card' | 'crisis';
  /** null means every candidate was dropped — nothing is shown. */
  card: VoiceCard | null;
  /** 1-based day this card is for. */
  day: number;
  tone: Tone;
  source: VoiceSource;
  provider: ProviderId | null;
  dropped: DropReason[];
  /**
   * What the consent gate resolved to for this call. 'pending' means the router
   * refused to call a model because consent hasn't been asked yet — the caller
   * must surface the consent prompt before any model call may happen.
   */
  consent: 'granted' | 'denied' | 'pending';
  /** Home-only. Null when gates fail or there is no real signal. */
  nudge: string | null;
  dev?: DevTrace;
}
