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
  | 'vague-do'
  | 'cruel-cut'
  | 'cut-after-crisis'
  | 'cut-streak';

export interface VoiceCard {
  read: string;
  do: string;
}

/** A previously logged check, as the router sees it. Oldest first. */
export interface CheckHistory {
  day: number;
  status: CheckStatus;
  read?: string;
  do?: string;
  source?: VoiceSource;
}

/** The slice of `me` the router needs. Kept free of Supabase/RN imports so the
 *  router is unit-testable in Node. */
export interface VoiceMe {
  name: string;
  show_up: string;
  talk_style: TalkStyle;
  knocks_you_off: string;
  morning_cue: string;
}

export interface RouteVoiceCardInput {
  me: VoiceMe;
  /** Number of checks logged so far (done + skipped). Day = checkCount + 1. */
  checkCount: number;
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
  dev?: DevTrace;
}
